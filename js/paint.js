// Mini MS Paint clone — Win98 style.
// Tools: pencil, eraser, fill, line, rect, ellipse. 16-color palette.
// Undo (Ctrl+Z), Export PNG, Win98-styled brush size + confirm dialog.

import { openWindow, closeWindow, toggleMaximize } from "./window-manager.js?v=191";
import { ICONS } from "./icons.js?v=191";
import { saveImage, loadUserFS } from "./user-storage.js?v=191";
import { win98Prompt, win98PickFolder } from "./win98-dialogs.js?v=191";
import { FS } from "./file-system.js?v=191";
import { spawnStickmanAt } from "./stickman.js?v=191";
import { currentZoom } from "./scale.js?v=191";

// Inline Win98-styled combobox (no native <select> — iOS renders that as
// a modal picker which breaks the OS illusion).
function makeWin98SelectInline(options, initial, onChange) {
  const root = document.createElement("div");
  root.className = "ws-select ws-select-inline";
  root.tabIndex = 0;
  let current = options.find(o => o.value === initial) || options[0];

  const valueEl = document.createElement("span");
  valueEl.className = "ws-value";
  valueEl.textContent = current.label;

  const arrow = document.createElement("button");
  arrow.type = "button";
  arrow.className = "ws-arrow";
  arrow.tabIndex = -1;
  arrow.innerHTML = `<span aria-hidden="true">▼</span>`;

  const listEl = document.createElement("ul");
  listEl.className = "ws-options";
  listEl.hidden = true;
  for (const o of options) {
    const li = document.createElement("li");
    li.dataset.value = o.value;
    li.textContent = o.label;
    if (o.value === current.value) li.classList.add("selected");
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      current = o;
      valueEl.textContent = o.label;
      listEl.querySelectorAll("li.selected").forEach(n => n.classList.remove("selected"));
      li.classList.add("selected");
      close();
      onChange(o.value);
    });
    listEl.appendChild(li);
  }

  const open = () => { listEl.hidden = false; document.addEventListener("click", outside, true); };
  const close = () => { listEl.hidden = true; document.removeEventListener("click", outside, true); };
  const outside = (e) => { if (!root.contains(e.target)) close(); };

  root.addEventListener("click", (e) => {
    e.stopPropagation();
    listEl.hidden ? open() : close();
  });

  root.appendChild(valueEl);
  root.appendChild(arrow);
  root.appendChild(listEl);
  return root;
}

// Classic Win98 menu bar: top-level labels with dropdowns.
function buildMenubar(rootEl, menus) {
  rootEl.innerHTML = "";
  let openMenu = null;
  let openDrop = null;
  const close = () => {
    if (openDrop) { openDrop.remove(); openDrop = null; }
    if (openMenu) { openMenu.classList.remove("open"); openMenu = null; }
    document.removeEventListener("click", outsideClose, true);
  };
  const outsideClose = (e) => {
    if (!rootEl.contains(e.target) && (!openDrop || !openDrop.contains(e.target))) close();
  };
  for (const m of menus) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pm-menu";
    btn.textContent = m.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu === btn) { close(); return; }
      close();
      openMenu = btn;
      btn.classList.add("open");
      const drop = document.createElement("div");
      drop.className = "pm-drop";
      for (const it of m.items) {
        if (it === "sep") {
          const sep = document.createElement("div");
          sep.className = "pm-sep";
          drop.appendChild(sep);
          continue;
        }
        const item = document.createElement("div");
        item.className = "pm-item";
        item.innerHTML = `<span class="pm-lbl">${it.label}</span>${it.accel ? `<span class="pm-accel">${it.accel}</span>` : ""}`;
        item.addEventListener("click", (ev) => {
          ev.stopPropagation();
          close();
          it.action();
        });
        drop.appendChild(item);
      }
      const r = btn.getBoundingClientRect();
      drop.style.position = "fixed";
      drop.style.left = r.left + "px";
      drop.style.top  = r.bottom + "px";
      document.body.appendChild(drop);
      openDrop = drop;
      document.addEventListener("click", outsideClose, true);
    });
    btn.addEventListener("mouseenter", () => {
      // Once a menu is open, hovering siblings switches the dropdown.
      if (openMenu && openMenu !== btn) btn.click();
    });
    rootEl.appendChild(btn);
  }
}

