// Anarchy — pure game-state reducer. No UI imports; safe to run in Node or the browser.
// Rules: see the full spec. Card: { rank: 2..14, suit:'H'|'D'|'C'|'S', id }.
// Rank 11=J, 12=Q, 13=K, 14=A. Color: H/D red, C/S black.

export const SUITS = ["H", "D", "C", "S"];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const STOCK_BY_PLAYERS = { 2: 34, 3: 25, 4: 16 };

export const colorOf = (suit) => (suit === "H" || suit === "D" ? "red" : "black");
export const isRed = (card) => colorOf(card.suit) === "red";
const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankLabel = (r) => RANK_LABEL[r] || String(r);
export const cardLabel = (c) => `${rankLabel(c.rank)}${c.suit}`;

// ---- deterministic RNG (mulberry32) so tests are reproducible ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s, id: `${r}${s}` });
  return deck;
}

function shuffle(deck, rng) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame({ numPlayers = 2, names, humanIndices = [0], seed } = {}) {
  if (numPlayers < 2 || numPlayers > 4) throw new Error("numPlayers must be 2..4");
  const rng = mulberry32(seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed);
  const deck = shuffle(freshDeck(), rng);
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: `p${i}`,
      name: (names && names[i]) || (i === 0 ? "You" : `CPU ${i}`),
      isHuman: humanIndices.includes(i),
      hand: deck.splice(0, 9),
    });
  }
  const state = {
    players,
    stock: deck, // remainder is the face-down stock
    pile: [],
    removed: [],
    turn: 0,
    demand: { type: "open" },
    topRank: null,
    topColor: null,
    topRun: 0,
    lastPlacer: null,
    lastPlayCount: 0,
    consecutivePasses: 0,
    status: "playing",
    winner: null,
    log: [`New game: ${numPlayers} players, stock ${deck.length}.`],
  };
  return state;
}

// ---- derived top-of-pile state ----
export function recomputeTop(s) {
  if (s.pile.length === 0) { s.topRank = null; s.topColor = null; s.topRun = 0; return; }
  const top = s.pile[s.pile.length - 1];
  s.topRank = top.rank;
  s.topColor = colorOf(top.suit);
  let run = 0;
  for (let i = s.pile.length - 1; i >= 0 && s.pile[i].rank === top.rank; i--) run++;
  s.topRun = run;
}

const nextIdx = (s, i) => (i + 1) % s.players.length;
const demandFromTop = (s) => ({ type: "color", dir: s.topColor === "red" ? "up" : "down", rank: s.topRank });

function satisfiesDir(rank, demand) {
  if (demand.type !== "color") return true;
  return demand.dir === "up" ? rank >= demand.rank : rank <= demand.rank;
}

// draw up to `amount`; if stock is empty nobody draws (spec section 12)
function draw(s, playerIdx, amount) {
  let drawn = 0;
  for (let k = 0; k < amount && s.stock.length > 0; k++) {
    s.players[playerIdx].hand.push(s.stock.shift());
    drawn++;
  }
  return drawn;
}

function takeFromHand(player, id) {
  const i = player.hand.findIndex((c) => c.id === id);
  if (i === -1) throw new Error(`card ${id} not in ${player.name}'s hand`);
  return player.hand.splice(i, 1)[0];
}

// ---- straights (section 11) ----
export function findStraights(hand) {
  const present = new Set(hand.map((c) => c.rank));
  const out = [];
  if ([2, 3, 4, 5, 6].every((r) => present.has(r))) out.push([2, 3, 4, 5, 6]);
  // high band 8..14: every maximal consecutive run of length >= 5 yields all its >=5 sub-runs
  let run = [];
  const flush = () => {
    if (run.length >= 5) {
      for (let len = 5; len <= run.length; len++)
        for (let start = 0; start + len <= run.length; start++)
          out.push(run.slice(start, start + len));
    }
    run = [];
  };
  for (let r = 8; r <= 14; r++) { if (present.has(r)) run.push(r); else flush(); }
  flush();
  return out;
}
export const hasStraight = (hand) => findStraights(hand).length > 0;

