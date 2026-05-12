// Image Viewer — pan/zoom canvas-backed preview app.
// Renders fine-art images via <canvas> so right-click "Save image as"
// disappears, blocks contextmenu / drag / selection. (This is a
// deterrent — anything on screen can still be screenshotted, but most
// casual visitors won't bother.)

import { openWindow } from "./window-manager.js";
import { ICONS } from "./icons.js";

export function openImageViewer(src, title) {
  const wrap = document.createElement("div");
  wrap.className = "iv";
  wrap.innerHTML = `
    <div class="iv-toolbar">
      <button class="iv-btn iv-zoom-out" title="Zoom out">−</button>
      <button class="iv-btn iv-zoom-in"  title="Zoom in">+</button>
      <button class="iv-btn iv-fit"      title="Fit to window">Fit</button>
      <button class="iv-btn iv-actual"   title="Actual size">100%</button>
      <span class="iv-spacer"></span>
      <span class="iv-info"></span>
    </div>
    <div class="iv-stage">
      <canvas class="iv-canvas"></canvas>
    </div>
  `;

  const stage = wrap.querySelector(".iv-stage");
  const canvas = wrap.querySelector(".iv-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const info = wrap.querySelector(".iv-info");

  let img = new Image();
  let scale = 1;
  let tx = 0, ty = 0;     // translation
  let loaded = false;

  // Anti-copy deterrents
  ["contextmenu", "dragstart", "selectstart"].forEach(ev => {
    wrap.addEventListener(ev, (e) => e.preventDefault());
  });
  canvas.style.webkitUserSelect = "none";
  canvas.style.userSelect = "none";
  canvas.style.webkitUserDrag = "none";

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width  = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fit() {
    if (!loaded) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    scale = Math.min(w / img.naturalWidth, h / img.naturalHeight, 1);
    tx = (w - img.naturalWidth  * scale) / 2;
    ty = (h - img.naturalHeight * scale) / 2;
    draw();
  }

  function setScale(next, center) {
    if (!loaded) return;
    next = Math.max(0.05, Math.min(20, next));
    const w = stage.clientWidth, h = stage.clientHeight;
    const cx = center ? center.x : w / 2;
    const cy = center ? center.y : h / 2;
    // Keep the point under the cursor fixed during zoom.
    const ix = (cx - tx) / scale;
    const iy = (cy - ty) / scale;
    scale = next;
    tx = cx - ix * scale;
    ty = cy - iy * scale;
    draw();
  }

  function draw() {
    const w = stage.clientWidth, h = stage.clientHeight;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);
    if (!loaded) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, tx, ty, img.naturalWidth * scale, img.naturalHeight * scale);
    info.textContent = `${img.naturalWidth}×${img.naturalHeight}  ${Math.round(scale * 100)}%`;
  }

  // Pan with drag (mouse + touch)
  let dragging = false;
  let lastX = 0, lastY = 0;
  const onDown = (cx, cy) => { dragging = true; lastX = cx; lastY = cy; };
  const onMove = (cx, cy) => {
    if (!dragging) return;
    tx += cx - lastX;
    ty += cy - lastY;
    lastX = cx; lastY = cy;
    draw();
  };
  const onUp = () => { dragging = false; };

  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener("touchend", onUp);

  // Wheel zoom
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setScale(scale * factor, center);
  }, { passive: false });

  wrap.querySelector(".iv-zoom-in").addEventListener("click",  () => setScale(scale * 1.25));
  wrap.querySelector(".iv-zoom-out").addEventListener("click", () => setScale(scale / 1.25));
  wrap.querySelector(".iv-fit").addEventListener("click",      fit);
  wrap.querySelector(".iv-actual").addEventListener("click",   () => setScale(1));

  // Load the image
  img.crossOrigin = "anonymous";
  img.onload = () => {
    loaded = true;
    setTimeout(() => { resize(); fit(); }, 0);
  };
  img.onerror = () => {
    loaded = false;
    info.textContent = "Failed to load image.";
    draw();
  };
  img.src = src;

  // React to window resize
  const ro = new ResizeObserver(() => { resize(); });
  setTimeout(() => ro.observe(stage), 0);

  return openWindow({
    title: title || "Image Viewer",
    icon: ICONS.picture(14),
    iconHtml: true,
    content: wrap,
    width: 720,
    height: 540,
    flush: true,
  });
}
