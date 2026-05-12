// Minesweeper — Win98 style. Three preset difficulties.
// Mouse: left-click reveal, right-click flag. Touch: tap reveal,
// long-press flag (350ms).

import { openWindow } from "./window-manager.js";
import { ICONS } from "./icons.js";
import { currentZoom } from "./scale.js";

const LEVELS = {
  beginner:     { w:  9, h:  9, mines: 10 },
  intermediate: { w: 16, h: 16, mines: 40 },
  expert:       { w: 30, h: 16, mines: 99 },
};

const NUM_COLORS = ["", "#0000aa", "#007a00", "#aa0000", "#000080", "#7a0000", "#007a7a", "#000000", "#7a7a7a"];

export function openMinesweeper() {
  const wrap = document.createElement("div");
  wrap.className = "ms";
  wrap.innerHTML = `
    <div class="ms-menubar">
      <button class="ms-menu" data-menu="game">Game</button>
    </div>
    <div class="ms-frame">
      <div class="ms-status">
        <div class="ms-counter ms-mines">000</div>
        <button class="ms-face" title="New game">🙂</button>
        <div class="ms-counter ms-timer">000</div>
      </div>
      <div class="ms-board"></div>
    </div>
  `;

  let level = LEVELS.beginner;
  let board = [];
  let gameOver = false;
  let firstClick = true;
  let revealed = 0;
  let flagsLeft = level.mines;
  let timer = 0;
  let timerHandle = null;

  const face = wrap.querySelector(".ms-face");
  const minesEl = wrap.querySelector(".ms-mines");
  const timerEl = wrap.querySelector(".ms-timer");
  const boardEl = wrap.querySelector(".ms-board");

  function pad3(n) { return String(Math.max(0, Math.min(999, n))).padStart(3, "0"); }
  function updateStatus() {
    minesEl.textContent = pad3(flagsLeft);
    timerEl.textContent = pad3(timer);
  }
  function startTimer() {
    if (timerHandle) return;
    timerHandle = setInterval(() => { timer++; updateStatus(); }, 1000);
  }
  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  // Pick a cell size that lets the board fit the viewport for the level.
  function cellPxForLevel(lvl) {
    const z = currentZoom();
    const vw = window.innerWidth  / z;
    const vh = window.innerHeight / z;
    const chromeW = 40;            // window borders + frame paddings
    const chromeH = 130;            // titlebar + menubar + status + frame
    const maxCellW = Math.floor((vw - chromeW) / lvl.w);
    const maxCellH = Math.floor((vh - chromeH) / lvl.h);
    return Math.max(12, Math.min(20, maxCellW, maxCellH));
  }

  // Resize the host window to match the current board.
  function fitWindowToBoard() {
    const winEl = wrap.closest(".window");
    if (!winEl) return;
    if (winEl.classList.contains("maximized")) return;
    const cell = cellPxForLevel(level);
    const z = currentZoom();
    const vw = window.innerWidth  / z;
    const vh = window.innerHeight / z;
    const w = Math.min(vw - 8, level.w * cell + 40);
    const h = Math.min(vh - 8, level.h * cell + 130);
    winEl.style.width  = w + "px";
    winEl.style.height = h + "px";
    // Re-center if it would overflow
    if (parseInt(winEl.style.left, 10) + w > vw) winEl.style.left = Math.max(4, (vw - w) / 2) + "px";
    if (parseInt(winEl.style.top,  10) + h > vh) winEl.style.top  = Math.max(4, (vh - h) / 2) + "px";
  }

  function newGame(lvl) {
    if (lvl) level = lvl;
    gameOver = false;
    firstClick = true;
    revealed = 0;
    flagsLeft = level.mines;
    timer = 0;
    stopTimer();
    face.textContent = "🙂";
    board = [];
    for (let y = 0; y < level.h; y++) {
      const row = [];
      for (let x = 0; x < level.w; x++) {
        row.push({ mine: false, revealed: false, flagged: false, n: 0 });
      }
      board.push(row);
    }
    renderBoard();
    updateStatus();
    fitWindowToBoard();
  }

  function placeMines(safeX, safeY) {
    let placed = 0;
    while (placed < level.mines) {
      const x = Math.floor(Math.random() * level.w);
      const y = Math.floor(Math.random() * level.h);
      if (board[y][x].mine) continue;
      if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
      board[y][x].mine = true;
      placed++;
    }
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (board[y][x].mine) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) continue;
            if (board[ny][nx].mine) n++;
          }
        }
        board[y][x].n = n;
      }
    }
  }

  function reveal(x, y) {
    if (gameOver) return;
    const c = board[y][x];
    if (c.revealed || c.flagged) return;
    if (firstClick) {
      placeMines(x, y);
      firstClick = false;
      startTimer();
    }
    if (c.mine) {
      gameOver = true;
      stopTimer();
      face.textContent = "💀";
      for (let yy = 0; yy < level.h; yy++) {
        for (let xx = 0; xx < level.w; xx++) {
          if (board[yy][xx].mine) board[yy][xx].revealed = true;
        }
      }
      renderBoard();
      return;
    }
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const cell = board[cy][cx];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      revealed++;
      if (cell.n === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) continue;
            stack.push([nx, ny]);
          }
        }
      }
    }
    if (revealed === level.w * level.h - level.mines) {
      gameOver = true;
      stopTimer();
      face.textContent = "😎";
    }
    renderBoard();
  }

  function toggleFlag(x, y) {
    if (gameOver) return;
    const c = board[y][x];
    if (c.revealed) return;
    c.flagged = !c.flagged;
    flagsLeft += c.flagged ? -1 : 1;
    updateStatus();
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    const cell = cellPxForLevel(level);
    boardEl.style.gridTemplateColumns = `repeat(${level.w}, ${cell}px)`;
    boardEl.style.setProperty("--ms-cell", cell + "px");
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const c = board[y][x];
        const cell = document.createElement("button");
        cell.className = "ms-cell" + (c.revealed ? " revealed" : "");
        cell.dataset.x = x;
        cell.dataset.y = y;
        if (c.revealed) {
          if (c.mine) {
            cell.classList.add("mine");
            cell.textContent = "✱";
          } else if (c.n > 0) {
            cell.textContent = c.n;
            cell.style.color = NUM_COLORS[c.n] || "#000";
          }
        } else if (c.flagged) {
          cell.textContent = "⚑";
          cell.classList.add("flag");
        }
        boardEl.appendChild(cell);
      }
    }
  }

  // Click handling — mouse and touch
  let holdTimer = null;
  let heldCell = null;
  boardEl.addEventListener("mousedown", (e) => {
    const cell = e.target.closest(".ms-cell");
    if (!cell) return;
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    if (e.button === 2) {
      e.preventDefault();
      toggleFlag(x, y);
    } else if (e.button === 0) {
      face.textContent = "😮";
    }
  });
  boardEl.addEventListener("mouseup", (e) => {
    const cell = e.target.closest(".ms-cell");
    if (!cell) return;
    if (e.button !== 0) return;
    if (!gameOver) face.textContent = "🙂";
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    reveal(x, y);
  });
  boardEl.addEventListener("contextmenu", (e) => e.preventDefault());
  boardEl.addEventListener("touchstart", (e) => {
    const cell = e.target.closest(".ms-cell");
    if (!cell) return;
    heldCell = cell;
    holdTimer = setTimeout(() => {
      const x = parseInt(cell.dataset.x, 10);
      const y = parseInt(cell.dataset.y, 10);
      toggleFlag(x, y);
      heldCell = null;
    }, 350);
  }, { passive: true });
  boardEl.addEventListener("touchend", (e) => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (heldCell) {
      const x = parseInt(heldCell.dataset.x, 10);
      const y = parseInt(heldCell.dataset.y, 10);
      reveal(x, y);
      heldCell = null;
    }
  });
  boardEl.addEventListener("touchcancel", () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    heldCell = null;
  });

  // Smiley resets
  face.addEventListener("click", () => newGame());

  // Game menu — quick difficulty switcher
  wrap.querySelector('.ms-menu[data-menu="game"]').addEventListener("click", (e) => {
    e.stopPropagation();
    const existing = document.querySelector(".ms-drop");
    if (existing) { existing.remove(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const drop = document.createElement("div");
    drop.className = "ms-drop pm-drop";
    drop.style.position = "fixed";
    drop.style.left = r.left + "px";
    drop.style.top  = r.bottom + "px";
    drop.innerHTML = `
      <div class="pm-item" data-lvl="beginner">New (Beginner)</div>
      <div class="pm-item" data-lvl="intermediate">New (Intermediate)</div>
      <div class="pm-item" data-lvl="expert">New (Expert)</div>
    `;
    drop.querySelectorAll(".pm-item").forEach(it => {
      it.addEventListener("click", () => {
        const lvl = it.dataset.lvl;
        drop.remove();
        newGame(LEVELS[lvl]);
      });
    });
    document.body.appendChild(drop);
    const close = (ev) => {
      if (!drop.contains(ev.target)) {
        drop.remove();
        document.removeEventListener("click", close, true);
      }
    };
    document.addEventListener("click", close, true);
  });

  newGame(level);

  return openWindow({
    title: "Minesweeper",
    icon: ICONS.recycle(14),
    iconHtml: true,
    content: wrap,
    width: 240,
    height: 300,
    flush: true,
  });
}
