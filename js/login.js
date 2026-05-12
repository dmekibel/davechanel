// Heaven OS — XP-style welcome / login screen.
// Shown once per browser session (sessionStorage flag), then revealed only
// when the user clicks the user tile.

import { t } from "./i18n.js";

// Always show the welcome screen on a fresh page load.
export function shouldShowLogin() { return true; }

export function showLogin(onComplete) {
  const overlay = document.getElementById("login-overlay");
  if (!overlay) { onComplete(); return; }

  // Translate dynamic strings in the overlay
  const set = (sel, key) => {
    const el = overlay.querySelector(sel);
    if (el) el.textContent = t(key);
  };
  // Overlay is visible by default in HTML — no need to unhide it here.

  const userBtn = overlay.querySelector("#login-user");
  const finish = () => {
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.remove();
      onComplete();
      // Auto-open the Welcome window once the desktop has booted
      setTimeout(() => {
        import("./programs.js").then(m => m.openWelcome && m.openWelcome());
      }, 250);
    }, 480);
  };
  userBtn.addEventListener("click", finish, { once: true });
  userBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
  });
  // Auto-focus the user tile so Enter works immediately
  setTimeout(() => userBtn.focus(), 30);

  // Wire Shut Down — show the classic Win98 "It is now safe to turn off
  // your computer." screen. Tapping it returns to the welcome dialog.
  const shutdownBtn = overlay.querySelector("#login-shutdown");
  shutdownBtn?.addEventListener("click", showShutdownScreen);

  // Wire Sleep — fire the bouncing-name screensaver right from the login.
  const sleepBtn = overlay.querySelector("#login-sleep");
  sleepBtn?.addEventListener("click", () => {
    import("./screensaver.js").then(m => m.startScreensaver());
  });
}

function showShutdownScreen() {
  const layer = document.createElement("div");
  layer.className = "shutdown-screen";
  layer.innerHTML = `
    <div class="shutdown-text">
      ${t("It is now safe to turn off your computer.")}
      <div class="shutdown-hint">${t("(Tap to return)")}</div>
    </div>
  `;
  document.body.appendChild(layer);
  setTimeout(() => {
    layer.addEventListener("click", () => layer.remove(), { once: true });
    layer.addEventListener("touchstart", () => layer.remove(), { once: true });
  }, 250);
}
