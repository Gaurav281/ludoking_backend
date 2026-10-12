function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-player-id, x-admin-token');
}

function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { success: false, error: message });
}

module.exports = {
  setCorsHeaders,
  handleCors,
  sendJson,
  sendError
};
