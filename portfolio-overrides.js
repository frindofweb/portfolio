(function () {
  const SCHEDULE_TEXT = "Schedule a Call";
  const SCHEDULE_LINK = "https://www.cal.eu/friendofweb/30min";

  function patchContactButtons() {
    document
      .querySelectorAll('a[href*="mailto:"], a[href*="vlad@friendofweb"]')
      .forEach((a) => {
        a.href = SCHEDULE_LINK;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });

    const root = document.getElementById("container") || document.body;
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes("Contact Me")) {
        node.nodeValue = node.nodeValue.replace(/Contact Me/g, SCHEDULE_TEXT);
      }
    }

    document.querySelectorAll('[role="link"][tabindex="0"]').forEach((el) => {
      const label = el.querySelector(".css-i5i15q, .css-vkpzlc");
      if (!label) return;

      const text = label.textContent || "";
      if (!text.includes(SCHEDULE_TEXT) && !text.includes("Contact Me")) return;
      if (el.dataset.fowPatched) return;

      el.dataset.fowPatched = "1";
      el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(SCHEDULE_LINK, "_blank", "noopener,noreferrer");
      });
    });
  }

  function enhanceNextStudyButtons() {
    const selectors = [".css-4uwqh2.css-hf9sha", ".css-1dq1dy.css-hf9sha"];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.dataset.fowEnhanced) return;

        el.dataset.fowEnhanced = "1";
        el.classList.add("fow-next-study-btn");

        const icon = el.querySelector('[data-isimage="true"]');
        if (icon) icon.classList.add("fow-icon");

        const label = el.querySelector(".css-cpkxy6, .css-2of95g");
        if (!label) return;

        label.classList.add("fow-label");
        const textNode = label.querySelector("p") || label;
        const raw = textNode.textContent || "";
        const textPart = raw.replace(/→/g, "").trim();
        textNode.innerHTML =
          '<span class="fow-label-text">' +
          textPart +
          '</span><span class="fow-arrow-wrap"><span class="fow-arrow-inner"><span>→</span><span>→</span></span></span>';
      });
    });
  }

  function runPatches() {
    patchContactButtons();
    enhanceNextStudyButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runPatches, { once: true });
  } else {
    runPatches();
  }

  window.setTimeout(runPatches, 300);
  window.setTimeout(runPatches, 800);
  window.setTimeout(runPatches, 1500);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(runPatches);
  });

  const observeRoot = document.getElementById("container") || document.body;
  if (observeRoot) {
    observer.observe(observeRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
})();
