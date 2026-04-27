/* global TurndownService, JSZip */

let currentArticle = null;

document.addEventListener('DOMContentLoaded', async () => {
  const notWechat = document.getElementById('not-wechat');
  const mainPanel = document.getElementById('main-panel');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('mp.weixin.qq.com')) {
      notWechat.classList.remove('hidden');
      return;
    }
    mainPanel.classList.remove('hidden');

    // Ensure content script is injected (handles pages opened before extension install)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (_) {
      // Already injected or no permission — that's fine
    }

    // Try to extract article metadata for preview
    const response = await sendToContent(tab.id, { action: 'EXTRACT_ARTICLE' });
    if (response && response.success) {
      currentArticle = response.data;
      document.getElementById('article-title').textContent = response.data.title || '(无标题)';
      const meta = [response.data.author, response.data.publishTime].filter(Boolean).join(' · ');
      document.getElementById('article-meta').textContent = meta;
    }
  } catch (err) {
    notWechat.classList.remove('hidden');
  }

  document.getElementById('convert-btn').addEventListener('click', onConvertClick);
});

async function onConvertClick() {
  const btn = document.getElementById('convert-btn');
  const btnText = document.getElementById('btn-text');
  const includeImages = document.getElementById('include-images').checked;

  btn.disabled = true;
  hideStatus();
  showProgress(0, '提取文章内容...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Re-extract in case page changed
    const extractResp = await sendToContent(tab.id, { action: 'EXTRACT_ARTICLE' });
    if (!extractResp || !extractResp.success) {
      throw new Error(extractResp?.error || '无法提取文章内容');
    }

    const article = extractResp.data;
    currentArticle = article;

    showProgress(20, '转换为 Markdown...');
    const markdown = convertToMarkdown(article);

    if (!includeImages || article.images.length === 0) {
      // Download .md only
      showProgress(80, '生成文件...');
      downloadMarkdown(article.title, markdown);
      showProgress(100, '完成');
      showStatus('success', `已下载：${sanitizeFilename(article.title)}.md`);
    } else {
      // Download as ZIP with images
      showProgress(30, `下载图片 (共 ${article.images.length} 张)...`);

      const imageResults = await fetchImagesViaBackground(article.images, (done, total) => {
        const pct = 30 + Math.floor((done / total) * 50);
        showProgress(pct, `下载图片 ${done}/${total}...`);
      });

      showProgress(85, '打包 ZIP...');
      const zip = new JSZip();
      const safeTitle = sanitizeFilename(article.title);
      zip.file(`${safeTitle}.md`, markdown);

      const imgFolder = zip.folder('images');
      let downloaded = 0;
      for (const result of imageResults) {
        if (result.success && result.base64) {
          imgFolder.file(result.filename, result.base64, { base64: true });
          downloaded++;
        }
      }

      showProgress(95, '生成 ZIP 文件...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      downloadBlob(blob, `${safeTitle}.zip`);

      showProgress(100, '完成');
      const skipped = article.images.length - downloaded;
      const msg = skipped > 0
        ? `已下载：${safeTitle}.zip（${downloaded} 张图片，${skipped} 张失败）`
        : `已下载：${safeTitle}.zip（含 ${downloaded} 张图片）`;
      showStatus('success', msg);
    }
  } catch (err) {
    showStatus('error', `错误：${err.message}`);
    hideProgress();
  } finally {
    btn.disabled = false;
    btnText.textContent = '转换并下载';
  }
}

// ─── Markdown conversion ────────────────────────────────────────────────────

function convertToMarkdown(article) {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  // WeChat uses <section> and <p> as block containers — ensure they become paragraphs
  td.addRule('wechatBlocks', {
    filter: ['section', 'p'],
    replacement(content) {
      const trimmed = content.trim();
      return trimmed ? `\n\n${trimmed}\n\n` : '';
    }
  });

  // Trim whitespace inside bold markers to avoid `** text **` artifacts
  td.addRule('strongFix', {
    filter: ['strong', 'b'],
    replacement(content) {
      const trimmed = content.trim();
      return trimmed ? `**${trimmed}**` : '';
    }
  });

  // Trim whitespace inside italic markers
  td.addRule('emFix', {
    filter: ['em', 'i'],
    replacement(content) {
      const trimmed = content.trim();
      return trimmed ? `*${trimmed}*` : '';
    }
  });

  // Fenced code blocks with language detection
  td.addRule('codeBlocks', {
    filter(node) {
      return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
    },
    replacement(content, node) {
      const codeEl = node.firstChild;
      const langClass = codeEl.className || '';
      const langMatch = langClass.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';
      const code = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
    }
  });

  // Images already have rewritten src (./images/xxx.jpg)
  td.addRule('images', {
    filter: 'img',
    replacement(content, node) {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      return src ? `![${alt}](${src})` : '';
    }
  });

  let body = td.turndown(article.contentHtml);

  // Collapse 3+ consecutive blank lines to 2
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  // Build final markdown with header
  const lines = [];
  lines.push(`# ${article.title}`);
  lines.push('');
  if (article.author) lines.push(`> 作者：${article.author}`);
  if (article.publishTime) lines.push(`> 发布时间：${article.publishTime}`);
  if (article.url) lines.push(`> 原文：${article.url}`);
  if (article.author || article.publishTime || article.url) lines.push('');
  lines.push(body);

  return lines.join('\n');
}

// ─── Image fetching ──────────────────────────────────────────────────────────

async function fetchImagesViaBackground(images, onProgress) {
  const results = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_IMAGE',
        url: img.url
      });
      results.push({
        filename: img.filename,
        base64: response.success ? response.base64 : null,
        success: response.success
      });
    } catch (_) {
      results.push({ filename: img.filename, success: false });
    }
    if (onProgress) onProgress(i + 1, images.length);
  }
  return results;
}

// ─── Download helpers ────────────────────────────────────────────────────────

function downloadMarkdown(title, markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFilename(title)}.md`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sanitizeFilename(name) {
  return (name || 'article')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'article';
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function showProgress(pct, label) {
  document.getElementById('progress-section').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-label').textContent = label;
}

function hideProgress() {
  document.getElementById('progress-section').classList.add('hidden');
}

function showStatus(type, msg) {
  const el = document.getElementById('status-msg');
  el.className = `status-msg ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideStatus() {
  document.getElementById('status-msg').classList.add('hidden');
}

// ─── Messaging ───────────────────────────────────────────────────────────────

function sendToContent(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}
