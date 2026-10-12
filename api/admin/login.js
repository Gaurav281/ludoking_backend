const { handleCors, sendJson, sendError } = require('../../lib/response');
const { createAdminToken, ADMIN_DEFAULT_PASSWORD } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { password } = req.body || {};
    const expectedPassword = process.env.ADMIN_PASSWORD || ADMIN_DEFAULT_PASSWORD;

    if (!password || password !== expectedPassword) {
      return sendError(res, 401, 'Invalid admin password');
    }

    const token = createAdminToken();
    return sendJson(res, 200, {
      success: true,
      token,
      admin: {
        role: 'admin',
        username: 'Tournament Admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return sendError(res, 500, 'Internal server error');
  }
};
