const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase } = require('../../../lib/db');
const { verifyPlayerSession, generateToken } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    if (!code) {
      return sendError(res, 400, 'Room code is required');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    const room = await roomsCollection.findOne({ code });
    if (!room) {
      return sendError(res, 404, 'Room not found');
    }

    const authResult = await verifyPlayerSession(req, db, room);
    if (!authResult.valid) {
      return sendError(res, 401, 'Unauthorized: ' + authResult.error);
    }

    const playerId = authResult.playerId;

    // If room is WAITING, vacate the slot
    if (room.status === 'WAITING') {
      const updateField = room.player1?.id === playerId ? { player1: null } : { player2: null };
      await roomsCollection.updateOne({ code }, { $set: updateField });
    }

    // If match was IN_PROGRESS, mark opponent as winner by forfeit
    if (room.status === 'IN_PROGRESS') {
      const isP1 = room.player1?.id === playerId;
      const opponent = isP1 ? room.player2 : room.player1;
      const opponentColor = isP1 ? 'yellow' : 'red';

      if (opponent) {
        await roomsCollection.updateOne(
          { code },
          {
            $set: {
              status: 'COMPLETED',
              winnerId: opponent.id,
              winnerName: opponent.name,
              winnerColor: opponentColor,
              completedAt: Date.now(),
              forfeitedBy: playerId
            }
          }
        );

        await db.collection('game_states').updateOne(
          { roomCode: code },
          {
            $set: {
              status: 'COMPLETED',
              winnerId: opponent.id,
              winnerColor: opponentColor,
              lastAction: {
                type: 'PLAYER_FORFEIT',
                description: `${authResult.user.displayName} left the room. ${opponent.name} wins!`,
                timestamp: Date.now()
              }
            }
          }
        );
      }
    }

    await db.collection('match_actions').insertOne({
      actionId: 'act_' + generateToken(''),
      roomCode: code,
      playerId,
      type: 'PLAYER_LEFT',
      timestamp: Date.now()
    });

    return sendJson(res, 200, { success: true, message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
