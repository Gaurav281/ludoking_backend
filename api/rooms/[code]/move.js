const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase, extractUpdatedDoc } = require('../../../lib/db');
const { verifyPlayerSession, generateToken } = require('../../../lib/auth');
const { processTokenMove } = require('../../../lib/ludoEngine');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    const { tokenIndex, actionId, stateVersion: clientStateVersion } = req.body || {};

    if (!code) {
      return sendError(res, 400, 'Room code is required');
    }

    if (tokenIndex === undefined || tokenIndex === null) {
      return sendError(res, 400, 'tokenIndex is required');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    const gameStatesCollection = db.collection('game_states');
    const actionsCollection = db.collection('match_actions');

    const room = await roomsCollection.findOne({ code });
    if (!room) {
      return sendError(res, 404, 'Room not found');
    }

    if (room.status !== 'IN_PROGRESS') {
      return sendError(res, 400, `Cannot move token: Match status is ${room.status}`);
    }

    // Verify player session
    const authResult = await verifyPlayerSession(req, db, room);
    if (!authResult.valid) {
      return sendError(res, 401, 'Unauthorized: ' + authResult.error);
    }
    const playerId = authResult.playerId;

    // Check actionId idempotency
    if (actionId) {
      const existingAction = await actionsCollection.findOne({ actionId });
      if (existingAction) {
        const currentState = await gameStatesCollection.findOne({ roomCode: code });
        return sendJson(res, 200, {
          success: true,
          message: 'Action already processed (cached)',
          gameState: currentState,
          action: existingAction
        });
      }
    }

    // Fetch current state
    const currentGameState = await gameStatesCollection.findOne({ roomCode: code });
    if (!currentGameState) {
      return sendError(res, 404, 'Game state not found');
    }

    if (clientStateVersion !== undefined && clientStateVersion !== currentGameState.stateVersion) {
      return sendError(res, 409, `State version mismatch. Expected ${currentGameState.stateVersion}, got ${clientStateVersion}`);
    }

    // Process move through authoritative engine
    let updatedGameState;
    try {
      updatedGameState = processTokenMove(currentGameState, playerId, parseInt(tokenIndex, 10));
    } catch (engineErr) {
      return sendError(res, 400, engineErr.message);
    }

    // If game ended, mark room as COMPLETED atomically
    if (updatedGameState.status === 'COMPLETED') {
      const winnerName = updatedGameState.players[updatedGameState.winnerColor].name;
      await roomsCollection.updateOne(
        { code, status: 'IN_PROGRESS' },
        {
          $set: {
            status: 'COMPLETED',
            winnerId: updatedGameState.winnerId,
            winnerName: winnerName,
            winnerColor: updatedGameState.winnerColor,
            completedAt: Date.now()
          }
        }
      );
    }

    // Atomic conditional update on game_states
    const updateResult = await gameStatesCollection.findOneAndUpdate(
      { roomCode: code, stateVersion: currentGameState.stateVersion },
      { $set: updatedGameState },
      { returnDocument: 'after' }
    );

    const updatedStateDoc = extractUpdatedDoc(updateResult);
    if (!updatedStateDoc) {
      return sendError(res, 409, 'Concurrent action conflict. Please refresh and retry.');
    }

    // Record action
    const recordedAction = {
      actionId: actionId || 'act_' + generateToken(''),
      roomCode: code,
      playerId,
      type: 'MOVE_TOKEN',
      data: {
        tokenIndex,
        diceRoll: currentGameState.diceRoll,
        action: updatedGameState.lastAction
      },
      resultingStateVersion: updatedGameState.stateVersion,
      timestamp: Date.now()
    };
    await actionsCollection.insertOne(recordedAction);

    return sendJson(res, 200, {
      success: true,
      gameState: updatedStateDoc,
      action: recordedAction
    });
  } catch (error) {
    console.error('Move token error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
