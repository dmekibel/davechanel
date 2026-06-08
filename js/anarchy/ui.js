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
    <div class="anarchy-menubar">
      <button class="anarchy-menu" data-act="new">Game</button>
      <button class="anarchy-menu" data-act="help">How to Play</button>
    </div>
    <div class="anarchy-felt">
      <div class="anarchy-opponents"></div>
      <div class="anarchy-stock"></div>
      <div class="anarchy-bita-pile"></div>
      <div class="anarchy-center">
        <div class="anarchy-badge">YOUR LEAD</div>
        <div class="anarchy-pile"></div>
        <div class="anarchy-run"></div>
      </div>
      <div class="anarchy-log"></div>
    </div>
    <div class="anarchy-hand-wrap">
      <div class="anarchy-aside"></div>
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
    </div>
    <div class="anarchy-help">
      <div class="anarchy-help-box">
        <h2>HOW TO PLAY</h2>
        <div class="anarchy-help-body">
          <p><b>Goal:</b> empty your hand first. The instant your last card lands, you win.</p>
          <h3>Direction (the core rule)</h3>
          <p>The top card's <b>colour</b> tells the next player what to do. <b>Red</b> → play <b>equal or higher</b>. <b>Black</b> → play <b>equal or lower</b>. Equal rank always works, so matching the rank is always legal.</p>
          <h3>Pairs (punish forward)</h3>
          <p>Play two of a kind and the <i>next</i> player must <b>pick up 1</b> — but taking it doesn't cost their turn: they draw 1, then play on against the pair. They can instead stack a third or switch it away with a 7/Ace.</p>
          <h3>Matching &amp; three of a kind (punish back)</h3>
          <p>Play the <b>same rank</b> that's on top and the <i>previous</i> player draws: a 2nd of that rank makes them draw 1, a 3rd — a <b>triple</b> — makes them draw 2. A triple otherwise sets a normal demand; its one special power is that the 4th can be slapped.</p>
          <h3>Four of a kind</h3>
          <p>Completing four of a kind deals everyone else a card, clears the table, and you lead again. While a triple is showing, anyone holding the 4th can <b>Slap</b> it — in or out of turn.</p>
          <h3>The 7 (switch)</h3>
          <p>Play a 7 anytime, even out of turn. It ignores direction, cancels a pick-up, and takes the card beneath it into your hand. <b>7s go one at a time</b> — you can't play two as a pair.</p>
          <h3>The Ace</h3>
          <p>Highest card. A <b>black</b> Ace lets the next player play anything; a <b>red</b> Ace forces another Ace (equal counts, and nothing beats an Ace) — the hardest card to follow.</p>
          <h3>Straights</h3>
          <p>5+ in a row within 2–6 or 8–A (never crossing the 7). <b>Set aside</b> a straight to bluff a bigger hand, then <b>Dump it</b> to shed it all at once — ideally to go out.</p>
          <h3>Good to know</h3>
          <p>• Can't follow a colour demand? You draw 1 and pass; the demand stays for the next player.<br>• Going out wins immediately — before any pick-up or combo the card would otherwise cause.<br>• Once the draw pile is empty there are no more draws: pure shedding to the end.</p>
        </div>
        <div class="anarchy-setup-btns"><button class="anarchy-help-close">Got it</button></div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const elOpp = $(".anarchy-opponents");
  const elBadge = $(".anarchy-badge");
  const elPile = $(".anarchy-pile");
  const elRun = $(".anarchy-run");
  const elLog = $(".anarchy-log");
  const elHand = $(".anarchy-hand");
  const elAside = $(".anarchy-aside");
  const elHandName = $(".anarchy-handname");
  const elActions = $(".anarchy-actions");
  const elSetup = $(".anarchy-setup");
  const elHandoff = $(".anarchy-handoff");
  const elHelp = $(".anarchy-help");
  const elFelt = $(".anarchy-felt");
  const elStock = $(".anarchy-stock");
  const elBita = $(".anarchy-bita-pile");

  let state = null;
  let mode = "cpu";          // "cpu" | "local"
  let selection = [];
  let aceTake = false;
  let botTimer = null;
  let handoffPending = false; // local mode: hide the hand until the next player confirms
  let flashMsg = "";
  const reservedByPlayer = new Map(); // per-player: card ids held off to the side (a saved straight)
  let lastTopId = null, lastPileLen = 0, oppSeatMap = {}, oppBoxMap = {}, lastHandCounts = []; // animation state

  // whose hand is shown / who may act right now
  const viewer = () => (mode === "cpu" ? 0 : state.turn);
  const canAct = () =>
    state && state.status === "playing" && !handoffPending &&
    state.players[state.turn].isHuman && state.turn === viewer();
  // cards the viewer has set aside; pruned to whatever is still in hand
  function reservedSet() {
    const v = viewer();
    if (!reservedByPlayer.has(v)) reservedByPlayer.set(v, new Set());
    const set = reservedByPlayer.get(v);
    const ids = new Set(state.players[v].hand.map((c) => c.id));
    for (const id of [...set]) if (!ids.has(id)) set.delete(id);
    return set;
  }
  // legal moves computed against only the cards NOT set aside (so a reserved
  // duplicate rank doesn't hide its still-playable twin)
  function activeAndLegal() {
    const v = viewer();
    const reserved = reservedSet();
    const full = state.players[v].hand;
    const active = full.filter((c) => !reserved.has(c.id));
    if (active.length === full.length) return { active, legal: legalMoves(state) };
    const tmp = { ...state, players: state.players.map((p, i) => (i === v ? { ...p, hand: active } : p)) };
    return { active, legal: legalMoves(tmp) };
  }

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

  // where a freshly played card should fly in from (your hand, or an opponent's seat)
  function dealOrigin(idx) {
    if (idx == null || idx === viewer()) return { x: 0, y: 150 };
    switch (oppSeatMap[idx]) {
      case "seat-left": return { x: -170, y: 0 };
      case "seat-right": return { x: 170, y: 0 };
      case "seat-tl": return { x: -150, y: -120 };
      case "seat-tr": return { x: 150, y: -120 };
      default: return { x: 0, y: -130 }; // seat-top
    }
  }
  // felt-relative position of an element's top-left
  function feltPos(el) {
    const f = elFelt.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
  }
  // a small stack of face-down cards + a count, for the draw and бита piles
  function renderSidePile(el, count, label) {
    el.innerHTML = "";
    const stack = document.createElement("div");
    stack.className = "anarchy-sidepile-stack";
    const n = Math.min(count, 4);
    for (let i = 0; i < n; i++) {
      const c = cardEl(null, { mini: true, faceUp: false });
      c.style.position = "absolute"; c.style.left = i + "px"; c.style.top = -i + "px"; c.style.zIndex = String(i);
      stack.appendChild(c);
    }
    if (!n) { const e = document.createElement("div"); e.className = "acard mini empty"; stack.appendChild(e); }
    const lbl = document.createElement("div");
    lbl.className = "anarchy-pile-label"; lbl.textContent = `${label} ${count}`;
    el.appendChild(stack); el.appendChild(lbl);
  }
  // fly a face-down card from the stock to whoever just drew
  function flyDraw(idx, count) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!target || !elStock) return;
    const from = feltPos(elStock), to = feltPos(target);
    const toX = to.x + to.w / 2 - 11, toY = to.y + (idx === viewer() ? 0 : to.h / 2);
    for (let k = 0; k < Math.min(count, 3); k++) {
      const fly = cardEl(null, { mini: true, faceUp: false });
      fly.classList.add("anarchy-fly");
      fly.style.left = from.x + "px"; fly.style.top = from.y + "px";
      elFelt.appendChild(fly);
      const d = k * 90;
      setTimeout(() => { fly.style.transition = "transform .42s ease-in-out, opacity .42s"; fly.style.transform = `translate(${toX - from.x}px, ${toY - from.y}px) scale(1.3)`; fly.style.opacity = "0"; }, d + 10);
      setTimeout(() => fly.remove(), d + 460);
    }
  }
  // sweep the table to the бита pile when it clears
  function biteFlyAway() {
    const from = feltPos(elPile), to = feltPos(elBita);
    const fly = document.createElement("div");
    fly.className = "acard back anarchy-bita-card";
    fly.style.left = (from.x + 28) + "px"; fly.style.top = (from.y + 18) + "px";
    elFelt.appendChild(fly);
    requestAnimationFrame(() => {
      fly.style.transition = "transform .45s ease-in, opacity .45s ease-in";
      fly.style.transform = `translate(${to.x - from.x - 28}px, ${to.y - from.y - 18}px) scale(.6) rotate(16deg)`;
      fly.style.opacity = "0";
    });
    setTimeout(() => fly.remove(), 480);
    const toast = document.createElement("div");
    toast.className = "anarchy-bita-toast"; toast.textContent = "бита";
    elPile.appendChild(toast);
    setTimeout(() => toast.remove(), 750);
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
      if (c.rank === 14 && d.type === "pickup") return { label: "Cancel (Ace switch)", action: { type: "ACE_CANCEL", card: c.id, take: true } };
      if (c.rank === 14) return { label: aceTake ? "Play Ace + take" : "Play Ace", action: { type: "ACE_SWITCH", card: c.id, take: aceTake } };
    }
    // generic single/pair, matched by RANK (the engine lists one card per rank,
    // so match on rank+count and play whatever copies are actually selected)
    const r = sel[0].rank;
    if (!sel.every((c) => c.rank === r)) return null;
    const hasMove = activeAndLegal().legal.some((m) =>
      m.type === "PLAY" && m.cards.length === sel.length &&
      m.cards.every((cid) => ((hand.find((x) => x.id === cid) || {}).rank === r)));
    if (!hasMove) return null;
    const four = d.type === "pickup" && sel.length === 2;
    return { label: four ? "Make four!" : sel.length === 2 ? "Play pair" : "Play", action: { type: "PLAY", cards: [...selection] } };
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
    // tapping a selected card cycles it: pair -> just-this-one -> nothing
    // (keep the card you actually tapped, so no stray twin is left raised)
    if (selection.includes(id)) {
      selection = selection.length === 2 ? [id] : [];
      aceTake = false; render(); return;
    }
    // default to the whole pair when two of a kind can be played; 7s play one at a time
    let pick = [id];
    if (card.rank !== 7) {
      const pair = activeAndLegal().legal.find((m) =>
        m.type === "PLAY" && m.cards.length === 2 &&
        m.cards.every((cid) => ((hand.find((x) => x.id === cid) || {}).rank === card.rank)));
      if (pair) pick = [...pair.cards];
    }
    selection = pick;
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

    // opponents seated around the table: 1 across the top, 2 in the upper corners,
    // 3 as left / top / right. Each holds a compact fan (not a spread) + a count.
    elOpp.innerHTML = "";
    const opps = state.players.map((p, i) => ({ p, i })).filter((o) => o.i !== viewer());
    const seatsByCount = { 1: ["seat-top"], 2: ["seat-tl", "seat-tr"], 3: ["seat-left", "seat-top", "seat-right"] };
    const seats = seatsByCount[opps.length] || ["seat-top"];
    oppSeatMap = {}; oppBoxMap = {};
    opps.forEach((o, k) => {
      oppSeatMap[o.i] = seats[k] || "seat-top";
      const box = document.createElement("div");
      oppBoxMap[o.i] = box;
      box.className = "anarchy-opp " + (seats[k] || "seat-top") + (state.turn === o.i ? " active" : "");
      const fan = document.createElement("div");
      fan.className = "anarchy-opp-fan";
      const showN = Math.min(o.p.hand.length, 8); // a held fan, capped so seats stay tidy
      for (let j = 0; j < showN; j++) fan.appendChild(cardEl(null, { mini: true, faceUp: false }));
      const meta = document.createElement("div");
      meta.className = "anarchy-opp-meta";
      meta.innerHTML = `<span class="anarchy-opp-name">${o.p.name}</span><span class="anarchy-opp-count">${o.p.hand.length} cards</span>`;
      box.appendChild(fan); box.appendChild(meta);
      elOpp.appendChild(box);
    });

    // badge + pile (a growing stack of past plays) + run
    elBadge.textContent = flashMsg || badgeText();
    elBadge.className = "anarchy-badge" + (flashMsg ? " flash" : "") + (state.demand.type === "pickup" ? " pickup" : "");
    // newest play sits in front, fully visible; the prior two stay buried showing only a corner
    elPile.innerHTML = "";
    const shown = state.pile.slice(-3);
    if (!shown.length) { const e = document.createElement("div"); e.className = "acard empty"; e.style.position = "absolute"; e.style.left = "28px"; e.style.top = "18px"; elPile.appendChild(e); }
    shown.forEach((c, i) => {
      const e = cardEl(c);
      const depth = shown.length - 1 - i; // 0 = newest
      e.style.left = (28 - depth * 14) + "px";
      e.style.top = (18 - depth * 9) + "px";
      e.style.zIndex = String(10 - depth);
      if (depth) e.classList.add("buried");
      elPile.appendChild(e);
    });
    elRun.textContent = state.topRun >= 3 ? "TRIPLE — slap the 4th!" : state.topRun === 2 ? "pair ×2" : "";

    // animations: deal the newest card in from whoever played it; sweep to бита on a clear
    const topId = state.pile.length ? state.pile[state.pile.length - 1].id : null;
    if (topId && topId !== lastTopId && elPile.lastChild) {
      const front = elPile.lastChild, o = dealOrigin(state.lastPlacer);
      front.style.transition = "none";
      front.style.transform = `translate(${o.x}px, ${o.y}px) scale(.85)`;
      requestAnimationFrame(() => { front.style.transition = "transform .26s ease-out"; front.style.transform = ""; });
    }
    if (lastPileLen > 0 && state.pile.length === 0) biteFlyAway();
    lastTopId = topId;
    lastPileLen = state.pile.length;

    // visible draw (stock) and бита (discard) piles, kept separate
    renderSidePile(elStock, state.stock.length, "Draw");
    renderSidePile(elBita, state.removed.length, "бита");
    // animate any card a player just took (flies from the stock to that player)
    state.players.forEach((p, i) => {
      const grew = p.hand.length - (lastHandCounts[i] ?? p.hand.length);
      if (grew > 0) flyDraw(i, grew);
    });
    lastHandCounts = state.players.map((p) => p.hand.length);

    elLog.innerHTML = state.log.slice(-4).map((l) => `<div>${l}</div>`).join("");
    elLog.scrollTop = elLog.scrollHeight;

    renderHand();
    renderAside();
    renderActions();
  }

  function renderHand() {
    elHand.innerHTML = "";
    elHandName.textContent = "";
    if (!state || state.status !== "playing") return;
    if (mode === "local" && handoffPending) return; // keep the hand hidden during a handoff
    if (mode === "local") elHandName.textContent = `${state.players[viewer()].name}'s hand`;
    const { active, legal } = activeAndLegal();
    const act = canAct();
    const playRanks = new Set(); // ranks with a legal PLAY — every copy of that rank is playable
    const playIds = new Set();   // specific cards: 7 switch, Ace
    if (act) for (const m of legal) {
      if (m.type === "PLAY") { const c0 = active.find((c) => c.id === m.cards[0]); if (c0) playRanks.add(c0.rank); }
      else if (m.type === "SWITCH7" || m.type === "ACE_SWITCH" || m.type === "ACE_CANCEL") playIds.add(m.card);
    }
    [...active].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit)).forEach((c) => {
      const e = cardEl(c);
      const isSel = selection.includes(c.id);
      const isLegal = act && (playRanks.has(c.rank) || playIds.has(c.id));
      if (isSel) e.classList.add("sel");
      if (isLegal) e.classList.add("legal");
      if (!isSel && !isLegal) e.classList.add("dim");
      e.addEventListener("click", () => onCardClick(c.id));
      elHand.appendChild(e);
    });
    fitHand();
  }

  // overlap the hand so every card fits on screen without horizontal scrolling
  function fitHand() {
    const cards = [...elHand.children];
    cards.forEach((el) => (el.style.marginLeft = ""));
    if (cards.length < 2) return;
    const cw = cards[0].offsetWidth || 46;
    const containerW = elHand.clientWidth;
    if (!containerW) return;
    const gap = 4;
    const natural = cards.length * cw + (cards.length - 1) * gap;
    if (natural <= containerW) return;
    const overlap = (natural - containerW) / (cards.length - 1) + 0.5;
    cards.forEach((el, i) => { if (i) el.style.marginLeft = `-${overlap}px`; });
  }

  // the set-aside tray: a saved straight kept off to the side until you choose to dump it
  function renderAside() {
    elAside.innerHTML = "";
    const hide = !state || state.status !== "playing" || (mode === "local" && handoffPending);
    const reserved = hide ? null : reservedSet();
    if (hide || !reserved.size) { elAside.style.display = "none"; return; }
    elAside.style.display = "flex";
    const label = document.createElement("div");
    label.className = "anarchy-aside-label";
    label.textContent = "Set aside (still counts as your cards) — dump it to shed in one shot:";
    elAside.appendChild(label);
    const row = document.createElement("div");
    row.className = "anarchy-aside-cards";
    state.players[viewer()].hand.filter((c) => reserved.has(c.id))
      .sort((a, b) => a.rank - b.rank).forEach((c) => row.appendChild(cardEl(c, { mini: true })));
    const dump = document.createElement("button");
    dump.className = "anarchy-btn slap"; dump.textContent = "Dump it";
    dump.addEventListener("click", () => apply({ type: "DUMP", by: viewer(), cards: [...reserved] }));
    const ret = document.createElement("button");
    ret.className = "anarchy-btn"; ret.textContent = "Return to hand";
    ret.addEventListener("click", () => { reserved.clear(); render(); });
    row.appendChild(dump); row.appendChild(ret);
    elAside.appendChild(row);
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

    const reserved = reservedSet();
    const { active } = activeAndLegal();
    // hold a straight off to the side (bluff a bigger hand; dump it later, ideally to go out)
    if (!reserved.size) {
      const straights = findStraights(active);
      if (straights.length) {
        const longest = straights.reduce((a, b) => (b.length > a.length ? b : a));
        const g = new Map(); active.forEach((c) => { if (!g.has(c.rank)) g.set(c.rank, c); });
        const ids = longest.map((r) => g.get(r).id);
        add("Set aside straight", () => { ids.forEach((id) => reservedSet().add(id)); selection = []; render(); }, "");
      }
    }
    // pass is always available under a colour demand — it sweeps the table to бита
    if (state.demand.type === "color") add("Pass (clear table)", () => apply({ type: "PASS" }), "");
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
    selection = []; aceTake = false; flashMsg = ""; handoffPending = false; reservedByPlayer.clear();
    lastTopId = null; lastPileLen = 0; // don't fire a stray бита on the first render
    lastHandCounts = state.players.map((p) => p.hand.length); // the deal isn't a "draw"
    render();
    scheduleBots();
  }

  root.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => newGame(b.dataset.mode, parseInt(b.dataset.players, 10))));
  $(".anarchy-handoff-go").addEventListener("click", () => { handoffPending = false; render(); });
  root.querySelectorAll(".anarchy-menu").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.act === "help") { elHelp.style.display = "flex"; return; }
    clearTimeout(botTimer); state = null; selection = []; handoffPending = false; render(); // Game = new game
  }));
  $(".anarchy-help-close").addEventListener("click", () => { elHelp.style.display = "none"; });

  newGame("cpu", 2); // standard 1-on-1 vs the computer; the Game menu offers more
  const winId = openWindow({ title: "Anarchy", icon: ICONS.anarchy(14), iconHtml: true, content: root, width: 600, height: 660, flush: true });
  requestAnimationFrame(() => { if (document.body.contains(root)) fitHand(); }); // fit once laid out
  window.addEventListener("resize", () => { if (document.body.contains(root)) render(); }); // re-fit on rotate/resize
  return winId;
}
