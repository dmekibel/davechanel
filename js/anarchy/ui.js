// Anarchy — Win98 window UI on top of the pure engine.
import { openWindow } from "../window-manager.js?v=163";
import { ICONS } from "../icons.js?v=163";
import {
  createGame, reduce, legalMoves, slapOpportunities,
  findStraights, rankLabel, colorOf,
} from "./engine.js?v=163";
import { chooseAction, botSlap } from "./bot.js?v=163";
import { currentZoom } from "../scale.js?v=163";

const SUIT = { H: "♥", D: "♦", C: "♣", S: "♠" };
const PLAYER_COLORS = ["#ffd24d", "#5db0ff", "#7cf08a", "#ff7ad9"]; // per-seat identity colors
const colorFor = (i) => PLAYER_COLORS[i % PLAYER_COLORS.length];
const BOT_DELAY = 2000; // slow, real-game pace so each CPU play is easy to follow

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
        <div class="anarchy-badge">YOUR TURN</div>
        <div class="anarchy-pile"></div>
        <div class="anarchy-run"></div>
      </div>
      <div class="anarchy-log"></div>
      <div class="anarchy-fx"></div>
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
        <div class="anarchy-start-view">
          <div class="anarchy-setup-btns anarchy-start-btns">
            <button class="anarchy-start-go">Start Game</button>
            <button class="anarchy-modes-open">Game Mode</button>
          </div>
        </div>
        <div class="anarchy-modes-view">
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
          <div class="anarchy-setup-btns"><button class="anarchy-modes-back">Back</button></div>
        </div>
        <div class="anarchy-names-view">
          <div class="anarchy-setup-section">Player names</div>
          <div class="anarchy-names-fields"></div>
          <div class="anarchy-setup-btns">
            <button class="anarchy-names-start">Start game</button>
            <button class="anarchy-names-back">Back</button>
          </div>
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
          <p>Highest card. A <b>black</b> Ace lets the next player play anything; a <b>red</b> Ace can only be beaten by another Ace — or switched away with a 7.</p>
          <h3>Straights</h3>
          <p>5+ in a row within 2–6 or 8–A (never crossing the 7). <b>Set aside</b> a straight to bluff a bigger hand, then <b>Dump it</b> to shed it all at once — ideally to go out.</p>
          <h3>Good to know</h3>
          <p>• Can't follow a colour demand? You draw 1 and pass; the demand stays for the next player.<br>• Going out wins immediately — before any pick-up or combo the card would otherwise cause.<br>• Once the draw pile is empty there are no more draws: pure shedding to the end.</p>
        </div>
        <div class="anarchy-setup-btns"><button class="anarchy-help-close">Got it</button></div>
      </div>
    </div>
    <div class="anarchy-win">
      <div class="anarchy-win-box">
        <h2 class="anarchy-win-title">YOU WIN!</h2>
        <div class="anarchy-setup-btns"><button class="anarchy-win-again">Play again</button></div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const elOpp = $(".anarchy-opponents");
  const elBadge = $(".anarchy-badge");
  const elPile = $(".anarchy-pile");
  const elRun = $(".anarchy-run");
  const elLog = $(".anarchy-log");
  const elHand = $(".anarchy-hand");
  const elHandWrap = $(".anarchy-hand-wrap");
  const elAside = $(".anarchy-aside");
  const elHandName = $(".anarchy-handname");
  const elActions = $(".anarchy-actions");
  const elSetup = $(".anarchy-setup");
  const elStartView = $(".anarchy-start-view");
  const elModesView = $(".anarchy-modes-view");
  const elNamesView = $(".anarchy-names-view");
  const elHandoff = $(".anarchy-handoff");
  const elHelp = $(".anarchy-help");
  const elFelt = $(".anarchy-felt");
  const elStock = $(".anarchy-stock");
  const elBita = $(".anarchy-bita-pile");
  const elFx = $(".anarchy-fx");
  const elWin = $(".anarchy-win");
  const elWinTitle = $(".anarchy-win-title");

  let state = null;
  let mode = "cpu";          // "cpu" | "local"
  let selection = [];
  let aceTake = false;
  let botTimer = null;
  let handoffPending = false; // local mode: hide the hand until the next player confirms
  let flashMsg = "";
  const reservedByPlayer = new Map(); // per-player: card ids held off to the side (a saved straight)
  let lastTopId = null, lastPileLen = 0, oppSeatMap = {}, oppBoxMap = {}, lastHandCounts = [], suppressDrawIdx = -1; // animation state
  let fxTimer = null, lastMode = "cpu", lastNum = 2, lastNames = null, justRevealed = false;

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

  // a ghost of the played card glides from the player to the table (the pile stays put)
  function flyPlay(idx, card) {
    if (idx == null || !card) return;
    const src = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!src || !elPile) return;
    const from = feltPos(src), to = feltPos(elPile);
    const ghost = cardEl(card);
    ghost.classList.add("anarchy-fly");
    const fromX = from.x + from.w / 2 - 22, fromY = from.y + (idx === viewer() ? -6 : from.h / 2);
    ghost.style.left = fromX + "px"; ghost.style.top = fromY + "px"; ghost.style.opacity = "0.92";
    elFelt.appendChild(ghost);
    const toX = to.x + 22, toY = to.y + 18;
    requestAnimationFrame(() => { ghost.style.transition = "transform .3s ease-out, opacity .3s ease-out"; ghost.style.transform = `translate(${toX - fromX}px, ${toY - fromY}px)`; ghost.style.opacity = "0"; });
    setTimeout(() => ghost.remove(), 320);
  }
  // felt-relative position of an element's top-left
  function feltPos(el) {
    const z = currentZoom() || 1; // getBoundingClientRect is post-zoom; convert to the felt's own px
    const f = elFelt.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - f.left) / z, y: (r.top - f.top) / z, w: r.width / z, h: r.height / z };
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
  // fly drawn cards from the stock to whoever drew; the viewer's flip face-up on arrival
  function flyDraw(idx, cards, fromEl) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    const src = fromEl || elStock;
    if (!target || !src) return;
    const from = feltPos(src), to = feltPos(target);
    const toX = to.x + to.w / 2 - 16, toY = to.y + (idx === viewer() ? -4 : to.h / 2);
    const reveal = idx === viewer();
    cards.slice(0, 3).forEach((card, k) => {
      const fly = cardEl(null, { mini: true, faceUp: false });
      fly.classList.add("anarchy-fly");
      fly.style.left = from.x + "px"; fly.style.top = from.y + "px";
      elFelt.appendChild(fly);
      const d = k * 150;
      setTimeout(() => { fly.style.transition = "transform .6s ease-in-out"; fly.style.transform = `translate(${toX - from.x}px, ${toY - from.y}px) scale(1.7)`; }, d + 10);
      if (reveal && card) setTimeout(() => { // flip face-up so you can see the card you drew
        fly.classList.remove("back"); fly.classList.add(colorOf(card.suit), "flip-in");
        fly.innerHTML = `<span class="acard-r">${rankLabel(card.rank)}</span><span class="acard-s">${SUIT[card.suit]}</span>`;
      }, d + 460);
      setTimeout(() => { fly.style.transition = "opacity .3s"; fly.style.opacity = "0"; }, d + 820);
      setTimeout(() => fly.remove(), d + 1120);
    });
  }
  // a deliberately BIG, slow pickup: a full-size card glides from the draw deck into
  // the taker's hand and flips face-up, so the forced draw is impossible to miss.
  function flyPickup(idx, cards) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!target || !elStock) return;
    const from = feltPos(elStock), to = feltPos(target);
    const reveal = idx === viewer();
    const toX = to.x + to.w / 2 - 18, toY = to.y + (idx === viewer() ? -12 : to.h / 2);
    cards.slice(0, 3).forEach((card, k) => {
      const fly = cardEl(null, { faceUp: false });
      fly.classList.add("anarchy-fly", "anarchy-fly-pickup");
      fly.style.left = from.x + "px"; fly.style.top = from.y + "px";
      elFelt.appendChild(fly);
      const d = k * 220;
      setTimeout(() => { fly.style.transition = "transform .85s cubic-bezier(.18,.7,.2,1)"; fly.style.transform = `translate(${toX - from.x}px, ${toY - from.y}px) scale(1.15)`; }, d + 20);
      if (reveal && card) setTimeout(() => { // flip face-up so you clearly see what you took
        fly.classList.remove("back"); fly.classList.add(colorOf(card.suit), "flip-in");
        fly.innerHTML = `<span class="acard-r">${rankLabel(card.rank)}</span><span class="acard-s">${SUIT[card.suit]}</span>`;
      }, d + 560);
      setTimeout(() => { fly.style.transition = "opacity .35s"; fly.style.opacity = "0"; }, d + 1150);
      setTimeout(() => fly.remove(), d + 1520);
    });
  }
  // a switch (7/Ace) takes the card beneath it: fly that card from the table to the player
  function flyFromPile(idx) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!target || !elPile) return;
    const from = feltPos(elPile), to = feltPos(target);
    const fly = cardEl(null, { mini: true, faceUp: false });
    fly.classList.add("anarchy-fly");
    fly.style.left = (from.x + 24) + "px"; fly.style.top = (from.y + 16) + "px";
    elFelt.appendChild(fly);
    const toX = to.x + to.w / 2 - 11, toY = to.y + (idx === viewer() ? 0 : to.h / 2);
    requestAnimationFrame(() => { fly.style.transition = "transform .55s ease-in-out, opacity .55s"; fly.style.transform = `translate(${toX - from.x - 24}px, ${toY - from.y - 16}px) scale(1.2)`; fly.style.opacity = "0"; });
    setTimeout(() => fly.remove(), 600);
  }
  // a clear "+N pick up" tag floating off whoever just drew
  function floatPickup(idx, n) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!target || !elFelt) return;
    const to = feltPos(target);
    const tag = document.createElement("div");
    tag.className = "anarchy-pickup-tag";
    tag.textContent = `+${n} pick up`;
    tag.style.left = (to.x + to.w / 2 - 30) + "px";
    tag.style.top = (to.y + (idx === viewer() ? -8 : to.h / 2)) + "px";
    elFelt.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  }
  // a big center-screen intake announcement; grander when 2+ cards are forced
  function announce(msg, grand) {
    if (!elFelt) return;
    const el = document.createElement("div");
    el.className = "anarchy-intake" + (grand ? " grand" : "");
    el.textContent = msg;
    elFelt.appendChild(el);
    setTimeout(() => el.remove(), grand ? 1800 : 1300);
  }
  // fire the intake banner when a play forces a pickup (demand) or punishes
  // a player backward (they draw on the spot). count >= 2 → grand variant.
  function announceIntakes(action, prevDemandType, before) {
    if (!state || state.status !== "playing") return;
    const who = (i) => (i === viewer() ? "YOU" : state.players[i].name);
    if (state.demand.type === "pickup" && prevDemandType !== "pickup") {
      const i = state.turn, n = state.demand.count || 1;
      announce(`${who(i)} — PICK UP ${n}`, n >= 2);
      return;
    }
    if (action.type === "PLAY") {
      for (let i = 0; i < state.players.length; i++) {
        const grew = state.players[i].hand.length - (before[i] || 0);
        if (grew > 0) { announce(`${who(i)} — PICK UP ${grew}`, grew >= 2); return; }
      }
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
      fly.style.transition = "transform .55s ease-in, opacity .55s ease-in";
      fly.style.transform = `translate(${to.x - from.x - 28}px, ${to.y - from.y - 18}px) scale(.6) rotate(16deg)`;
      fly.style.opacity = "0";
    });
    setTimeout(() => fly.remove(), 580);
    const toast = document.createElement("div");
    toast.className = "anarchy-bita-toast"; toast.textContent = "Discard";
    elPile.appendChild(toast);
    setTimeout(() => toast.remove(), 850);
  }
  // ---- fireworks for a win ----
  function firework(x, y) {
    const colors = ["#ff4d4d", "#ffe14d", "#4dff88", "#4db8ff", "#ff7ad9", "#ffffff"];
    const burst = document.createElement("div");
    burst.className = "anarchy-fw-burst";
    burst.style.left = x + "px"; burst.style.top = y + "px";
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("div");
      p.className = "anarchy-fw-particle";
      const ang = (i / 16) * Math.PI * 2, dist = 36 + Math.random() * 46;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.background = colors[(Math.random() * colors.length) | 0];
      burst.appendChild(p);
    }
    elFx.appendChild(burst);
    setTimeout(() => burst.remove(), 1000);
  }
  function startFireworks() {
    if (fxTimer) return;
    const boom = () => {
      const r = elFelt.getBoundingClientRect();
      firework(24 + Math.random() * (r.width - 48), 20 + Math.random() * r.height * 0.6);
    };
    boom(); boom();
    fxTimer = setInterval(boom, 420);
  }
  function stopFireworks() { if (fxTimer) { clearInterval(fxTimer); fxTimer = null; } if (elFx) elFx.innerHTML = ""; }

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
    const isSwitchTake = action.type === "SWITCH7" || ((action.type === "ACE_SWITCH" || action.type === "ACE_CANCEL") && action.take);
    const taker = isSwitchTake ? (action.by == null ? prevTurn : action.by) : null;
    const hadPile = state.pile.length > 0;
    // taking a pickup: the card(s) should appear to come off the play pile, not the stock
    const takingPickup = action.type === "TAKE_PICKUP";
    const pickupTaker = takingPickup ? state.turn : -1;
    const pickupCount = takingPickup ? (state.demand.count || 1) : 0;
    const prevDemandType = state.demand.type;
    const beforeCounts = state.players.map((p) => p.hand.length);
    try { state = reduce(state, action); }
    catch (e) { flash(e.message); return; }
    selection = []; aceTake = false;
    // local mode: hand off the device whenever the active player changes
    if (mode === "local" && state.status === "playing" && state.turn !== prevTurn) {
      handoffPending = true;
      flipHandArea();
    }
    if (takingPickup && pickupTaker >= 0) suppressDrawIdx = pickupTaker; // skip the generic stock-fly for the taker
    render();
    if (takingPickup && pickupTaker >= 0) {
      const h = state.players[pickupTaker].hand;
      flyPickup(pickupTaker, h.slice(h.length - pickupCount)); // big card slides from the draw deck
    }
    if (taker != null && hadPile) flyFromPile(taker); // switch: card from below flies to the player
    announceIntakes(action, prevDemandType, beforeCounts);
    scheduleBots();
  }
  function reveal() { handoffPending = false; justRevealed = true; render(); justRevealed = false; }
  function flipHandArea() {
    if (!elHandWrap) return;
    elHandWrap.classList.remove("flip-area");
    void elHandWrap.offsetWidth; // restart the flip animation
    elHandWrap.classList.add("flip-area");
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
      const isSwitchTake = action.type === "SWITCH7" || ((action.type === "ACE_SWITCH" || action.type === "ACE_CANCEL") && action.take);
      const taker = isSwitchTake ? (action.by == null ? state.turn : action.by) : null;
      const hadPile = state.pile.length > 0;
      const takingPickup = action.type === "TAKE_PICKUP";
      const pickupTaker = takingPickup ? state.turn : -1;
      const pickupCount = takingPickup ? (state.demand.count || 1) : 0;
      const prevDemandType = state.demand.type;
      const beforeCounts = state.players.map((p) => p.hand.length);
      try { state = reduce(state, action); } catch (e) { /* skip a bad bot move */ }
      if (takingPickup && pickupTaker >= 0) suppressDrawIdx = pickupTaker;
      render();
      if (takingPickup && pickupTaker >= 0) {
        const h = state.players[pickupTaker].hand;
        flyPickup(pickupTaker, h.slice(h.length - pickupCount)); // enemy pickup slides from deck to their seat
      }
      if (taker != null && hadPile) flyFromPile(taker); // enemy switch: card from below flies to them
      announceIntakes(action, prevDemandType, beforeCounts);
      scheduleBots();
    }, BOT_DELAY);
  }

  // ---- interaction ----
  function onCardClick(id) {
    if (!canAct()) return;
    const hand = state.players[viewer()].hand;
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    if (selection.includes(id)) {
      // a selected pair: the card you click becomes the one on top (its colour sets the next demand)
      if (selection.length === 2) {
        const other = selection.find((x) => x !== id);
        selection = [other, id];
        render(); return;
      }
      // a selected single: click/tap again to play it (or throw it up)
      const sa = selectionAction();
      if (sa) apply(sa.action); else { selection = []; render(); }
      return;
    }
    const { active, legal } = activeAndLegal();
    const selRank = selection.length ? (hand.find((c) => c.id === selection[0]) || {}).rank : null;
    if (selRank === card.rank && selection.length === 1 && card.rank !== 7) {
      selection = [...selection, id]; // add a 2nd of this rank — you pick exactly which two
    } else {
      // fresh: auto-grab the pair only when you hold exactly two of this rank; with 3-4 you choose
      const sameRank = active.filter((c) => c.rank === card.rank);
      const legalPair = card.rank !== 7 && legal.some((m) => m.type === "PLAY" && m.cards.length === 2 && (active.find((x) => x.id === m.cards[0]) || {}).rank === card.rank);
      selection = legalPair && sameRank.length === 2 ? sameRank.map((c) => c.id) : [id];
    }
    aceTake = false;
    render();
  }

  // throw a card up onto the table to play it (alternative to the Play button)
  function swipePlay(id) {
    if (!canAct()) return;
    const hand = state.players[viewer()].hand;
    if (!hand.find((c) => c.id === id)) return;
    if (!(selection.includes(id) && selection.length === 2)) selection = [id]; // keep a raised pair, else play this one
    const sa = selectionAction();
    if (sa) apply(sa.action); else { selection = [id]; render(); }
  }
  // distinguish a tap (select/play) from an upward throw (play)
  function bindCardGestures(e, id) {
    let sy = null, sx = null, dragging = false;
    e.addEventListener("pointerdown", (ev) => { sy = ev.clientY; sx = ev.clientX; dragging = false; try { e.setPointerCapture(ev.pointerId); } catch (_) {} });
    e.addEventListener("pointermove", (ev) => {
      if (sy == null) return;
      const dy = ev.clientY - sy, dx = ev.clientX - sx;
      // once a clear upward drag starts, the card follows your finger all the way to the table.
      // the OS scales the window, so divide the screen-space delta by the zoom to track the cursor.
      if (dragging || (dy < -14 && Math.abs(dy) > Math.abs(dx))) {
        dragging = true;
        const z = currentZoom() || 1;
        e.style.transition = "none";
        e.style.zIndex = "70";
        e.style.transform = `translate(${dx / z}px, ${dy / z}px)`;
      }
    });
    const end = (ev) => {
      if (sy == null) return;
      const dy = (ev.clientY ?? sy) - sy;
      sy = null; e.style.transition = ""; e.style.transform = ""; e.style.zIndex = "";
      if (dy < -50) swipePlay(id);         // thrown up toward the middle -> play
      else if (!dragging) onCardClick(id); // tap -> select / play
      else render();                       // small drag back down -> reset
    };
    e.addEventListener("pointerup", end);
    e.addEventListener("pointercancel", () => { sy = null; e.style.transition = ""; e.style.transform = ""; e.style.zIndex = ""; });
  }

  // ---- render ----
  // the badge announces what just happened to the player whose turn it is
  function badgeText() {
    const d = state.demand;
    const mine = state.turn === viewer();
    const me = mine ? "YOU" : state.players[state.turn].name;
    const turnTag = mine ? "YOUR TURN" : `${me}'s turn`;
    const prev = state.lastPlacer != null && state.lastPlacer !== state.turn ? state.players[state.lastPlacer].name : null;
    const top = state.pile.length ? state.pile[state.pile.length - 1] : null;
    const played = top ? `${rankLabel(top.rank)}${SUIT[top.suit]}` : "";
    if (d.type === "open") return mine ? "YOUR TURN — lead any card" : `${me}: lead any card`;
    if (d.type === "pickup") {
      const what = state.lastPlayCount >= 2 ? "a pair" : "a card";
      return prev ? `${prev} dropped ${what} — PICK UP ${d.count}` : `PICK UP ${d.count}`;
    }
    // just state what the previous player put down — let the player deduce the
    // legal response themselves (red = equal/higher, black = equal/lower); the
    // highlighted cards in hand confirm it without spelling out the rule.
    return prev ? `${prev} played ${played} — ${turnTag}` : turnTag;
  }

  function render() {
    if (!state) { stopFireworks(); elWin.style.display = "none"; elSetup.style.display = "flex"; elHandoff.style.display = "none"; return; }
    elSetup.style.display = "none";
    elHandoff.style.display = "none"; // replaced by the in-hand face-down reveal
    const finished = state.status === "finished";
    elWin.style.display = finished ? "flex" : "none";
    if (finished) {
      const w = state.winner;
      elWinTitle.textContent = (mode === "cpu" && w === 0) ? "YOU WIN!" : `${state.players[w].name} WINS!`;
      startFireworks();
    } else stopFireworks();

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
      meta.innerHTML = `<span class="anarchy-opp-name" style="color:${colorFor(o.i)}">${o.p.name}</span><span class="anarchy-opp-count">${o.p.hand.length} cards</span>`;
      box.appendChild(fan); box.appendChild(meta);
      elOpp.appendChild(box);
    });

    // badge + pile (a growing stack of past plays) + run
    elBadge.textContent = flashMsg || badgeText();
    elBadge.className = "anarchy-badge" + (flashMsg ? " flash" : "") + (state.demand.type === "pickup" ? " pickup" : "");
    // the current top group (a pair/triple) sits side-by-side on the same level,
    // all highlighted; older plays stay buried behind showing a corner
    elPile.innerHTML = "";
    const pile = state.pile;
    if (!pile.length) {
      const e = document.createElement("div"); e.className = "acard empty"; e.style.position = "absolute"; e.style.left = "28px"; e.style.top = "18px"; elPile.appendChild(e);
    } else {
      // only the cards played TOGETHER last sit side-by-side; matched singles stack
      const groupN = Math.min(state.lastPlayCount || 1, 3);
      const buried = pile.slice(Math.max(0, pile.length - groupN - 2), pile.length - groupN);
      const group = pile.slice(pile.length - groupN);
      buried.forEach((c, i) => {
        const e = cardEl(c);
        const depth = buried.length - i; // 1..2 behind
        e.style.left = (28 - depth * 13) + "px";
        e.style.top = (18 - depth * 8) + "px";
        e.style.zIndex = String(2 - depth);
        e.classList.add("buried");
        elPile.appendChild(e);
      });
      const span = (group.length - 1) * 24;
      group.forEach((c, i) => {
        const e = cardEl(c);
        e.style.left = (28 - span / 2 + i * 24) + "px";
        e.style.top = "18px";
        e.style.zIndex = String(10 + i);
        if (group.length >= 2) e.classList.add("pile-top");
        elPile.appendChild(e);
      });
    }
    elRun.textContent = state.topRun >= 3 ? "TRIPLE — slap the 4th!" : state.topRun === 2 ? "two of a kind on top" : "";

    // a ghost of the played card glides from the player to the table; the pile itself never moves
    const topId = state.pile.length ? state.pile[state.pile.length - 1].id : null;
    if (topId && topId !== lastTopId) flyPlay(state.lastPlacer, state.pile[state.pile.length - 1]);
    if (lastPileLen > 0 && state.pile.length === 0) biteFlyAway();
    lastTopId = topId;
    lastPileLen = state.pile.length;

    // visible draw (stock) and бита (discard) piles, kept separate
    renderSidePile(elStock, state.stock.length, "Draw");
    renderSidePile(elBita, state.removed.length, "Discard");
    // facing a pickup? the draw deck itself becomes a tap target to take it
    const facingPickup = canAct() && state.demand.type === "pickup";
    elStock.classList.toggle("pickup-ready", facingPickup);
    elStock.onclick = facingPickup ? () => apply({ type: "TAKE_PICKUP" }) : null;
    if (facingPickup) {
      const hint = document.createElement("div");
      hint.className = "anarchy-pickup-hint";
      hint.textContent = `Tap to pick up ${state.demand.count}`;
      elStock.appendChild(hint);
    }
    // animate any card a player just took (flies from the stock) + a clear "+N" pickup tag
    state.players.forEach((p, i) => {
      const grew = p.hand.length - (lastHandCounts[i] ?? p.hand.length);
      if (grew > 0 && i !== suppressDrawIdx) { flyDraw(i, p.hand.slice(p.hand.length - grew)); floatPickup(i, grew); } // drawn cards are appended
    });
    suppressDrawIdx = -1;
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
    elHandName.style.color = mode === "local" ? colorFor(viewer()) : "#eafff0";
    if (mode === "local" && handoffPending) { // show the next player's hand face-down until they reveal
      elHandName.textContent = `${state.players[viewer()].name} — pass the phone, then tap Reveal`;
      state.players[viewer()].hand.forEach(() => elHand.appendChild(cardEl(null, { faceUp: false })));
      fitHand();
      return;
    }
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
      // for a selected pair, mark the card that will land on top (last in order)
      if (isSel && selection.length === 2 && c.id === selection[selection.length - 1]) e.classList.add("sel-top");
      if (isLegal) e.classList.add("legal");
      if (!isSel && !isLegal) e.classList.add("dim");
      if (justRevealed) e.classList.add("flip-in");
      e.style.touchAction = "none"; // let us handle the upward-throw gesture
      bindCardGestures(e, c.id);
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
    if (mode === "local" && handoffPending) {
      add(`Reveal ${state.players[viewer()].name}'s cards`, reveal, "primary reveal");
      return;
    }
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

    // facing a pickup: show every option spelled out
    if (state.demand.type === "pickup") {
      const r = state.demand.rank;
      const seven = hand.find((c) => c.rank === 7);
      const ace = hand.find((c) => c.rank === 14);
      const matches = hand.filter((c) => c.rank === r);
      add(`Take ${state.demand.count}`, () => apply({ type: "TAKE_PICKUP" }), "primary");
      if (matches.length >= 2) add(`Stack two ${rankLabel(r)} → four!`, () => apply({ type: "PLAY", cards: [matches[0].id, matches[1].id] }), "");
      else if (matches.length >= 1) add(`Stack a ${rankLabel(r)}`, () => apply({ type: "PLAY", cards: [matches[0].id] }), "");
      if (seven) add("Cancel with 7 (switch)", () => apply({ type: "SWITCH7", card: seven.id }), "");
      if (ace) add("Cancel with Ace", () => apply({ type: "ACE_CANCEL", card: ace.id, take: true }), "");
      return;
    }

    const sa = selectionAction();
    if (sa) add(sa.label, () => apply(sa.action), "primary");

    const sel = selection.map((id) => hand.find((c) => c.id === id));
    if (sel.length === 1 && sel[0] && sel[0].rank === 14 && state.pile.length)
      add(aceTake ? "☑ take below" : "☐ take below", () => { aceTake = !aceTake; render(); }, "toggle");

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
  function newGame(m, numPlayers, customNames) {
    clearTimeout(botTimer); stopFireworks();
    mode = m; lastMode = m; lastNum = numPlayers; lastNames = customNames || null;
    const names = customNames || (m === "cpu"
      ? ["You", "CPU 1", "CPU 2", "CPU 3"].slice(0, numPlayers)
      : Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`));
    const humanIndices = m === "cpu" ? [0] : names.map((_, i) => i);
    state = createGame({ numPlayers, humanIndices, names });
    selection = []; aceTake = false; flashMsg = ""; handoffPending = false; reservedByPlayer.clear();
    lastTopId = null; lastPileLen = 0; // don't fire a stray бита on the first render
    lastHandCounts = state.players.map((p) => p.hand.length); // the deal isn't a "draw"
    render();
    scheduleBots();
  }

  function showSetupStart() { elStartView.style.display = "block"; elModesView.style.display = "none"; elNamesView.style.display = "none"; }
  function showSetupModes() { elStartView.style.display = "none"; elModesView.style.display = "block"; elNamesView.style.display = "none"; }
  function showNames(n) {
    elStartView.style.display = "none"; elModesView.style.display = "none"; elNamesView.style.display = "block";
    const fields = $(".anarchy-names-fields");
    fields.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const row = document.createElement("div"); row.className = "anarchy-name-row";
      const sw = document.createElement("span"); sw.className = "anarchy-name-color"; sw.style.background = colorFor(i);
      const inp = document.createElement("input"); inp.className = "anarchy-name-input"; inp.maxLength = 12; inp.value = `Player ${i + 1}`;
      row.appendChild(sw); row.appendChild(inp); fields.appendChild(row);
    }
  }
  function toStart() { clearTimeout(botTimer); stopFireworks(); state = null; selection = []; handoffPending = false; showSetupStart(); render(); }

  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    const n = parseInt(b.dataset.players, 10);
    if (b.dataset.mode === "local") showNames(n); else newGame("cpu", n); // local: enter names first
  }));
  $(".anarchy-start-go").addEventListener("click", () => newGame("cpu", 2)); // quick 1-on-1 vs CPU
  $(".anarchy-modes-open").addEventListener("click", showSetupModes);
  $(".anarchy-modes-back").addEventListener("click", showSetupStart);
  $(".anarchy-names-back").addEventListener("click", showSetupModes);
  $(".anarchy-names-start").addEventListener("click", () => {
    const inputs = [...$(".anarchy-names-fields").querySelectorAll("input")];
    const names = inputs.map((inp, i) => (inp.value.trim() || `Player ${i + 1}`).slice(0, 12));
    newGame("local", names.length, names);
  });
  $(".anarchy-handoff-go").addEventListener("click", () => { handoffPending = false; render(); });
  root.querySelectorAll(".anarchy-menu").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.act === "help") { elHelp.style.display = "flex"; return; }
    toStart(); // Game menu = back to the Start screen
  }));
  $(".anarchy-help-close").addEventListener("click", () => { elHelp.style.display = "none"; });
  $(".anarchy-win-again").addEventListener("click", () => newGame(lastMode, lastNum, lastNames));

  showSetupStart();
  render(); // open on the Start screen — no auto-start
  const winId = openWindow({ title: "Anarchy", icon: ICONS.anarchy(14), iconHtml: true, content: root, width: 600, height: 660, flush: true });
  window.addEventListener("resize", () => { if (document.body.contains(root)) render(); }); // re-fit on rotate/resize
  return winId;
}
