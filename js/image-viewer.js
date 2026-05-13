// Image Viewer — pan/zoom canvas-backed preview app.
// Renders images via <canvas> so right-click "Save image as" disappears,
// blocks contextmenu / drag / selection. (Deterrent only — anything on
// screen can be screenshotted.)
//
// Public API:
//   openImageViewer(src, title)
//   openImageViewer({ list, index })   // list: [{src, name}], index: 0..n-1

import { openWindow, closeWindow } from "./window-manager.js";
import { ICONS } from "./icons.js";
import { FS } from "./file-system.js";

// Collect every kind:"image" leaf in the virtual file system. Used as the
// default list when the viewer is opened from the start menu.
function collectAllPortfolioImages(node = FS, out = []) {
  if (!node) return out;
  if (node.type === "file" && node.kind === "image") {
    out.push({
      src: node.src,
      preview: node.preview,
      thumb: node.thumb,
      name: node.name,
      detailW: node.detailW,
      detailH: node.detailH,
    });
  } else if (node.children) {
    for (const c of node.children) collectAllPortfolioImages(c, out);
  }
  return out;
}

export function openImageViewer(arg1, title) {
  // Normalize the argument shape into { list, index }.
  let list, index;
  if (arg1 && typeof arg1 === "object" && Array.isArray(arg1.list)) {
    list = arg1.list.slice();
    index = Math.max(0, Math.min(list.length - 1, arg1.index || 0));
    title = arg1.title || (list[index] && list[index].name) || "Image Viewer";
  } else if (typeof arg1 === "string") {
    list = arg1 ? [{ src: arg1, name: title || "Image" }] : [];
    index = 0;
    title = title || (list[0] && list[0].name) || "Image Viewer";
  } else {
    // Opened with no args (e.g. from the start menu) — default to ALL
    // portfolio images so prev/next walks David's whole gallery.
    list = collectAllPortfolioImages();
    index = 0;
    title = title || (list[0] && list[0].name) || "Image Viewer";
  }

  const wrap = document.createElement("div");
  wrap.className = "iv";
  wrap.innerHTML = `
    <div class="iv-menubar">
      <button class="iv-menu" data-menu="file">File</button>
      <button class="iv-menu" data-menu="view">View</button>
      <span class="iv-menubar-spacer"></span>
      <button class="iv-mb-nav iv-prev" aria-label="Previous image" title="Previous">‹</button>
      <button class="iv-mb-nav iv-next" aria-label="Next image"     title="Next">›</button>
    </div>
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
      <div class="iv-navigator" hidden>
        <canvas class="iv-nav-canvas" width="160" height="120"></canvas>
        <div class="iv-nav-rect"></div>
      </div>
      <div class="iv-empty">
        <p>No images in this portfolio yet.</p>
      </div>
    </div>
  `;

  const stage    = wrap.querySelector(".iv-stage");
  const canvas   = wrap.querySelector(".iv-canvas");
  const ctx      = canvas.getContext("2d", { alpha: true });
  const info     = wrap.querySelector(".iv-info");
  const prevBtn  = wrap.querySelector(".iv-prev");
  const nextBtn  = wrap.querySelector(".iv-next");
  const emptyEl  = wrap.querySelector(".iv-empty");
  const navEl    = wrap.querySelector(".iv-navigator");
  const navCv    = wrap.querySelector(".iv-nav-canvas");
  const navCtx   = navCv.getContext("2d");
  const navRect  = wrap.querySelector(".iv-nav-rect");
  const isTouch  = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  // unused references — kept for clarity
  void wrap.querySelector(".iv-empty");

  let img = new Image();
  let scale = 1;
  let tx = 0, ty = 0;
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
    const cur = list[index];
    // Show the master (detail) dimensions — don't bounce the readout as
    // each progressive level loads in. Fall back to current image's
    // natural size if the manifest didn't provide detailW/H.
    const showW = (cur && cur.detailW) || img.naturalWidth;
    const showH = (cur && cur.detailH) || img.naturalHeight;
    // Visual zoom is relative to the master size, not the loaded level.
    const visualZoom = img.naturalWidth ? (img.naturalWidth * scale / showW) : scale;
    info.textContent = `${cur ? (cur.name + "  ") : ""}${showW}×${showH}  ${Math.round(visualZoom * 100)}%`;
    drawNavigator();
  }

  // Navigator (Photoshop-style mini-map). Visible only on desktop and only
  // when the image is zoomed enough that pan is meaningful.
  function fitScale() {
    if (!loaded) return 1;
    const w = stage.clientWidth, h = stage.clientHeight;
    return Math.min(w / img.naturalWidth, h / img.naturalHeight, 1);
  }
  function drawNavigator() {
    if (!loaded || isTouch) { navEl.hidden = true; return; }
    const fs = fitScale();
    if (scale <= fs * 1.05) { navEl.hidden = true; return; }
    navEl.hidden = false;
    const NW = navCv.width, NH = navCv.height;
    navCtx.fillStyle = "#1a1a1a";
    navCtx.fillRect(0, 0, NW, NH);
    const nFit = Math.min(NW / img.naturalWidth, NH / img.naturalHeight);
    const dw = img.naturalWidth  * nFit;
    const dh = img.naturalHeight * nFit;
    const ox = (NW - dw) / 2;
    const oy = (NH - dh) / 2;
    navCtx.imageSmoothingQuality = "low";
    navCtx.drawImage(img, ox, oy, dw, dh);
    // Viewport rect in image-space
    const w = stage.clientWidth, h = stage.clientHeight;
    const vx = (-tx) / scale;          // image x of viewport left
    const vy = (-ty) / scale;
    const vw = w / scale;
    const vh = h / scale;
    const rL = ox + vx * nFit;
    const rT = oy + vy * nFit;
    const rW = vw * nFit;
    const rH = vh * nFit;
    navRect.style.left   = Math.max(ox, rL) + "px";
    navRect.style.top    = Math.max(oy, rT) + "px";
    navRect.style.width  = Math.min(dw, rW) + "px";
    navRect.style.height = Math.min(dh, rH) + "px";
    navEl._navMeta = { ox, oy, dw, dh, nFit };
  }

  function updateNavVisibility() {
    const hasMany = list.length > 1;
    prevBtn.hidden = !hasMany;
    nextBtn.hidden = !hasMany;
    emptyEl.hidden = list.length > 0;
  }

  // Bump on every loadCurrent so stale Image.onload callbacks from a
  // previous load can't overwrite the current image.
  let loadToken = 0;

  function loadCurrent() {
    if (!list.length || index < 0 || index >= list.length) {
      loaded = false;
      updateNavVisibility();
      draw();
      return;
    }
    const cur = list[index];
    setTitle(cur.name || "Image Viewer");
    loaded = false;

    const myToken = ++loadToken;
    const tinyURL = cur.thumb || cur.preview || cur.src;
    const mainURL = cur.preview || cur.src;
    const fullURL = cur.src;

    let currentLevel = 0;       // 0 nothing, 1 thumb, 2 preview, 3 detail
    let hasInitialFit = false;

    const apply = (next, level) => {
      // Bail if user has navigated away to a different image since.
      if (myToken !== loadToken) return;
      if (level <= currentLevel) return;

      if (!hasInitialFit || !img || !img.naturalWidth) {
        // First image we've seen — center it and call fit so the whole
        // piece is on screen.
        img = next;
        loaded = true;
        currentLevel = level;
        hasInitialFit = true;
        resize();
        fit();
      } else {
        // Upgrading: drawImage uses (tx, ty, naturalW*scale, naturalH*scale).
        // To make the new (higher-res) image render at the SAME pixels as
        // the old one, shrink scale by the natural-width ratio. tx/ty stay.
        const ratio = img.naturalWidth / next.naturalWidth;
        img = next;
        loaded = true;
        currentLevel = level;
        scale = scale * ratio;
        draw();
      }
    };

    const fetchAt = (url, level) => {
      if (!url) return;
      const next = new Image();
      next.decoding = "async";
      next.onload = () => apply(next, level);
      next.onerror = () => {
        if (currentLevel === 0 && level === 1) info.textContent = "Failed to load: " + url;
      };
      next.src = url;
    };

    fetchAt(tinyURL, 1);
    if (mainURL && mainURL !== tinyURL) fetchAt(mainURL, 2);
    if (fullURL && fullURL !== mainURL) fetchAt(fullURL, 3);

    updateNavVisibility();
  }

  function setTitle(t) {
    const winEl = wrap.closest(".window");
    if (winEl) {
      const titleEl = winEl.querySelector(".window-titlebar .title");
      if (titleEl) titleEl.textContent = t;
    }
  }

  function prev() {
    if (list.length < 2) return;
    index = (index - 1 + list.length) % list.length;
    loadCurrent();
  }
  function next() {
    if (list.length < 2) return;
    index = (index + 1) % list.length;
    loadCurrent();
  }

  // Pan with drag
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

  // Touch: 1 finger = pan, 2 fingers = pinch-zoom (centered on midpoint)
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchAnchorImg = null;   // image-space anchor point we keep under the midpoint
  function touchMidpoint(e) {
    const r = canvas.getBoundingClientRect();
    const a = e.touches[0], b = e.touches[1];
    return {
      x: (a.clientX + b.clientX) / 2 - r.left,
      y: (a.clientY + b.clientY) / 2 - r.top,
    };
  }
  function touchDistance(e) {
    const a = e.touches[0], b = e.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      onDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      dragging = false;
      pinchStartDist  = touchDistance(e);
      pinchStartScale = scale;
      const mid = touchMidpoint(e);
      pinchAnchorImg  = { ix: (mid.x - tx) / scale, iy: (mid.y - ty) / scale };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      if (e.cancelable) e.preventDefault();
      const dist = touchDistance(e);
      const mid = touchMidpoint(e);
      scale = Math.max(0.05, Math.min(20, pinchStartScale * (dist / pinchStartDist)));
      // Keep the original image-space anchor under the (moving) midpoint
      tx = mid.x - pinchAnchorImg.ix * scale;
      ty = mid.y - pinchAnchorImg.iy * scale;
      draw();
    } else if (e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) { pinchStartDist = 0; pinchAnchorImg = null; }
    onUp();
  });

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
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  // Keyboard arrows
  function keyHandler(e) {
    if (!wrap.isConnected) {
      document.removeEventListener("keydown", keyHandler);
      return;
    }
    if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  }
  document.addEventListener("keydown", keyHandler);

  // Menu bar — File menu only has Close. The viewer is bound to portfolio
  // content; you don't open arbitrary local files from here.
  const menubar = wrap.querySelector(".iv-menubar");
  buildIvMenu(menubar.querySelector('[data-menu="file"]'), [
    { label: "Close",  action: () => {
      const winEl = wrap.closest(".window");
      if (winEl) closeWindow(parseInt(winEl.dataset.id, 10));
    } },
  ]);
  buildIvMenu(menubar.querySelector('[data-menu="view"]'), [
    { label: "Zoom in",       action: () => setScale(scale * 1.25), accel: "+" },
    { label: "Zoom out",      action: () => setScale(scale / 1.25), accel: "−" },
    "sep",
    { label: "Fit to window", action: fit },
    { label: "Actual size",   action: () => setScale(1) },
    "sep",
    { label: "Previous image", action: prev, accel: "←" },
    { label: "Next image",     action: next, accel: "→" },
  ]);

  // Navigator drag — clicking the mini-map centers the main viewport there.
  function navToImageCoords(clientX, clientY) {
    const meta = navEl._navMeta;
    if (!meta) return null;
    const r = navCv.getBoundingClientRect();
    const nx = clientX - r.left;
    const ny = clientY - r.top;
    // Convert nav-canvas px back to image-space px
    return {
      ix: (nx - meta.ox) / meta.nFit,
      iy: (ny - meta.oy) / meta.nFit,
    };
  }
  function centerImageOn(ix, iy) {
    const w = stage.clientWidth, h = stage.clientHeight;
    tx = w / 2 - ix * scale;
    ty = h / 2 - iy * scale;
    draw();
  }
  let navDragging = false;
  const onNavDown = (e) => {
    navDragging = true;
    const p = navToImageCoords(e.clientX, e.clientY);
    if (p) centerImageOn(p.ix, p.iy);
    e.preventDefault();
  };
  const onNavMove = (e) => {
    if (!navDragging) return;
    const p = navToImageCoords(e.clientX, e.clientY);
    if (p) centerImageOn(p.ix, p.iy);
  };
  const onNavUp = () => { navDragging = false; };
  navEl.addEventListener("mousedown", onNavDown);
  window.addEventListener("mousemove", onNavMove);
  window.addEventListener("mouseup", onNavUp);

  // React to window resize
  const ro = new ResizeObserver(() => { resize(); });
  setTimeout(() => ro.observe(stage), 0);

  const winId = openWindow({
    title,
    icon: ICONS.picture(14),
    iconHtml: true,
    content: wrap,
    width: 720,
    height: 540,
    flush: true,
  });

  // Kick off after the window mounts so .iv-stage has a real size.
  setTimeout(loadCurrent, 0);

  return winId;
}