function validateStraightRanks(ranks) {
  if (ranks.length < 5) return false;
  const sorted = [...new Set(ranks)].sort((a, b) => a - b);
  if (sorted.length !== ranks.length) return false; // distinct ranks only
  for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
  if (sorted.includes(7)) return false;
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  return hi <= 6 || lo >= 8; // single band, never crosses the 7
}

// ---- conservation invariant (key test assertion) ----
export function totalCards(s) {
  return s.players.reduce((n, p) => n + p.hand.length, 0) + s.stock.length + s.pile.length + s.removed.length;
}

// ---- terminal transitions ----
function win(s, idx) {
  s.status = "finished";
  s.winner = idx;
  s.log.push(`${s.players[idx].name} goes out and wins.`);
  return s;
}
function stalemateEnd(s) {
  let best = 0;
  for (let i = 1; i < s.players.length; i++)
    if (s.players[i].hand.length < s.players[best].hand.length) best = i;
  s.status = "finished";
  s.winner = best;
  s.log.push(`Stalemate. Fewest cards: ${s.players[best].name} wins.`);
  return s;
}

// four-of-a-kind combo (sections 7, 8)
function combo(s, completer) {
  for (let i = 1; i < s.players.length; i++) draw(s, (completer + i) % s.players.length, 1);
  s.removed.push(...s.pile);
  s.pile = [];
  recomputeTop(s);
  s.demand = { type: "open" };
  s.turn = completer;
  s.lastPlacer = completer;
  s.lastPlayCount = 0;
  s.consecutivePasses = 0;
  s.log.push(`Four of a kind! ${s.players[completer].name} clears the table and leads.`);
  return s;
}

// ---- action handlers (each mutates the working copy `s`) ----

function actPLAY(s, action) {
  const idx = s.turn;
  const p = s.players[idx];
  const ids = action.cards || [];
  if (ids.length < 1 || ids.length > 2) throw new Error("PLAY takes 1 or 2 cards");
  const cards = ids.map((id) => p.hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) throw new Error("PLAY: card not in hand");
  const R = cards[0].rank;
  if (cards.some((c) => c.rank !== R)) throw new Error("PLAY: cards must share a rank");
  if (R === 7 && ids.length === 2) throw new Error("PLAY: 7s go one at a time, never as a pair");
  const d = s.demand;
  const prevTopRank = s.topRank;
  const prevLastPlacer = s.lastPlacer;

  // validate against the current demand
  if (d.type === "open") {
    // any single or pair is legal
  } else if (d.type === "color") {
    if (R !== prevTopRank && !satisfiesDir(R, d)) throw new Error("PLAY: violates color demand");
  } else if (d.type === "pickup") {
    if (R !== d.rank) throw new Error("PLAY under pickup must stack the same rank (or take/switch)");
  }

  for (const id of ids) s.pile.push(takeFromHand(p, id));
  recomputeTop(s);
  s.lastPlayCount = ids.length; // how many cards landed together (pair vs matched single)
  s.consecutivePasses = 0;
  s.log.push(`${p.name} plays ${cards.map(cardLabel).join(" ")}.`);

  // (15.1) going out locks in before any side effect
  if (p.hand.length === 0) return win(s, idx);
  // (15.2) reaching four overrides forward/backward punishment
  if (s.topRun >= 4) return combo(s, idx);

  const matched = d.type === "pickup" || (d.type !== "open" && R === prevTopRank);
  if (matched) {
    // backward punish: the previous placer draws (runLength - 1)
    if (prevLastPlacer != null) {
      const n = draw(s, prevLastPlacer, s.topRun - 1);
      if (n) s.log.push(`${s.players[prevLastPlacer].name} draws ${n} (matched).`);
    }
    s.lastPlacer = idx;
    s.turn = nextIdx(s, idx);
    s.demand = demandFromTop(s);
  } else if (ids.length === 2) {
    // fresh pair -> the next player picks up 1
    s.lastPlacer = idx;
    s.turn = nextIdx(s, idx);
    s.demand = { type: "pickup", rank: R, count: 1 };
  } else {
    // fresh single -> color demand
    s.lastPlacer = idx;
    s.turn = nextIdx(s, idx);
    s.demand = demandFromTop(s);
  }
  return s;
}

