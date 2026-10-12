const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static game files directly for seamless local testing
const gamePath = path.join(__dirname, '..', 'game');
app.use('/game', express.static(gamePath));

// Serve Flutter Web application if built
const flutterWebPath = path.join(__dirname, '..', 'flutter_app', 'build', 'web');
const fs = require('fs');
if (fs.existsSync(flutterWebPath)) {
  app.use('/app', express.static(flutterWebPath));
}

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simple Multiplayer Ludo Room Platform</title>
      <style>
        body { font-family: sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 480px; }
        h1 { color: #38bdf8; margin-top: 0; }
        a { display: block; margin: 12px 0; padding: 14px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
        a.secondary { background: #0284c7; }
        p { color: #94a3b8; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🎲 Ludo Tournament Platform</h1>
        <p>Free room creation & server-verified tournament match platform.</p>
        <a href="/app">Launch Flutter Web App (Admin & Player)</a>
        <a href="/game" class="secondary">Launch PhaserJS Game Directly</a>
        <p style="margin-top: 20px;">Backend Serverless REST APIs: <code>/api/*</code></p>
      </div>
    </body>
    </html>
  `);
});

// Helper to adapt Vercel serverless handlers to Express
function adaptVercelHandler(handlerPath, getParams = () => ({})) {
  const handler = require(handlerPath);
  return async (req, res) => {
    req.query = { ...req.query, ...getParams(req) };
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`Error in ${handlerPath}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  };
}

// API Routes
app.post('/api/admin/login', adaptVercelHandler('./api/admin/login.js'));
app.get('/api/admin/rooms', adaptVercelHandler('./api/admin/rooms.js'));
app.get('/api/admin/results', adaptVercelHandler('./api/admin/results.js'));
app.post('/api/admin/rooms/:code/cancel', adaptVercelHandler('./api/admin/rooms/[code]/cancel.js', req => ({ code: req.params.code })));

app.post('/api/rooms', adaptVercelHandler('./api/rooms/index.js'));
app.get('/api/rooms/:code', adaptVercelHandler('./api/rooms/[code]/index.js', req => ({ code: req.params.code })));
app.post('/api/rooms/:code/join', adaptVercelHandler('./api/rooms/[code]/join.js', req => ({ code: req.params.code })));
app.post('/api/rooms/:code/start', adaptVercelHandler('./api/rooms/[code]/start.js', req => ({ code: req.params.code })));
app.get('/api/rooms/:code/state', adaptVercelHandler('./api/rooms/[code]/state.js', req => ({ code: req.params.code })));
app.post('/api/rooms/:code/roll', adaptVercelHandler('./api/rooms/[code]/roll.js', req => ({ code: req.params.code })));
app.post('/api/rooms/:code/move', adaptVercelHandler('./api/rooms/[code]/move.js', req => ({ code: req.params.code })));
app.post('/api/rooms/:code/leave', adaptVercelHandler('./api/rooms/[code]/leave.js', req => ({ code: req.params.code })));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    storage: process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Local Persistent JSON'
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Ludo Serverless API Dev Server running on port ${PORT}`);
  console.log(` Base API URL: http://localhost:${PORT}/api`);
  console.log(` Phaser Game URL: http://localhost:${PORT}/game`);
  console.log(` Storage: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Local Persistent DB (.data/local_db.json)'}`);
  console.log(`====================================================`);
});
