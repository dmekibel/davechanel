// Anarchy — Win98 window UI on top of the pure engine.
import { openWindow } from "../window-manager.js";
import { ICONS } from "../icons.js";
import {
  createGame, reduce, legalMoves, slapOpportunities,
  findStraights, rankLabel, colorOf,
} from "./engine.js";
import { chooseAction, botSlap } from "./bot.js";

const SUIT = { H: "♥", D: "♦", C: "♣", S: "♠" };
const BOT_DELAY = 1400; // slow enough to follow each play

export function openAnarchy() {
  const root = document.createElement("div");
  root.className = "anarchy";
  root.innerHTML = `
    <div class="anarchy-menubar"><button class="anarchy-menu" data-act="new">Game</button></div>
    <div class="anarchy-felt">
      <div class="anarchy-opponents"></div>
      <div class="anarchy-center">
        <div class="anarchy-badge">YOUR LEAD</div>
        <div class="anarchy-pile"></div>
        <div class="anarchy-run"></div>
      </div>
      <div class="anarchy-log"></div>
    </div>
    <div class="anarchy-hand-wrap">
      <div class="anarchy-handname"></div>
      <div class="anarchy-hand"></div>
      <div class="anarchy-actions"></div>
    </div>
    <div class="anarchy-setup">
      <div class="anarchy-setup-box">
        <h2>ANARCHY</h2>
        <p>Shed your whole hand first. Red sends the next player up, black sends them down.</p>
        <div class="anarchy-setup-section">vs Computer</div>
        <div class="anarchy-setup-btns">
          <button data-mode="cpu" data-players="2">vs 1 CPU</button>
          <button data-mode="cpu" data-players="3">vs 2 CPUs</button>
          <button data-mode="cpu" data-players="4">vs 3 CPUs</button>
        </div>
        <div class="anarchy-setup-section">Pass &amp; Play (one device)</div>
        <div class="anarchy-setup-btns">
          <button data-mode="local" data-players="2">2 Players</button>
          <button data-mode="local" data-players="3">3 Players</button>
          <button data-mode="local" data-players="4">4 Players</button>
        </div>
      </div>
    </div>
    <div class="anarchy-handoff">
      <div class="anarchy-setup-box">
        <h2>PASS THE DEVICE</h2>
        <p class="anarchy-handoff-name"></p>
        <p class="anarchy-handoff-sub">The previous player's hand is hidden. Tap when you're ready.</p>
        <div class="anarchy-setup-btns"><button class="anarchy-handoff-go">Show my hand</button></div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const elOpp = $(".anarchy-opponents");
  const elBadge = $(".anarchy-badge");
  const elPile = $(".anarchy-pile");
  const elRun = $(".anarchy-run");
  const elLog = $(".anarchy-log");
  const elHand = $(".anarchy-hand");
  const elHandName = $(".anarchy-handname");
  const elActions = $(".anarchy-actions");
  const elSetup = $(".anarchy-setup");
  const elHandoff = $(".anarchy-handoff");

  let state = null;
  let mode = "cpu";          // "cpu" | "local"
  let selection = [];
  let aceTake = false;
  let botTimer = null;
  let handoffPending = false; // local mode: hide the hand until the next player confirms
  let flashMsg = "";

  // whose hand is shown / who may act right now
  const viewer = () => (mode === "cpu" ? 0 : state.turn);
  const canAct = () =>
    state && state.status === "playing" && !handoffPending &&
    state.players[state.turn].isHuman && state.turn === viewer();

  // ---- card markup ----
  function cardEl(card, { mini = false, faceUp = true } = {}) {
    const d = document.createElement("div");
    if (!faceUp) { d.className = "acard back" + (mini ? " mini" : ""); return d; }
    const col = colorOf(card.suit);
    d.className = `acard ${col}` + (mini ? " mini" : "");
    d.dataset.id = card.id;
    d.innerHTML = `<span class="acard-r">${rankLabel(card.rank)}</span><span class="acard-s">${SUIT[card.suit]}</span>`;
    return d;
  }

  // ---- the move the current selection maps to (or null) ----
  function selectionAction() {
    if (!canAct()) return null;
    const hand = state.players[viewer()].hand;
    const sel = selection.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
    if (!sel.length) return null;
    const d = state.demand;
    if (sel.length === 1) {
      const c = sel[0];
      if (c.rank === 7) return { label: "Switch 7", action: { type: "SWITCH7", card: c.id } };
      if (c.rank === 14 && d.type === "pickup") return { label: "Cancel with Ace", action: { type: "ACE_CANCEL", card: c.id, take: aceTake } };
      if (c.rank === 14) return { label: aceTake ? "Play Ace + take" : "Play Ace", action: { type: "ACE_SWITCH", card: c.id, take: aceTake } };
    }
    const want = new Set(selection);
    const move = legalMoves(state).find(
      (m) => m.type === "PLAY" && m.cards.length === want.size && m.cards.every((id) => want.has(id))
    );
    if (move) {
      const four = d.type === "pickup" && sel.length === 2;
      return { label: four ? "Make four!" : sel.length === 2 ? "Play pair" : "Play", action: move };
    }
    return null;
  }

  function apply(action) {
    const prevTurn = state.turn;
    try { state = reduce(state, action); }
    catch (e) { flash(e.message); return; }
    selection = []; aceTake = false;
    // local mode: hand off the device whenever the active player changes
    if (mode === "local" && state.status === "playing" && state.turn !== prevTurn)
      handoffPending = true;
    render();
    scheduleBots();
  }

  function flash(msg) { flashMsg = msg; render(); setTimeout(() => { flashMsg = ""; render(); }, 1400); }

  // ---- bot scheduler (cpu mode only): slaps any time, then plays bot turns on a delay ----
  function scheduleBots() {
    clearTimeout(botTimer);
    if (mode !== "cpu" || !state || state.status !== "playing") return;
    if (!document.body.contains(root)) return;
    if (!(botSlap(state) || !state.players[state.turn].isHuman)) return;
    botTimer = setTimeout(() => {
      if (mode !== "cpu" || !state || state.status !== "playing" || !document.body.contains(root)) return;
      let action = botSlap(state);
      if (!action) {
        if (state.players[state.turn].isHuman) { render(); return; }
        action = chooseAction(state);
      }
      try { state = reduce(state, action); } catch (e) { /* skip a bad bot move */ }
      render();
      scheduleBots();
    }, BOT_DELAY);
  }

  // ---- interaction ----
  function onCardClick(id) {
    if (!canAct()) return;
    const hand = state.players[viewer()].hand;
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    if (selection.includes(id)) { selection = selection.filter((x) => x !== id); render(); return; }
    if (selection.length === 1) {
      const first = hand.find((c) => c.id === selection[0]);
      if (first && first.rank === card.rank) selection = [selection[0], id]; // try a pair
      else selection = [id];
    } else {
      selection = [id];
    }
    aceTake = false;
    render();
  }

  // ---- render ----
  function badgeText() {
    const d = state.demand;
    const mine = state.turn === viewer();
    const who = mine ? "YOU" : state.players[state.turn].name;
    if (d.type === "open") return mine ? "YOUR LEAD" : `${who} LEADS`;
    if (d.type === "pickup") return `${who}: PICK UP ${d.count}`;
    return `${who}: PLAY ${rankLabel(d.rank)} OR ${d.dir === "up" ? "HIGHER" : "LOWER"}`;
  }

  function render() {
    if (!state) { elSetup.style.display = "flex"; elHandoff.style.display = "none"; return; }
    elSetup.style.display = "none";
    const showHandoff = mode === "local" && handoffPending && state.status === "playing";
    elHandoff.style.display = showHandoff ? "flex" : "none";
    if (showHandoff) {
      $(".anarchy-handoff-name").textContent = `${state.players[state.turn].name}, it's your turn.`;
    }

    // opponents = everyone except the current viewer, each as a fan of face-down cards + count
    elOpp.innerHTML = "";
    state.players.forEach((p, i) => {
      if (i === viewer()) return;
      const box = document.createElement("div");
      box.className = "anarchy-opp" + (state.turn === i ? " active" : "");
      const fan = document.createElement("div");
      fan.className = "anarchy-opp-fan";
      for (let k = 0; k < p.hand.length; k++) fan.appendChild(cardEl(null, { mini: true, faceUp: false }));
      const meta = document.createElement("div");
      meta.className = "anarchy-opp-meta";
      meta.innerHTML = `<span class="anarchy-opp-name">${p.name}</span><span class="anarchy-opp-count">${p.hand.length} cards</span>`;
      box.appendChild(fan); box.appendChild(meta);
      elOpp.appendChild(box);
    });

    // badge + pile (a growing stack of past plays) + run
    elBadge.textContent = flashMsg || badgeText();
    elBadge.className = "anarchy-badge" + (flashMsg ? " flash" : "") + (state.demand.type === "pickup" ? " pickup" : "");
    elPile.innerHTML = "";
    const shown = state.pile.slice(-14);
    if (!shown.length) { const e = document.createElement("div"); e.className = "acard empty"; elPile.appendChild(e); }
    shown.forEach((c, i) => { const e = cardEl(c); e.style.marginLeft = i ? "-30px" : "0"; e.style.zIndex = String(i); elPile.appendChild(e); });
    elRun.textContent = state.topRun >= 3 ? "TRIPLE — slap the 4th!" : state.topRun === 2 ? "pair ×2" : "";

    elLog.innerHTML = state.log.slice(-4).map((l) => `<div>${l}</div>`).join("");
    elLog.scrollTop = elLog.scrollHeight;

    renderHand();
    renderActions();
  }

  function renderHand() {
    elHand.innerHTML = "";
    elHandName.textContent = "";
    if (!state || state.status !== "playing") return;
    if (mode === "local" && handoffPending) return; // keep the hand hidden during a handoff
    const hand = state.players[viewer()].hand;
    if (mode === "local") elHandName.textContent = `${state.players[viewer()].name}'s hand`;
    const act = canAct();
    const legal = act ? legalMoves(state) : [];
    const playableIds = new Set();
    for (const m of legal) {
      if (m.type === "PLAY") m.cards.forEach((id) => playableIds.add(id));
      if (m.type === "SWITCH7" || m.type === "ACE_SWITCH" || m.type === "ACE_CANCEL") playableIds.add(m.card);
    }
    [...hand].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit)).forEach((c) => {
      const e = cardEl(c);
      const isSel = selection.includes(c.id);
      const isLegal = act && playableIds.has(c.id);
      if (isSel) e.classList.add("sel");
      if (isLegal) e.classList.add("legal");
      if (!isSel && !isLegal) e.classList.add("dim");
      e.addEventListener("click", () => onCardClick(c.id));
      elHand.appendChild(e);
    });
  }

  function renderActions() {
    elActions.innerHTML = "";
    if (!state || state.status !== "playing") return;
    const add = (label, fn, cls = "") => {
      const b = document.createElement("button");
      b.className = "anarchy-btn " + cls; b.textContent = label;
      b.addEventListener("click", fn); elActions.appendChild(b); return b;
    };
    if (mode === "local" && handoffPending) return;
    const hand = state.players[viewer()].hand;

    // slap (in or out of turn) for the viewer
    if (slapOpportunities(state).some((o) => o.by === viewer())) {
      const card = hand.find((c) => c.rank === state.topRank);
      if (card) add("SLAP!", () => apply({ type: "SLAP", by: viewer(), card: card.id }), "slap");
    }
    if (!canAct()) {
      if (!elActions.children.length) elActions.innerHTML = `<span class="anarchy-wait">${state.players[state.turn].name} is playing…</span>`;
      return;
    }

    const sa = selectionAction();
    if (sa) add(sa.label, () => apply(sa.action), "primary");

    const sel = selection.map((id) => hand.find((c) => c.id === id));
    if (sel.length === 1 && sel[0] && sel[0].rank === 14 && state.pile.length)
      add(aceTake ? "☑ take below" : "☐ take below", () => { aceTake = !aceTake; render(); }, "toggle");

    if (state.demand.type === "pickup") add("Take " + state.demand.count, () => apply({ type: "TAKE_PICKUP" }), "");
    const straights = findStraights(hand);
    if (straights.length) {
      const longest = straights.reduce((a, b) => (b.length > a.length ? b : a));
      const groups = new Map(); hand.forEach((c) => { if (!groups.has(c.rank)) groups.set(c.rank, c); });
      add("Dump straight", () => apply({ type: "DUMP", by: viewer(), cards: longest.map((r) => groups.get(r).id) }), "");
    }
    if (legalMoves(state).some((m) => m.type === "PASS")) add("Pass", () => apply({ type: "PASS" }), "");
  }

  // ---- new game ----
  function newGame(m, numPlayers) {
    clearTimeout(botTimer);
    mode = m;
    const names = m === "cpu"
      ? ["You", "CPU 1", "CPU 2", "CPU 3"].slice(0, numPlayers)
      : Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    const humanIndices = m === "cpu" ? [0] : names.map((_, i) => i);
    state = createGame({ numPlayers, humanIndices, names });
    selection = []; aceTake = false; flashMsg = ""; handoffPending = false;
    render();
    scheduleBots();
  }

  root.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => newGame(b.dataset.mode, parseInt(b.dataset.players, 10))));
  $(".anarchy-handoff-go").addEventListener("click", () => { handoffPending = false; render(); });
  $(".anarchy-menu").addEventListener("click", () => { clearTimeout(botTimer); state = null; selection = []; handoffPending = false; render(); });

  newGame("cpu", 2); // standard 1-on-1 vs the computer; the Game menu offers more
  return openWindow({ title: "Anarchy", icon: ICONS.anarchy(14), iconHtml: true, content: root, width: 600, height: 660, flush: true });
}
