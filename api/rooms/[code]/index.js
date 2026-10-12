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

    // Sanitize response
    const sanitized = {
      id: room.id,
      code: room.code,
      status: room.status,
      player1: room.player1 ? { id: room.player1.id, name: room.player1.name, color: 'red' } : null,
      player2: room.player2 ? { id: room.player2.id, name: room.player2.name, color: 'yellow' } : null,
      winnerId: room.winnerId,
      winnerName: room.winnerName,
      winnerColor: room.winnerColor,
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      completedAt: room.completedAt
    };

    return sendJson(res, 200, { success: true, room: sanitized });
  } catch (error) {
    console.error('Get room error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
