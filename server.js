const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 8000;

const MIMES = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
};

const CSS_PATCH = `
  /* AGGRESSIVE UI FIXES V3 */
  
  /* Force all button-like containers to expand to content */
  [data-framer-name*="Button"], 
  [class*="Button"], 
  [class*="css-pygw6r"], 
  [class*="css-ss6j61"], 
  [class*="css-ty29eb"], 
  [class*="css-v73i46"], 
  [class*="css-i5i15q"],
  [class*="css-vkpzlc"] {
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
    white-space: nowrap !important;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: visible !important;
    flex-shrink: 0 !important;
  }
  
  /* Target the text nodes specifically - prevent ANY wrapping */
  [data-framer-name*="Button"] p, 
  [class*="Button"] p, 
  [class*="textContents"] p, 
  .framer-text p,
  [class*="framer-text"] p,
  [class*="framer-text"] div {
    white-space: nowrap !important;
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
    display: inline-block !important;
    flex-shrink: 0 !important;
    overflow: visible !important;
  }

  /* Fix for background height */
  #container .css-ee2921 { height: 100vh !important; min-height: 100vh !important; }
  
  /* Next Case Study Hover */
  .fow-next-study-btn:hover { transform: translateY(-6px) scale(1.03); transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
`;

const JS_PATCH = `
(function() {
  const NEW_LABEL = 'Schedule a Call';
  const NEW_HREF  = 'https://www.cal.eu/friendofweb/30min';
  
  function runPatches() {
    // 1. Link hijacking
    document.querySelectorAll('a[href*="mailto:"], a[href*="vlad@friendofweb"], [role="link"]').forEach(el => {
      const text = el.textContent || '';
      if (text.includes('Contact Me') || text.includes('Schedule a Call') || el.href?.includes('mailto:')) {
        if (el.tagName === 'A') {
          el.href = NEW_HREF; el.target = '_blank';
        } else {
          if (!el.dataset.fowPatched) {
            el.dataset.fowPatched = '1';
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.open(NEW_HREF, '_blank'); });
          }
        }
      }
    });

    // 2. Text replacement
    const walker = document.createTreeWalker(document.getElementById('container') || document.body, NodeFilter.SHOW_TEXT);
    let node;
    while(node = walker.nextNode()) {
      if (node.nodeValue.includes('Contact Me')) {
        node.nodeValue = node.nodeValue.replace(/Contact Me/g, NEW_LABEL);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => setTimeout(runPatches, 1500));
    const obs = new MutationObserver(() => runPatches());
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
})();
`;

http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = '.' + urlPath;
    if (path.extname(filePath) === '' && fs.existsSync(filePath + '.html')) filePath += '.html';

    const ext = path.extname(filePath);
    const contentType = MIMES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                const upstream = 'https://friendofweb.co.uk' + urlPath;
                https.get(upstream, (pRes) => {
                    if (pRes.statusCode === 200) {
                        res.writeHead(200, { 'Content-Type': contentType });
                        pRes.pipe(res);
                    } else { res.writeHead(404); res.end('Not found'); }
                }).on('error', () => { res.writeHead(502); res.end('Gateway Error'); });
                return;
            }
            res.writeHead(500); res.end('Server'); return;
        }

        // Apply patches via assets to avoid hydration issues
        if (urlPath.endsWith('.css') && urlPath.includes('/_components/v2/')) {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data.toString() + CSS_PATCH);
        } else if (urlPath.endsWith('.js') && urlPath.includes('/_components/v2/')) {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data.toString() + "\n" + JS_PATCH);
        } else {
            res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
            res.end(data);
        }
    });
}).listen(PORT, () => {
    console.log(`Final aggressively patched server running at http://127.0.0.1:${PORT}/`);
});
