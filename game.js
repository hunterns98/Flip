// game.js - Core Game Logic & Firebase Sync

const { createStorableDeck, cardToStorable, storableToCard,
        calculateRoundScore, checkFlip7, hasNumberCard,
        hasSecondChance, removeSecondChance, SPECIAL_CARDS } = window.DeckModule;

const TARGET_SCORE = 200;
const FLIP7_BONUS = 15;

// ─── Room helpers ───────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createRoom(adminName) {
  const roomId = generateRoomCode();
  const adminId = 'admin_' + Date.now();

  const roomData = {
    gameStatus: 'waiting',
    targetScore: TARGET_SCORE,
    round: 1,
    currentPlayer: null,
    deck: [],
    roundStatus: 'playing',
    flip7Winner: null,
    adminId,
    adminName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    playerOrder: [adminId],
  };

  const playerData = {
    [adminId]: {
      name: adminName,
      totalScore: 0,
      roundScore: 0,
      cardsInRound: [],
      status: 'playing',
      hasSecondChance: false,
      isAdmin: true,
      connected: true,
      joinedAt: Date.now(),
    }
  };

  await db.collection('rooms').doc(roomId).set({ ...roomData, players: playerData });
  return { roomId, playerId: adminId };
}

async function joinRoom(roomId, playerName) {
  const roomRef = db.collection('rooms').doc(roomId);
  const snap = await roomRef.get();

  if (!snap.exists) throw new Error('Phòng không tồn tại!');
  const data = snap.data();
  if (data.gameStatus !== 'waiting') throw new Error('Game đã bắt đầu, không thể tham gia!');

  const playerCount = Object.keys(data.players || {}).length;
  if (playerCount >= 15) throw new Error('Phòng đã đầy (tối đa 15 người)!');

  const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  await roomRef.update({
    [`players.${playerId}`]: {
      name: playerName,
      totalScore: 0,
      roundScore: 0,
      cardsInRound: [],
      status: 'playing',
      hasSecondChance: false,
      isAdmin: false,
      connected: true,
      joinedAt: Date.now(),
    },
    playerOrder: firebase.firestore.FieldValue.arrayUnion(playerId),
  });

  return { roomId, playerId };
}

async function startGame(roomId, adminId) {
  const roomRef = db.collection('rooms').doc(roomId);
  const snap = await roomRef.get();
  const data = snap.data();

  if (data.adminId !== adminId) throw new Error('Chỉ admin mới có thể bắt đầu!');
  const playerIds = data.playerOrder || Object.keys(data.players);
  if (playerIds.length < 2) throw new Error('Cần ít nhất 2 người chơi!');

  const deck = createStorableDeck();
  const firstPlayer = playerIds[0];

  // Reset all players for new game
  const updates = {};
  playerIds.forEach(pid => {
    updates[`players.${pid}.totalScore`] = 0;
    updates[`players.${pid}.roundScore`] = 0;
    updates[`players.${pid}.cardsInRound`] = [];
    updates[`players.${pid}.status`] = 'playing';
    updates[`players.${pid}.hasSecondChance`] = false;
  });

  await roomRef.update({
    ...updates,
    gameStatus: 'playing',
    round: 1,
    currentPlayer: firstPlayer,
    deck,
    roundStatus: 'playing',
    flip7Winner: null,
    playerOrder: playerIds,
  });
}

// ─── Turn actions ────────────────────────────────────────────────────────────

async function flipCard(roomId, playerId) {
  const roomRef = db.collection('rooms').doc(roomId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    const data = snap.data();

    if (data.currentPlayer !== playerId) throw new Error('Không phải lượt của bạn!');
    if (data.gameStatus !== 'playing') throw new Error('Game chưa bắt đầu!');
    if (data.roundStatus !== 'playing') throw new Error('Vòng đang kết thúc!');

    const player = data.players[playerId];
    if (player.status !== 'playing') throw new Error('Bạn đã dừng hoặc bị bust!');

    const deck = [...data.deck];
    if (deck.length === 0) {
      // Reshuffle if deck runs out
      const newDeck = createStorableDeck();
      deck.push(...newDeck);
    }

    const drawnRaw = deck.shift();
    const drawnCard = storableToCard(drawnRaw);

    const updates = { deck };

    // Handle Flip3: draw 3 cards sequentially (handled recursively via state)
    if (drawnCard.type === 'special' && drawnCard.value === SPECIAL_CARDS.FLIP3) {
      const result = await handleFlip3(tx, roomRef, data, playerId, deck, updates);
      return result;
    }

    return await processCard(tx, roomRef, data, playerId, drawnCard, updates);
  });
}

