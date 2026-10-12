const crypto = require('crypto');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ludo_admin_secret_key_2026';
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Generate session tokens
function generateToken(prefix = 'tok_') {
  return prefix + crypto.randomBytes(16).toString('hex');
}

// Generate unpredictable 6-character uppercase room code (e.g. LUD982)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous characters like 0, O, 1, I
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Create admin token
function createAdminToken() {
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(timestamp).digest('hex');
  return `adm_${timestamp}_${signature}`;
}

// Verify admin token
function verifyAdmin(req) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const parts = token.split('_');
  if (parts.length !== 3 || parts[0] !== 'adm') return false;

  const timestamp = parts[1];
  const signature = parts[2];

  // Token expires after 7 days
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', ADMIN_SECRET).update(timestamp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Verify player session in a specific room
async function verifyPlayerSession(req, db, room) {
  const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken || req.query?.sessionToken;
  const playerId = req.headers['x-player-id'] || req.body?.playerId || req.query?.playerId;

  if (!sessionToken || !playerId) {
    return { valid: false, error: 'Missing sessionToken or playerId' };
  }

  // Look up user in database
  const user = await db.collection('users').findOne({ userId: playerId, sessionToken });
  if (!user) {
    return { valid: false, error: 'Invalid player session token' };
  }

  // Check if player is part of this room
  const isP1 = room.player1 && room.player1.id === playerId;
  const isP2 = room.player2 && room.player2.id === playerId;

  if (!isP1 && !isP2) {
    return { valid: false, error: 'Player does not belong to this room' };
  }

  const slot = isP1 ? 'player1' : 'player2';
  const color = isP1 ? 'red' : 'yellow';

  return { valid: true, user, slot, color, playerId };
}

module.exports = {
  ADMIN_DEFAULT_PASSWORD,
  generateToken,
  generateRoomCode,
  createAdminToken,
  verifyAdmin,
  verifyPlayerSession
};
