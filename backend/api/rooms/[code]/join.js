const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase, extractUpdatedDoc } = require('../../../lib/db');
const { generateToken } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    const { displayName, existingPlayerId, existingSessionToken } = req.body || {};

    if (!code) {
      return sendError(res, 400, 'Room code is required');
    }

    const trimmedName = (displayName || '').trim();
    if (!trimmedName && !existingPlayerId) {
      return sendError(res, 400, 'Display name is required');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    const usersCollection = db.collection('users');

    const room = await roomsCollection.findOne({ code });
    if (!room) {
      return sendError(res, 404, 'Room not found. Please check the room code.');
    }

    // Check if player is reconnecting with existing session
    if (existingPlayerId && existingSessionToken) {
      const user = await usersCollection.findOne({ userId: existingPlayerId, sessionToken: existingSessionToken });
      if (user) {
        if (room.player1 && room.player1.id === existingPlayerId) {
          return sendJson(res, 200, {
            success: true,
            playerId: existingPlayerId,
            sessionToken: existingSessionToken,
            slot: 'player1',
            color: 'red',
            room
          });
        }
        if (room.player2 && room.player2.id === existingPlayerId) {
          return sendJson(res, 200, {
            success: true,
            playerId: existingPlayerId,
            sessionToken: existingSessionToken,
            slot: 'player2',
            color: 'yellow',
            room
          });
        }
      }
    }

    // Ensure room is still in WAITING status
    if (room.status !== 'WAITING') {
      if (room.status === 'IN_PROGRESS') {
        return sendError(res, 400, 'Match is already in progress and cannot be joined');
      }
      return sendError(res, 400, `Room is ${room.status.toLowerCase()}`);
    }

    // Check if both slots are filled
    if (room.player1 && room.player2) {
      return sendError(res, 409, 'Room is already full (2/2 players joined)');
    }

    // Generate lightweight secure player identity
    const playerId = 'p_' + generateToken('');
    const sessionToken = generateToken('sess_');
    const playerRecord = {
      userId: playerId,
      displayName: trimmedName || 'Player',
      sessionToken,
      roomCode: code,
      createdAt: Date.now()
    };
    await usersCollection.insertOne(playerRecord);

    const playerPayload = {
      id: playerId,
      name: trimmedName || 'Player',
      joinedAt: Date.now()
    };

    // Atomic conditional slot assignment
    let updatedRoom = null;
    let slot = null;
    let color = null;

    if (!room.player1) {
      const result = await roomsCollection.findOneAndUpdate(
        { code, status: 'WAITING', player1: null },
        { $set: { player1: playerPayload } },
        { returnDocument: 'after' }
      );
      const doc = extractUpdatedDoc(result);
      if (doc) {
        updatedRoom = doc;
        slot = 'player1';
        color = 'red';
      }
    }

    if (!slot && !room.player2) {
      const result = await roomsCollection.findOneAndUpdate(
        { code, status: 'WAITING', player2: null },
        { $set: { player2: playerPayload } },
        { returnDocument: 'after' }
      );
      const doc = extractUpdatedDoc(result);
      if (doc) {
        updatedRoom = doc;
        slot = 'player2';
        color = 'yellow';
      }
    }

    if (!updatedRoom || !slot) {
      return sendError(res, 409, 'Failed to join: room filled by another player simultaneously');
    }

    // Log action
    await db.collection('match_actions').insertOne({
      actionId: 'act_' + generateToken(''),
      roomCode: code,
      playerId,
      type: 'PLAYER_JOINED',
      data: { slot, name: trimmedName },
      timestamp: Date.now()
    });

    return sendJson(res, 200, {
      success: true,
      playerId,
      sessionToken,
      slot,
      color,
      room: {
        id: updatedRoom.id,
        code: updatedRoom.code,
        status: updatedRoom.status,
        player1: updatedRoom.player1 ? { id: updatedRoom.player1.id, name: updatedRoom.player1.name, color: 'red' } : null,
        player2: updatedRoom.player2 ? { id: updatedRoom.player2.id, name: updatedRoom.player2.name, color: 'yellow' } : null
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