// Quick info dialog — same chrome as win98Confirm but OK only.
function win98Info(message, title) {
  win98Confirm(message, title, () => {}, { okOnly: true });
}

// Sensible default canvas dimensions based on the viewport.
function defaultCanvasSize() {
  const vw = Math.max(window.innerWidth, document.documentElement.clientWidth);
  const vh = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const portrait = vh > vw;
  if (vw < 700) return portrait ? { w: 320, h: 480 } : { w: 560, h: 320 };
  return { w: 800, h: 560 };
}

// Win98-styled canvas-attributes dialog. onOk receives {w, h}.
function canvasSizeDialog(initial, onOk) {
  const back = document.createElement("div");
  back.className = "win98-confirm-backdrop";
  const dlg = document.createElement("div");
  dlg.className = "win98-confirm canvas-attr-dlg";
  dlg.innerHTML = `
    <div class="win98-confirm-title">Image Attributes</div>
    <div class="canvas-attr-body">
      <div class="canvas-attr-row">
        <label>Width: <input type="number" class="ca-w" min="16" max="4096" step="1"></label>
        <label>Height: <input type="number" class="ca-h" min="16" max="4096" step="1"></label>
      </div>
      <div class="canvas-attr-presets">
        <button data-preset="fit">Fit window</button>
        <button data-preset="320,480">320 × 480</button>
        <button data-preset="640,480">640 × 480</button>
        <button data-preset="800,600">800 × 600</button>
        <button data-preset="1024,768">1024 × 768</button>
      </div>
    </div>
    <div class="win98-confirm-buttons">
      <button class="win98-confirm-btn win98-confirm-ok">OK</button>
      <button class="win98-confirm-btn win98-confirm-cancel">Cancel</button>
    </div>
  `;
  const wIn = dlg.querySelector(".ca-w");
  const hIn = dlg.querySelector(".ca-h");
  wIn.value = initial.w;
  hIn.value = initial.h;
  dlg.querySelectorAll(".canvas-attr-presets button").forEach(b => {
    b.addEventListener("click", () => {
      const p = b.dataset.preset;
      if (p === "fit") {
        const fit = fitCanvasSizeToWindow();
        wIn.value = fit.w;
        hIn.value = fit.h;
      } else {
        const [w, h] = p.split(",").map(Number);
        wIn.value = w;
        hIn.value = h;
      }
    });
  });
  back.appendChild(dlg);
  document.body.appendChild(back);
  const cleanup = () => back.remove();
  dlg.querySelector(".win98-confirm-ok").addEventListener("click", () => {
    const w = Math.max(16, Math.min(4096, parseInt(wIn.value, 10) || initial.w));
    const h = Math.max(16, Math.min(4096, parseInt(hIn.value, 10) || initial.h));
    cleanup();
    onOk({ w, h });
  });
  dlg.querySelector(".win98-confirm-cancel").addEventListener("click", cleanup);
  back.addEventListener("click", (e) => { if (e.target === back) cleanup(); });
}

// Compute the canvas size that fits within the current paint window, if open.
function fitCanvasSizeToWindow() {
  const wrapEl = document.querySelector(".paint-canvas-wrap");
  if (wrapEl) {
    return {
      w: Math.max(16, Math.floor(wrapEl.clientWidth  - 16)),
      h: Math.max(16, Math.floor(wrapEl.clientHeight - 16)),
    };
  }
  return defaultCanvasSize();
}

// Win98 confirm dialog — replaces native confirm() so the OS illusion holds.
function win98Confirm(message, title, onOk, opts = {}) {
  const back = document.createElement("div");
  back.className = "win98-confirm-backdrop";
  const dlg = document.createElement("div");
  dlg.className = "win98-confirm";
  const okOnly = opts.okOnly === true;
  dlg.innerHTML = `
    <div class="win98-confirm-title">${title || "Confirm"}</div>
    <div class="win98-confirm-body">
      <div class="win98-confirm-icon">${okOnly ? "i" : "?"}</div>
      <div class="win98-confirm-msg"></div>
    </div>
    <div class="win98-confirm-buttons">
      <button class="win98-confirm-btn win98-confirm-ok">OK</button>
      ${okOnly ? "" : `<button class="win98-confirm-btn win98-confirm-cancel">Cancel</button>`}
    </div>
  `;
  dlg.querySelector(".win98-confirm-msg").textContent = message;
  back.appendChild(dlg);
  document.body.appendChild(back);
  const cleanup = () => back.remove();
  dlg.querySelector(".win98-confirm-ok").addEventListener("click", () => { cleanup(); onOk(); });
  if (!okOnly) dlg.querySelector(".win98-confirm-cancel").addEventListener("click", cleanup);
  back.addEventListener("click", (e) => { if (e.target === back) cleanup(); });
}

