const { handleCors, sendJson, sendError } = require('../../lib/response');
const { connectToDatabase } = require('../../lib/db');
const { verifyAdmin, generateRoomCode, generateToken } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    // Admin must be authorized
    if (!verifyAdmin(req)) {
      return sendError(res, 401, 'Unauthorized admin');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    // Prevent duplicate room creation if client sends requestId/idempotencyKey
    const idempotencyKey = req.body?.idempotencyKey;
    if (idempotencyKey) {
      const existing = await roomsCollection.findOne({ idempotencyKey });
      if (existing) {
        return sendJson(res, 200, {
          success: true,
          room: existing,
          isDuplicate: true
        });
      }
    }

    // Generate unique room code
    let code = '';
    let isUnique = false;
    for (let attempts = 0; attempts < 10; attempts++) {
      code = generateRoomCode();
      const existingCode = await roomsCollection.findOne({ code });
      if (!existingCode) {
        isUnique = true;
        break;
      }
    }

    if (!isUnique) {
      return sendError(res, 500, 'Failed to generate a unique room code, please retry');
    }

    const roomId = 'room_' + generateToken('');
    const newRoom = {
      id: roomId,
      code,
      status: 'WAITING', // WAITING, IN_PROGRESS, COMPLETED, CANCELLED
      player1: null,
      player2: null,
      winnerId: null,
      winnerName: null,
      winnerColor: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      idempotencyKey: idempotencyKey || null,
      adminId: 'admin_primary'
    };

    await roomsCollection.insertOne(newRoom);

    return sendJson(res, 201, {
      success: true,
      room: newRoom
    });
  } catch (error) {
    console.error('Create room error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
