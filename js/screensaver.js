// Heaven OS — bouncing-DVD-style screensaver.
// Logo bounces around the screen, color cycles on each wall hit.
// Any input wakes it.

const COLORS = [
  "#ff3344", "#ff7a22", "#ffd140", "#5cd862",
  "#3fc7e6", "#5366ff", "#b948e3", "#ff45b0", "#ffffff",
];

export function startScreensaver() {
  if (document.getElementById("screensaver")) return;

  const overlay = document.createElement("div");
  overlay.id = "screensaver";
  overlay.className = "screensaver";

  const logo = document.createElement("div");
  logo.className = "screensaver-logo";
  logo.textContent = "David Mekibel";
  overlay.appendChild(logo);

  document.body.appendChild(overlay);

  // Measure after attach, then start motion
  requestAnimationFrame(() => {
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const w = () => logo.offsetWidth;
    const h = () => logo.offsetHeight;

    let x = Math.random() * Math.max(1, W() - w());
    let y = Math.random() * Math.max(1, H() - h());
    let dx = (Math.random() < 0.5 ? -1 : 1) * 1.7;
    let dy = (Math.random() < 0.5 ? -1 : 1) * 1.7;
    let ci = Math.floor(Math.random() * COLORS.length);
    logo.style.color = COLORS[ci];

    let raf;
    const tick = () => {
      x += dx;
      y += dy;
      let bounced = false;
      if (x <= 0)             { x = 0;          dx = -dx; bounced = true; }
      else if (x + w() >= W()) { x = W() - w(); dx = -dx; bounced = true; }
      if (y <= 0)             { y = 0;          dy = -dy; bounced = true; }
      else if (y + h() >= H()) { y = H() - h(); dy = -dy; bounced = true; }
      if (bounced) {
        ci = (ci + 1 + Math.floor(Math.random() * 3)) % COLORS.length;
        logo.style.color = COLORS[ci];
      }
      logo.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const wake = () => {
      cancelAnimationFrame(raf);
      overlay.classList.add("waking");
      setTimeout(() => overlay.remove(), 220);
      WAKE_EVENTS.forEach(ev => document.removeEventListener(ev, wake, true));
    };
    const WAKE_EVENTS = ["click", "keydown", "mousemove", "touchstart", "wheel"];

    // Brief delay so the click that triggered Sleep doesn't dismiss it instantly
    setTimeout(() => {
      WAKE_EVENTS.forEach(ev => document.addEventListener(ev, wake, true));
    }, 350);
  });
}