async function handleFlip3(tx, roomRef, data, playerId, deck, updates) {
  const player = data.players[playerId];
  let cards = [...(player.cardsInRound || []).map(storableToCard)];
  let bust = false;
  let bustCard = null;
  let drawnCards = [{ type: 'special', value: SPECIAL_CARDS.FLIP3, label: 'Flip 3' }];

  for (let i = 0; i < 3; i++) {
    if (deck.length === 0) deck.push(...createStorableDeck());
    const rawCard = deck.shift();
    const card = storableToCard(rawCard);
    drawnCards.push(card);

    if (card.type === 'number') {
      if (hasNumberCard(cards, card.value)) {
        // Check second chance
        const sc = hasSecondChance(cards);
        if (sc) {
          cards = removeSecondChance(cards);
          // Remove the duplicate and continue
          cards = cards.filter((c, idx) => !(c.type === 'number' && c.value === card.value) || idx !== cards.findIndex(x => x.type === 'number' && x.value === card.value));
          continue;
        }
        bust = true;
        bustCard = card;
        break;
      } else {
        cards.push(card);
      }
    } else {
      cards.push(card);
    }
  }

  const updatedData = { ...data };
  if (bust) {
    updatedData.players[playerId].status = 'bust';
    updatedData.players[playerId].roundScore = 0;
    updatedData.players[playerId].cardsInRound = [];
    updates[`players.${playerId}.status`] = 'bust';
    updates[`players.${playerId}.roundScore`] = 0;
    updates[`players.${playerId}.cardsInRound`] = [];
    await advanceTurn(tx, roomRef, updatedData, playerId, updates);
    return { bust: true, bustCard, drawnCards };
  } else {
    const roundScore = calculateRoundScore(cards);
    const cardStorables = cards.map(cardToStorable);
    updates[`players.${playerId}.cardsInRound`] = cardStorables;
    updates[`players.${playerId}.roundScore`] = roundScore;
    updates.deck = deck;

    // Check Flip7
    if (checkFlip7(cards)) {
      await triggerFlip7(tx, roomRef, { ...data, players: { ...data.players, [playerId]: { ...data.players[playerId], cardsInRound: cardStorables, roundScore } } }, playerId, updates);
      return { flip7: true, drawnCards };
    }

    tx.update(roomRef, updates);
    return { drawnCards, roundScore, cards };
  }
}

async function processCard(tx, roomRef, data, playerId, drawnCard, updates) {
  const player = data.players[playerId];
  let cards = (player.cardsInRound || []).map(storableToCard);

  if (drawnCard.type === 'number') {
    if (hasNumberCard(cards, drawnCard.value)) {
      // BUST scenario
      const sc = hasSecondChance(cards);
      if (sc) {
        // Use second chance: remove duplicate card from hand and the second chance card
        cards = removeSecondChance(cards);
        // Remove one instance of the duplicate number
        const dupIdx = cards.findIndex(c => c.type === 'number' && c.value === drawnCard.value);
        if (dupIdx !== -1) cards.splice(dupIdx, 1);
        // Continue with current card added
        cards.push(drawnCard);

        const roundScore = calculateRoundScore(cards);
        updates[`players.${playerId}.cardsInRound`] = cards.map(cardToStorable);
        updates[`players.${playerId}.roundScore`] = roundScore;

        if (checkFlip7(cards)) {
          await triggerFlip7(tx, roomRef, data, playerId, updates);
          return { secondChanceUsed: true, flip7: true, drawnCard };
        }

        tx.update(roomRef, updates);
        return { secondChanceUsed: true, drawnCard, roundScore };
      }

      // Real bust
      updates[`players.${playerId}.status`] = 'bust';
      updates[`players.${playerId}.roundScore`] = 0;
      updates[`players.${playerId}.cardsInRound`] = [];

      const updatedData = {
        ...data,
        players: {
          ...data.players,
          [playerId]: { ...player, status: 'bust', roundScore: 0, cardsInRound: [] }
        }
      };
      await advanceTurn(tx, roomRef, updatedData, playerId, updates);
      return { bust: true, bustCard: drawnCard };
    }

    // Normal number card
    cards.push(drawnCard);
    const roundScore = calculateRoundScore(cards);
    updates[`players.${playerId}.cardsInRound`] = cards.map(cardToStorable);
    updates[`players.${playerId}.roundScore`] = roundScore;

    if (checkFlip7(cards)) {
      await triggerFlip7(tx, roomRef, data, playerId, updates);
      return { flip7: true, drawnCard };
    }

    tx.update(roomRef, updates);
    return { drawnCard, roundScore };
  }

  // Special card handling
  if (drawnCard.value === SPECIAL_CARDS.SECOND_CHANCE) {
    cards.push(drawnCard);
    const roundScore = calculateRoundScore(cards);
    updates[`players.${playerId}.cardsInRound`] = cards.map(cardToStorable);
    updates[`players.${playerId}.roundScore`] = roundScore;
    updates[`players.${playerId}.hasSecondChance`] = true;
    tx.update(roomRef, updates);
    return { drawnCard, roundScore };
  }

  if (drawnCard.value === SPECIAL_CARDS.DOUBLE ||
      [SPECIAL_CARDS.PLUS2, SPECIAL_CARDS.PLUS4, SPECIAL_CARDS.PLUS6,
       SPECIAL_CARDS.PLUS8, SPECIAL_CARDS.PLUS10].includes(drawnCard.value)) {
    cards.push(drawnCard);
    const roundScore = calculateRoundScore(cards);
    updates[`players.${playerId}.cardsInRound`] = cards.map(cardToStorable);
    updates[`players.${playerId}.roundScore`] = roundScore;
    tx.update(roomRef, updates);
    return { drawnCard, roundScore };
  }

  if (drawnCard.value === SPECIAL_CARDS.FREEZE) {
    // Return freeze card info - UI will ask who to freeze
    updates[`players.${playerId}.cardsInRound`] = [...cards.map(cardToStorable), cardToStorable(drawnCard)];
    tx.update(roomRef, updates);
    return { drawnCard, requireFreezeTarget: true };
  }

  tx.update(roomRef, updates);
  return { drawnCard };
}

