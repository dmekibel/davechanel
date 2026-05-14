// Image Viewer — pan/zoom canvas-backed preview app.
// Renders images via <canvas> so right-click "Save image as" disappears,
// blocks contextmenu / drag / selection. (Deterrent only — anything on
// screen can be screenshotted.)
//
// Public API:
//   openImageViewer(src, title)
//   openImageViewer({ list, index })   // list: [{src, name}], index: 0..n-1

import { openWindow, closeWindow, toggleMaximize, setWindowTitle } from "./window-manager.js";
import { ICONS } from "./icons.js";
import { FS } from "./file-system.js";
import { currentZoom } from "./scale.js";

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
      <button class="iv-btn iv-zoom-out"   title="Zoom out">−</button>
      <button class="iv-btn iv-zoom-in"    title="Zoom in">+</button>
      <button class="iv-btn iv-fit"        title="Fit to window">Fit</button>
      <button class="iv-btn iv-actual"     title="Actual size">100%</button>
      <button class="iv-btn iv-fullscreen" title="Full screen (image only)">⛶ Full</button>
      <span class="iv-spacer"></span>
      <span class="iv-info" hidden></span>
    </div>
    <div class="iv-stage iv-show-arrows">
      <canvas class="iv-canvas"></canvas>
      <button class="iv-side iv-side-prev" aria-label="Previous image">
        <span class="iv-side-arrow">‹</span>
      </button>
      <button class="iv-side iv-side-next" aria-label="Next image">
        <span class="iv-side-arrow">›</span>
      </button>
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

  // Swipe-to-nav state (iOS Photos style).
  //   gestureMode: "idle" | "undecided" | "panning" | "swiping"
  //   swipeOffsetX: current horizontal swipe offset, in viewport px.
  //   neighbors: preloaded preview-quality prev/next Image()s.
  let gestureMode = "idle";
  let swipeOffsetX = 0;
  let swipeStartX = 0, swipeStartY = 0, swipeStartT = 0;
  let swipeLastX = 0,  swipeLastY = 0;
  const SWIPE_DECIDE_PX = 8;
  const neighbors = { prev: null, next: null };
  let snapRaf = null;
  let pendingCommit = null;        // { cb } if a commit-to-next/prev anim is in-flight

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
    // Fit relative to the MASTER dimensions, not the currently-loaded
    // progressive level. That way a 300 px thumb still fills the stage
    // (blurry briefly) instead of sitting tiny in the corner.
    const cur = list[index];
    const targetW = (cur && cur.detailW) || img.naturalWidth;
    const targetH = (cur && cur.detailH) || img.naturalHeight;
    const masterScale = Math.min(w / targetW, h / targetH, 1);
    // Translate to "scale of the master" into the actual loaded image's
    // scale: drawImage uses img.naturalWidth * scale.
    scale = masterScale * (targetW / img.naturalWidth);
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

  // Compute fit-scale position for an arbitrary loaded image (used to
  // draw the current image AND its neighbors during a swipe).
  function fitDrawRect(im) {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!im || !im.naturalWidth) return null;
    const s = Math.min(w / im.naturalWidth, h / im.naturalHeight, 1);
    return {
      s,
      dw: im.naturalWidth  * s,
      dh: im.naturalHeight * s,
      dx: (w - im.naturalWidth  * s) / 2,
      dy: (h - im.naturalHeight * s) / 2,
    };
  }

  function draw() {
    const w = stage.clientWidth, h = stage.clientHeight;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);
    if (!loaded) return;
    ctx.imageSmoothingQuality = "high";

    if (swipeOffsetX !== 0 && gestureMode !== "panning") {
      // Swipe transition: current image follows finger; neighbor enters
      // from the opposite edge with a small gap.
      const GAP = 16;
      const cur = fitDrawRect(img);
      ctx.drawImage(img, cur.dx + swipeOffsetX, cur.dy, cur.dw, cur.dh);
      if (swipeOffsetX < 0 && neighbors.next) {
        const n = fitDrawRect(neighbors.next);
        ctx.drawImage(neighbors.next, n.dx + swipeOffsetX + w + GAP, n.dy, n.dw, n.dh);
      } else if (swipeOffsetX > 0 && neighbors.prev) {
        const p = fitDrawRect(neighbors.prev);
        ctx.drawImage(neighbors.prev, p.dx + swipeOffsetX - w - GAP, p.dy, p.dw, p.dh);
      }
    } else {
      ctx.drawImage(img, tx, ty, img.naturalWidth * scale, img.naturalHeight * scale);
    }

    const cur = list[index];
    const showW = (cur && cur.detailW) || img.naturalWidth;
    const showH = (cur && cur.detailH) || img.naturalHeight;
    const visualZoom = img.naturalWidth ? (img.naturalWidth * scale / showW) : scale;
    info.textContent = `${cur ? (cur.name + "  ") : ""}${showW}×${showH}  ${Math.round(visualZoom * 100)}%`;
    drawNavigator();
  }

  // Preload the preview-quality prev and next images so the swipe
  // transition has something real to show before nav commits.
  function preloadNeighbors() {
    neighbors.prev = neighbors.next = null;
    if (list.length < 2) return;
    const prevItem = list[(index - 1 + list.length) % list.length];
    const nextItem = list[(index + 1) % list.length];
    const make = (slot, item) => {
      const im = new Image();
      im.onload = () => { neighbors[slot] = im; };
      im.src = item.preview || item.thumb || item.src;
    };
    make("prev", prevItem);
    make("next", nextItem);
  }

  // Animate swipeOffsetX from its current value to `target`, then run cb.
  // If `target` isn't 0 (i.e. we're committing to a neighbor), we remember
  // the cb so a subsequent touchstart that interrupts us can fire it
  // immediately — otherwise fast successive swipes would drop nav calls.
  function animateSwipeTo(target, cb) {
    if (snapRaf) cancelAnimationFrame(snapRaf);
    pendingCommit = (target !== 0 && cb) ? { cb } : null;
    const start = swipeOffsetX;
    const t0 = performance.now();
    const dur = 220;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      swipeOffsetX = start + (target - start) * ease(k);
      draw();
      if (k < 1) {
        snapRaf = requestAnimationFrame(step);
      } else {
        swipeOffsetX = target;
        snapRaf = null;
        pendingCommit = null;
        draw();
        cb && cb();
      }
    };
    snapRaf = requestAnimationFrame(step);
  }
  // Flush any in-flight commit instantly — used by touchstart so the
  // first navigation always lands even if the user starts swipe 2 mid-
  // animation.
  function flushPendingCommit() {
    if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = null; }
    if (pendingCommit) {
      const cb = pendingCommit.cb;
      pendingCommit = null;
      swipeOffsetX = 0;
      gestureMode = "idle";
      cb && cb();
    }
  }

  function finishSwipe() {
    const w = stage.clientWidth;
    const threshold = Math.max(50, w * 0.25);
    // Commit even if the neighbor preview hasn't loaded yet — we'll just
    // animate past the edge and call next()/prev(); the new image will
    // load progressively in the destination.
    if (swipeOffsetX <= -threshold && list.length > 1) {
      animateSwipeTo(-w - 16, () => {
        swipeOffsetX = 0;
        gestureMode = "idle";
        next();
      });
    } else if (swipeOffsetX >= threshold && list.length > 1) {
      animateSwipeTo(w + 16, () => {
        swipeOffsetX = 0;
        gestureMode = "idle";
        prev();
      });
    } else {
      animateSwipeTo(0, () => { gestureMode = "idle"; });
    }
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
    stage.classList.toggle("iv-no-nav", !hasMany);
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
    preloadNeighbors();
  }

  function setTitle(t) {
    const winEl = wrap.closest(".window");
    if (winEl && winEl.dataset.id) {
      setWindowTitle(parseInt(winEl.dataset.id, 10), t);
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

  // Touch: 1 finger = pan or swipe, 2 fingers = pinch-zoom.
  // The swipe detector tracks the SAME gesture as pan: we only commit a
  // swipe (next/prev image) on touchend if the motion was mostly
  // horizontal, fast, and the image is at or near "fit" scale (zoomed-
  // in users probably want to pan around, not jump to the next image).
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchAnchorImg = null;
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
    flushPendingCommit();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      swipeStartX = t.clientX;
      swipeStartY = t.clientY;
      swipeStartT = Date.now();
      swipeLastX  = t.clientX;
      swipeLastY  = t.clientY;
      gestureMode = "undecided";
      // We still record the pan start so existing pan code works once
      // we commit to "panning". Pan won't actually move anything until
      // we set gestureMode to "panning" in touchmove.
      onDown(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      gestureMode = "idle";          // pinch — neither swipe nor pan
      swipeOffsetX = 0;
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
      tx = mid.x - pinchAnchorImg.ix * scale;
      ty = mid.y - pinchAnchorImg.iy * scale;
      draw();
      return;
    }
    if (e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - swipeStartX;
    const dy = t.clientY - swipeStartY;

    // First few px decide: at-near-fit horizontal motion → swipe gesture.
    // Otherwise → pan (the existing behavior; tx/ty follow finger).
    if (gestureMode === "undecided") {
      if (Math.abs(dx) > SWIPE_DECIDE_PX || Math.abs(dy) > SWIPE_DECIDE_PX) {
        const fs = fitScale();
        const nearFit = scale <= fs * 1.25;
        if (nearFit && Math.abs(dx) > Math.abs(dy) && list.length > 1) {
          gestureMode = "swiping";
        } else {
          gestureMode = "panning";
        }
      }
    }

    swipeLastX = t.clientX;
    swipeLastY = t.clientY;

    if (gestureMode === "swiping") {
      swipeOffsetX = dx;
      if (list.length < 2) swipeOffsetX = dx * 0.3;
      draw();
    } else if (gestureMode === "panning") {
      onMove(t.clientX, t.clientY);
    }
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) { pinchStartDist = 0; pinchAnchorImg = null; }

    // Fling-to-nav: a fast horizontal flick always navigates, even when
    // zoomed in (where the gesture would otherwise be a pan) or when the
    // swipe distance didn't quite reach the visual threshold.
    const dxTotal = swipeLastX - swipeStartX;
    const dyTotal = swipeLastY - swipeStartY;
    const dt      = Date.now() - swipeStartT;
    const absX = Math.abs(dxTotal), absY = Math.abs(dyTotal);
    const isFling = list.length > 1 && dt > 0 && dt < 350 && absX > 80 && absX > absY * 1.5;

    if (gestureMode === "swiping") {
      if (isFling) {
        // Honor the fling direction even if swipeOffsetX didn't cross
        // the 25% threshold (a quick fast flick should still commit).
        const w = stage.clientWidth;
        if (dxTotal < 0) animateSwipeTo(-w - 16, () => { swipeOffsetX = 0; gestureMode = "idle"; next(); });
        else             animateSwipeTo( w + 16, () => { swipeOffsetX = 0; gestureMode = "idle"; prev(); });
      } else {
        finishSwipe();
      }
    } else if (gestureMode === "panning") {
      if (isFling) {
        // Zoomed-in fling: commit to next/prev. fit() runs inside loadCurrent
        // → the new image starts fresh.
        if (dxTotal < 0) next(); else prev();
        gestureMode = "idle";
      } else {
        // After panning at fit scale, snap the image back inside the stage.
        const fs = fitScale();
        if (scale <= fs * 1.05) setTimeout(fit, 0);
        onUp();
        gestureMode = "idle";
      }
    } else {
      onUp();
      gestureMode = "idle";
    }
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

  // ---- Full-screen mode ---------------------------------------------------
  // Drops all chrome and locks the viewer over the whole viewport. To exit
  // you tap once without dragging and without pinching. Pan (drag) and
  // pinch-zoom both stay inside fullscreen. Tapping the left/right side
  // zones flips to prev/next while staying in fullscreen.
  let fullscreen = false;
  let exitPending = false;
  let exitStartX = 0, exitStartY = 0;
  let originalParent = null, originalNextSibling = null;
  const EXIT_MOVE_THRESHOLD = 8;   // px of pointer travel that disqualifies a tap

  function enterFullscreen() {
    if (fullscreen) return;
    fullscreen = true;
    // Portal the viewer to <body> so it escapes the window's stacking
    // context and covers the taskbar / titlebar / everything.
    originalParent = wrap.parentNode;
    originalNextSibling = wrap.nextSibling;
    document.body.appendChild(wrap);
    wrap.classList.add("iv-fullscreen-root");
    setTimeout(() => { resize(); fit(); }, 30);
    document.addEventListener("keydown", fsKey, true);
  }
  function exitFullscreen() {
    if (!fullscreen) return;
    fullscreen = false;
    wrap.classList.remove("iv-fullscreen-root");
    if (originalParent) originalParent.insertBefore(wrap, originalNextSibling);
    originalParent = originalNextSibling = null;
    document.removeEventListener("keydown", fsKey, true);
    setTimeout(() => { resize(); fit(); }, 30);
  }
  function fsKey(e) {
    if (e.key === "Escape") { e.preventDefault(); exitFullscreen(); }
  }
  wrap.querySelector(".iv-fullscreen").addEventListener("click", enterFullscreen);

  // Double-click / double-tap on the image enters fullscreen.
  canvas.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (!fullscreen) enterFullscreen();
  });
  // Manual double-tap detection for iOS (dblclick is unreliable on touch).
  // Only count it as a tap if the touch barely moved — otherwise a quick
  // pair of swipes between images would mistakenly trigger fullscreen.
  let lastTapAt = 0, lastTapX = 0, lastTapY = 0;
  canvas.addEventListener("touchend", (e) => {
    if (fullscreen) return;
    if (e.changedTouches.length !== 1) return;
    if (e.touches.length !== 0) return;
    // If this gesture was a swipe or a pan, don't treat it as a tap.
    if (gestureMode === "swiping" || gestureMode === "panning") {
      lastTapAt = 0;
      return;
    }
    const t = e.changedTouches[0];
    // Distance from the touchstart — if user moved, it's a drag, not a tap.
    const moved = Math.hypot(t.clientX - swipeStartX, t.clientY - swipeStartY);
    if (moved > 12) {
      lastTapAt = 0;
      return;
    }
    const now = Date.now();
    const closeToLast = Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY) < 30;
    if (now - lastTapAt < 350 && closeToLast) {
      lastTapAt = 0;
      e.preventDefault();
      enterFullscreen();
    } else {
      lastTapAt = now;
      lastTapX = t.clientX;
      lastTapY = t.clientY;
    }
  });

  // Stage touch handling for the exit gesture.
  stage.addEventListener("touchstart", (e) => {
    if (!fullscreen) return;
    if (e.touches.length >= 2) { exitPending = false; return; }   // pinch
    // Edge taps: let the side zone's own click handler flip the image
    // and keep us in fullscreen. Don't arm the exit.
    if (e.target.closest(".iv-side")) { exitPending = false; return; }
    const t = e.touches[0];
    exitPending = true;
    exitStartX = t.clientX;
    exitStartY = t.clientY;
  }, { passive: true });
  stage.addEventListener("touchmove", (e) => {
    if (!fullscreen) return;
    if (e.touches.length >= 2) { exitPending = false; return; }   // pinch
    const t = e.touches[0];
    if (Math.hypot(t.clientX - exitStartX, t.clientY - exitStartY) > EXIT_MOVE_THRESHOLD) {
      exitPending = false;   // it's a drag/pan, not a tap
    }
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (!fullscreen) return;
    if (exitPending && e.touches.length === 0) {
      exitPending = false;
      exitFullscreen();
    }
  });

  // Desktop: only plain clicks (no drag in between) exit. Track mouse
  // distance from mousedown → mouseup; if the cursor moved noticeably,
  // treat it as a drag and don't exit.
  let mDownX = 0, mDownY = 0, mDragged = false;
  stage.addEventListener("mousedown", (e) => {
    if (!fullscreen) return;
    mDownX = e.clientX; mDownY = e.clientY; mDragged = false;
  });
  stage.addEventListener("mousemove", (e) => {
    if (!fullscreen) return;
    if (e.buttons && Math.hypot(e.clientX - mDownX, e.clientY - mDownY) > EXIT_MOVE_THRESHOLD) {
      mDragged = true;
    }
  });
  stage.addEventListener("click", (e) => {
    if (!fullscreen) return;
    if (mDragged) { mDragged = false; return; }
    exitFullscreen();
  });
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  // Side hit zones — full-height zones on the left and right of the
  // stage that always cycle prev/next on click. The visible arrow inside
  // fades out after a moment of inactivity but the zone stays clickable.
  const sidePrev = wrap.querySelector(".iv-side-prev");
  const sideNext = wrap.querySelector(".iv-side-next");
  sidePrev.addEventListener("click", (e) => { e.stopPropagation(); prev(); pingArrows(); });
  sideNext.addEventListener("click", (e) => { e.stopPropagation(); next(); pingArrows(); });

  let arrowFadeTimer = null;
  function pingArrows() {
    stage.classList.add("iv-show-arrows");
    clearTimeout(arrowFadeTimer);
    arrowFadeTimer = setTimeout(() => stage.classList.remove("iv-show-arrows"), 2200);
  }
  // Show arrows when the user pokes the stage — mouse move, tap, etc.
  stage.addEventListener("mousemove", pingArrows);
  stage.addEventListener("touchstart", pingArrows, { passive: true });
  // Initial nudge so they show briefly when the viewer first opens.
  pingArrows();

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

  // Default size: most of viewport with breathing room on top + bottom.
  // Don't auto-maximize — full-bleed feels claustrophobic on mobile and
  // hides the titlebar / close button.
  const z = currentZoom();
  const vw = window.innerWidth  / z;
  const vh = window.innerHeight / z;
  const isNarrow = window.matchMedia("(max-width: 720px)").matches;
  const marginTop    = isNarrow ?  6 : 24;
  const marginBottom = isNarrow ? 40 : 60;          // taskbar room
  const marginX      = isNarrow ?  4 : 24;
  const initialW = Math.min(1280, vw - marginX * 2);
  const initialH = Math.min(960,  vh - marginTop - marginBottom);

  const winId = openWindow({
    title,
    icon: ICONS.picture(14),
    iconHtml: true,
    content: wrap,
    width:  initialW,
    height: initialH,
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
