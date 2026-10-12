const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase, extractUpdatedDoc } = require('../../../lib/db');
const { verifyPlayerSession, generateToken } = require('../../../lib/auth');
const { processDiceRoll } = require('../../../lib/ludoEngine');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    const actionId = req.body?.actionId;
    const clientStateVersion = req.body?.stateVersion;

    if (!code) {
      return sendError(res, 400, 'Room code is required');
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
      return sendError(res, 400, `Cannot roll dice: Match status is ${room.status}`);
    }

    // Verify player session
    const authResult = await verifyPlayerSession(req, db, room);
    if (!authResult.valid) {
      return sendError(res, 401, 'Unauthorized: ' + authResult.error);
    }
    const playerId = authResult.playerId;

    // Check if this actionId was already processed (Idempotency)
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

    // Fetch current game state
    const currentGameState = await gameStatesCollection.findOne({ roomCode: code });
    if (!currentGameState) {
      return sendError(res, 404, 'Game state not found');
    }

    // Optional client version check
    if (clientStateVersion !== undefined && clientStateVersion !== currentGameState.stateVersion) {
      return sendError(res, 409, `State version mismatch. Expected ${currentGameState.stateVersion}, got ${clientStateVersion}`);
    }

    // Process authoritative dice roll
    let updatedGameState;
    try {
      updatedGameState = processDiceRoll(currentGameState, playerId);
    } catch (engineErr) {
      return sendError(res, 400, engineErr.message);
    }

    // Atomic conditional update on stateVersion
    const updateResult = await gameStatesCollection.findOneAndUpdate(
      { roomCode: code, stateVersion: currentGameState.stateVersion },
      { $set: updatedGameState },
      { returnDocument: 'after' }
    );

    const updatedStateDoc = extractUpdatedDoc(updateResult);
    if (!updatedStateDoc) {
      return sendError(res, 409, 'Concurrent action conflict. Please refresh and retry.');
    }

    // Record action log
    const recordedAction = {
      actionId: actionId || 'act_' + generateToken(''),
      roomCode: code,
      playerId,
      type: 'ROLL_DICE',
      data: {
        roll: updatedGameState.diceRoll,
        legalMoves: updatedGameState.legalMoves
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
    console.error('Roll dice error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
