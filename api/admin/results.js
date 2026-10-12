const { handleCors, sendJson, sendError } = require('../../lib/response');
const { connectToDatabase } = require('../../lib/db');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    if (!verifyAdmin(req)) {
      return sendError(res, 401, 'Unauthorized: Admin authorization required');
    }

    const { db } = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    const cursor = await roomsCollection.find({ status: 'COMPLETED' });
    const completedRooms = await cursor.toArray();

    completedRooms.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    const results = completedRooms.map(r => ({
      roomCode: r.code,
      roomId: r.id,
      player1: r.player1 ? r.player1.name : 'Unknown',
      player2: r.player2 ? r.player2.name : 'Unknown',
      winner: r.winnerName || 'Unknown',
      winnerColor: r.winnerColor || 'Unknown',
      winnerId: r.winnerId,
      status: r.status,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationSeconds: r.startedAt && r.completedAt ? Math.round((r.completedAt - r.startedAt) / 1000) : null
    }));

    return sendJson(res, 200, {
      success: true,
      totalCompleted: results.length,
      results
    });
  } catch (error) {
    console.error('Admin get results error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
