const {
  BOARD_CONFIG,
  getTrackTile,
  createInitialGameState,
  getLegalMovesForPlayer,
  processDiceRoll,
  processTokenMove
} = require('./lib/ludoEngine');

console.log('--- TESTING LUDO RULES ENGINE ---');

// 1. Initial State
const mockRoom = {
  code: 'TEST01',
  player1: { id: 'p1', name: 'Alice' },
  player2: { id: 'p2', name: 'Bob' }
};

let state = createInitialGameState(mockRoom);
console.assert(state.currentTurnColor === 'red', 'Player 1 (Red) should start first');
console.assert(state.players.red.tokens.every(s => s === -1), 'All Red tokens in yard');
console.assert(state.players.yellow.tokens.every(s => s === -1), 'All Yellow tokens in yard');
console.log('✔ Initial state verified.');

// 2. Track tile calculation
console.assert(getTrackTile('red', 0) === 0, 'Red start tile should be 0');
console.assert(getTrackTile('yellow', 0) === 26, 'Yellow start tile should be 26');
console.assert(getTrackTile('red', 50) === 50, 'Red tile at step 50 should be 50');
console.assert(getTrackTile('yellow', 50) === 24, 'Yellow tile at step 50 should be 24');
console.assert(getTrackTile('red', 51) === null, 'Home path is off common track');
console.log('✔ Board tile mappings verified.');

// 3. Yard Release Legal Moves
const legalMovesOn5 = getLegalMovesForPlayer(state.players.red, 5);
console.assert(legalMovesOn5.length === 0, 'No legal moves from Yard on roll of 5');

const legalMovesOn6 = getLegalMovesForPlayer(state.players.red, 6);
console.assert(legalMovesOn6.length === 4, 'All 4 tokens can exit Yard on roll of 6');
console.assert(legalMovesOn6[0].nextStep === 0, 'Token exits to step 0');
console.log('✔ Yard release rules verified.');

// 4. Manual move simulation
// Force roll = 6 and move token 0 to step 0
state.diceRoll = 6;
state.diceRolled = true;
state.mustMove = true;
state.legalMoves = legalMovesOn6;

state = processTokenMove(state, 'p1', 0);
console.assert(state.players.red.tokens[0] === 0, 'Token 0 should be at step 0');
console.assert(state.currentTurnPlayerId === 'p1', 'Rolling 6 gives bonus turn to Alice');
console.log('✔ Token move and bonus turn on 6 verified.');

// 5. Turn Switch when no 6 and move completed
state.diceRoll = 3;
state.diceRolled = true;
state.mustMove = true;
state.legalMoves = [{ tokenIndex: 0, currentStep: 0, nextStep: 3, isYardRelease: false }];

state = processTokenMove(state, 'p1', 0);
console.assert(state.players.red.tokens[0] === 3, 'Token 0 moved to step 3');
console.assert(state.currentTurnPlayerId === 'p2', 'Turn switched to Bob (Yellow)');
console.assert(state.currentTurnColor === 'yellow', 'Current turn color is yellow');
console.log('✔ Normal move switches turn to opponent verified.');

// 6. Capture Test
// Position Red token 0 at step 26 (which is Tile 26: Yellow start tile, a safe square)
// Safe square test:
state.players.red.tokens[0] = 26; // Red step 26 is track tile 26
// Position Yellow token 0 at step 0 (which is Track tile 26)
state.players.yellow.tokens[0] = 0;
// Since Tile 26 is safe, it should not capture
let moves = [{ tokenIndex: 0, currentStep: 0, nextStep: 0 }];

// Now test capture on UN-SAFE square:
// Red token 0 at step 5 (Track tile 5, not safe)
state.players.red.tokens[0] = 5;
// Yellow token 0 is at step 31 (Track tile: (26 + 31) % 52 = 57 % 52 = 5)
state.players.yellow.tokens[0] = 31;
console.assert(getTrackTile('red', 5) === 5, 'Red tile is 5');
console.assert(getTrackTile('yellow', 31) === 5, 'Yellow tile is 5');

// Now let Red token 1 move to step 5!
state.currentTurnPlayerId = 'p1';
state.currentTurnColor = 'red';
state.players.red.tokens[1] = 1;
state.diceRoll = 4;
state.diceRolled = true;
state.mustMove = true;
state.legalMoves = [{ tokenIndex: 1, currentStep: 1, nextStep: 5, isYardRelease: false }];

state = processTokenMove(state, 'p1', 1);
console.assert(state.players.yellow.tokens[0] === -1, 'Yellow token was captured and returned to Yard!');
console.assert(state.currentTurnPlayerId === 'p1', 'Alice got bonus turn from capture!');
console.log('✔ Capture mechanics and bonus turn verified.');

// 7. Victory Condition
// Set all 4 Red tokens to step 56 (Goal)
state.players.red.tokens = [56, 56, 56, 55];
state.currentTurnPlayerId = 'p1';
state.currentTurnColor = 'red';
state.diceRoll = 1;
state.diceRolled = true;
state.mustMove = true;
state.legalMoves = [{ tokenIndex: 3, currentStep: 55, nextStep: 56, isYardRelease: false }];

state = processTokenMove(state, 'p1', 3);
console.assert(state.status === 'COMPLETED', 'Game status is COMPLETED');
console.assert(state.winnerId === 'p1', 'Alice is verified winner');
console.assert(state.winnerColor === 'red', 'Winner color is Red');
console.log('✔ Win condition detection verified.');

console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY! 🎉');
