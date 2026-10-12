const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase, extractUpdatedDoc } = require('../../../lib/db');
const { verifyAdmin, generateToken } = require('../../../lib/auth');
const { createInitialGameState } = require('../../../lib/ludoEngine');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    // Only authorized admin can start match
    if (!verifyAdmin(req)) {
      return sendError(res, 401, 'Unauthorized: Admin authorization required to start match');
    }

    const code = (req.query?.code || '').toUpperCase().trim();
    if (!code) {
      return sendError(res, 400, 'Room code is required');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    const gameStatesCollection = db.collection('game_states');

    const room = await roomsCollection.findOne({ code });
    if (!room) {
      return sendError(res, 404, 'Room not found');
    }

    if (room.status === 'IN_PROGRESS') {
      return sendJson(res, 200, { success: true, message: 'Match already in progress', room });
    }

    if (room.status !== 'WAITING') {
      return sendError(res, 400, `Cannot start match. Room status is ${room.status}`);
    }

    // Both players must be present
    if (!room.player1 || !room.player2) {
      return sendError(res, 400, 'Cannot start match: exactly two players must join first');
    }

    // Initialize game state
    const initialGameState = createInitialGameState(room);

    // Save game state
    await gameStatesCollection.findOneAndUpdate(
      { roomCode: code },
      { $set: initialGameState },
      { upsert: true }
    );

    // Atomically transition room status to IN_PROGRESS
    const updatedRoomResult = await roomsCollection.findOneAndUpdate(
      { code, status: 'WAITING' },
      {
        $set: {
          status: 'IN_PROGRESS',
          startedAt: Date.now()
        }
      },
      { returnDocument: 'after' }
    );

    // Log match start
    await db.collection('match_actions').insertOne({
      actionId: 'act_' + generateToken(''),
      roomCode: code,
      playerId: 'admin',
      type: 'MATCH_STARTED',
      data: {
        player1: room.player1.name,
        player2: room.player2.name
      },
      timestamp: Date.now()
    });

    const updatedRoom = extractUpdatedDoc(updatedRoomResult) || room;

    return sendJson(res, 200, {
      success: true,
      message: 'Match started successfully',
      room: updatedRoom,
      gameState: initialGameState
    });
  } catch (error) {
    console.error('Start match error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
