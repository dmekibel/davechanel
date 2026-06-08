// Run: node js/anarchy/engine.test.js
import {
  createGame, reduce, legalMoves, slapOpportunities, recomputeTop,
  totalCards, freshDeck, findStraights, cardLabel,
} from "./engine.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg} (got ${a}, want ${b})`);
const section = (name) => console.log(`\n# ${name}`);

// build a card object from an id like "14H" / "5C"
const mk = (id) => ({ rank: parseInt(id.slice(0, -1), 10), suit: id.slice(-1), id });
const ids = (cards) => cards.map((c) => c.id);

// Build a full 52-card state from explicit hands/pile/stock; everything else lands in `removed`
// so the conservation invariant (== 52) always holds.
function scenario({ hands, pile = [], stock = [], demand, turn = 0, lastPlacer = null }) {
  const used = new Set();
  const claim = (idList) => idList.forEach((id) => used.add(id));
  const handCards = hands.map((h) => h.map(mk));
  handCards.forEach((h) => claim(ids(h)));
  const pileCards = pile.map(mk); claim(pile);
  const stockCards = stock.map(mk); claim(stock);
  const removed = freshDeck().filter((c) => !used.has(c.id));
  const s = {
    players: handCards.map((h, i) => ({ id: `p${i}`, name: i === 0 ? "P0" : `P${i}`, isHuman: i === 0, hand: h, pendingDraw: 0 })),
    stock: stockCards, pile: pileCards, removed,
    turn, demand: demand || { type: "open" }, topRank: null, topColor: null, topRun: 0,
    lastPlacer, consecutivePasses: 0, status: "playing", winner: null, log: [],
  };
  recomputeTop(s);
  ok(totalCards(s) === 52, `scenario builds a 52-card state (got ${totalCards(s)})`);
  return s;
}

// ---------------------------------------------------------------------------
section("straight detection");
{
  ok(findStraights([mk("2H"), mk("3C"), mk("4D"), mk("5S"), mk("6H")]).length === 1, "low band 2-6 is a straight");
  ok(findStraights([mk("2H"), mk("3C"), mk("4D"), mk("5S")]).length === 0, "2-5 is not a straight");
  // high band 8..12 present -> exactly one 5-run
  ok(findStraights(["8H", "9C", "10D", "11S", "12H"].map(mk)).length === 1, "8-Q is a straight");
  // a straight may never include a 7
  ok(findStraights(["5H", "6C", "7D", "8S", "9H"].map(mk)).length === 0, "no straight crosses the 7");
  // 8..14 all present -> multiple dumpable runs (sub-runs of the 7-long band)
  ok(findStraights(["8H", "9C", "10D", "11S", "12H", "13C", "14D"].map(mk)).length > 1, "8-A yields several straights");
}

// ---------------------------------------------------------------------------
section("T1: fresh pair -> opponent takes pickup of 1");
{
  let s = scenario({ hands: [["5H", "5D", "9S"], ["8C", "8H"]], stock: ["2C", "3C"], turn: 0, demand: { type: "open" } });
  s = reduce(s, { type: "PLAY", cards: ["5H", "5D"] });
  eq(s.demand.type, "pickup", "fresh pair creates a pickup demand");
  eq(s.demand.count, 1, "a pair makes the next player pick up 1");
  eq(s.turn, 1, "turn passes to opponent");
  const before = s.players[1].hand.length;
  s = reduce(s, { type: "TAKE_PICKUP" });
  eq(s.players[1].hand.length, before + 1, "taker draws 1");
  eq(s.demand.type, "color", "after taking, the taker faces the pair's colour demand");
  eq(s.turn, 1, "taking keeps your turn — you draw then play on");
}

