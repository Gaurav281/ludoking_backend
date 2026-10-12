# Simple Multiplayer Ludo Room Platform

A functional, lightweight, server-authoritative multiplayer Ludo tournament platform.

## The Problem Solved
Previously, tournament admins had to create rooms in third-party Ludo apps, spend coins or tickets to generate rooms, manually collect entry fees, and ask players to submit screenshots to verify match results.

**This application solves that problem completely:**
- Admins create rooms **for free** (no coins, tickets, or in-app purchases required).
- Admins invite 2 players with a unique 6-character room code.
- Admin starts the match when both players join.
- Official match results are **verified automatically by the backend** and displayed in real time on the Admin Dashboard without requiring screenshots or manual confirmation.

---

## 1. Technology Stack & Architecture

- **Mobile Client:** Flutter (Dart) for Android, Web, and Desktop.
- **Game Engine:** PhaserJS 3 (HTML5 Canvas & JavaScript) with responsive mobile layouts.
- **Backend API:** Vercel-compatible Node.js Serverless Functions in `backend/api/`.
- **Persistent Database:** MongoDB Atlas (with built-in local JSON DB fallback for offline development).
- **Communication:** HTTP REST APIs with periodic database-backed polling (1s during match, 2s in lobby, 2.5s on admin dashboard).
- **Embedded Game:** Dual-platform Flutter WebView (`webview_flutter` on mobile, responsive iframe on web).

```
my game app/
├── backend/                       # Serverless Backend
│   ├── api/                       # Vercel Serverless Route Handlers
│   │   ├── admin/
│   │   │   ├── login.js           # POST /api/admin/login
│   │   │   ├── rooms.js           # GET /api/admin/rooms (Dashboard stats & all rooms)
│   │   │   ├── results.js         # GET /api/admin/results (Verified match results)
│   │   │   └── rooms/[code]/
│   │   │       └── cancel.js      # POST /api/admin/rooms/:code/cancel
│   │   ├── rooms/
│   │   │   ├── index.js           # POST /api/rooms (Create free room)
│   │   │   └── [code]/
│   │   │       ├── index.js       # GET /api/rooms/:code
│   │   │       ├── join.js        # POST /api/rooms/:code/join (Atomic slot claim)
│   │   │       ├── start.js       # POST /api/rooms/:code/start (Admin starts match)
│   │   │       ├── state.js       # GET /api/rooms/:code/state (Authoritative game state)
│   │   │       ├── roll.js        # POST /api/rooms/:code/roll (Server dice roll 1-6)
│   │   │       ├── move.js        # POST /api/rooms/:code/move (Authoritative move & win)
│   │   │       └── leave.js       # POST /api/rooms/:code/leave (Leave / forfeit)
│   ├── lib/
│   │   ├── db.js                  # MongoDB Atlas client + local atomic fallback
│   │   ├── auth.js                # HMAC admin tokens & player session management
│   │   ├── ludoEngine.js          # Authoritative Ludo rules engine
│   │   └── response.js            # CORS & HTTP JSON response helper
│   ├── test-engine.js             # Unit test suite for Ludo rules engine
│   ├── test-api.js                # Integration tests for serverless endpoints
│   ├── test-e2e-match.js          # Full E2E simulation (Admin + 2 Players + Edge Cases)
│   ├── dev-server.js              # Local Express runner for serverless functions
│   └── package.json
│
├── game/                          # PhaserJS Playable Ludo Game
│   ├── index.html                 # Mobile-first game entry
│   ├── css/style.css              # Cyber-slate gaming styling
│   ├── js/
│   │   ├── phaser.min.js          # Bundled Phaser 3.80.1 (offline-ready)
│   │   ├── ludoBoard.js           # 15x15 board geometry & HD graphics
│   │   ├── apiBridge.js           # Polling bridge, Flutter bridge, & Web Audio FX
│   │   └── ludoGame.js            # Phaser scene, token hopping & legal moves
│   └── assets/
│
├── flutter_app/                   # Flutter Mobile & Web Client
│   ├── lib/
│   │   ├── config/api_config.dart # API Base URL configuration & overrides
│   │   ├── models/                # RoomModel, DashboardStats, VerifiedResult
│   │   ├── services/              # ApiService & SessionService (SharedPreferences)
│   │   ├── screens/
│   │   │   ├── role_selection_screen.dart # Role chooser (Admin vs Player)
│   │   │   ├── admin/             # Login, Dashboard, Lobby, All Rooms, Results
│   │   │   └── player/            # Home, Join Room, Player Lobby, Game WebView
│   │   └── widgets/               # StatusBadge, SettingsDialog
│   └── pubspec.yaml
└── vercel.json                    # Vercel deployment configuration
```

---

## 2. Server-Validated Gameplay & Ludo Rules

The client is **never trusted** to determine dice outcomes, movements, turns, or wins.

