// Anarchy — Win98 window UI on top of the pure engine.
import { openWindow, closeWindow } from "../window-manager.js?v=185";
import { ICONS } from "../icons.js?v=185";
import {
  createGame, reduce, legalMoves, slapOpportunities,
  findStraights, rankLabel, colorOf,
} from "./engine.js?v=185";
import { chooseAction, botSlap } from "./bot.js?v=185";
import { currentZoom } from "../scale.js?v=185";

// ︎ forces text (monochrome) presentation so ♥/♦ render as glyphs the
// same size as the rank digit and inherit the card's colour — not as big,
// off-centre colour emoji.
const SUIT = { H: "♥︎", D: "♦︎", C: "♣︎", S: "♠︎" };
const PLAYER_COLORS = ["#ffd24d", "#5db0ff", "#7cf08a", "#ff7ad9"]; // per-seat identity colors
// a card face: a small rank-over-suit index tucked into the top-left corner AND
// mirrored (rotated) into the bottom-right, like a real playing card.
const faceHTML = (card) => {
  const r = rankLabel(card.rank), s = SUIT[card.suit];
  const idx = (pos) => `<span class="acard-idx ${pos}"><b>${r}</b><b>${s}</b></span>`;
  return idx("tl") + idx("br");
};
const colorFor = (i) => PLAYER_COLORS[i % PLAYER_COLORS.length];
const BOT_DELAY = 2000; // base CPU pace; +600ms per extra opponent so crowded tables stay followable

