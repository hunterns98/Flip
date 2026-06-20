// deck.js - Flip 7 Card Deck Management

const SPECIAL_CARDS = {
  FREEZE: 'freeze',
  SECOND_CHANCE: 'second_chance',
  FLIP3: 'flip3',
  DOUBLE: 'double',
  PLUS2: '+2',
  PLUS4: '+4',
  PLUS6: '+6',
  PLUS8: '+8',
  PLUS10: '+10',
};

function createDeck() {
  const deck = [];

  // Number cards: n appears n times (0 appears 1 time, 1 appears 1 time, etc.)
  for (let n = 0; n <= 12; n++) {
    const count = n === 0 ? 1 : n;
    for (let i = 0; i < count; i++) {
      deck.push({ type: 'number', value: n });
    }
  }

  // Special cards
  for (let i = 0; i < 3; i++) {
    deck.push({ type: 'special', value: SPECIAL_CARDS.FREEZE, label: 'Freeze' });
    deck.push({ type: 'special', value: SPECIAL_CARDS.SECOND_CHANCE, label: 'Second Chance' });
    deck.push({ type: 'special', value: SPECIAL_CARDS.FLIP3, label: 'Flip 3' });
  }

  deck.push({ type: 'special', value: SPECIAL_CARDS.DOUBLE, label: 'Double' });
  deck.push({ type: 'special', value: SPECIAL_CARDS.PLUS2, label: '+2' });
  deck.push({ type: 'special', value: SPECIAL_CARDS.PLUS4, label: '+4' });
  deck.push({ type: 'special', value: SPECIAL_CARDS.PLUS6, label: '+6' });
  deck.push({ type: 'special', value: SPECIAL_CARDS.PLUS8, label: '+8' });
  deck.push({ type: 'special', value: SPECIAL_CARDS.PLUS10, label: '+10' });

  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardToStorable(card) {
  return JSON.stringify(card);
}

function storableToCard(str) {
  return JSON.parse(str);
}

function createStorableDeck() {
  return createDeck().map(cardToStorable);
}

// Calculate round score for a player's cards
function calculateRoundScore(cards) {
  let numberSum = 0;
  let multiplier = 1;
  let bonusSum = 0;

  const numberCards = cards.filter(c => c.type === 'number');
  const specialCards = cards.filter(c => c.type === 'special');

  numberCards.forEach(c => { numberSum += c.value; });

  specialCards.forEach(c => {
    if (c.value === SPECIAL_CARDS.DOUBLE) multiplier *= 2;
    else if ([SPECIAL_CARDS.PLUS2, SPECIAL_CARDS.PLUS4, SPECIAL_CARDS.PLUS6,
               SPECIAL_CARDS.PLUS8, SPECIAL_CARDS.PLUS10].includes(c.value)) {
      bonusSum += parseInt(c.value);
    }
  });

  return (numberSum * multiplier) + bonusSum;
}

function checkFlip7(cards) {
  const numberCards = cards.filter(c => c.type === 'number');
  const uniqueNumbers = new Set(numberCards.map(c => c.value));
  return uniqueNumbers.size >= 7;
}

function hasNumberCard(cards, value) {
  return cards.some(c => c.type === 'number' && c.value === value);
}

function hasSecondChance(cards) {
  return cards.some(c => c.type === 'special' && c.value === SPECIAL_CARDS.SECOND_CHANCE);
}

function removeSecondChance(cards) {
  const idx = cards.findIndex(c => c.type === 'special' && c.value === SPECIAL_CARDS.SECOND_CHANCE);
  if (idx !== -1) {
    const newCards = [...cards];
    newCards.splice(idx, 1);
    return newCards;
  }
  return cards;
}

// Export for use in other files
window.DeckModule = {
  createStorableDeck,
  cardToStorable,
  storableToCard,
  calculateRoundScore,
  checkFlip7,
  hasNumberCard,
  hasSecondChance,
  removeSecondChance,
  SPECIAL_CARDS,
};