1. **Yard Release:** A token starts in Yard (`step: -1`). Rolling a **6** is required to enter the track at Tile 0 (Red) or Tile 26 (Yellow).
2. **Clockwise Track:** 52 common tiles (`0..51`).
3. **Safe Squares (8 tiles):**
   - Start tiles: Tile 0 (Red Start), Tile 26 (Yellow Start).
   - Star tiles: Tile 8, 13, 21, 34, 39, 47.
   - Tokens on safe squares cannot be captured.
4. **Captures:** Landing on an opponent token on any non-safe track square captures it, sending it back to Yard, and awards an **extra turn**!
5. **Bonus Turns:**
   - Rolling a 6 awards an extra turn (max 3 consecutive sixes before penalty).
   - Capturing an opponent token awards an extra turn.
   - Moving a token into Home Goal awards an extra turn.
6. **Reaching Home:** Steps 51 to 55 are the colored Home Column; Step 56 is the Home Goal. Exact dice rolls are required.
7. **No Legal Moves:** If dice is rolled and 0 legal moves exist, turn passes automatically to the opponent.
8. **Win Detection:** First player to bring all 4 tokens to Home Goal wins. The backend marks the match `COMPLETED` and saves `winnerId`, `winnerName`, and `completedAt`.

---

## 3. MongoDB Atlas Setup Guide

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free shared M0 cluster.
2. In **Database Access**, create a database user with read/write privileges.
3. In **Network Access**, add IP `0.0.0.0/0` (allow access from anywhere for Vercel functions).
4. Click **Connect** -> **Connect your application** (Node.js driver) and copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. In `backend/.env` (or Vercel Environment Variables):
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=ludo_db
   ADMIN_PASSWORD=admin123
   ADMIN_SECRET=super_secret_ludo_admin_jwt_salt_2026
   PORT=3000
   ```
> *Note:* If `MONGODB_URI` is left blank, the app automatically uses the built-in local persistent JSON database at `backend/.data/local_db.json`.

---

## 4. Vercel Deployment Guide

1. Install the Vercel CLI or deploy via GitHub:
   ```bash
   npm install -g vercel
   ```
2. In the project root directory:
   ```bash
   vercel
   ```
3. Set the environment variables in your Vercel Project Settings:
   - `MONGODB_URI`: Your MongoDB Atlas connection URI.
   - `ADMIN_PASSWORD`: Your secret admin password (e.g. `admin123`).
   - `ADMIN_SECRET`: A random string for HMAC token signing.
4. Deploy to production:
   ```bash
   vercel --prod
   ```
5. Your API endpoints will be live at `https://<your-project>.vercel.app/api/*` and the Phaser game will be at `https://<your-project>.vercel.app/game/index.html`.

---

## 5. Running and Testing Locally

### Start the Backend Dev Server:
```bash
cd backend
npm install
npm run dev
```
The server will start at `http://localhost:3000`:
- **API Base:** `http://localhost:3000/api`
- **Phaser Game:** `http://localhost:3000/game`
- **Flutter Web App:** `http://localhost:3000/app`

### Run Backend Unit & Integration Tests:
```bash
cd backend
node test-engine.js      # Verifies rules engine
node test-api.js         # Verifies REST API endpoints
node test-e2e-match.js   # Verifies full 12-step E2E match flow
```

### Run the Flutter App:
```bash
cd flutter_app
flutter pub get
```
- **Run on Chrome (Web):**
  ```bash
  flutter run -d chrome
  ```
- **Run on Android Emulator / Device:**
  ```bash
  flutter run -d android
  ```
  *(On Android emulator, the app automatically connects to `http://10.0.2.2:3000`)*

---

## 6. How to Test with 2 Players and 1 Admin

You can test the entire workflow using 3 separate browser windows/tabs or devices:

1. **Window 1 (Admin):**
   - Open `http://localhost:3000/app`
   - Select **Tournament Admin Portal** and log in (`admin123`).
   - Click **Create Room**. A 6-character room code appears (e.g. `7DD6GL`).
   - Notice the **Start Match** button is disabled until 2 players join.

2. **Window 2 (Player 1):**
   - Open `http://localhost:3000/app` (or on a mobile device).
   - Select **Player Arena** -> **Join Room**.
   - Enter Room Code `7DD6GL` and Name "Player One".
   - Assigned **Red (Player 1)** in the lobby.

3. **Window 3 (Player 2):**
   - Open `http://localhost:3000/app` in an Incognito window.
   - Select **Player Arena** -> **Join Room**.
   - Enter Room Code `7DD6GL` and Name "Player Two".
   - Assigned **Yellow (Player 2)** in the lobby.

4. **Start Match:**
   - On Window 1 (Admin), the **Start Match** button becomes enabled. Click **Start Match**.
   - Windows 2 & 3 automatically transition to the playable Ludo game!
   - Player 1 rolls the dice, legal tokens glow, tokens hop along the track.
   - Captures and extra turns are handled authoritatively.
   - When a player's tokens reach Home Goal, the victory celebration overlay appears.

5. **Instant Result Verification:**
   - In Window 1 (Admin Dashboard), go to **Verified Results Dashboard**.
   - The verified winner, players, completion timestamp, and match duration appear **automatically without screenshots**!