const PALETTE = [
  "#000000","#808080","#7e0000","#808000","#007e00","#007e7e","#00007e","#7e007e",
  "#ffffff","#c3c3c3","#ff0000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff",
];

export function openPaint(opts = {}) {
  const initial = opts && (opts.w && opts.h) ? { w: opts.w, h: opts.h } : defaultCanvasSize();
  const wrap = document.createElement("div");
  wrap.className = "paint";
  wrap.innerHTML = `
    <div class="paint-menubar"></div>
    <div class="paint-toolbar">
      <button data-tool="pencil"  class="pt-btn active" title="Pencil" aria-label="Pencil">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2 14 L4 12 L11 5 L13 7 L6 14 Z" fill="#fdd55d" stroke="#000"/>
          <path d="M11 5 L13 3 L15 5 L13 7 Z" fill="#cdcdcd" stroke="#000"/>
          <path d="M2 14 L3.5 12.5 L4.5 13.5 L4 14 Z" fill="#000"/>
        </svg>
      </button>
      <button data-tool="eraser"  class="pt-btn" title="Eraser" aria-label="Eraser">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2 11 L8 5 L13 10 L7 14 Z" fill="#ffc0cb" stroke="#000"/>
          <path d="M8 5 L12 1 L15 4 L13 6 Z" fill="#5a7fbd" stroke="#000"/>
          <path d="M13 6 L8 5" stroke="#000" stroke-width="0.5" fill="none"/>
        </svg>
      </button>
      <button data-tool="fill"    class="pt-btn" title="Fill (paint bucket)" aria-label="Fill">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 7 L8 2 L13 7 L8 12 Z" fill="#fff" stroke="#000" stroke-width="1"/>
          <path d="M8 2 L8 12" stroke="#000" stroke-width="1"/>
          <path d="M13 7 L14 9 L14 12 L12 12 L12 9 Z" fill="#888" stroke="#000" stroke-width="1"/>
          <circle cx="13" cy="13" r="1.5" fill="#1976d2"/>
          <circle cx="11" cy="14" r="1" fill="#1976d2"/>
        </svg>
      </button>
      <button data-tool="line"    class="pt-btn"        title="Line">╱</button>
      <button data-tool="rect"    class="pt-btn"        title="Rectangle">▭</button>
      <button data-tool="ellipse" class="pt-btn"        title="Ellipse">◯</button>
      <span class="pt-sep"></span>
      <button class="pt-btn pt-undo"  title="Undo (Ctrl+Z)" aria-label="Undo">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2 7 L5 4 L5 6 L10 6 Q14 6 14 10 Q14 14 10 14 L7 14" stroke="#0a3d6e" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 7 L5 10 L5 8" stroke="#0a3d6e" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="pt-sep"></span>
      <button class="pt-btn pt-life" title="Bring to life!" aria-label="Bring to life">⚡</button>
      <span class="pt-sep"></span>
      <label class="pt-size">Size <span class="pt-size-slot"></span></label>
    </div>
    <div class="paint-main">
      <div class="paint-palette"></div>
      <div class="paint-canvas-wrap">
        <canvas class="paint-canvas" width="${initial.w}" height="${initial.h}"></canvas>
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

  // Undo stack: snapshot before each draw action
  const UNDO_MAX = 24;
  const undoStack = [];
  function pushUndo() {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }
  function undo() {
    if (!undoStack.length) return;
    ctx.putImageData(undoStack.pop(), 0, 0);
  }

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

  // Brush size — Win98 combobox (not native select)
  const sizeSlot = wrap.querySelector(".pt-size-slot");
  sizeSlot.appendChild(makeWin98SelectInline(
    [1,2,4,8,14].map(n => ({ value: String(n), label: `${n} px` })),
    String(size),
    (v) => { size = parseInt(v, 10); }
  ));

  // Actions
  function doUndo() { undo(); }
  function resizeCanvas(w, h) {
    pushUndo();
    canvas.width  = w;
    canvas.height = h;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  function doNew() {
    canvasSizeDialog(
      { w: canvas.width, h: canvas.height },
      ({ w, h }) => resizeCanvas(w, h),
    );
  }
  function doAttributes() {
    canvasSizeDialog(
      { w: canvas.width, h: canvas.height },
      ({ w, h }) => {
        // Preserve existing image when only resizing (Image > Attributes)
        const old = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pushUndo();
        canvas.width  = w;
        canvas.height = h;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.putImageData(old, 0, 0);
      },
    );
  }
  function defaultFileName() {
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    return `paint-${stamp}.png`;
  }
  // Download to local disk (the user's actual files).
  function doDownload() {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }, "image/png");
  }
  // Save on the in-OS desktop.
  async function doSaveToDesktop() {
    const name = await win98Prompt("Save as:", defaultFileName(), { title: "Save to Desktop" });
    if (name == null) return;
    const dataURL = canvas.toDataURL("image/png");
    saveImage("desktop", dataURL, name.trim() || defaultFileName());
  }
  // Save into a folder in My Computer (user picks the folder).
  async function doSaveAs() {
    // Walk the FS to build the folder list (depth-limited).
    const folders = [{ label: "My Computer (root)", value: "/", depth: 0 }];
    function walk(node, path, depth) {
      if (!node.children) return;
      for (const c of node.children) {
        if (c.type === "folder") {
          const p = path === "/" ? "/" + c.name : path + "/" + c.name;
          folders.push({ label: c.name, value: p, depth });
          if (depth < 3) walk(c, p, depth + 1);
        }
      }
    }
    walk(FS, "/", 1);
    // Also include any user-created folders at the root level.
    const fs = loadUserFS();
    for (const path of Object.keys(fs.items || {})) {
      if (path === "desktop" || folders.find(f => f.value === path)) continue;
      const segments = path.split("/").filter(Boolean);
      folders.push({ label: segments[segments.length - 1] + "  (user)", value: path, depth: segments.length });
    }
    const result = await win98PickFolder(folders, {
      title: "Save image to folder",
      defaultName: defaultFileName(),
    });
    if (!result) return;
    const dataURL = canvas.toDataURL("image/png");
    saveImage(result.path, dataURL, result.name || defaultFileName());
  }

  // Toolbar Undo button
  wrap.querySelector(".pt-undo").addEventListener("click", doUndo);

  // Ctrl/Cmd+Z global keybinding for Undo
  document.addEventListener("keydown", function paintKey(e) {
    if (!wrap.isConnected) {
      document.removeEventListener("keydown", paintKey);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
    }
  });

  // Classic Win98 menu bar — File / Edit / Image / Help
  const menubar = wrap.querySelector(".paint-menubar");
  buildMenubar(menubar, [
    { label: "File", items: [
      { label: "New",                       action: doNew,           accel: "Ctrl+N" },
      "sep",
      { label: "Save to Desktop",           action: doSaveToDesktop },
      { label: "Save to Folder…",           action: doSaveAs },
      { label: "Download to my Computer",   action: doDownload,      accel: "Ctrl+S" },
      "sep",
      { label: "Close",                     action: () => { const win = wrap.closest(".window"); if (win) closeWindow(parseInt(win.dataset.id, 10)); } },
    ]},
    { label: "Edit", items: [
      { label: "Undo",          action: doUndo,   accel: "Ctrl+Z" },
      "sep",
      { label: "Clear Image",   action: doNew },
    ]},
    { label: "Image", items: [
      { label: "Attributes...", action: doAttributes },
    ]},
    { label: "Help", items: [
      { label: "About Paint",   action: () => win98Info("Paint — a tiny in-page MS Paint clone.", "About Paint") },
    ]},
  ]);

  // Coords helper — work entirely in BODY-INTERNAL px (the same convention as
  // window/icon dragging): pointer clientX/Y arrive post-zoom, offsetLeft/Top
  // are pre-zoom, and on iOS WebKit getBoundingClientRect disagrees with touch
  // coords under CSS zoom — which made strokes land away from the finger.
  function pos(e) {
    const p = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    const z = currentZoom() || 1;
    let ax = 0, ay = 0, el = canvas;
    while (el) { ax += el.offsetLeft; ay += el.offsetTop; el = el.offsetParent; }
    // a scrolled ancestor (the canvas-wrap, the window body…) shifts the canvas
    for (let sc = canvas.parentElement; sc && sc !== document.body; sc = sc.parentElement) {
      ax -= sc.scrollLeft; ay -= sc.scrollTop;
    }
    const cw = canvas.offsetWidth || canvas.width, chh = canvas.offsetHeight || canvas.height;
    return {
      x: Math.round((p.clientX / z - ax) * canvas.width  / cw),
      y: Math.round((p.clientY / z - ay) * canvas.height / chh),
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
    // Snapshot the canvas BEFORE this stroke so Undo can roll it back.
    pushUndo();
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

  // ---- ⚡ Bring to Life — the Stickman game's origin ritual ---------------
  // Find what the player drew, cut it off the canvas as a sprite, wake it up
  // (shake, two hops), then hand it to the stickman engine mid-leap: the
  // drawing escapes Paint and lands on the desktop, alive and controllable.
  const lifeBtn = wrap.querySelector(".pt-life");
  let waking = false;
  function drawnBBox() {
    const cw = canvas.width, chh = canvas.height;
    const img = ctx.getImageData(0, 0, cw, chh).data;
    let minX = cw, minY = chh, maxX = -1, maxY = -1;
    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4;
        if (img[i] < 246 || img[i + 1] < 246 || img[i + 2] < 246) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || (maxX - minX) < 6 || (maxY - minY) < 6) return null;
    const pad = 3;
    return {
      x: Math.max(0, minX - pad), y: Math.max(0, minY - pad),
      w: Math.min(cw - 1, maxX + pad) - Math.max(0, minX - pad) + 1,
      h: Math.min(chh - 1, maxY + pad) - Math.max(0, minY - pad) + 1,
    };
  }
  function paintToast(msg) {
    const tEl = document.createElement("div");
    tEl.className = "paint-life-hint";
    tEl.textContent = msg;
    wrap.querySelector(".paint-canvas-wrap").appendChild(tEl);
    setTimeout(() => tEl.classList.add("fade"), 3400);
    setTimeout(() => tEl.remove(), 4100);
  }
  // ---- the figure's Level-1 world: the live canvas box, in body-internal px ----
  function canvasWorldRect() {
    if (!canvas.isConnected) return null;
    const zz = currentZoom() || 1;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { l: r.left / zz, t: r.top / zz, r: r.right / zz, b: r.bottom / zz };
  }
  function worldToCanvasPt(wx, wy) {
    const zz = currentZoom() || 1;
    const r = canvas.getBoundingClientRect();
    return { x: (wx - r.left / zz) * canvas.width / (r.width / zz), y: (wy - r.top / zz) * canvas.height / (r.height / zz) };
  }
  // each slam tears real cracks into the page (drawn into the actual canvas)
  function drawWallCrack(side, wy) {
    const p = worldToCanvasPt(0, wy);
    const edgeX = side === "left" ? 1 : canvas.width - 1;
    const dir = side === "left" ? 1 : -1;
    ctx.save();
    ctx.strokeStyle = "#6f6f6f"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      let cx = edgeX, cy = p.y + (Math.random() * 30 - 15);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) { cx += dir * (5 + Math.random() * 10); cy += Math.random() * 16 - 8; ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // the third slam tears a hole clean through — the gray behind the page shows
  function drawWallHole(side, wy) {
    const p = worldToCanvasPt(0, wy);
    const edgeX = side === "left" ? 0 : canvas.width;
    const dir = side === "left" ? 1 : -1;
    ctx.save();
    ctx.fillStyle = "#808080";
    ctx.beginPath();
    ctx.moveTo(edgeX, p.y - 44);
    for (let i = 1; i <= 7; i++) ctx.lineTo(edgeX + dir * (10 + Math.random() * 22), p.y - 44 + (88 / 7) * i);
    ctx.lineTo(edgeX, p.y + 44);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5c5c5c"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function bringToLife() {
    if (waking) return;
    const box = drawnBBox();
    if (!box) { paintToast("Draw a stickman first — then press ⚡"); return; }
    waking = true;
    lifeBtn.classList.remove("attn");
    try { sessionStorage.setItem("sm-life-used", "1"); } catch (_) {}
    // cut the drawing into a transparent sprite (white drops out)
    const cut = document.createElement("canvas");
    cut.width = box.w; cut.height = box.h;
    const cctx = cut.getContext("2d");
    cctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const d = cctx.getImageData(0, 0, box.w, box.h);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i] > 245 && d.data[i + 1] > 245 && d.data[i + 2] > 245) d.data[i + 3] = 0;
    }
    cctx.putImageData(d, 0, 0);
    // overlay the sprite exactly over the drawing (body-internal px)
    const z = currentZoom() || 1;
    const cr = canvas.getBoundingClientRect();
    const wrapEl = wrap.querySelector(".paint-canvas-wrap");
    const wr = wrapEl.getBoundingClientRect();
    const sx = (cr.width / z) / canvas.width, sy = (cr.height / z) / canvas.height;
    const sprite = document.createElement("img");
    sprite.src = cut.toDataURL();
    sprite.className = "paint-wake-sprite";
    sprite.style.left = ((cr.left - wr.left) / z + wrapEl.scrollLeft + box.x * sx) + "px";
    sprite.style.top  = ((cr.top  - wr.top)  / z + wrapEl.scrollTop  + box.y * sy) + "px";
    sprite.style.width  = (box.w * sx) + "px";
    sprite.style.height = (box.h * sy) + "px";
    wrapEl.appendChild(sprite);
    // the drawing leaves the page — erase it (Ctrl+Z can resurrect a copy)
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    sprite.classList.add("wake");                                                  // …did it just move?
    setTimeout(() => { sprite.classList.remove("wake"); sprite.classList.add("hop"); }, 640); // it's ALIVE — two excited hops
    setTimeout(() => {
      // hand off to the engine IN PLACE — and the character IS the drawing:
      // the exact cut-out bitmap becomes the playable figure, no swap, no poof.
      // Level 1 is the canvas itself: it must crack a wall to get out.
      const sr = sprite.getBoundingClientRect();
      const worldX = (sr.left + sr.width / 2) / z;
      const worldY = sr.bottom / z;
      spawnStickmanAt({
        x: worldX, y: worldY - 2, vx: 0, vy: -8.5,
        sprite: { url: sprite.src, w: sr.width / z, h: sr.height / z },
        confine: { rect: canvasWorldRect, onCrack: drawWallCrack, onBreak: drawWallHole },
      });
      sprite.remove(); // the engine renders the SAME bitmap from this exact spot
      waking = false;
    }, 640 + 800);
  }
  lifeBtn.addEventListener("click", bringToLife);
  // the ⚡ IS the game's front door now — it pulses until the player has used
  // it once (per session), and the invitation toast shows once per session
  let lifeUsed = false;
  try { lifeUsed = sessionStorage.getItem("sm-life-used") === "1"; } catch (_) {}
  if (!lifeUsed) {
    lifeBtn.classList.add("attn");
    if (!openPaint.__hinted) {
      openPaint.__hinted = true;
      setTimeout(() => paintToast("Draw a stickman — then press ⚡ to bring it to life"), 600);
    }
  }

  const winId = openWindow({
    title: "Paint",
    icon: ICONS.paint(14),
    iconHtml: true,
    content: wrap,
    width: 720,
    height: 540,
    flush: true,
  });

  // After the window mounts: on mobile, maximize so paint fills the screen.
  // Then size the canvas to fully fit the canvas-wrap area, oriented the
  // same way as the device (portrait window → portrait canvas, etc.).
  setTimeout(() => {
    const isNarrow = window.matchMedia("(max-width: 720px)").matches;
    if (isNarrow) toggleMaximize(winId);
    // Wait one more tick for the maximize layout to settle.
    setTimeout(() => {
      const wrapEl = wrap.querySelector(".paint-canvas-wrap");
      if (!wrapEl) return;
      const w = Math.max(120, Math.floor(wrapEl.clientWidth));
      const h = Math.max(120, Math.floor(wrapEl.clientHeight));
      canvas.width  = w;
      canvas.height = h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      // Reset undo stack — the dimensions changed; old snapshots would
      // throw on putImageData.
      undoStack.length = 0;
    }, 50);
  }, 0);

  return winId;
}
