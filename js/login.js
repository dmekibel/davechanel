// Heaven OS — XP-style welcome / login screen.
// Shown once per browser session (sessionStorage flag), then revealed only
// when the user clicks the user tile.

const t = (s) => s;   // i18n removed

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
}