async function applyFreeze(roomId, currentPlayerId, targetPlayerId) {
  const roomRef = db.collection('rooms').doc(roomId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    const data = snap.data();

    if (data.currentPlayer !== currentPlayerId) throw new Error('Không phải lượt của bạn!');

    const target = data.players[targetPlayerId];
    if (!target || target.status !== 'playing') throw new Error('Người chơi không hợp lệ!');

    const targetCards = (target.cardsInRound || []).map(storableToCard);
    const targetScore = calculateRoundScore(targetCards);

    const updates = {
      [`players.${targetPlayerId}.status`]: 'stopped',
      [`players.${targetPlayerId}.totalScore`]: (target.totalScore || 0) + targetScore,
      [`players.${targetPlayerId}.roundScore`]: 0,
    };

    const updatedData = {
      ...data,
      players: {
        ...data.players,
        [targetPlayerId]: { ...target, status: 'stopped', totalScore: (target.totalScore || 0) + targetScore, roundScore: 0 }
      }
    };

    // If freezing someone else, current player still continues their turn
    // If the target is the current player themselves, advance turn
    if (targetPlayerId === currentPlayerId) {
      await advanceTurn(tx, roomRef, updatedData, currentPlayerId, updates);
    } else {
      // Check if all others are done
      const allDone = checkAllPlayersDone(updatedData, currentPlayerId);
      if (allDone) {
        await endRound(tx, roomRef, updatedData, updates);
      } else {
        tx.update(roomRef, updates);
      }
    }

    return { frozen: targetPlayerId };
  });
}

async function stopTurn(roomId, playerId) {
  const roomRef = db.collection('rooms').doc(roomId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    const data = snap.data();

    if (data.currentPlayer !== playerId) throw new Error('Không phải lượt của bạn!');

    const player = data.players[playerId];
    if (player.status !== 'playing') throw new Error('Bạn đã dừng!');

    const cards = (player.cardsInRound || []).map(storableToCard);
    const roundScore = calculateRoundScore(cards);
    const newTotal = (player.totalScore || 0) + roundScore;

    const updates = {
      [`players.${playerId}.status`]: 'stopped',
      [`players.${playerId}.totalScore`]: newTotal,
      [`players.${playerId}.roundScore`]: 0,
    };

    const updatedData = {
      ...data,
      players: {
        ...data.players,
        [playerId]: { ...player, status: 'stopped', totalScore: newTotal, roundScore: 0 }
      }
    };

    // Check win condition
    if (newTotal >= TARGET_SCORE) {
      updates.gameStatus = 'finished';
      updates.winner = playerId;
      tx.update(roomRef, updates);
      return { stopped: true, won: true, total: newTotal };
    }

    await advanceTurn(tx, roomRef, updatedData, playerId, updates);
    return { stopped: true, total: newTotal };
  });
}

// ─── Round & Turn helpers ───────────────────────────────────────────────────

function checkAllPlayersDone(data, excludePlayerId) {
  const playerIds = data.playerOrder || Object.keys(data.players);
  return playerIds.every(pid => {
    const p = data.players[pid];
    return p.status === 'stopped' || p.status === 'bust';
  });
}

