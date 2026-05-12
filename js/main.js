// Mekibel — boot

import { initDesktop } from "./desktop.js";
import { shouldShowLogin, showLogin } from "./login.js";
import { applyWallpaper } from "./wallpaper.js";
import { applyDomTranslations, getLang } from "./i18n.js";
import { applyScale } from "./scale.js";

function boot() {
  disableZoom();
  applyWallpaper();
  applyScale();
  // Translate any static HTML strings BEFORE anything renders
  applyDomTranslations();
  // Initialize the language globe in the tray
  initLangGlobe();
  if (shouldShowLogin()) {
    showLogin(initDesktop);
  } else {
    document.getElementById("login-overlay")?.remove();
    initDesktop();
  }
}

function initLangGlobe() {
  // There are two globe buttons (tray + login). Wire both.
  document.querySelectorAll(".tray-globe, #lang-globe, #login-globe").forEach(btn => {
    if (!btn) return;
    if (btn.dataset.langWired) return;
    btn.dataset.langWired = "1";
    const code = btn.querySelector(".lang-code");
    if (code) code.textContent = getLang().toUpperCase();
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showLangPopup(btn);
    });
  });
}

function showLangPopup(anchor) {
  closeLangPopup();
  import("./i18n.js").then(({ getLang, setLang }) => {
    const cur = getLang();
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "lang-popup";
    menu.style.visibility = "hidden";    // measure before clamp
    menu.style.left = rect.left + "px";
    menu.style.bottom = (window.innerHeight - rect.top + 4) + "px";
    const opts = [
      { code: "en", label: "English" },
      { code: "ru", label: "Русский" },
    ];
    for (const o of opts) {
      const item = document.createElement("div");
      item.className = "item" + (o.code === cur ? " current" : "");
      item.innerHTML =
        `<span class="abbr">${o.code.toUpperCase()}</span>` +
        `<span class="name">${o.label}</span>` +
        (o.code === cur ? `<span class="check">✓</span>` : "");
      item.addEventListener("click", () => setLang(o.code));
      menu.appendChild(item);
    }
    document.body.appendChild(menu);
    // Clamp inside viewport so the popup never gets cut off (login screen is
    // bottom-right so it overflows the right edge by default).
    const r = menu.getBoundingClientRect();
    let left = rect.left;
    if (left + r.width > window.innerWidth - 4) {
      left = Math.max(4, window.innerWidth - r.width - 4);
    }
    menu.style.left = left + "px";
    menu.style.visibility = "";
    setTimeout(() => {
      const closer = (e) => {
        if (!menu.contains(e.target) && e.target !== anchor) {
          closeLangPopup();
          document.removeEventListener("click", closer);
        }
      };
      document.addEventListener("click", closer);
    }, 0);
  });
}
function closeLangPopup() {
  document.querySelectorAll(".lang-popup").forEach(n => n.remove());
}

// Block accidental browser zoom on every platform.
// iOS Safari ignores user-scalable=no, so we have to actively cancel.
function disableZoom() {
  // Desktop: ctrl/cmd + wheel, ctrl/cmd + +/-/0
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
      e.preventDefault();
    }
  });

  // Mobile: pinch with two fingers — block both at start and during move
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // iOS-only: gesture* events fire alongside touch* during pinch
  document.addEventListener("gesturestart",  (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend",    (e) => e.preventDefault());

  // Note: don't preventDefault on touchend for double-tap zoom — that
  // would also suppress the synthesized click/dblclick that we need
  // for opening icons. CSS `touch-action: pan-x pan-y` on body already
  // disables double-tap-zoom at the gesture level.
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