// Tiny menu dropdown helper — same style as Paint's menubar but local to
// this module so the file is self-contained.
function buildIvMenu(btn, items) {
  let openDrop = null;
  const close = () => {
    if (openDrop) { openDrop.remove(); openDrop = null; }
    btn.classList.remove("open");
    document.removeEventListener("click", outsideClose, true);
  };
  const outsideClose = (e) => {
    if (!btn.contains(e.target) && (!openDrop || !openDrop.contains(e.target))) close();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (openDrop) { close(); return; }
    btn.classList.add("open");
    const drop = document.createElement("div");
    drop.className = "pm-drop";
    for (const it of items) {
      if (it === "sep") {
        const sep = document.createElement("div");
        sep.className = "pm-sep";
        drop.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className = "pm-item";
      row.innerHTML = `<span class="pm-lbl">${it.label}</span>${it.accel ? `<span class="pm-accel">${it.accel}</span>` : ""}`;
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        close();
        it.action();
      });
      drop.appendChild(row);
    }
    const r = btn.getBoundingClientRect();
    drop.style.position = "fixed";
    drop.style.left = r.left + "px";
    drop.style.top  = r.bottom + "px";
    document.body.appendChild(drop);
    openDrop = drop;
    document.addEventListener("click", outsideClose, true);
  });
}
