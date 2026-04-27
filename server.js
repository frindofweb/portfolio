const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 8000;

const MIMES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// Assets that should be cached for a long time (hashed filenames never change)
const IMMUTABLE_PATHS = ['/_assets/', '/_woff/', '/_runtimes/', '/_components/', '/_json/'];
const IS_COMPRESSIBLE = new Set(['text/html', 'application/javascript', 'text/css', 'application/json', 'image/svg+xml']);

function getCacheHeaders(urlPath) {
  const isImmutable = IMMUTABLE_PATHS.some(p => urlPath.startsWith(p));
  if (isImmutable) {
    // Cache for 1 year — these are content-hashed so safe forever
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  // HTML pages: always revalidate to pick up any changes
  return { 'Cache-Control': 'no-cache' };
}

function serveWithCompression(req, res, content, contentType) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Accept-Encoding',
    ...getCacheHeaders(req.url),
  };

  if (IS_COMPRESSIBLE.has(contentType) && acceptEncoding.includes('gzip')) {
    zlib.gzip(content, (err, compressed) => {
      if (err) {
        res.writeHead(200, headers);
        res.end(content);
      } else {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
        res.end(compressed);
      }
    });
  } else {
    res.writeHead(200, headers);
    res.end(content);
  }
}

function serveVideoWithRange(req, res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Range requests are critical for video scrubbing
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

http.createServer((req, res) => {
  // Ignore Chrome DevTools noise
  if (req.url.startsWith('/.well-known/')) {
    res.writeHead(204);
    return res.end();
  }

  let urlPath = req.url.split('?')[0];
  let filePath = '.' + urlPath;
  if (filePath === './') filePath = './index.html';

  // SPA page routing: /cannes -> cannes.html etc.
  if (path.extname(filePath) === '') {
    const htmlVersion = filePath + '.html';
    if (fs.existsSync(htmlVersion)) filePath = htmlVersion;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIMES[extname] || 'application/octet-stream';

  // Serve videos with Range support for instant scrubbing
  if (extname === '.mp4' || extname === '.webm' || MIMES[extname] === 'video/mp4') {
    if (fs.existsSync(filePath)) {
      return serveVideoWithRange(req, res, filePath, contentType);
    }
  }
  // Also handle extensionless video paths (Figma stores videos without extension)
  if (urlPath.startsWith('/_videos/')) {
    if (fs.existsSync(filePath)) {
      return serveVideoWithRange(req, res, filePath, 'video/mp4');
    }
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Auto-download missing asset from original server and cache it permanently
        const targetUrl = 'https://friendofweb.co.uk' + urlPath;
        https.get(targetUrl, (proxyRes) => {
          if (proxyRes.statusCode === 200) {
            const dirname = path.dirname(filePath);
            if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
            const chunks = [];
            proxyRes.on('data', c => chunks.push(c));
            proxyRes.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.writeFile(filePath, buf, () => { });
              serveWithCompression(req, res, buf, contentType);
              console.log(`Auto-fetched & cached: ${filePath}`);
            });
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        }).on('error', () => {
          res.writeHead(502);
          res.end('Upstream fetch error');
        });
        return;
      }
      res.writeHead(500);
      res.end('Server Error: ' + error.code);
    } else {
      // Strip external GA script from HTML to avoid failed network requests at load
      if (extname === '.html') {
        let html = content.toString('utf-8');
        html = html.replace(/<script[^>]+googletagmanager\.com[^>]*><\/script>/g, '');
        html = html.replace(/<script[^>]*>[\s\S]*?gtag\([\s\S]*?<\/script>/g, '');
        // Fix broken srcSet absolute paths from scraper (/_assets/ -> ./_assets/)
        html = html.replace(/srcSet="([^"]+)"/g, (match, val) => {
          const fixed = val.replace(/(,\s*)\/_assets\//g, '$1./_assets/');
          return `srcSet="${fixed}"`;
        });

        // Inject smooth page-load entrance animations
        const ENTRANCE_SMOOTH_INJECTION = `
<style id="fow-entrance-smooth">
  :root {
    --fow-ease-out-expo  : cubic-bezier(0.16, 1, 0.3, 1);
    --fow-ease-spring   : cubic-bezier(0.34, 1.2, 0.64, 1);
    --fow-dur-slow      : 0.85s;
    --fow-dur-mid       : 0.65s;
    --fow-dur-fast      : 0.45s;
  }

  /* ── Header – slide in from top ─────────────────────────────────── */
  #container header {
    transition:
      opacity  var(--fow-dur-slow) var(--fow-ease-out-expo),
      transform var(--fow-dur-slow) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }

  /* ── Hero images and main blocks ────────────────────────────────── */
  #container main {
    transition:
      opacity  var(--fow-dur-mid) var(--fow-ease-out-expo),
      transform var(--fow-dur-mid) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }

  /* ── Hero slide-in images (translateX animations) ───────────────── */
  #container .css-lbbuna,
  #container .css-1p9pc2,
  #container .css-pn5rr8,
  #container .css-5cl2xa,
  #container .css-lodtrb {
    transition:
      opacity  var(--fow-dur-mid) var(--fow-ease-out-expo),
      transform var(--fow-dur-mid) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }



  /* ── Center avatar / logo blob ──────────────────────────────────── */
  #container .css-48no6p {
    transition:
      opacity  var(--fow-dur-slow) var(--fow-ease-spring),
      transform 1s var(--fow-ease-spring);
    will-change: opacity, transform;
  }

  /* ── Stagger: give each animated child a natural cascade delay ──── */
  #container header { transition-delay: 0s;    }

  #container .css-lbbuna,
  #container .css-pn5rr8         { transition-delay: 0.08s; }

  #container .css-1p9pc2,
  #container .css-5cl2xa         { transition-delay: 0.15s; }


  #container .css-48no6p         { transition-delay: 0.18s; }

  /* ── CTA button: fix "Schedule a Call" text wrapping ───────────── */
  /* The original button was sized for "Contact Me" (134px).          */
  /* "Schedule a Call" is longer — let it grow naturally.             */
  #container .css-i5i15q {
    width: auto !important;
    min-width: 134px;
    white-space: nowrap;
  }

  /* ── Disable lazy mouse follow effect ───────────────────────────── */
  #sites-cursor-element {
    transition: none !important;
  }
</style>`;
        html = html.replace('</head>', ENTRANCE_SMOOTH_INJECTION + '</head>');

        // Inject "Next case study →" hover animation before </body>
        const NEXT_STUDY_INJECTION = `
<style id="fow-next-study-hover">
  /* Wrapper: the clickable div containing the "Next case study →" link */
  .fow-next-study-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    position: relative;
    padding: 20px 32px;
    border-radius: 20px;
    
    /* Hard kill entrance animation (slide/fade) */
    opacity: 1 !important;
    transform: none !important;
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    will-change: transform;
  }
  .fow-next-study-btn:hover {
    transform: none !important;
  }

  /* The icon (project logo SVG above the text) */
  .fow-next-study-btn .fow-icon {
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .fow-next-study-btn:hover .fow-icon {
    transform: scale(1.12) rotate(-4deg);
  }

  /* "Next case study →" text */
  .fow-next-study-btn .fow-label {
    position: relative;
    overflow: hidden;
  }
  .fow-next-study-btn .fow-label::after {
    content: '';
    position: absolute;
    left: 0; bottom: -2px;
    width: 100%; height: 2px;
    background: linear-gradient(90deg, #c6cdde 0%, rgba(198,205,222,0) 100%);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.38s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .fow-next-study-btn:hover .fow-label::after {
    transform: scaleX(1);
  }

  /* Slide-up animated arrow */
  .fow-next-study-btn .fow-arrow-wrap {
    display: inline-block;
    overflow: hidden;
    height: 1em;
    vertical-align: middle;
    margin-left: 4px;
  }
  .fow-next-study-btn .fow-arrow-inner {
    display: flex;
    flex-direction: column;
    transition: transform 0.38s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .fow-next-study-btn:hover .fow-arrow-inner {
    transform: translateY(-50%);
  }
  .fow-next-study-btn .fow-arrow-inner span {
    display: block;
    line-height: 1;
  }

  /* Shimmer fill on hover */
  @keyframes fow-shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
  .fow-next-study-btn:hover .fow-label-text {
    background: linear-gradient(90deg, #fff 20%, #c6cdde 40%, #fff 60%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: fow-shimmer 1.2s linear infinite;
  }
</style>
<script id="fow-next-study-script">
(function() {
  function enhanceNextStudyBtns() {
    // Target both the mobile (css-4uwqh2) and desktop (css-1dq1dy) wrappers
    const selectors = [
      '.css-4uwqh2.css-hf9sha',
      '.css-1dq1dy.css-hf9sha'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.dataset.fowEnhanced) return;
        el.dataset.fowEnhanced = '1';
        el.classList.add('fow-next-study-btn');

        // Wrap the icon
        const icon = el.querySelector('[data-isimage="true"]');
        if (icon) icon.classList.add('fow-icon');

        // Wrap the label text with animated arrow
        const label = el.querySelector('.css-cpkxy6, .css-2of95g');
        if (label) {
          label.classList.add('fow-label');
          // Replace the → with an animated version
          const p = label.querySelector('p') || label;
          const raw = p.textContent || '';
          const textPart = raw.replace(/→/, '').trim();
          label.classList.add('fow-label');
          p.innerHTML =
            '<span class="fow-label-text">' + textPart + '</span>' +
            '<span class="fow-arrow-wrap"><span class="fow-arrow-inner"><span>→</span><span>→</span></span></span>';
        }
      });
    });
  }

  // Run after SitesRuntime hydrates the DOM (it animates in after ~500ms)
  setTimeout(enhanceNextStudyBtns, 800);
  // Also observe for any late DOM mutations from the runtime
  new MutationObserver(enhanceNextStudyBtns)
    .observe(document.getElementById('container') || document.body, { childList: true, subtree: true });
})();
</script>`;
        // Inject: persistent DOM patcher for Contact Me → Schedule a Call
        // The Figma runtime re-renders from its JSON, overwriting HTML edits.
        // This MutationObserver fires every time the runtime touches the DOM
        // and immediately patches any "Contact Me" text + href back to what we want.
        const CONTACT_PATCH_INJECTION = `
<script id="fow-contact-patch">
(function() {
  var NEW_LABEL = 'Schedule a Call';
  var NEW_HREF  = 'https://www.cal.eu/friendofweb/30min';

  function patchContactButtons() {
    // 1. Patch real <a> tags with mailto href
    document.querySelectorAll('a[href*="mailto:"], a[href*="vlad@friendofweb"]').forEach(function(a) {
      a.href = NEW_HREF;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });

    var walker = document.createTreeWalker(
      document.getElementById('container') || document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        if (node.nodeValue.includes('Contact Me')) {
          node.nodeValue = node.nodeValue.replace(/Contact Me/g, NEW_LABEL);
        }

        var val = node.nodeValue;
        if (val.includes('future-ready design systems at the Speed of AI')) {
           val = val.replace(
             'future-ready design systems at the Speed of AI. Working hands-on across research, design, and implementation.',
             'future-ready systems, bridging research, design, and implementation for the AI era.'
           );
           // Fallback in case they are split
           val = val.replace('future-ready design systems at the Speed of AI.', 'future-ready systems, bridging research, design, and implementation for the AI era.');
        }
        if (val.includes('Working hands-on across research, design, and implementation.')) {
           // If we already replaced it above, this won't be found. 
           // If it was split into a separate node, remove it.
           val = val.replace('Working hands-on across research, design, and implementation.', '');
        }
        node.nodeValue = val;
      }
    }

    // 3. The header/footer CTA is a div[role=link] — patch its click handler
    //    by wrapping it to navigate to the cal.eu URL instead
    document.querySelectorAll('[role="link"][tabindex="0"]').forEach(function(el) {
      // Only target the Contact/Schedule button (identified by having the label text)
      var label = el.querySelector('.css-i5i15q, .css-vkpzlc');
      if (!label) return;
      var text = label.textContent || '';
      if (!text.includes('Schedule a Call') && !text.includes('Contact Me')) return;
      if (el.dataset.fowPatched) return;
      el.dataset.fowPatched = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.open(NEW_HREF, '_blank', 'noopener,noreferrer');
      });
    });
  }

  // Run once after runtime initial hydration
  setTimeout(patchContactButtons, 300);
  setTimeout(patchContactButtons, 800);
  setTimeout(patchContactButtons, 1500);

  // Then observe for any subsequent re-renders from the runtime
  var observer = new MutationObserver(function(mutations) {
    var needsPatch = mutations.some(function(m) {
      return Array.from(m.addedNodes).some(function(n) {
        return n.textContent && (n.textContent.includes('Contact Me') || n.textContent.includes('Speed of AI'));
      });
    });
    if (needsPatch) patchContactButtons();
  });
  observer.observe(document.getElementById('container') || document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
</script>`;
        html = html.replace('</body>', CONTACT_PATCH_INJECTION + NEXT_STUDY_INJECTION + '</body>');
        content = Buffer.from(html, 'utf-8');
      }
      serveWithCompression(req, res, content, contentType);
    }
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Optimized server running at http://127.0.0.1:${PORT}/`);
  console.log('  ✓ Gzip compression enabled');
  console.log('  ✓ Immutable cache headers for hashed assets');
  console.log('  ✓ Video Range request support (instant scrub)');
  console.log('  ✓ Auto-fetch & cache for missing assets');
  console.log('  ✓ Google Analytics removed (local-only mode)');
  console.log('  ✓ Broken srcSet paths fixed on-the-fly');
});