// ---------------------------------------------------------------------------
section("T2: pair -> third (pair-player draws 2) -> slap fourth -> combo clears");
{
  let s = scenario({ hands: [["9H", "9D", "9S", "13H"], ["9C", "8H"]], stock: ["2C", "3C", "4C", "5C"], turn: 0 });
  s = reduce(s, { type: "PLAY", cards: ["9H", "9D"] });           // fresh pair, pickup on P1
  const p0before = s.players[0].hand.length;
  s = reduce(s, { type: "PLAY", cards: ["9C"] });                 // P1 stacks the third
  eq(s.topRun, 3, "three of a kind on the table");
  eq(s.players[0].pendingDraw, 2, "pair-player OWES 2 (run-1) — not auto-drawn");
  eq(s.players[0].hand.length, p0before, "hand unchanged until they tap the deck");
  const opps = slapOpportunities(s);
  ok(opps.some((o) => o.by === 0), "P0 can slap the fourth 9S");
  s = reduce(s, { type: "SLAP", by: 0, card: "9S" });
  eq(s.pile.length, 0, "combo clears the table");
  eq(s.demand.type, "open", "completer leads with an open demand");
  eq(s.turn, 0, "slapper becomes the leader");
}

// ---------------------------------------------------------------------------
section("T3: matching punishes the previous placer backward");
{
  // single matched by a single -> previous OWES 1, cleared by tapping the deck
  let s = scenario({ hands: [["5H", "13D"], ["5C", "12S"]], stock: ["2C", "3C", "4C"], turn: 0 });
  s = reduce(s, { type: "PLAY", cards: ["5H"] });
  const p0 = s.players[0].hand.length;
  s = reduce(s, { type: "PLAY", cards: ["5C"] });
  eq(s.players[0].pendingDraw, 1, "single matched by single: previous OWES 1");
  eq(s.players[0].hand.length, p0, "no auto-draw — hand unchanged");
  eq(legalMoves(s)[0].type, "DRAW_PENDING", "owing forces a deck-tap before anything else");
  s = reduce(s, { type: "DRAW_PENDING" });
  eq(s.players[0].hand.length, p0 + 1, "tapping the deck draws the owed card");
  eq(s.players[0].pendingDraw, 0, "debt cleared");

  // single matched by a pair -> previous OWES 2
  let t = scenario({ hands: [["6H", "13D"], ["6C", "6S", "13H"]], stock: ["2C", "3C", "4C"], turn: 0 });
  t = reduce(t, { type: "PLAY", cards: ["6H"] });
  const tp0 = t.players[0].hand.length;
  t = reduce(t, { type: "PLAY", cards: ["6C", "6S"] });
  eq(t.topRun, 3, "pair onto a single makes a triple");
  eq(t.players[0].pendingDraw, 2, "single matched by pair: previous OWES 2");
  eq(t.players[0].hand.length, tp0, "no auto-draw");
}

// ---------------------------------------------------------------------------
section("T4: out-of-turn 7 keeps turn order and clears a pending pickup");
{
  // 3 players. P0 plays a fresh pair -> pickup on P1. P2 interjects a 7 out of turn.
  let s = scenario({ hands: [["4H", "4D", "13H"], ["8C", "9C"], ["7S", "12H"]], stock: ["2C", "3C"], turn: 0 });
  s = reduce(s, { type: "PLAY", cards: ["4H", "4D"] });
  eq(s.demand.type, "pickup", "pickup pending on P1");
  eq(s.turn, 1, "P1 is to play");
  const p2before = s.players[2].hand.length;
  s = reduce(s, { type: "SWITCH7", by: 2, card: "7S" });
  eq(s.turn, 1, "out-of-turn 7 does not change whose turn it is");
  eq(s.demand.type, "color", "pickup is cleared; P1 now faces a color demand");
  eq(s.players[2].hand.length, p2before, "7 nets zero: played one, took the card below");
}

// ---------------------------------------------------------------------------
section("T5: straight dump removes cards, leaves top/turn/demand untouched");
{
  let s = scenario({ hands: [["13H", "12S"], ["8C", "9C", "10D", "11S", "12H", "3C"]], pile: ["13D"], stock: ["2C"], turn: 0, lastPlacer: 0, demand: { type: "color", dir: "up", rank: 13 } });
  const topId = s.pile[s.pile.length - 1].id;
  const before = s.players[1].hand.length;
  s = reduce(s, { type: "DUMP", by: 1, cards: ["8C", "9C", "10D", "11S", "12H"] });
  eq(s.players[1].hand.length, before - 5, "five cards leave the dumper's hand");
  eq(s.pile[s.pile.length - 1].id, topId, "top card unchanged");
  eq(s.turn, 0, "turn unchanged");
  eq(s.demand.rank, 13, "demand unchanged");
}

