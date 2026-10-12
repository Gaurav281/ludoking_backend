/**
 * Standard Server-Authoritative Ludo Game Logic
 * Two players: Red (player1) and Yellow (player2)
 */

const BOARD_CONFIG = {
  TRACK_LENGTH: 52,
  HOME_STEPS: 6, // step 51..55 (columns 1..5), step 56 is Home goal
  GOAL_STEP: 56,
  SAFE_TILES: [0, 8, 13, 21, 26, 34, 39, 47],
  START_TILES: {
    red: 0,
    yellow: 26
  }
};

/**
 * Convert player relative step (-1..56) to board tile index (0..51)
 * Returns null if token is in Yard (-1) or Home Column / Goal (51..56)
 */
function getTrackTile(color, step) {
  if (step < 0 || step > 50) return null;
  const startTile = BOARD_CONFIG.START_TILES[color];
  return (startTile + step) % BOARD_CONFIG.TRACK_LENGTH;
}

/**
 * Initialize a fresh Game State
 */
function createInitialGameState(room) {
  return {
    roomCode: room.code,
    currentTurnPlayerId: room.player1.id,
    currentTurnColor: 'red',
    consecutiveSixes: 0,
    diceRoll: null,
    diceRolled: false,
    legalMoves: [], // list of token indices that can move
    mustMove: false,
    players: {
      red: {
        id: room.player1.id,
        name: room.player1.name,
        color: 'red',
        tokens: [-1, -1, -1, -1], // all 4 in yard
        finishedCount: 0
      },
      yellow: {
        id: room.player2.id,
        name: room.player2.name,
        color: 'yellow',
        tokens: [-1, -1, -1, -1], // all 4 in yard
        finishedCount: 0
      }
    },
    stateVersion: 1,
    turnNumber: 1,
    status: 'IN_PROGRESS',
    winnerId: null,
    winnerColor: null,
    lastAction: {
      type: 'START_MATCH',
      description: 'Match started by admin. Red rolls first.',
      timestamp: Date.now()
    },
    updatedAt: Date.now()
  };
}

/**
 * Calculate legal moves for active player given the dice roll
 */
function getLegalMovesForPlayer(playerState, diceRoll) {
  const legalMoves = [];

  playerState.tokens.forEach((step, tokenIndex) => {
    // If token already at Home goal, cannot move
    if (step >= BOARD_CONFIG.GOAL_STEP) return;

    // If token is in Yard, needs a 6 to enter
    if (step === -1) {
      if (diceRoll === 6) {
        legalMoves.push({
          tokenIndex,
          currentStep: -1,
          nextStep: 0,
          isYardRelease: true
        });
      }
      return;
    }

    // Token is on track or in home column
    const nextStep = step + diceRoll;
    if (nextStep <= BOARD_CONFIG.GOAL_STEP) {
      legalMoves.push({
        tokenIndex,
        currentStep: step,
        nextStep,
        isYardRelease: false
      });
    }
  });

  return legalMoves;
}

/**
 * Handle dice roll request on server
 */
function processDiceRoll(gameState, playerId) {
  if (gameState.status !== 'IN_PROGRESS') {
    throw new Error('Game is not in progress');
  }

  if (gameState.currentTurnPlayerId !== playerId) {
    throw new Error("It is not your turn to roll");
  }

  if (gameState.diceRolled && gameState.mustMove) {
    throw new Error("You must move a token before rolling again");
  }

  // Authoritative random roll 1..6
  const roll = Math.floor(Math.random() * 6) + 1;
  const activeColor = gameState.currentTurnColor;
  const activePlayer = gameState.players[activeColor];

  let consecutiveSixes = gameState.consecutiveSixes || 0;
  if (roll === 6) {
    consecutiveSixes += 1;
  } else {
    consecutiveSixes = 0;
  }

  // Standard penalty: 3 consecutive sixes forfeits turn
  if (consecutiveSixes >= 3) {
    const nextColor = activeColor === 'red' ? 'yellow' : 'red';
    const nextPlayer = gameState.players[nextColor];

    return {
      ...gameState,
      consecutiveSixes: 0,
      diceRoll: roll,
      diceRolled: true,
      legalMoves: [],
      mustMove: false,
      currentTurnColor: nextColor,
      currentTurnPlayerId: nextPlayer.id,
      turnNumber: gameState.turnNumber + 1,
      stateVersion: gameState.stateVersion + 1,
      lastAction: {
        type: 'PENALTY_THREE_SIXES',
        playerId,
        roll,
        description: `${activePlayer.name} rolled three 6s in a row! Turn forfeited.`,
        timestamp: Date.now()
      },
      updatedAt: Date.now()
    };
  }

  const legalMoves = getLegalMovesForPlayer(activePlayer, roll);

  // If no legal moves available, turn passes automatically to opponent
  if (legalMoves.length === 0) {
    const nextColor = activeColor === 'red' ? 'yellow' : 'red';
    const nextPlayer = gameState.players[nextColor];

    return {
      ...gameState,
      consecutiveSixes,
      diceRoll: roll,
      diceRolled: true,
      legalMoves: [],
      mustMove: false,
      currentTurnColor: nextColor,
      currentTurnPlayerId: nextPlayer.id,
      turnNumber: gameState.turnNumber + 1,
      stateVersion: gameState.stateVersion + 1,
      lastAction: {
        type: 'NO_LEGAL_MOVES',
        playerId,
        roll,
        description: `${activePlayer.name} rolled a ${roll} but has no legal moves. Turn passed.`,
        timestamp: Date.now()
      },
      updatedAt: Date.now()
    };
  }

  // Active player has legal move(s)
  return {
    ...gameState,
    consecutiveSixes,
    diceRoll: roll,
    diceRolled: true,
    legalMoves,
    mustMove: true,
    stateVersion: gameState.stateVersion + 1,
    lastAction: {
      type: 'DICE_ROLLED',
      playerId,
      roll,
      legalMoveTokens: legalMoves.map(m => m.tokenIndex),
      description: `${activePlayer.name} rolled a ${roll}.`,
      timestamp: Date.now()
    },
    updatedAt: Date.now()
  };
}

