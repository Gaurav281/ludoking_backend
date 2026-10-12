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

    const cursor = await roomsCollection.find({});
    const allRooms = await cursor.toArray();

    // Sort descending by creation time
    allRooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Calculate dashboard statistics
    const stats = {
      total: allRooms.length,
      waiting: allRooms.filter(r => r.status === 'WAITING').length,
      inProgress: allRooms.filter(r => r.status === 'IN_PROGRESS').length,
      completed: allRooms.filter(r => r.status === 'COMPLETED').length,
      cancelled: allRooms.filter(r => r.status === 'CANCELLED').length
    };

    return sendJson(res, 200, {
      success: true,
      stats,
      rooms: allRooms
    });
  } catch (error) {
    console.error('Admin get rooms error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
