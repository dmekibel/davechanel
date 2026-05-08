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
  set(".login-tagline",          "To begin, click your user name");
  set(".login-power-label",      "Turn off computer");
  set(".login-help",             "After you log on, the desktop loads. There is no password.");
  set(".login-intro",            "Russian-Israeli artist. Co-founder of Balancē Creative.");

  overlay.hidden = false;

  const userBtn = overlay.querySelector("#login-user");
  const finish = () => {
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.remove();
      onComplete();
    }, 480);
  };
  userBtn.addEventListener("click", finish, { once: true });
  userBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
  });
  // Auto-focus the user tile so Enter works immediately
  setTimeout(() => userBtn.focus(), 30);
}