export function openAnarchy() {
  const root = document.createElement("div");
  root.className = "anarchy";
  root.innerHTML = `
    <div class="anarchy-menubar">
      <button class="anarchy-menu" data-menu="file">File</button>
      <button class="anarchy-menu" data-menu="help">Help</button>
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
      <div class="anarchy-pulse"></div>
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
        <div class="anarchy-start-view">
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
          <div class="anarchy-setup-btns"><button class="anarchy-setup-back">Back to game</button></div>
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
        <div class="anarchy-win-standings"></div>
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
  const elHandName = $(".anarchy-handname");
  const elActions = $(".anarchy-actions");
  const elSetup = $(".anarchy-setup");
  const elSetupBack = $(".anarchy-setup-back");
  const elStartView = $(".anarchy-start-view");
  const elNamesView = $(".anarchy-names-view");
  const elHandoff = $(".anarchy-handoff");
  const elHelp = $(".anarchy-help");
  const elFelt = $(".anarchy-felt");
  const elPulse = $(".anarchy-pulse");
  const elStock = $(".anarchy-stock");
  const elBita = $(".anarchy-bita-pile");
  const elFx = $(".anarchy-fx");
  // a fly layer spanning the WHOLE game (felt + hand) so cards animating between
  // the deck/pile and the hand are never clipped by the felt's overflow:hidden
  const elFly = document.createElement("div");
  elFly.className = "anarchy-fly-layer";
  root.appendChild(elFly);
  const elWin = $(".anarchy-win");
  const elWinTitle = $(".anarchy-win-title");
  const elWinStandings = $(".anarchy-win-standings");

  let state = null;
  let mode = "cpu";          // "cpu" | "local"
  let selection = [];
  let aceTake = false;
  let switchMode = false; // a selected 7/Ace: false = play it as a regular card, true = use its switch power
  let botTimer = null;
  let handoffPending = false; // local mode: hide the hand until the next player confirms
  let flashMsg = "";
  const reservedByPlayer = new Map(); // per-player: card ids held off to the side (a saved straight)
  let lastTopId = null, lastPileLen = 0, oppSeatMap = {}, oppBoxMap = {}, lastHandCounts = [], suppressDrawIdx = -1; // animation state
  // live card/pile dimensions — the CSS container queries shrink --cw/--ch/--pilew
  // when the window squeezes, and ALL layout math below derives from these
  let CW = 44, CH = 62, PW = 96, STEP = 13;
  let throwOrigin = null; // where a flicked card left your finger — the ghost continues from THERE
  let setupOpen = false;  // the File > New Game screen shown OVER a live (paused) game — dismissable
  let deckPassReadyAt = 0; // after you tap the deck to TAKE cards, draw-and-pass is locked briefly so a stray double-tap can't pass
  function readDims() {
    // read from the felt (a child of the container) — container queries may not
    // restyle the container itself, so the tier vars land on the children
    const cs = getComputedStyle(elFelt || root);
    CW = parseFloat(cs.getPropertyValue("--cw")) || 44;
    CH = parseFloat(cs.getPropertyValue("--ch")) || 62;
    PW = parseFloat(cs.getPropertyValue("--pilew")) || 96;
    STEP = Math.max(9, Math.round(CW * 0.3)); // how far a pair/triple fans apart
  }
  let pileSnapshot = []; // last rendered pile (positions + faces) so we can fly the real cards to the discard
  let pairFlipId = null; // when swapping which of a selected pair is on top, the card to flip forward
  let newCardIds = new Set(); // cards just added to YOUR hand (draw/pickup) — flagged "new" until you play
  let fxTimer = null, lastMode = "cpu", lastNum = 2, lastNames = null, justRevealed = false;

  // click empty table / hand background (anything that isn't a card or a button) to clear the selection
  const deselectOnBlank = (e) => { if (selection.length && !e.target.closest(".acard") && !e.target.closest("button")) { selection = []; render(); } };
  elFelt.addEventListener("click", deselectOnBlank);
  elHandWrap.addEventListener("click", deselectOnBlank);

  // whose hand is shown / who may act right now
  const viewer = () => (mode === "cpu" ? 0 : state.turn);
  const canAct = () =>
    state && state.status === "playing" && !handoffPending &&
    state.players[state.turn].isHuman && state.turn === viewer();
  // you can slip a 7 in OUT OF TURN (a switch) during a bot's window, as long as
  // there's a card on the table to take and you don't owe a draw. Speed matters.
  const canInterrupt = () =>
    mode === "cpu" && state && state.status === "playing" && !handoffPending &&
    state.turn !== viewer() && !state.players[viewer()].finished &&
    state.pile.length > 0 && (state.players[viewer()].pendingDraw || 0) === 0 &&
    state.players[viewer()].hand.some((c) => c.rank === 7);
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
    d.innerHTML = faceHTML(card);
    return d;
  }

  // a tiny per-card "how it landed" wobble, seeded by the card id so every render
  // agrees where it sits — controlled mess: reads like real stacking, never moves
  function jitter(id, range, salt) {
    let h = salt | 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (((h >>> 0) % 1000) / 1000 - 0.5) * 2 * range;
  }
  // the played card(s) are THROWN from the hand to the table: the group flies as
  // one unit, spinning a full turn like a real toss, and settles at the exact
  // angle/spot the pile shows it resting (the pile itself never moves).
  function flyPlay(idx, cards) {
    const group = Array.isArray(cards) ? cards.filter(Boolean) : (cards ? [cards] : []);
    if (idx == null || !group.length) return;
    const src = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!src || !elPile) return;
    const mine = idx === viewer();
    const from = feltPos(src);
    const span = (group.length - 1) * STEP; // tight: a pair flies and lands close together
    let fromX = from.x + from.w / 2 - (CW + span) / 2, fromY = from.y + (mine ? -6 : from.h / 2);
    if (mine && throwOrigin && group.some((c) => throwOrigin.ids.has(c.id))) {
      // a flicked card keeps flying from the exact spot it left your finger
      const f = elFly.getBoundingClientRect(), z = currentZoom() || 1;
      fromX = (throwOrigin.rect.left - f.left) / z;
      fromY = (throwOrigin.rect.top - f.top) / z;
    }
    throwOrigin = null;
    // aim at the REAL pile cards' MEASURED positions, so the ghost lands exactly
    // where the cards rest — no computed-vs-rendered drift, no last-pixel jump
    const pileCards = group.map((c) => elPile.querySelector(`.acard[data-id="${c.id}"]`)).filter(Boolean);
    if (!pileCards.length) return;
    const land0 = feltPos(pileCards[0]);
    const toX = land0.x, toY = land0.y;
    pileCards.forEach((el) => { el.style.visibility = "hidden"; }); // hidden until the ghost arrives on them
    const wrap = document.createElement("div");
    wrap.className = "anarchy-fly anarchy-throw";
    wrap.style.left = fromX + "px"; wrap.style.top = fromY + "px";
    group.forEach((card, i) => {
      // an opponent throws from a hidden hand: each card is a 3D flipper that
      // turns face-up mid-air inside the spinning group — a real flick onto the
      // table. Your own throw leaves your hand already face-up.
      let g;
      if (!mine) {
        g = document.createElement("div");
        g.className = "anarchy-flipcard";
        const inner = document.createElement("div");
        inner.className = "anarchy-flip-inner";
        inner.appendChild(cardEl(null, { faceUp: false }));
        const face = cardEl(card); face.classList.add("anarchy-flip-front");
        inner.appendChild(face);
        g.appendChild(inner);
      } else g = cardEl(card);
      if (i) { g.style.position = "absolute"; g.style.left = (i * STEP) + "px"; g.style.top = "0"; }
      wrap.appendChild(g);
    });
    // launch FLAT at the start point, then force a reflow so the browser commits
    // that frame. Without this the start + target collapse into one frame and the
    // transition is SKIPPED — the card just jumps to the pile (the "teleport").
    wrap.style.transform = "translate(0px, 0px) rotate(0deg)";
    elFly.appendChild(wrap);
    void wrap.offsetWidth; // commit the launch frame — now the glide actually runs
    const T = mine ? 560 : 680; // the CPU flick is a touch slower so its reveal reads
    const turn = (jitter(group[0].id, 1, 7) >= 0 ? 360 : -360); // one full spin, landing flat (360 ≡ 0)
    // reveal the real cards the INSTANT the ghost actually lands (transitionend),
    // never on a guessed timer, so it can't pop in early while the ghost still glides
    let landed = false;
    const land = () => {
      if (landed) return; landed = true;
      pileCards.forEach((el) => { el.style.visibility = ""; }); // real cards take over exactly where the ghost rests
      setTimeout(() => wrap.remove(), 30); // one frame of overlap (ghost over real), then drop it
    };
    wrap.addEventListener("transitionend", (e) => { if (e.target === wrap && e.propertyName === "transform") land(); });
    wrap.style.transition = `transform ${T}ms cubic-bezier(.22,.68,.3,1)`; // glides in and settles onto the slot
    wrap.style.transform = `translate(${toX - fromX}px, ${toY - fromY}px) rotate(${turn}deg)`;
    wrap.querySelectorAll(".anarchy-flip-inner").forEach((inner) => {
      inner.style.transition = `transform ${Math.round(T * 0.45)}ms ease ${Math.round(T * 0.18)}ms`;
      inner.style.transform = "rotateY(180deg)";
    });
    setTimeout(land, T + 160); // fallback only — if transitionend never fires, still reveal
  }
  // position of an element's top-left within the fly layer (which spans the whole
  // game), so flies can travel between the felt and the hand without being clipped
  function feltPos(el) {
    const z = currentZoom() || 1; // getBoundingClientRect is post-zoom; convert to layer px
    const f = elFly.getBoundingClientRect(), r = el.getBoundingClientRect();
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
  // a drawn card flies from the deck like a real take: it launches deck-sized and
  // face-down, grows as it travels toward you, FLIPS face-up mid-flight, and lands
  // on the EXACT spot in your hand where it ends up (the real card hides until the
  // ghost arrives, so flight path and destination always agree).
  function flyDraw(idx, cards, fromEl, opts = {}) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    const src = fromEl || elStock;
    if (!target || !src) return;
    const from = feltPos(src);
    const reveal = idx === viewer();
    const T = opts.big ? 1050 : 900; // unhurried — the eye should be able to follow
    cards.slice(0, 3).forEach((card, k) => {
      let toX, toY, endScale = 1, slotEl = null, fanEl = null;
      if (reveal && card) slotEl = [...elHand.children].find((el) => el.dataset && el.dataset.id === card.id) || null;
      if (slotEl) { const p = feltPos(slotEl); toX = p.x; toY = p.y; }
      else if (!reveal && target.querySelector && (fanEl = target.querySelector(".anarchy-opp-fan")) && fanEl.lastElementChild) {
        // an opponent's draw lands ON their fan — the newest card of the stack they
        // hold, not just somewhere near their seat
        const p = feltPos(fanEl.lastElementChild);
        toX = p.x; toY = p.y; endScale = Math.max(0.4, 22 / CW);
      }
      else { const to = feltPos(target); toX = to.x + to.w / 2 - CW / 2; toY = to.y + (reveal ? -8 : to.h / 2); if (!reveal) endScale = 0.55; }
      const fly = document.createElement("div");
      fly.className = "anarchy-fly anarchy-fly3d" + (opts.big ? " anarchy-fly-pickup" : "");
      fly.style.left = from.x + "px"; fly.style.top = from.y + "px";
      fly.style.transform = "scale(.55)"; // deck-sized at launch, full-sized on arrival
      const inner = document.createElement("div");
      inner.className = "anarchy-flip-inner";
      inner.appendChild(cardEl(null, { faceUp: false }));
      if (reveal && card) { const face = cardEl(card); face.classList.add("anarchy-flip-front"); inner.appendChild(face); }
      fly.appendChild(inner);
      elFly.appendChild(fly);
      const d = k * 240;
      const slotRot = slotEl ? parseFloat(slotEl.style.rotate) || 0 : 0; // land at the slot's fan tilt
      if (slotEl) { slotEl.style.visibility = "hidden"; setTimeout(() => { slotEl.style.visibility = ""; }, d + T); }
      if (fanEl) setTimeout(() => { fanEl.classList.remove("absorb"); void fanEl.offsetWidth; fanEl.classList.add("absorb"); }, d + T); // the fan swallows it
      setTimeout(() => {
        fly.style.transition = `transform ${T}ms cubic-bezier(.22,.7,.25,1)`;
        fly.style.transform = `translate(${toX - from.x}px, ${toY - from.y}px) scale(${endScale}) rotate(${slotRot}deg)`;
        if (reveal && card) { // the flip starts a third of the way home
          inner.style.transition = `transform ${Math.round(T * 0.5)}ms ease ${Math.round(T * 0.3)}ms`;
          inner.style.transform = "rotateY(180deg)";
        }
      }, d + 20);
      // the real card reappears exactly under the still-opaque ghost, then the ghost
      // whips away in 120ms — a tight crossfade, no double-image shimmer, no gap
      setTimeout(() => { fly.style.transition = "opacity .12s"; fly.style.opacity = "0"; }, d + T + 10);
      setTimeout(() => fly.remove(), d + T + 180);
    });
  }
  // the forced-pickup variant: the same flight with a bigger, golden presence
  function flyPickup(idx, cards) { flyDraw(idx, cards, null, { big: true }); }
  // a switch (7/Ace) scoops the card beneath it into the player's hand — show that
  // EXACT card, face-up, gliding from the table to the very slot it lands in.
  function flyFromPile(idx, card) {
    const target = idx === viewer() ? elHand : oppBoxMap[idx];
    if (!target || !elPile) return;
    const from = feltPos(elPile), to = feltPos(target);
    const fly = card ? cardEl(card) : cardEl(null, { mini: true, faceUp: false });
    fly.classList.add("anarchy-fly", "anarchy-fly-pickup");
    const fromX = from.x + Math.round(PW * 0.27), fromY = from.y + Math.round(CH * 0.32);
    fly.style.left = fromX + "px"; fly.style.top = fromY + "px";
    elFly.appendChild(fly);
    const T = 950;
    const slotEl = idx === viewer() && card ? [...elHand.children].find((el) => el.dataset && el.dataset.id === card.id) || null : null;
    const fanEl = idx !== viewer() && target.querySelector ? target.querySelector(".anarchy-opp-fan") : null;
    let toX, toY, endScale;
    const slotRot = slotEl ? parseFloat(slotEl.style.rotate) || 0 : 0; // settle at the slot's fan tilt
    if (slotEl) {
      const p = feltPos(slotEl); toX = p.x; toY = p.y; endScale = 1;
      slotEl.style.visibility = "hidden"; setTimeout(() => { slotEl.style.visibility = ""; }, T);
    } else if (fanEl && fanEl.lastElementChild) { // the scooped card joins their held fan
      const p = feltPos(fanEl.lastElementChild); toX = p.x; toY = p.y; endScale = Math.max(0.4, 22 / CW);
      setTimeout(() => { fanEl.classList.remove("absorb"); void fanEl.offsetWidth; fanEl.classList.add("absorb"); }, T);
    } else { toX = to.x + to.w / 2 - CW / 2; toY = to.y + (idx === viewer() ? -8 : to.h / 2); endScale = idx === viewer() ? 1.05 : 0.7; }
    requestAnimationFrame(() => {
      fly.style.transition = `transform ${T}ms cubic-bezier(.2,.7,.2,1)`;
      fly.style.transform = `translate(${toX - fromX}px, ${toY - fromY}px) scale(${endScale}) rotate(${slotRot}deg)`;
    });
    setTimeout(() => { fly.style.transition = "opacity .12s"; fly.style.opacity = "0"; }, T + 10);
    setTimeout(() => fly.remove(), T + 180);
  }
  // the table breathes with the takes: a brief red sting around the edges when
  // YOU pick up, a soft green wash when an opponent does — quiet scorekeeping
  function feltPulse(kind) {
    if (!elPulse) return;
    elPulse.classList.remove("pain", "reward");
    void elPulse.offsetWidth; // restart the animation even on back-to-back takes
    elPulse.classList.add(kind);
  }
  // your punishing play THUDS: a subtle table shake as the cards land
  function feltShake() {
    if (!elFelt) return;
    elFelt.classList.remove("shake");
    void elFelt.offsetWidth;
    elFelt.classList.add("shake");
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
    elFly.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  }
  // a distinct banner so a pass reads clearly as a pass (not a pickup)
  function announcePass(idx) {
    if (!elFelt || idx == null || !state.players[idx]) return;
    [...elFelt.querySelectorAll(".anarchy-intake")].forEach((e) => e.remove());
    const name = idx === viewer() ? "YOU" : state.players[idx].name;
    const el = document.createElement("div");
    el.className = "anarchy-intake pass";
    el.textContent = `${name} — PASS`;
    elFelt.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  // snapshot the rendered pile (felt-relative positions + faces) so that, when the
  // table clears, we can fly the REAL cards into the discard rather than a stand-in.
  function snapshotPile() {
    return [...elPile.querySelectorAll(".acard:not(.empty)")].map((el) => {
      const p = feltPos(el);
      return { x: p.x, y: p.y, cls: el.className, html: el.innerHTML };
    });
  }
  // sweep the table to the discard when it clears: every card that was on the table
  // flips face-down and slides into the discard pile, one after another.
  function discardSweep(cards) {
    if (!elBita) return;
    const list = (cards && cards.length) ? cards : snapshotPile();
    if (!list.length) return;
    const to = feltPos(elBita);
    list.forEach((c, i) => {
      const fly = document.createElement("div");
      fly.className = (c.cls || "acard").replace(/\b(buried|pile-top)\b/g, "").trim() + " anarchy-fly anarchy-discard-fly";
      fly.innerHTML = c.html || "";
      fly.style.left = c.x + "px"; fly.style.top = c.y + "px"; fly.style.zIndex = String(38 + i);
      elFly.appendChild(fly);
      const d = i * 95;
      // 1) flip the face to its edge, 2) swap to the card back, 3) keep flipping while it slides into the discard
      setTimeout(() => { fly.style.transition = "transform .2s linear"; fly.style.transform = "perspective(600px) rotateY(90deg)"; }, d);
      setTimeout(() => { fly.className = "acard back anarchy-fly anarchy-discard-fly"; fly.innerHTML = ""; fly.style.transform = "perspective(600px) rotateY(90deg)"; }, d + 200);
      setTimeout(() => {
        fly.style.transition = "transform .5s ease-in, opacity .5s ease-in";
        fly.style.transform = `translate(${to.x - c.x}px, ${to.y - c.y}px) perspective(600px) rotateY(180deg) scale(.62) rotate(12deg)`;
        fly.style.opacity = "0";
      }, d + 230);
      setTimeout(() => fly.remove(), d + 770);
    });
    const toast = document.createElement("div");
    toast.className = "anarchy-bita-toast"; toast.textContent = "Discard";
    elPile.appendChild(toast);
    setTimeout(() => toast.remove(), 900);
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

  // ---- win cascade: a flurry of REAL game cards (identical design to the table)
  // rains down and bounces, BOUNDED to the felt so nothing ever clips off an edge. ----
  let winRainRAF = null, winRainCards = [];
  function stopWinCascade() {
    if (winRainRAF) { cancelAnimationFrame(winRainRAF); winRainRAF = null; }
    winRainCards.forEach((s) => s.el.remove());
    winRainCards = [];
  }
  function startWinCascade() {
    if (winRainRAF || !elFly) return;
    const z = currentZoom() || 1;
    const f = elFly.getBoundingClientRect();
    const W = Math.max(120, f.width / z), H = Math.max(120, f.height / z);
    const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14], SUITS = ["H","D","C","S"];
    const maxX = Math.max(0, W - CW), floor = Math.max(0, H - CH);
    const rc = () => { const r = RANKS[(Math.random()*RANKS.length)|0], s = SUITS[(Math.random()*SUITS.length)|0]; return { rank: r, suit: s, id: `${r}${s}` }; };
    const launch = (sc, fromTop) => {
      sc.x = Math.random() * maxX;
      sc.y = fromTop ? -CH - Math.random() * H * 0.6 : Math.random() * floor; // first frame: spread across the felt
      sc.vx = (Math.random() - 0.5) * 2.4;
      sc.vy = 1 + Math.random() * 2.5;
      sc.rot = Math.random() * 360; sc.vr = (Math.random() - 0.5) * 9; sc.bounces = 0;
      sc.el.style.transform = `translate(${sc.x}px, ${sc.y}px) rotate(${sc.rot}deg)`; // set NOW so the first frame is correct
    };
    winRainCards = [];
    for (let i = 0; i < 16; i++) {
      const el = cardEl(rc());          // a REAL game card — same markup/design as the table
      el.className += " anarchy-win-card";
      elFly.appendChild(el);
      const sc = { el }; launch(sc, false);
      winRainCards.push(sc);
    }
    const GRAV = 0.22;
    const tick = () => {
      for (const sc of winRainCards) {
        sc.vy += GRAV; sc.x += sc.vx; sc.y += sc.vy; sc.rot += sc.vr;
        if (sc.x < 0) { sc.x = 0; sc.vx = -sc.vx * 0.9; }          // bounce off the sides — bounded, never clips
        else if (sc.x > maxX) { sc.x = maxX; sc.vx = -sc.vx * 0.9; }
        if (sc.y >= floor) {
          if (sc.bounces < 2 && sc.vy > 2.2) { sc.y = floor; sc.vy = -sc.vy * 0.5; sc.vx *= 0.8; sc.bounces++; }
          else { launch(sc, true); continue; }                     // settled → recycle from the top: an endless gentle rain
        }
        sc.el.style.transform = `translate(${sc.x}px, ${sc.y}px) rotate(${sc.rot}deg)`;
      }
      winRainRAF = requestAnimationFrame(tick);
    };
    winRainRAF = requestAnimationFrame(tick);
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
      if (c.rank === 7 || c.rank === 14) {
        // a 7/Ace can play as a REGULAR card (e.g. stack a 3rd Ace onto a pair of
        // Aces to send 2 back) OR use its switch power. Default to regular when
        // that's a legal move; switchMode (a re-tap) arms the special power.
        const regularLegal = activeAndLegal().legal.some((m) =>
          m.type === "PLAY" && m.cards.length === 1 &&
          (hand.find((x) => x.id === m.cards[0]) || {}).rank === c.rank);
        if (regularLegal && !switchMode) {
          const what = c.rank === 14 ? "Ace" : "7";
          return { label: (d.type === "pickup" ? "Stack " : "Play ") + what, action: { type: "PLAY", cards: [c.id] } };
        }
        if (c.rank === 7) return { label: "Switch 7", action: { type: "SWITCH7", card: c.id } };
        if (d.type === "pickup") return { label: "Ace — cancel pickup", action: { type: "ACE_CANCEL", card: c.id, take: true } };
        return { label: aceTake ? "Ace switch + take" : "Ace switch", action: { type: "ACE_SWITCH", card: c.id, take: aceTake } };
      }
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
    const me = viewer();
    const isSwitchTake = action.type === "SWITCH7" || ((action.type === "ACE_SWITCH" || action.type === "ACE_CANCEL") && action.take);
    const taker = isSwitchTake ? (action.by == null ? prevTurn : action.by) : null;
    const hadPile = state.pile.length > 0;
    const switchCard = isSwitchTake && hadPile ? state.pile[state.pile.length - 1] : null; // the exact card the switch will scoop
    // taking a pickup OR clearing an owed draw: cards slide from the draw deck
    const drawing = action.type === "TAKE_PICKUP" || action.type === "DRAW_PENDING";
    const drawTaker = drawing ? state.turn : -1;
    const beforeCounts = state.players.map((p) => p.hand.length);
    const beforePending = state.players.map((p) => p.pendingDraw || 0);
    const demandBefore = state.demand.type;
    try { state = reduce(state, action); }
    catch (e) { flash(e.message); return; }
    selection = []; aceTake = false; switchMode = false;
    // local mode: hand off the device whenever the active player changes
    if (mode === "local" && state.status === "playing" && state.turn !== prevTurn) {
      handoffPending = true;
      flipHandArea();
    }
    if (drawTaker >= 0) suppressDrawIdx = drawTaker; // skip the generic stock-fly for the taker
    if (taker === me && switchCard) newCardIds.add(switchCard.id); // a switch scoops a card (hand count unchanged) — flag it NEW too
    render();
    if (drawTaker >= 0) {
      const h = state.players[drawTaker].hand;
      const drewN = h.length - beforeCounts[drawTaker]; // actual cards drawn (0 if the stock was empty)
      if (drewN > 0) { flyPickup(drawTaker, h.slice(h.length - drewN)); feltPulse(drawTaker === viewer() ? "pain" : "reward"); } // big cards slide from the draw deck
    }
    if (taker != null && hadPile) flyFromPile(taker, switchCard); // switch: the card below flies to the player
    if (action.type === "PASS") announcePass(prevTurn);
    // your play just stuck somebody: a small table THUD as the cards land
    if (state.status === "playing" && (action.type === "PLAY" || action.type === "DUMP" || action.type === "SLAP")) {
      const punished = state.players.some((p, i) => i !== me && ((p.pendingDraw || 0) > beforePending[i] || p.hand.length > beforeCounts[i]))
        || (state.demand.type === "pickup" && demandBefore !== "pickup" && state.turn !== me);
      if (punished) setTimeout(feltShake, 430); // synced to the throw's landing
    }
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
      const switchCard = isSwitchTake && hadPile ? state.pile[state.pile.length - 1] : null; // the card the switch scoops
      const drawing = action.type === "TAKE_PICKUP" || action.type === "DRAW_PENDING";
      const drawTaker = drawing ? state.turn : -1;
      const beforeCounts = state.players.map((p) => p.hand.length);
      const passer = state.turn; // who is about to act (for a PASS banner)
      try { state = reduce(state, action); } catch (e) { /* skip a bad bot move */ }
      if (drawTaker >= 0) suppressDrawIdx = drawTaker;
      render();
      if (drawTaker >= 0) {
        const h = state.players[drawTaker].hand;
        const drewN = h.length - beforeCounts[drawTaker];
        if (drewN > 0) { flyPickup(drawTaker, h.slice(h.length - drewN)); feltPulse(drawTaker === viewer() ? "pain" : "reward"); } // enemy draw slides from deck to their seat
      }
      if (taker != null && hadPile) flyFromPile(taker, switchCard); // enemy switch: the card below flies to them
      if (action.type === "PASS") announcePass(passer);
      scheduleBots();
    }, BOT_DELAY + Math.max(0, state.players.length - 2) * 600);
  }

  // ---- interaction ----
  // off-turn, two cards still fire straight from the hand — but only by a real
  // THROW (flick up): a 7 slips in as a switch, and the 4th of a showing triple
  // SLAPS in to complete the four. A mere tap never triggers them.
  function offTurnCardPlay(id) {
    const c = state.players[viewer()].hand.find((x) => x.id === id);
    if (!c) return false;
    if (c.rank === 7 && canInterrupt()) { apply({ type: "SWITCH7", card: id, by: viewer() }); return true; }
    if (c.rank === state.topRank && slapOpportunities(state).some((o) => o.by === viewer())) { apply({ type: "SLAP", by: viewer(), card: id }); return true; }
    return false;
  }
  function onCardClick(id) {
    // a combo card: tapping it breaks it out of the combo, back into your fan
    // (a hand-sorting move, so it works any time — even off-turn)
    if (reservedSet().has(id)) { reservedSet().delete(id); render(); return; }
    if (!canAct()) return; // off-turn moves (7 switch, slap) need a real THROW, not a tap
    const hand = state.players[viewer()].hand;
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    if (selection.includes(id)) {
      // tapping a card that's already selected:
      // - a pair → tap ANYWHERE on it to toggle which card is on top (never
      //   deselects; deselect = tap empty felt)
      if (selection.length === 2) {
        const newTop = selection[0]; // whoever is underneath comes forward
        selection = [selection[1], newTop];
        flipPairTop(newTop); return;
      }
      // - a lone selected 7/Ace → re-tap toggles regular ↔ switch power when BOTH
      //   are real moves (the card / button / a throw commits the chosen mode)
      if (card.rank === 7 || card.rank === 14) {
        const lg = activeAndLegal().legal;
        const regularLegal = lg.some((m) => m.type === "PLAY" && m.cards.length === 1 && (hand.find((x) => x.id === m.cards[0]) || {}).rank === card.rank);
        const switchLegal = lg.some((m) => (m.type === "SWITCH7" || m.type === "ACE_SWITCH" || m.type === "ACE_CANCEL") && m.card === id);
        if (regularLegal && switchLegal) { switchMode = !switchMode; render(); return; }
      }
      // - a lone selected card → tap again to play it
      const sa = selectionAction();
      if (sa) apply(sa.action); else { selection = []; render(); }
      return;
    }
    // tapping an unselected card: select just that one, OR — if you already hold a
    // single of the same rank — add it to make a pair. Purely manual: no auto-grab.
    const selRank = selection.length === 1 ? (hand.find((c) => c.id === selection[0]) || {}).rank : null;
    selection = (selRank != null && selRank === card.rank && card.rank !== 7) ? [...selection, id] : [id];
    newCardIds.delete(id); // you've picked the card up — the NEW tag has done its job
    aceTake = false; switchMode = false; // a fresh selection starts as a plain card
    render();
  }

  // throw a card up onto the table to play it (alternative to the Play button)
  function swipePlay(id) {
    if (reservedSet().has(id)) { reservedSet().delete(id); render(); return; } // a flicked combo card just returns to the fan
    if (!canAct()) { if (!offTurnCardPlay(id)) render(); return; } // a flick can still slap the 4th / slip a 7 in; refused → the card glides home
    const hand = state.players[viewer()].hand;
    if (!hand.find((c) => c.id === id)) { render(); return; }
    if (!(selection.includes(id) && selection.length === 2)) {
      if (!(selection.length === 1 && selection[0] === id)) switchMode = false; // a fresh/different card throws as a plain card
      selection = [id]; // keep a raised pair, else play this one
    }
    const sa = selectionAction();
    if (sa) apply(sa.action); else { selection = [id]; render(); }
  }
  // distinguish a tap (select/play) from an upward throw (play)
  function bindCardGestures(e, id) {
    let sy = null, sx = null, dragging = false;
    // the other card of a selected pair, so the two drag (and throw) together in unison
    const partnerEl = () => {
      if (!(selection.length === 2 && selection.includes(id))) return null;
      const other = selection.find((x) => x !== id);
      return [...elHand.children].find((el) => el.dataset && el.dataset.id === other) || null;
    };
    const clearDrag = (el) => { if (el) { el.style.transition = ""; el.style.transform = ""; el.style.zIndex = ""; } };
    e.addEventListener("pointerdown", (ev) => { sy = ev.clientY; sx = ev.clientX; dragging = false; try { e.setPointerCapture(ev.pointerId); } catch (_) {} });
    e.addEventListener("pointermove", (ev) => {
      if (sy == null) return;
      const dy = ev.clientY - sy, dx = ev.clientX - sx;
      // once a clear upward drag starts, the card follows your finger all the way to the table.
      // the OS scales the window, so divide the screen-space delta by the zoom to track the cursor.
      if (dragging || (dy < -14 && Math.abs(dy) > Math.abs(dx))) {
        dragging = true;
        const z = currentZoom() || 1;
        // a selected pair sits in a tight stack (--px/--py from layoutSelectedPair);
        // keep each card's own offset under the drag so the stack flies as one unit
        const lift = (el, zi) => {
          if (!el) return;
          const bx = parseFloat(el.style.getPropertyValue("--px")) || 0;
          const by = parseFloat(el.style.getPropertyValue("--py")) || 0;
          el.style.transition = "none";
          el.style.zIndex = zi;
          el.style.transform = `translate(${bx + dx / z}px, ${by + dy / z}px)`;
        };
        lift(e, "70");
        lift(partnerEl(), "69");
      }
    });
    const end = (ev) => {
      if (sy == null) return;
      const dy = (ev.clientY ?? sy) - sy;
      sy = null;
      if (dy < -50) {
        // a throw: remember exactly where the card left your finger — the ghost
        // continues the SAME flight from there (no snap-back, no teleport). The
        // re-render removes the dragged card, so its transform needs no cleanup.
        throwOrigin = { ids: new Set(selection.length === 2 && selection.includes(id) ? selection : [id]), rect: e.getBoundingClientRect() };
        swipePlay(id);    // synchronous: a successful play's ghost has already launched
        throwOrigin = null; // a refused throw must not leave a stale origin behind
        return;
      }
      if (dragging) { clearDrag(e); clearDrag(partnerEl()); render(); } // small drag back down -> reset
      else onCardClick(id);                                             // tap -> select / play
    };
    e.addEventListener("pointerup", end);
    e.addEventListener("pointercancel", () => { sy = null; clearDrag(e); clearDrag(partnerEl()); });
  }

  // ---- render ----
  // the badge announces what just happened to the player whose turn it is
  function badgeText() {
    const d = state.demand;
    const mine = state.turn === viewer();
    const me = mine ? "YOU" : state.players[state.turn].name;
    const owed = (state.players[state.turn].pendingDraw || 0);
    if (owed > 0 && state.stock.length > 0) return mine ? `TAP THE DECK — TAKE ${owed}` : `${me} — pick up ${owed}`;
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
    readDims(); // pick up the container-query card size for all layout math
    if (!state) { stopFireworks(); stopWinCascade(); elWin.style.display = "none"; elSetup.style.display = "flex"; elSetupBack.style.display = "none"; elHandoff.style.display = "none"; return; }
    elSetup.style.display = setupOpen ? "flex" : "none"; // the New Game screen can sit over a paused game
    elHandoff.style.display = "none"; // replaced by the in-hand face-down reveal
    const finished = state.status === "finished";
    elWin.style.display = finished && !setupOpen ? "flex" : "none";
    if (finished) {
      const places = state.places && state.places.length ? state.places : [state.winner];
      const ord = (n) => ["", "1st", "2nd", "3rd", "4th"][n] || `${n}th`;
      const myPlace = mode === "cpu" ? places.indexOf(0) + 1 : 0;
      const youWon = mode !== "cpu" || state.winner === 0;
      elWinTitle.textContent = mode === "cpu"
        ? (myPlace === 1 ? "YOU WIN!" : `YOU CAME ${ord(myPlace)}`)
        : `${state.players[state.winner].name} WINS!`;
      elWinStandings.innerHTML = places.length > 2
        ? places.map((i, k) => `<div>${ord(k + 1)} — ${i === 0 && mode === "cpu" ? "You" : state.players[i].name}</div>`).join("")
        : "";
      if (youWon) startWinCascade(); else startFireworks();
    } else { stopFireworks(); stopWinCascade(); }

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
    const owedNow = (state.players[state.turn].pendingDraw || 0) > 0 && state.stock.length > 0;
    const urgent = state.demand.type === "pickup" || owedNow;
    elBadge.className = "anarchy-badge" + (flashMsg ? " flash" : "") + (urgent ? " pickup" : "") + (urgent && state.turn === viewer() ? " you" : "");
    // the current top group (a pair/triple) sits side-by-side on the same level,
    // all highlighted; older plays stay buried behind showing a corner
    elPile.innerHTML = "";
    const pile = state.pile;
    if (!pile.length) {
      const e = document.createElement("div"); e.className = "acard empty"; e.style.position = "absolute"; e.style.left = ((PW - CW) / 2) + "px"; e.style.top = ((PW - CH) / 2) + "px"; elPile.appendChild(e);
    } else {
      // the current play sits tight and centred; older cards step out to the
      // upper-left so they keep peeking and are never fully covered
      const groupN = Math.min(state.lastPlayCount || 1, 3);
      const buried = pile.slice(Math.max(0, pile.length - groupN - 5), pile.length - groupN);
      const group = pile.slice(pile.length - groupN);
      const span = (group.length - 1) * STEP; // a pair barely overlaps — close together
      const gLeft = (PW - (CW + span)) / 2;   // centre the current play in the pile box
      const gTop = Math.round(CH * 0.32);
      // the history TRAILS behind the current play like a fan spread onto the felt:
      // each older card steps back along the arc and rotates further open, with its
      // own seeded wobble — organic, but the newest cards stay flat and readable
      buried.forEach((c, i) => {
        const e = cardEl(c);
        const depth = buried.length - i;       // 1..5 older, 1 = right under the play
        e.style.left = (gLeft - depth * Math.round(CW * 0.30) + jitter(c.id, 3, 2)) + "px";
        e.style.top = (gTop - depth * Math.round(CH * 0.10) + jitter(c.id, 3, 3)) + "px";
        e.style.transform = `rotate(${-depth * 7 + jitter(c.id, 5, 1)}deg)`; // the fan opens backwards
        e.style.zIndex = String(8 - depth);
        e.classList.add("buried");
        elPile.appendChild(e);
      });
      group.forEach((c, i) => {
        const e = cardEl(c);
        // the current play lands FLAT and jitter-free: it's the readable card, and
        // a flat target lets a thrown ghost settle onto it seamlessly (no pop)
        e.style.left = (gLeft + i * STEP) + "px";
        e.style.top = gTop + "px";
        e.style.zIndex = String(10 + i);
        if (group.length >= 2) e.classList.add("pile-top");
        elPile.appendChild(e);
      });
    }
    elRun.textContent = state.topRun >= 3 ? "TRIPLE — slap the 4th!" : state.topRun === 2 ? "two of a kind on top" : "";

    // a ghost of the just-played card(s) glides from the player to the table; the pile itself never moves
    const topId = state.pile.length ? state.pile[state.pile.length - 1].id : null;
    if (topId && topId !== lastTopId) {
      const n = Math.min(state.lastPlayCount || 1, 3);
      flyPlay(state.lastPlacer, state.pile.slice(state.pile.length - n));
    }
    if (lastPileLen > 0 && state.pile.length === 0) discardSweep(pileSnapshot); // the cleared table flips into the discard
    pileSnapshot = snapshotPile(); // remember this pile so the next clear can fly the real cards
    lastTopId = topId;
    lastPileLen = state.pile.length;

    // visible draw (stock) and бита (discard) piles, kept separate
    renderSidePile(elStock, state.stock.length, "Draw");
    renderSidePile(elBita, state.removed.length, "Discard");
    // the draw deck is the always-available action target: take a forced pickup,
    // clear an owed draw, or — under a colour demand — draw-and-pass. The pass is
    // ALWAYS optional (tap the deck), so it pulses only when it's your only move.
    const owed = canAct() ? (state.players[viewer()].pendingDraw || 0) : 0;
    const owesPending = owed > 0 && state.stock.length > 0; // you must tap to take cards you owe
    const facingPickup = canAct() && !owesPending && state.demand.type === "pickup";
    const deckPassRaw = canAct() && !owesPending && state.demand.type === "color" && state.stock.length > 0;
    // just took cards off the deck? hold the draw-and-pass for a beat so the
    // momentum of a second tap can't accidentally pass your turn away
    const passLocked = deckPassRaw && performance.now() < deckPassReadyAt;
    const deckPass = deckPassRaw && !passLocked;
    const hasPlay = canAct() && activeAndLegal().legal.some((m) => m.type === "PLAY" || m.type === "SWITCH7" || m.type === "ACE_SWITCH");
    const deckUrgent = owesPending || facingPickup || (deckPass && !hasPlay); // forced → pulse; optional pass → quiet
    elStock.classList.toggle("pickup-ready", deckUrgent);
    elStock.classList.toggle("tappable", owesPending || facingPickup || deckPass); // clickable even when it isn't pulsing (the optional draw-and-pass)
    const armPass = () => { deckPassReadyAt = performance.now() + 700; }; // start the cooldown the instant you take
    elStock.onclick = owesPending ? () => { armPass(); apply({ type: "DRAW_PENDING" }); }
                    : facingPickup ? () => { armPass(); apply({ type: "TAKE_PICKUP" }); }
                    : deckPass ? () => apply({ type: "PASS" })
                    : null;
    if (owesPending || facingPickup || deckPass) {
      const hint = document.createElement("div");
      hint.className = "anarchy-pickup-hint" + (deckPass && hasPlay ? " quiet" : ""); // optional pass reads calmer
      hint.textContent = owesPending ? `Tap to take ${owed}` : facingPickup ? `Tap to pick up ${state.demand.count}` : "Tap to draw & pass";
      elStock.appendChild(hint);
    }
    if (passLocked) setTimeout(() => { if (document.body.contains(root)) render(); }, Math.max(60, deckPassReadyAt - performance.now() + 30)); // re-enable draw-and-pass once the cooldown ends
    // who just took cards (flies from the stock) — flights launch AFTER renderHand
    // so the ghost can target the exact slot the new card occupies
    const drawFlights = [];
    state.players.forEach((p, i) => {
      const grew = p.hand.length - (lastHandCounts[i] ?? p.hand.length);
      if (grew > 0 && i !== suppressDrawIdx) drawFlights.push([i, p.hand.slice(p.hand.length - grew), grew]);
      if (i === viewer()) {
        if (grew > 0) p.hand.slice(p.hand.length - grew).forEach((c) => newCardIds.add(c.id)); // flag what just landed in YOUR hand
        else if (grew < 0) newCardIds.clear(); // you played — the "new" markers have served their purpose
      }
    });
    suppressDrawIdx = -1;
    lastHandCounts = state.players.map((p) => p.hand.length);

    elLog.innerHTML = state.log.slice(-4).map((l) => `<div>${l}</div>`).join("");
    elLog.scrollTop = elLog.scrollHeight;

    renderHand();
    renderActions();
    drawFlights.forEach(([i, cs, n]) => { flyDraw(i, cs); floatPickup(i, n); feltPulse(i === viewer() ? "pain" : "reward"); }); // drawn cards are appended
  }

  function renderHand() {
    // snapshot current card positions so a changed hand can animate (FLIP) into place
    const prevRects = new Map();
    const prevReserved = new Set(); // who was in the combo split before this render
    for (const el of elHand.children) if (el.dataset && el.dataset.id) {
      prevRects.set(el.dataset.id, el.getBoundingClientRect());
      if (el.classList.contains("reserved")) prevReserved.add(el.dataset.id);
    }
    elHand.innerHTML = "";
    elHandName.textContent = "";
    if (!state || state.status !== "playing") return;
    if (state.players[viewer()].finished) { // you're out, but others play on for the lower places
      const place = (state.places.indexOf(viewer()) + 1) || 1;
      elHandName.style.color = "#ffe14d";
      elHandName.textContent = `You're out — ${["", "1st", "2nd", "3rd", "4th"][place] || place + "th"}. Watching for the final places…`;
      return;
    }
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
    const interrupt = !act && canInterrupt(); // a bot's turn, but you could slip a 7 in
    // answer-in-kind cue: you hold the SAME rank as the play in front of you.
    // Playing it punishes the previous player (2nd → they draw 1, 3rd → draw 2)
    // or completes the four — red and propped up so new players spot the move.
    const slapRank = slapOpportunities(state).some((o) => o.by === viewer()) ? state.topRank : null;
    const counterRank = slapRank != null ? slapRank
      : !act ? null
      : state.demand.type === "pickup" ? state.demand.rank
      : (state.pile.length && state.lastPlacer != null && state.lastPlacer !== viewer()) ? state.topRank
      : null;
    const counterMine = counterRank != null ? active.filter((x) => x.rank === counterRank).length : 0; // 2+ = you can stack a pair / finish the four: fire
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
      const is7Int = interrupt && c.rank === 7; // tap to switch in, out of turn
      const isFresh = newCardIds.has(c.id); // just drawn / picked up
      const isCounter = counterRank != null && c.rank === counterRank; // same rank as their play: punish back / complete the 4
      const isSwitch = (c.rank === 7 || c.rank === 14) && isLegal && !isCounter; // a special card with a switch power
      if (isSel) e.classList.add("sel");
      // for a selected pair, mark the card that will land on top (last in order)
      if (isSel && selection.length === 2 && c.id === selection[selection.length - 1]) e.classList.add("sel-top");
      if (isLegal && !isSwitch) e.classList.add("legal"); // switch cards get the violet edge instead of the blue legal ring
      if (isSwitch) e.classList.add("switchcard");
      if (isSel && selection.length === 1 && switchMode && (c.rank === 7 || c.rank === 14)) e.classList.add("switching"); // armed: will use its switch power
      if (isCounter) { e.classList.add("counter"); if (counterMine >= 2) e.classList.add("fire"); }
      if (is7Int) e.classList.add("interrupt"); // a quiet, tappable out-of-turn 7 (not loud)
      if (isFresh) e.classList.add("fresh"); // "NEW" badge so it's obvious what just arrived
      if (!isSel && !isLegal && !is7Int && !isCounter) e.classList.add("dim"); // unplayable cards dim even if new — the NEW badge still shows, but no false highlight
      if (justRevealed) e.classList.add("flip-in");
      e.style.touchAction = "none"; // let us handle the upward-throw gesture
      bindCardGestures(e, c.id);
      elHand.appendChild(e);
    });
    // the combo you're building rides in the SAME spread, split off to the right —
    // like splitting cards in your grip. Tap one to take it back into the fan.
    const reserved = reservedSet();
    state.players[viewer()].hand.filter((c) => reserved.has(c.id))
      .sort((a, b) => a.rank - b.rank).forEach((c, k) => {
        const e = cardEl(c);
        e.classList.add("reserved");
        if (k === 0) e.classList.add("combo-start");
        if (justRevealed) e.classList.add("flip-in");
        e.style.touchAction = "none";
        bindCardGestures(e, c.id);
        elHand.appendChild(e);
      });
    fitHand();
    if (selection.length === 2) layoutSelectedPair();
    reflowHand(prevRects, prevReserved);
  }

  // a selected pair: lift both and square them up into a tight stack — one card
  // just barely on top of the other, the chosen "top" card in front.
  function layoutSelectedPair() {
    const els = [...elHand.querySelectorAll(".acard.sel, .acard.sel-top")];
    if (els.length !== 2) return;
    const z = currentZoom() || 1;
    const dx = (els[1].getBoundingClientRect().left - els[0].getBoundingClientRect().left) / z;
    const offset = Math.max(8, Math.round(CW * 0.25)); // close together: the back card peeks out just enough to read it
    els.forEach((el, i) => {
      const front = el.classList.contains("sel-top");
      el.style.setProperty("--px", `${i === 0 ? 0 : offset - dx}px`); // pull the right card onto the left
      el.style.setProperty("--py", "-20px");
      el.style.transition = "transform .15s ease, box-shadow .15s ease";
      el.style.transform = "translate(var(--px), var(--py))";
      el.style.zIndex = front ? "23" : "22";
    });
  }

  // swap which of the two selected cards is on top — just restack in place (no
  // flip, no jump): they stay tight together, only the front/ring changes
  function flipPairTop(frontId) {
    const els = [...elHand.querySelectorAll(".acard.sel, .acard.sel-top")];
    if (els.length !== 2) { render(); return; }
    // keep both cards exactly where layoutSelectedPair put them — only the front
    // card changes (z-order + ring), so the tight pair never splits apart
    els.forEach((el) => {
      const front = el.dataset.id === frontId;
      el.classList.toggle("sel-top", front);
      el.style.transition = "transform .15s ease, box-shadow .15s ease";
      el.style.zIndex = front ? "23" : "22";
    });
    renderActions();
  }

  // FLIP: when the hand's set of cards changes (draw / pickup / play), slide the
  // surviving cards to their new spots and flip new arrivals in — so the hand
  // visibly opens to make room and the change is impossible to miss.
  function reflowHand(prevRects, prevReserved) {
    const els = [...elHand.children].filter((el) => el.dataset && el.dataset.id);
    if (!els.length) return;
    const prevIds = new Set(prevRects.keys());
    let changed = els.length !== prevIds.size;
    if (!changed) for (const el of els) if (!prevIds.has(el.dataset.id)) { changed = true; break; }
    // a card moving into / out of the combo split also reflows (same ids, new spots)
    if (!changed && prevReserved) for (const el of els) if (prevReserved.has(el.dataset.id) !== el.classList.contains("reserved")) { changed = true; break; }
    if (!changed) return; // a selection-only re-render: leave the cards alone
    const z = currentZoom() || 1;
    els.forEach((el) => {
      if (el.classList.contains("sel") || el.classList.contains("sel-top")) return; // a lifted pair is transform-managed; don't fight it
      const prev = prevRects.get(el.dataset.id);
      if (!prev) { el.classList.add("flip-in"); return; } // a freshly arrived card flips in
      const now = el.getBoundingClientRect();
      const dx = (prev.left - now.left) / z, dy = (prev.top - now.top) / z;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "transform .46s ease";
        el.style.transform = "";
      }));
    });
  }

  // overlap the hand so every card fits on screen without horizontal scrolling.
  // The combo group keeps a visible split before it (SPLIT px) even when squeezed.
  // Cards sit in a gentle held-fan arc — tilted around the middle, edges dipping —
  // via the separate `rotate`/`top` channels so lifts and drags compose freely.
  function fitHand() {
    const SPLIT = 18;
    const cards = [...elHand.children];
    cards.forEach((el) => (el.style.marginLeft = ""));
    if (!cards.length) return;
    const mid = (cards.length - 1) / 2;
    cards.forEach((el, i) => {
      const t = mid ? (i - mid) / mid : 0; // -1..1 across the spread
      el.style.position = "relative";
      el.style.rotate = (t * 5).toFixed(2) + "deg";
      el.style.top = (t * t * 7).toFixed(1) + "px";
    });
    if (cards.length < 2) return;
    const splitIdx = cards.findIndex((el) => el.classList.contains("combo-start"));
    const splitW = splitIdx > 0 ? SPLIT : 0; // no split when the combo IS the whole hand
    const cw = cards[0].offsetWidth || 46;
    const containerW = elHand.clientWidth;
    if (!containerW) return;
    const gap = 4;
    const natural = cards.length * cw + (cards.length - 1) * gap + splitW;
    // a held hand always tucks its cards together like a real fan (each shows ~60%);
    // squeeze tighter only if the natural fan still wouldn't fit the width
    const minOverlap = Math.round(cw * 0.4);
    const fitOverlap = natural > containerW ? (natural - containerW) / (cards.length - 1) + 0.5 : 0;
    const overlap = Math.max(minOverlap, fitOverlap);
    cards.forEach((el, i) => { if (i) el.style.marginLeft = (splitW && i === splitIdx ? SPLIT - overlap : -overlap) + "px"; });
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
    // combo building + completing works in or out of turn: setting cards aside is
    // just sorting your grip, a straight dump is a free shed, a quad clears the
    // table — the engine validates the dump either way.
    {
      const reserved = reservedSet();
      if (reserved.size) {
        const combo = hand.filter((c) => reserved.has(c.id));
        const ranks = combo.map((c) => c.rank);
        const isQuad = combo.length === 4 && ranks.every((r) => r === ranks[0]);
        const isRun = combo.length >= 5 && findStraights(combo).some((run) => run.length === combo.length);
        if (isQuad || isRun)
          add(`Dump combo (${combo.length})`, () => apply({ type: "DUMP", by: viewer(), cards: combo.map((c) => c.id) }), "slap combo-dump");
      } else {
        const straights = findStraights(activeAndLegal().active);
        if (straights.length) {
          const longest = straights.reduce((a, b) => (b.length > a.length ? b : a));
          const g = new Map(); activeAndLegal().active.forEach((c) => { if (!g.has(c.rank)) g.set(c.rank, c); });
          const ids = longest.map((r) => g.get(r).id);
          add("Set aside straight", () => { ids.forEach((id) => reservedSet().add(id)); selection = []; render(); }, "");
        }
      }
    }
    if (!canAct()) {
      if (!elActions.children.length) elActions.innerHTML = `<span class="anarchy-wait">${state.players[state.turn].name} is playing…</span>`;
      return;
    }

    // facing a pickup — card-driven, no buttons: tap the pulsing draw deck to take
    // it, or play a highlighted card (a 7/Ace switches it away, a matching rank
    // stacks it on). The hand already lights up exactly those cards.
    if (state.demand.type === "pickup") {
      const canFight = hand.some((c) => c.rank === 7 || c.rank === 14 || c.rank === state.demand.rank);
      const hint = document.createElement("span");
      hint.className = "anarchy-wait";
      hint.textContent = canFight
        ? `Tap the deck to pick up ${state.demand.count} — or play a highlighted card to fight back.`
        : `Tap the deck to pick up ${state.demand.count}.`;
      elActions.appendChild(hint);
      return;
    }

    const sa = selectionAction();
    if (sa) add(sa.label, () => apply(sa.action), "primary");

    const sel = selection.map((id) => hand.find((c) => c.id === id));
    // the "take below" toggle only matters when the Ace acts as a SWITCH (armed),
    // not when it stacks as a regular card, and not under a pickup (cancel always takes)
    if (sel.length === 1 && sel[0] && sel[0].rank === 14 && switchMode && state.demand.type !== "pickup" && state.pile.length)
      add(aceTake ? "☑ take below" : "☐ take below", () => { aceTake = !aceTake; render(); }, "toggle");

    const { active } = activeAndLegal();
    // four-of-a-kind: throw it from hand — clears the table, everyone else owes a card, you lead
    {
      const counts = new Map();
      active.forEach((c) => counts.set(c.rank, (counts.get(c.rank) || 0) + 1));
      for (const [r, n] of counts) if (n === 4) {
        const ids = active.filter((c) => c.rank === r).map((c) => c.id);
        add(`Dump four ${rankLabel(r)}s`, () => { selection = []; apply({ type: "DUMP", cards: ids }); }, "slap");
        break;
      }
    }
    // draw-and-pass is always an option on the draw deck (labelled there). A real
    // Pass button only appears once the stock is empty — nothing left to draw.
    if (state.demand.type === "color" && state.stock.length === 0 && activeAndLegal().legal.some((m) => m.type === "PASS"))
      add("Pass (clear table)", () => apply({ type: "PASS" }), "");
  }

  // ---- new game ----
  function newGame(m, numPlayers, customNames) {
    clearTimeout(botTimer); stopFireworks(); stopWinCascade(); newCardIds.clear(); setupOpen = false;
    mode = m; lastMode = m; lastNum = numPlayers; lastNames = customNames || null;
    const names = customNames || (m === "cpu"
      ? ["You", "CPU 1", "CPU 2", "CPU 3"].slice(0, numPlayers)
      : Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`));
    const humanIndices = m === "cpu" ? [0] : names.map((_, i) => i);
    state = createGame({ numPlayers, humanIndices, names });
    selection = []; aceTake = false; switchMode = false; flashMsg = ""; handoffPending = false; reservedByPlayer.clear();
    lastTopId = null; lastPileLen = 0; // don't fire a stray бита on the first render
    lastHandCounts = state.players.map((p) => p.hand.length); // the deal isn't a "draw"
    render();
    scheduleBots();
  }

  function showSetupStart() { elStartView.style.display = "block"; elNamesView.style.display = "none"; }
  function showNames(n) {
    elStartView.style.display = "none"; elNamesView.style.display = "block";
    const fields = $(".anarchy-names-fields");
    fields.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const row = document.createElement("div"); row.className = "anarchy-name-row";
      const sw = document.createElement("span"); sw.className = "anarchy-name-color"; sw.style.background = colorFor(i);
      const inp = document.createElement("input"); inp.className = "anarchy-name-input"; inp.maxLength = 12; inp.value = `Player ${i + 1}`;
      row.appendChild(sw); row.appendChild(inp); fields.appendChild(row);
    }
  }
  // File > New Game… opens the mode screen OVER the running game — the game
  // pauses (bots frozen) and "Back to game" resumes it untouched
  function openSetup() {
    setupOpen = true;
    clearTimeout(botTimer);
    showSetupStart();
    elSetupBack.style.display = state ? "" : "none";
    render();
  }
  function closeSetup() {
    if (!state) return; // nothing to go back to
    setupOpen = false;
    render();
    scheduleBots();
  }

  // the start screen IS the mode choice: tap a mode and you're playing (local
  // multiplayer detours through name entry first)
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    const n = parseInt(b.dataset.players, 10);
    if (b.dataset.mode === "local") showNames(n); else newGame("cpu", n); // local: enter names first
  }));
  $(".anarchy-names-back").addEventListener("click", showSetupStart);
  $(".anarchy-names-start").addEventListener("click", () => {
    const inputs = [...$(".anarchy-names-fields").querySelectorAll("input")];
    const names = inputs.map((inp, i) => (inp.value.trim() || `Player ${i + 1}`).slice(0, 12));
    newGame("local", names.length, names);
  });
  $(".anarchy-handoff-go").addEventListener("click", () => { handoffPending = false; render(); });
  $(".anarchy-setup-back").addEventListener("click", closeSetup);
  // classic Win98 menubar: File / Help drop real menus (same chrome as the OS)
  function bindMenu(btn, items) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const existing = document.querySelector(".menu-dropdown");
      document.querySelectorAll(".menu-dropdown").forEach((n) => n.remove());
      if (existing && existing.dataset.owner === btn.dataset.menu) return; // second click closes
      const rect = btn.getBoundingClientRect();
      const dd = document.createElement("div");
      dd.className = "menu-dropdown";
      dd.dataset.owner = btn.dataset.menu;
      dd.style.left = rect.left + "px";
      dd.style.top = rect.bottom + "px";
      for (const it of items) {
        if (it === "sep") { const s = document.createElement("div"); s.className = "sep"; dd.appendChild(s); continue; }
        const row = document.createElement("div");
        row.className = "item";
        row.textContent = it.label;
        row.addEventListener("click", (ev) => { ev.stopPropagation(); dd.remove(); it.action(); });
        dd.appendChild(row);
      }
      document.body.appendChild(dd);
      const closer = (ev) => { if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener("mousedown", closer); } };
      setTimeout(() => document.addEventListener("mousedown", closer), 0);
    });
  }
  bindMenu($('[data-menu="file"]'), [
    { label: "New Game…", action: openSetup },
    "sep",
    { label: "Exit", action: () => closeWindow(winId) },
  ]);
  bindMenu($('[data-menu="help"]'), [
    { label: "How to Play", action: () => { elHelp.style.display = "flex"; } },
  ]);
  $(".anarchy-help-close").addEventListener("click", () => { elHelp.style.display = "none"; });
  $(".anarchy-win-again").addEventListener("click", () => newGame(lastMode, lastNum, lastNames));

  showSetupStart();
  render(); // open on the Start screen — no auto-start
  const winId = openWindow({ title: "Anarchy", icon: ICONS.anarchy(14), iconHtml: true, content: root, width: 600, height: 660, flush: true });
  window.addEventListener("resize", () => { if (document.body.contains(root)) render(); }); // re-fit on rotate/resize
  return winId;
}