function actSWITCH7(s, action) {
  const by = action.by == null ? s.turn : action.by;
  const player = s.players[by];
  const card = player.hand.find((c) => c.id === action.card);
  if (!card || card.rank !== 7) throw new Error("SWITCH7 requires a 7 in hand");
  const inTurn = by === s.turn;
  takeFromHand(player, action.card);
  // take exactly the one card directly below (the previous top), if any (16.8)
  if (s.pile.length > 0) player.hand.push(s.pile.pop());
  s.pile.push(card);
  recomputeTop(s);
  s.lastPlayCount = 1;
  s.consecutivePasses = 0;
  s.log.push(`${player.name} plays 7${card.suit}${inTurn ? "" : " (out of turn)"} and takes the card below.`);
  if (player.hand.length === 0) return win(s, by);
  s.demand = demandFromTop(s); // 7's own color sets the next demand; clears any pickup
  if (inTurn) s.turn = nextIdx(s, by); // out of turn: turn order is unchanged
  return s;
}

function actAce(s, action, cancel) {
  if (action.by != null && action.by !== s.turn) throw new Error("Ace may only be used on your turn");
  const idx = s.turn;
  const p = s.players[idx];
  const card = p.hand.find((c) => c.id === action.card);
  if (!card || card.rank !== 14) throw new Error("Ace action requires an Ace in hand");
  const d = s.demand;
  if (cancel) {
    if (d.type !== "pickup") throw new Error("ACE_CANCEL only answers a pickup demand");
  } else {
    if (d.type === "pickup") throw new Error("use ACE_CANCEL to answer a pickup");
    // an Ace can be played in response to anything (it acts as a switch), like the 7
  }
  takeFromHand(p, action.card);
  if (action.take && s.pile.length > 0) p.hand.push(s.pile.pop()); // optional take-below
  s.pile.push(card);
  recomputeTop(s);
  s.lastPlayCount = 1;
  s.consecutivePasses = 0;
  s.log.push(`${p.name} plays A${card.suit}${cancel ? " (cancels pickup)" : ""}${action.take ? " and takes below" : ""}.`);
  if (p.hand.length === 0) return win(s, idx);
  s.lastPlacer = idx;
  s.demand = demandFromTop(s);
  s.turn = nextIdx(s, idx);
  return s;
}

function actTAKE_PICKUP(s) {
  if (s.demand.type !== "pickup") throw new Error("no pickup to take");
  const idx = s.turn;
  const n = draw(s, idx, s.demand.count);
  s.consecutivePasses = 0;
  // taking the penalty does NOT end your turn — you keep playing, now answering
  // the pair's own colour demand
  s.demand = demandFromTop(s);
  s.log.push(`${s.players[idx].name} takes the pickup (${n}) and plays on.`);
  return s;
}

function actSLAP(s, action) {
  const by = action.by == null ? s.turn : action.by;
  if (s.topRun !== 3) throw new Error("SLAP requires exactly three of a kind showing");
  const player = s.players[by];
  const card = player.hand.find((c) => c.id === action.card);
  if (!card || card.rank !== s.topRank) throw new Error("SLAP requires the fourth card of that rank");
  takeFromHand(player, action.card);
  s.pile.push(card);
  recomputeTop(s);
  s.consecutivePasses = 0;
  s.log.push(`${player.name} slaps the fourth ${rankLabel(card.rank)}!`);
  if (player.hand.length === 0) return win(s, by); // (15.1)
  return combo(s, by); // slapper becomes leader (section 8)
}

function actDUMP(s, action) {
  const by = action.by == null ? s.turn : action.by;
  const player = s.players[by];
  const ids = action.cards || [];
  const cards = ids.map((id) => player.hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) throw new Error("DUMP: card not in hand");
  if (!validateStraightRanks(cards.map((c) => c.rank))) throw new Error("DUMP: not a valid straight");
  for (const id of ids) s.removed.push(takeFromHand(player, id));
  s.consecutivePasses = 0;
  s.log.push(`${player.name} dumps a straight (${cards.map(cardLabel).join(" ")}).`);
  if (player.hand.length === 0) return win(s, by);
  return s; // top, demand, and turn are unchanged
}

