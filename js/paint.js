// Mini MS Paint clone — Win98 style.
// Tools: pencil, eraser, fill, line, rect, ellipse. 16-color palette. Clear button.

import { openWindow, closeWindow } from "./window-manager.js";
import { ICONS } from "./icons.js";

const PALETTE = [
  "#000000","#808080","#7e0000","#808000","#007e00","#007e7e","#00007e","#7e007e",
  "#ffffff","#c3c3c3","#ff0000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff",
];

export function openPaint() {
  const wrap = document.createElement("div");
  wrap.className = "paint";
  wrap.innerHTML = `
    <div class="paint-toolbar">
      <button data-tool="pencil"  class="pt-btn active" title="Pencil">✎</button>
      <button data-tool="eraser"  class="pt-btn"        title="Eraser">⌫</button>
      <button data-tool="fill"    class="pt-btn"        title="Fill">⬛</button>
      <button data-tool="line"    class="pt-btn"        title="Line">╱</button>
      <button data-tool="rect"    class="pt-btn"        title="Rectangle">▭</button>
      <button data-tool="ellipse" class="pt-btn"        title="Ellipse">◯</button>
      <span class="pt-sep"></span>
      <label class="pt-size">Size
        <select class="pt-size-sel">
          <option value="1">1</option>
          <option value="2" selected>2</option>
          <option value="4">4</option>
          <option value="8">8</option>
          <option value="14">14</option>
        </select>
      </label>
      <span class="pt-sep"></span>
      <button class="pt-btn pt-clear" title="Clear canvas">Clear</button>
    </div>
    <div class="paint-main">
      <div class="paint-palette"></div>
      <div class="paint-canvas-wrap">
        <canvas class="paint-canvas" width="600" height="400"></canvas>
      </div>
    </div>
    <div class="paint-status">
      <span class="pt-status-color">Color: <span class="pt-current"></span></span>
      <span class="pt-status-coord">x: 0  y: 0</span>
    </div>
  `;

  const canvas = wrap.querySelector(".paint-canvas");
  const ctx = canvas.getContext("2d");
  // White background to start
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let tool = "pencil";
  let color = "#000000";
  let size = 2;
  let drawing = false;
  let startX = 0, startY = 0;
  let snapshot = null;   // for line/rect/ellipse preview

  // Palette
  const paletteEl = wrap.querySelector(".paint-palette");
  for (const c of PALETTE) {
    const sw = document.createElement("button");
    sw.className = "pt-swatch";
    sw.style.background = c;
    sw.dataset.color = c;
    sw.addEventListener("click", () => {
      color = c;
      updateCurrent();
      paletteEl.querySelectorAll(".pt-swatch.active").forEach(n => n.classList.remove("active"));
      sw.classList.add("active");
    });
    paletteEl.appendChild(sw);
  }
  paletteEl.firstChild.classList.add("active");
  const currentEl = wrap.querySelector(".pt-current");
  function updateCurrent() {
    currentEl.style.background = color;
  }
  updateCurrent();

  // Tool buttons
  wrap.querySelectorAll(".pt-btn[data-tool]").forEach(b => {
    b.addEventListener("click", () => {
      tool = b.dataset.tool;
      wrap.querySelectorAll(".pt-btn[data-tool]").forEach(n => n.classList.toggle("active", n === b));
    });
  });

  // Size
  const sizeSel = wrap.querySelector(".pt-size-sel");
  sizeSel.addEventListener("change", () => { size = parseInt(sizeSel.value, 10); });

  // Clear
  wrap.querySelector(".pt-clear").addEventListener("click", () => {
    if (!confirm("Clear the whole canvas?")) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  // Coords helper
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    return {
      x: Math.round((p.clientX - r.left) * canvas.width  / r.width),
      y: Math.round((p.clientY - r.top)  * canvas.height / r.height),
    };
  }
  const coordEl = wrap.querySelector(".pt-status-coord");

  function drawPoint(x, y) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawLineBetween(x0, y0, x1, y1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  function eraseAt(x, y) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.restore();
  }
  function floodFill(x, y, fillHex) {
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const i = (y * w + x) * 4;
    const sr = data[i], sg = data[i + 1], sb = data[i + 2], sa = data[i + 3];
    const fr = parseInt(fillHex.slice(1, 3), 16);
    const fg = parseInt(fillHex.slice(3, 5), 16);
    const fb = parseInt(fillHex.slice(5, 7), 16);
    if (sr === fr && sg === fg && sb === fb) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const idx = (cy * w + cx) * 4;
      if (data[idx] !== sr || data[idx + 1] !== sg || data[idx + 2] !== sb || data[idx + 3] !== sa) continue;
      data[idx] = fr; data[idx + 1] = fg; data[idx + 2] = fb; data[idx + 3] = 255;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }

  function start(e) {
    e.preventDefault();
    const { x, y } = pos(e);
    startX = x; startY = y;
    if (tool === "fill") { floodFill(x, y, color); return; }
    drawing = true;
    if (tool === "pencil") drawPoint(x, y);
    else if (tool === "eraser") eraseAt(x, y);
    else snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  function move(e) {
    const { x, y } = pos(e);
    coordEl.textContent = `x: ${x}  y: ${y}`;
    if (!drawing) return;
    if (e.cancelable) e.preventDefault();
    if (tool === "pencil") {
      drawLineBetween(startX, startY, x, y);
      startX = x; startY = y;
    } else if (tool === "eraser") {
      eraseAt(x, y);
    } else if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      if (tool === "line") {
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
      } else if (tool === "rect") {
        ctx.strokeRect(Math.min(startX, x), Math.min(startY, y), Math.abs(x - startX), Math.abs(y - startY));
      } else if (tool === "ellipse") {
        const cx = (startX + x) / 2, cy = (startY + y) / 2;
        const rx = Math.abs(x - startX) / 2, ry = Math.abs(y - startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  function end() { drawing = false; snapshot = null; }

  canvas.addEventListener("mousedown",   start);
  canvas.addEventListener("mousemove",   move);
  canvas.addEventListener("mouseup",     end);
  canvas.addEventListener("mouseleave",  end);
  canvas.addEventListener("touchstart",  start, { passive: false });
  canvas.addEventListener("touchmove",   move,  { passive: false });
  canvas.addEventListener("touchend",    end);

  return openWindow({
    title: "Paint",
    icon: ICONS.picture(14),
    iconHtml: true,
    content: wrap,
    width: 720,
    height: 540,
    flush: true,
  });
}