// ---------------------------------------------------------------------------
section("T6: empty stock -> pairs, matches, and passes cause no draws");
{
  let s = scenario({ hands: [["5H", "5D", "9S"], ["8C", "13H"]], stock: [], turn: 0 });
  s = reduce(s, { type: "PLAY", cards: ["5H", "5D"] });           // fresh pair
  const before = s.players[1].hand.length;
  s = reduce(s, { type: "TAKE_PICKUP" });
  eq(s.players[1].hand.length, before, "no draw when the stock is empty");
}

// ---------------------------------------------------------------------------
section("T7: going out on a pair wins, despite the pickup a pair would force");
{
  let s = scenario({ hands: [["6H", "6D"], ["8C", "13H"]], stock: ["2C", "3C"], turn: 0 });
  s = reduce(s, { type: "PLAY", cards: ["6H", "6D"] });
  eq(s.status, "finished", "game ends");
  eq(s.winner, 0, "P0 wins by emptying their hand");
  ok(s.demand.type !== "pickup", "no pickup side effect fires after going out");
}

section("T8: 7s can never be played as a pair");
{
  let s = scenario({ hands: [["7H", "7D", "9S"], ["8C", "13H"]], stock: ["2C", "3C"], turn: 0, demand: { type: "open" } });
  const pairs = legalMoves(s).filter((m) => m.type === "PLAY" && m.cards.length === 2);
  eq(pairs.length, 0, "legalMoves offers no 7-pair even when holding two 7s");
  let threw = false;
  try { reduce(s, { type: "PLAY", cards: ["7H", "7D"] }); } catch (_) { threw = true; }
  ok(threw, "reduce rejects a forced 7-pair PLAY");
}

section("T9: an Ace on a black low card must switch (take the card below)");
{
  // top is a black 2 → demand is colour/down/2. An Ace can't go "down" onto a 2,
  // so playing it is a switch: the player must scoop the 2 into their hand.
  let s = scenario({ hands: [["14H", "9S"], ["8C", "13H"]], pile: ["2C"], stock: ["3C", "4C"], turn: 0, lastPlacer: 1, demand: { type: "color", dir: "down", rank: 2 } });
  const before = s.players[0].hand.length;
  s = reduce(s, { type: "ACE_SWITCH", card: "14H", take: false }); // take:false, but it must be forced
  ok(s.players[0].hand.some((c) => c.id === "2C"), "P0 scooped the black 2 into hand");
  eq(s.players[0].hand.length, before, "net hand size unchanged (played Ace, took the 2)");
  eq(s.pile[s.pile.length - 1].id, "14H", "the Ace is now on top");
}

// ---------------------------------------------------------------------------
section("fuzz: random self-play stays conserved and terminates");
{
  let worstFail = null;
  for (let game = 0; game < 300; game++) {
    let s = createGame({ numPlayers: 2 + (game % 3), seed: game * 7 + 1 });
    let moves = 0;
    while (s.status === "playing" && moves < 4000) {
      // occasionally take an out-of-turn slap to exercise that path
      const slaps = slapOpportunities(s);
      let action;
      if (slaps.length && (game + moves) % 5 === 0) action = { type: "SLAP", by: slaps[0].by, card: slaps[0].card };
      else {
        const opts = legalMoves(s);
        if (!opts.length) { action = { type: "PASS" }; }
        else action = opts[(game * 31 + moves * 17) % opts.length];
      }
      try { s = reduce(s, action); } catch (e) { worstFail = `game ${game} move ${moves}: ${e.message}`; break; }
      if (totalCards(s) !== 52) { worstFail = `game ${game}: conservation ${totalCards(s)}`; break; }
      moves++;
    }
    if (worstFail) break;
    ok(s.status === "finished" || moves >= 4000, `game ${game} progressed (${moves} moves, ${s.status})`);
    if (s.status !== "finished") { worstFail = `game ${game} did not finish in ${moves} moves`; break; }
  }
  ok(!worstFail, `fuzz clean${worstFail ? ": " + worstFail : ""}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