async function advanceTurn(tx, roomRef, data, currentPlayerId, updates) {
  const playerIds = data.playerOrder || Object.keys(data.players);

  // Check if all players are done (stopped or bust)
  const allDone = playerIds.every(pid => {
    const p = data.players[pid];
    return p.status === 'stopped' || p.status === 'bust';
  });

  if (allDone) {
    await endRound(tx, roomRef, data, updates);
    return;
  }

  // Find next active player
  const currentIdx = playerIds.indexOf(currentPlayerId);
  let nextIdx = (currentIdx + 1) % playerIds.length;
  let attempts = 0;

  while (attempts < playerIds.length) {
    const nextPid = playerIds[nextIdx];
    const nextPlayer = data.players[nextPid];
    if (nextPlayer && nextPlayer.status === 'playing') {
      updates.currentPlayer = nextPid;
      tx.update(roomRef, updates);
      return;
    }
    nextIdx = (nextIdx + 1) % playerIds.length;
    attempts++;
  }

  // All done
  await endRound(tx, roomRef, data, updates);
}

async function triggerFlip7(tx, roomRef, data, flip7PlayerId, updates) {
  const playerIds = data.playerOrder || Object.keys(data.players);

  // Save all player scores
  playerIds.forEach(pid => {
    const player = data.players[pid];
    if (player.status === 'bust') return; // bust players get 0

    const cards = (player.cardsInRound || []).map(storableToCard);
    let roundScore = calculateRoundScore(cards);
    if (pid === flip7PlayerId) roundScore += FLIP7_BONUS;

    const newTotal = (player.totalScore || 0) + roundScore;
    updates[`players.${pid}.totalScore`] = newTotal;
    updates[`players.${pid}.roundScore`] = 0;
    updates[`players.${pid}.status`] = 'stopped';
  });

  // Check for overall winner
  const flip7Player = data.players[flip7PlayerId];
  const flip7Cards = (flip7Player.cardsInRound || []).map(storableToCard);
  const flip7Score = calculateRoundScore(flip7Cards) + FLIP7_BONUS;
  const flip7Total = (flip7Player.totalScore || 0) + flip7Score;

  if (flip7Total >= TARGET_SCORE) {
    updates.gameStatus = 'finished';
    updates.winner = flip7PlayerId;
    updates.roundStatus = 'flip7Triggered';
    updates.flip7Winner = flip7PlayerId;
    tx.update(roomRef, updates);
    return;
  }

  updates.roundStatus = 'endingRound';
  updates.flip7Winner = flip7PlayerId;
  tx.update(roomRef, updates);

  // Schedule round reset
  setTimeout(() => startNewRound(roomRef, data, updates), 3000);
}

async function endRound(tx, roomRef, data, updates) {
  const playerIds = data.playerOrder || Object.keys(data.players);

  // Save scores for players who stopped (bust already have 0)
  playerIds.forEach(pid => {
    const player = data.players[pid];
    if (player.status === 'playing') {
      // Force stop remaining players
      const cards = (player.cardsInRound || []).map(storableToCard);
      const roundScore = calculateRoundScore(cards);
      const newTotal = (player.totalScore || 0) + roundScore;
      updates[`players.${pid}.totalScore`] = newTotal;
      updates[`players.${pid}.roundScore`] = 0;
      updates[`players.${pid}.status`] = 'stopped';
    }
  });

  // Check winners
  let winner = null;
  let highScore = -1;
  playerIds.forEach(pid => {
    const total = (updates[`players.${pid}.totalScore`] !== undefined)
      ? updates[`players.${pid}.totalScore`]
      : data.players[pid].totalScore;
    if (total >= TARGET_SCORE && total > highScore) {
      highScore = total;
      winner = pid;
    }
  });

  if (winner) {
    updates.gameStatus = 'finished';
    updates.winner = winner;
    tx.update(roomRef, updates);
    return;
  }

  tx.update(roomRef, updates);
  // Reset for next round
  setTimeout(() => startNewRound(roomRef, data, {}), 2000);
}

async function startNewRound(roomRef, prevData, prevUpdates) {
  const snap = await roomRef.get();
  const data = snap.data();
  if (data.gameStatus === 'finished') return;

  const playerIds = data.playerOrder || Object.keys(data.players);
  const newRound = (data.round || 1) + 1;
  const deck = createStorableDeck();

  const updates = {
    round: newRound,
    deck,
    roundStatus: 'playing',
    flip7Winner: null,
    currentPlayer: playerIds[0],
  };

  playerIds.forEach(pid => {
    updates[`players.${pid}.status`] = 'playing';
    updates[`players.${pid}.roundScore`] = 0;
    updates[`players.${pid}.cardsInRound`] = [];
    updates[`players.${pid}.hasSecondChance`] = false;
  });

  await roomRef.update(updates);
}

// Subscribe to room updates
function subscribeToRoom(roomId, callback) {
  return db.collection('rooms').doc(roomId).onSnapshot(snap => {
    if (snap.exists) callback(snap.data());
  });
}

window.GameModule = {
  generateRoomCode,
  createRoom,
  joinRoom,
  startGame,
  flipCard,
  applyFreeze,
  stopTurn,
  subscribeToRoom,
};
