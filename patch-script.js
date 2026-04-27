
/* FOW Global Patches - Injected via Runtime JS to prevent Hydration Error #423 */
(function () {
  const css = `
  :root {
    --fow-ease-out-expo  : cubic-bezier(0.16, 1, 0.3, 1);
    --fow-ease-spring   : cubic-bezier(0.34, 1.2, 0.64, 1);
    --fow-dur-slow      : 0.85s;
    --fow-dur-mid       : 0.65s;
    --fow-dur-fast      : 0.45s;
  }

  #container header {
    transition: opacity var(--fow-dur-slow) var(--fow-ease-out-expo), transform var(--fow-dur-slow) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }
  #container main {
    transition: opacity var(--fow-dur-mid) var(--fow-ease-out-expo), transform var(--fow-dur-mid) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }
  #container .css-hf9sha[tabindex="0"] {
    transition: opacity var(--fow-dur-slow) var(--fow-ease-out-expo), transform var(--fow-dur-slow) var(--fow-ease-spring);
    will-change: opacity, transform;
  }
  #container .css-lbbuna, #container .css-1p9pc2, #container .css-pn5rr8, #container .css-5cl2xa, #container .css-lodtrb {
    transition: opacity var(--fow-dur-mid) var(--fow-ease-out-expo), transform var(--fow-dur-mid) var(--fow-ease-out-expo);
    will-change: opacity, transform;
  }
  #container .css-48no6p {
    transition: opacity var(--fow-dur-slow) var(--fow-ease-spring), transform 1s var(--fow-ease-spring);
    will-change: opacity, transform;
  }
  #container header { transition-delay: 0s; }
  #container .css-hf9sha[tabindex="0"] { transition-delay: 0.1s; }
  #container .css-lbbuna, #container .css-pn5rr8 { transition-delay: 0.08s; }
  #container .css-1p9pc2, #container .css-5cl2xa { transition-delay: 0.15s; }
  #container .css-48no6p { transition-delay: 0.18s; }

  /* UI Fixes */
  [data-framer-name="Button / Tertiary"], [class*="css-pygw6r"], [class*="css-ss6j61"], [class*="css-ty29eb"], [class*="css-v73i46"], [class*="css-i5i15q"] {
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
    white-space: nowrap !important;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    overflow: visible !important;
    flex-shrink: 0 !important;
  }
  [class*="textContents"] p, [class*="textContents"] div, .textContents p {
    white-space: nowrap !important;
    width: auto !important;
    min-width: max-content !important;
    display: inline-block !important;
    flex-shrink: 0 !important;
  }
  [class*="css-ty29eb"], .css-htom9d, [class*="css-v73i46"] {
    padding-right: 5px !important;
    padding-left: 14px !important;
  }
  #sites-cursor-element { transition: none !important; }
  #container .css-ee2921, #container .css-ezupt1, #container .css-gjzl8s, #container .embed, #container div:has(> .embed) {
    height: 100vh !important;
    min-height: 100vh !important;
  }

  /* Next Case Study Hover */
  .fow-next-study-btn {
    display: inline-flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; position: relative; padding: 20px 32px; border-radius: 20px;
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); will-change: transform;
  }
  .fow-next-study-btn:hover { transform: translateY(-6px) scale(1.03); }
  .fow-next-study-btn:hover .fow-icon { transform: scale(1.12) rotate(-4deg); }
  .fow-next-study-btn .fow-label::after {
    content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 2px;
    background: linear-gradient(90deg, #c6cdde 0%, rgba(198,205,222,0) 100%);
    transform: scaleX(0); transform-origin: left; transition: transform 0.38s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .fow-next-study-btn:hover .fow-label::after { transform: scaleX(1); }
  .fow-next-study-btn .fow-arrow-wrap { display: inline-block; overflow: hidden; height: 1em; vertical-align: middle; margin-left: 4px; }
  .fow-next-study-btn .fow-arrow-inner { display: flex; flex-direction: column; transition: transform 0.38s cubic-bezier(0.65, 0, 0.35, 1); }
  .fow-next-study-btn:hover .fow-arrow-inner { transform: translateY(-50%); }
  @keyframes fow-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .fow-next-study-btn:hover .fow-label-text {
    background: linear-gradient(90deg, #fff 20%, #c6cdde 40%, #fff 60%);
    background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    animation: fow-shimmer 1.2s linear infinite;
  }
  `;

  const injectStyles = () => {
    if (document.getElementById('fow-injected-patches')) return;
    const s = document.createElement('style');
    s.id = 'fow-injected-patches';
    s.textContent = css;
    document.head.appendChild(s);
  };

  const patchUI = () => {
    // Next Study
    const selectors = ['.css-4uwqh2.css-hf9sha', '.css-1dq1dy.css-hf9sha'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.dataset.fowEnhanced) return;
        el.dataset.fowEnhanced = '1';
        el.classList.add('fow-next-study-btn');
        const icon = el.querySelector('[data-isimage="true"]');
        if (icon) icon.classList.add('fow-icon');
        const label = el.querySelector('.css-cpkxy6, .css-2of95g');
        if (label) {
          label.classList.add('fow-label');
          const p = label.querySelector('p') || label;
          const raw = p.textContent || '';
          const textPart = raw.replace(/→/, '').trim();
          p.innerHTML = '<span class="fow-label-text">' + textPart + '</span>' +
            '<span class="fow-arrow-wrap"><span class="fow-arrow-inner"><span>→</span><span>→</span></span></span>';
        }
      });
    });

    // Contact Buttons
    const NEW_LABEL = 'Schedule a Call';
    const NEW_HREF = 'https://www.cal.eu/friendofweb/30min';
    document.querySelectorAll('a[href*="mailto:"], a[href*="vlad@friendofweb"]').forEach(a => {
      a.href = NEW_HREF; a.target = '_blank'; a.rel = 'noopener noreferrer';
    });

    // Text replacement
    const walker = document.createTreeWalker(document.getElementById('container') || document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        if (node.nodeValue.includes('Contact Me')) node.nodeValue = node.nodeValue.replace(/Contact Me/g, NEW_LABEL);
        if (node.nodeValue.includes('future-ready design systems at the Speed of AI')) {
          node.nodeValue = node.nodeValue.replace('future-ready design systems at the Speed of AI. Working hands-on across research, design, and implementation.', 'future-ready systems, bridging research, design, and implementation for the AI era.');
        }
      }
    }

    document.querySelectorAll('[role="link"][tabindex="0"]').forEach(el => {
      const label = el.querySelector('.css-i5i15q, .css-vkpzlc');
      if (!label) return;
      const text = label.textContent || '';
      if (!text.includes('Schedule a Call') && !text.includes('Contact Me')) return;
      if (el.dataset.fowPatched) return;
      el.dataset.fowPatched = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        window.open(NEW_HREF, '_blank', 'noopener,noreferrer');
      });
    });
  };

  const runAll = () => {
    injectStyles();
    patchUI();
  };

  // Run immediately and often to ensure high fidelity
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    runAll();
  }
  window.addEventListener('load', runAll);

  // Also watch for DOM changes (MutationObserver)
  const observer = new MutationObserver(runAll);
  const container = document.getElementById('container') || document.body;
  observer.observe(container, { childList: true, subtree: true, characterData: true });
})();
