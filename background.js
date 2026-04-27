// Background service worker
// Handles cross-origin image fetching with proper Referer header
// (host_permissions in manifest allow CORS bypass for WeChat CDN domains)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FETCH_IMAGE') {
    fetchImage(message.url)
      .then(base64 => sendResponse({ success: true, base64 }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.action === 'FETCH_IMAGES_BATCH') {
    fetchImagesBatch(message.images)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
});

async function fetchImage(url) {
  const response = await fetch(url, {
    referrer: 'https://mp.weixin.qq.com/',
    referrerPolicy: 'unsafe-url',
    headers: {
      'Accept': 'image/*,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchImagesBatch(images) {
  const results = [];
  for (const img of images) {
    try {
      const base64 = await fetchImage(img.url);
      results.push({ filename: img.filename, base64, success: true });
    } catch (err) {
      results.push({ filename: img.filename, success: false, error: err.message });
    }
  }
  return results;
}
