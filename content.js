// Guard against double injection
if (!window.__wechatClipperInjected) {
  window.__wechatClipperInjected = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_ARTICLE') {
      try {
        const data = extractArticle();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false; // synchronous response
    }
    return false;
  });
}

function extractArticle() {
  const contentEl = document.querySelector('#js_content');
  if (!contentEl) {
    throw new Error('未找到文章内容，请确认当前页面是微信公众号文章');
  }

  // Extract metadata
  const titleEl = document.querySelector('#activity-name');
  const authorEl = document.querySelector('#js_name');
  const timeEl = document.querySelector('#publish_time');

  const title = titleEl ? titleEl.textContent.trim() : document.title.trim();
  const author = authorEl ? authorEl.textContent.trim() : '';
  const publishTime = timeEl ? timeEl.textContent.trim() : '';

  // Clone to avoid mutating live DOM
  const content = contentEl.cloneNode(true);

  // Process images: collect URLs and rewrite src
  const images = [];
  content.querySelectorAll('img').forEach((img, index) => {
    const originalUrl = img.dataset.src || img.getAttribute('src') || '';
    if (originalUrl && !originalUrl.startsWith('data:')) {
      const ext = guessImageExt(originalUrl);
      const filename = `image_${String(index + 1).padStart(3, '0')}${ext}`;
      images.push({ url: originalUrl, filename });
      img.setAttribute('src', `./images/${filename}`);
      img.removeAttribute('data-src');
    } else {
      img.remove();
    }
  });

  // Remove WeChat-specific elements that don't belong in markdown
  content.querySelectorAll(
    '.rich_media_tool, .rich_media_area_extra, #js_tags_preview_toast, .weui-loadmore'
  ).forEach(el => el.remove());

  // Clean noisy attributes from all elements
  content.querySelectorAll('*').forEach(el => {
    el.removeAttribute('data-src');
    el.removeAttribute('data-ratio');
    el.removeAttribute('data-w');
    el.removeAttribute('data-tools');
    el.removeAttribute('data-type');
    el.removeAttribute('data-fail');
    el.removeAttribute('data-imgfileid');
    el.removeAttribute('data-cropselx1');
    el.removeAttribute('data-cropselx2');
    el.removeAttribute('data-cropsely1');
    el.removeAttribute('data-cropsely2');
  });

  // Normalize code blocks: <pre class="prettyprint"> → <pre><code class="language-X">
  content.querySelectorAll('pre').forEach(pre => {
    const codeEl = pre.querySelector('code') || pre;
    const classAttr = (pre.className || '') + ' ' + (codeEl.className || '');
    const langMatch = classAttr.match(/language-(\w+)|lang-(\w+)|prettyprint\s+(\w+)/);
    const lang = langMatch ? (langMatch[1] || langMatch[2] || langMatch[3] || '') : '';
    const codeText = codeEl.textContent;
    const newPre = document.createElement('pre');
    const newCode = document.createElement('code');
    if (lang) newCode.className = `language-${lang}`;
    newCode.textContent = codeText;
    newPre.appendChild(newCode);
    pre.replaceWith(newPre);
  });

  // Rewrite blockquote-style digest sections
  content.querySelectorAll('.js_blockquote_digest, .blockquote_digest').forEach(el => {
    const bq = document.createElement('blockquote');
    bq.innerHTML = el.innerHTML;
    el.replaceWith(bq);
  });

  return {
    title,
    author,
    publishTime,
    contentHtml: content.innerHTML,
    images,
    url: window.location.href
  };
}

function guessImageExt(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpe?g|png|gif|webp|svg)(\?|$)/i);
    if (match) return '.' + match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch (_) {
    // ignore
  }
  // WeChat CDN images are typically JPEG
  return '.jpg';
}
