// Anarchy baseline AI. Pure: chooseAction(state) returns a move for state.turn.
// Strategy (from the spec's suggested baseline): dump straights for free, prefer a
// fresh pair to force a pickup, otherwise play the most restrictive legal single,
// escape with a 7 when stuck, and just take a single-card pickup rather than burn a switch.
import { legalMoves } from "./engine.js?v=157";

// How much a single card constrains the next player once it's on top.
// Low black (forces "equal or lower" from a low rank) and high red (forces
// "equal or higher" from a high rank) are the tightest squeezes.
function squeeze(card) {
  const black = card.suit === "C" || card.suit === "S";
  return black ? 16 - card.rank : card.rank; // black: lower is better; red: higher is better
}

export function chooseAction(state) {
  const moves = legalMoves(state);
  if (!moves.length) return { type: "PASS" };
  const d = state.demand;
  const hand = state.players[state.turn].hand;
  const cardOf = (id) => hand.find((c) => c.id === id);

  // 1) shed a straight for free whenever we're not mid-pickup
  if (d.type !== "pickup") {
    const dump = moves.find((m) => m.type === "DUMP");
    if (dump) return dump;
  }

  if (d.type === "pickup") {
    // complete four if we hold the pair (clears the table); else just take the 1
    const combo = moves.find((m) => m.type === "PLAY" && m.cards.length === 2);
    if (combo) return combo;
    return { type: "TAKE_PICKUP" };
  }

  const plays = moves.filter((m) => m.type === "PLAY");
  // 2) prefer a fresh pair (forces the next player to pick up)
  const freshPairs = plays.filter(
    (m) => m.cards.length === 2 && (d.type === "open" || cardOf(m.cards[0]).rank !== state.topRank)
  );
  if (freshPairs.length) {
    freshPairs.sort((a, b) => squeeze(cardOf(b.cards[0])) - squeeze(cardOf(a.cards[0])));
    return freshPairs[0];
  }
  // 3) otherwise the most restrictive legal single
  const singles = plays.filter((m) => m.cards.length === 1);
  if (singles.length) {
    singles.sort((a, b) => squeeze(cardOf(b.cards[0])) - squeeze(cardOf(a.cards[0])));
    return singles[0];
  }
  // 4) any remaining play (e.g. a matching pair), else escape with a 7, else pass
  if (plays.length) return plays[0];
  const seven = moves.find((m) => m.type === "SWITCH7");
  if (seven) return seven;
  const ace = moves.find((m) => m.type === "ACE_SWITCH");
  if (ace) return ace;
  return moves.find((m) => m.type === "PASS") || moves[0];
}

// A bot that holds the fourth card should slap a visible triple, in or out of turn.
export function botSlap(state) {
  if (state.status !== "playing" || state.topRun !== 3) return null;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.isHuman) continue;
    const card = p.hand.find((c) => c.rank === state.topRank);
    if (card) return { type: "SLAP", by: i, card: card.id };
  }
  return null;
}
