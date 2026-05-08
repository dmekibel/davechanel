// Heaven OS — boot

import { initDesktop } from "./desktop.js";
import { shouldShowLogin, showLogin } from "./login.js";
import { applyWallpaper } from "./wallpaper.js";

function boot() {
  disableZoom();
  applyWallpaper();
  if (shouldShowLogin()) {
    showLogin(initDesktop);
  } else {
    document.getElementById("login-overlay")?.remove();
    initDesktop();
  }
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

  // Mobile: pinch with two fingers
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