/**
 * Handle token move request on server
 */
function processTokenMove(gameState, playerId, tokenIndex) {
  if (gameState.status !== 'IN_PROGRESS') {
    throw new Error('Game is not in progress');
  }

  if (gameState.currentTurnPlayerId !== playerId) {
    throw new Error("It is not your turn to move");
  }

  if (!gameState.diceRolled || !gameState.mustMove) {
    throw new Error("Must roll dice first");
  }

  const move = gameState.legalMoves.find(m => m.tokenIndex === tokenIndex);
  if (!move) {
    throw new Error("Invalid move: Token cannot legally move with current dice roll");
  }

  const activeColor = gameState.currentTurnColor;
  const opponentColor = activeColor === 'red' ? 'yellow' : 'red';
  const roll = gameState.diceRoll;

  // Clone player states
  const newPlayers = JSON.parse(JSON.stringify(gameState.players));
  const activeTokens = [...newPlayers[activeColor].tokens];
  const opponentTokens = [...newPlayers[opponentColor].tokens];

  const prevStep = activeTokens[tokenIndex];
  const nextStep = move.nextStep;
  activeTokens[tokenIndex] = nextStep;

  let captured = false;
  let reachedHome = false;
  let bonusTurn = false;
  let captureDescription = '';

  // Check if reached home goal
  if (nextStep === BOARD_CONFIG.GOAL_STEP) {
    reachedHome = true;
    bonusTurn = true;
    newPlayers[activeColor].finishedCount = activeTokens.filter(s => s === BOARD_CONFIG.GOAL_STEP).length;
  }

  // Check for capture on common track (0..50)
  if (nextStep >= 0 && nextStep <= 50) {
    const landingTile = getTrackTile(activeColor, nextStep);
    const isSafe = BOARD_CONFIG.SAFE_TILES.includes(landingTile);

    if (!isSafe) {
      // Check if any opponent token is on this exact track tile
      opponentTokens.forEach((oppStep, oppIndex) => {
        if (oppStep >= 0 && oppStep <= 50) {
          const oppTile = getTrackTile(opponentColor, oppStep);
          if (oppTile === landingTile) {
            // Captured! Send opponent token to Yard
            opponentTokens[oppIndex] = -1;
            captured = true;
            bonusTurn = true;
            captureDescription = ` Captured ${newPlayers[opponentColor].name}'s token!`;
          }
        }
      });
    }
  }

  // Bonus turn on rolling 6
  if (roll === 6) {
    bonusTurn = true;
  }

  newPlayers[activeColor].tokens = activeTokens;
  newPlayers[opponentColor].tokens = opponentTokens;

  // Check victory condition: all 4 tokens finished
  const allFinished = activeTokens.every(s => s === BOARD_CONFIG.GOAL_STEP);
  if (allFinished) {
    return {
      ...gameState,
      players: newPlayers,
      diceRoll: null,
      diceRolled: false,
      legalMoves: [],
      mustMove: false,
      status: 'COMPLETED',
      winnerId: playerId,
      winnerColor: activeColor,
      turnNumber: gameState.turnNumber + 1,
      stateVersion: gameState.stateVersion + 1,
      lastAction: {
        type: 'GAME_WON',
        playerId,
        tokenIndex,
        roll,
        description: `Victory! ${newPlayers[activeColor].name} won the match!`,
        timestamp: Date.now()
      },
      updatedAt: Date.now()
    };
  }

  // Determine next turn
  let nextTurnColor = activeColor;
  let nextTurnPlayerId = playerId;
  let consecutiveSixes = gameState.consecutiveSixes;

  if (!bonusTurn) {
    nextTurnColor = opponentColor;
    nextTurnPlayerId = newPlayers[opponentColor].id;
    consecutiveSixes = 0;
  }

  const actionDescription = `${newPlayers[activeColor].name} moved token ${tokenIndex + 1} to step ${nextStep}.${captureDescription}${bonusTurn ? ' Earned an extra turn!' : ''}`;

  return {
    ...gameState,
    players: newPlayers,
    consecutiveSixes,
    diceRoll: null,
    diceRolled: false,
    legalMoves: [],
    mustMove: false,
    currentTurnColor: nextTurnColor,
    currentTurnPlayerId: nextTurnPlayerId,
    turnNumber: bonusTurn ? gameState.turnNumber : gameState.turnNumber + 1,
    stateVersion: gameState.stateVersion + 1,
    lastAction: {
      type: 'TOKEN_MOVED',
      playerId,
      tokenIndex,
      prevStep,
      nextStep,
      captured,
      reachedHome,
      bonusTurn,
      description: actionDescription,
      timestamp: Date.now()
    },
    updatedAt: Date.now()
  };
}

module.exports = {
  BOARD_CONFIG,
  getTrackTile,
  createInitialGameState,
  getLegalMovesForPlayer,
  processDiceRoll,
  processTokenMove
};
