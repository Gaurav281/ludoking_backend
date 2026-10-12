const { handleCors, sendJson, sendError } = require('../../../../lib/response');
const { connectToDatabase } = require('../../../../lib/db');
const { verifyAdmin, generateToken } = require('../../../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    if (!verifyAdmin(req)) {
      return sendError(res, 401, 'Unauthorized: Admin authorization required');
    }

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

    if (room.status === 'COMPLETED') {
      return sendError(res, 400, 'Cannot cancel a completed match');
    }

    await roomsCollection.updateOne(
      { code },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: Date.now()
        }
      }
    );

    await db.collection('match_actions').insertOne({
      actionId: 'act_' + generateToken(''),
      roomCode: code,
      playerId: 'admin',
      type: 'ROOM_CANCELLED',
      timestamp: Date.now()
    });

    return sendJson(res, 200, {
      success: true,
      message: 'Room cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel room error:', error);
    return sendError(res, 500, 'Internal server error: ' + error.message);
  }
};
