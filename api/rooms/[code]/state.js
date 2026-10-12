const { handleCors, sendJson, sendError } = require('../../../lib/response');
const { connectToDatabase } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    if (!code) {
      return sendError(res, 400, 'Room code is required');
    }

    const { db } = await connectToDatabase();
    const room = await db.collection('rooms').findOne({ code });

    if (!room) {
      return sendError(res, 404, 'Room not found');
    }

    const gameState = await db.collection('game_states').findOne({ roomCode: code });

    return sendJson(res, 200, {
      success: true,
      roomStatus: room.status,
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        player1: room.player1,
        player2: room.player2,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        winnerColor: room.winnerColor,
        startedAt: room.startedAt,
        completedAt: room.completedAt
      },
      gameState: gameState || null
    });
  } catch (error) {
    console.error('Get state error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