function actPASS(s) {
  if (s.demand.type === "pickup") throw new Error("cannot PASS a pickup; take it or switch");
  const idx = s.turn;
  const drew = draw(s, idx, 1); // you take a card from the stock for passing
  // passing "beats" the table (бита): the play pile is swept away and the next
  // player leads from scratch on an open table
  s.removed.push(...s.pile);
  s.pile = [];
  recomputeTop(s);
  s.demand = { type: "open" };
  s.lastPlacer = null;
  s.lastPlayCount = 0;
  s.turn = nextIdx(s, idx);
  s.consecutivePasses = 0;
  s.log.push(`${s.players[idx].name} passes${drew ? " (draws 1)" : ""} — table cleared; ${s.players[s.turn].name} leads.`);
  return s;
}

const HANDLERS = {
  PLAY: actPLAY,
  SWITCH7: actSWITCH7,
  ACE_SWITCH: (s, a) => actAce(s, a, false),
  ACE_CANCEL: (s, a) => actAce(s, a, true),
  TAKE_PICKUP: actTAKE_PICKUP,
  SLAP: actSLAP,
  DUMP: actDUMP,
  PASS: actPASS,
};

// Pure entry point: returns a new state, never mutates the input.
export function reduce(state, action) {
  if (state.status !== "playing") return state;
  const s = structuredClone(state);
  const h = HANDLERS[action.type];
  if (!h) throw new Error(`unknown action ${action.type}`);
  const out = h(s, action);
  if (totalCards(out) !== 52) throw new Error(`card conservation broken after ${action.type}: ${totalCards(out)}`);
  return out;
}

// ---- move generation (UI highlights + bot) ----

const byRank = (hand) => {
  const m = new Map();
  for (const c of hand) {
    if (!m.has(c.rank)) m.set(c.rank, []);
    m.get(c.rank).push(c);
  }
  return m;
};

// Legal actions for the player whose turn it is.
export function legalMoves(state) {
  if (state.status !== "playing") return [];
  const s = state;
  const p = s.players[s.turn];
  const hand = p.hand;
  const groups = byRank(hand);
  const moves = [];
  const d = s.demand;

  if (d.type === "pickup") {
    moves.push({ type: "TAKE_PICKUP" });
    for (const c of hand) if (c.rank === 7) moves.push({ type: "SWITCH7", card: c.id });
    for (const c of hand) if (c.rank === 14) moves.push({ type: "ACE_CANCEL", card: c.id, take: false });
    const same = groups.get(d.rank) || [];
    if (same.length >= 1) moves.push({ type: "PLAY", cards: [same[0].id] }); // stack the third
    if (same.length >= 2) moves.push({ type: "PLAY", cards: [same[0].id, same[1].id] }); // third + fourth -> combo
  } else {
    const open = d.type === "open";
    for (const [r, cs] of groups) {
      const playable = open || r === s.topRank || satisfiesDir(r, d);
      if (playable) {
        moves.push({ type: "PLAY", cards: [cs[0].id] });
        if (cs.length >= 2 && r !== 7) moves.push({ type: "PLAY", cards: [cs[0].id, cs[1].id] }); // 7s go one at a time — never a pair
      }
    }
    for (const c of hand) if (c.rank === 7) moves.push({ type: "SWITCH7", card: c.id });
    for (const c of hand) if (c.rank === 14) // an Ace is always playable (switch/high card)
      moves.push({ type: "ACE_SWITCH", card: c.id, take: false });
  }
  // straights are legal any time
  for (const run of findStraights(hand)) {
    const ids = run.map((r) => groups.get(r)[0].id);
    moves.push({ type: "DUMP", cards: ids });
  }
  // can't satisfy a color demand -> pass
  if (d.type === "color" && !moves.some((m) => m.type === "PLAY" || m.type === "SWITCH7" || m.type === "ACE_SWITCH"))
    moves.push({ type: "PASS" });
  return moves;
}

// Players who could slap the fourth card right now (in or out of turn).
export function slapOpportunities(state) {
  if (state.status !== "playing" || state.topRun !== 3) return [];
  return state.players
    .map((p, i) => ({ i, card: p.hand.find((c) => c.rank === state.topRank) }))
    .filter((o) => o.card)
    .map((o) => ({ by: o.i, card: o.card.id }));
}
