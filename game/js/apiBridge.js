/**
 * API Bridge for Simple Multiplayer Ludo
 * Handles HTTP Polling, Action Submissions, and Flutter Bridge
 */

class ApiBridge {
  constructor() {
    this.params = this.parseQueryParams();
    this.roomCode = (this.params.roomCode || '').toUpperCase().trim();
    this.playerId = this.params.playerId || '';
    this.sessionToken = this.params.sessionToken || '';
    this.role = this.params.role || 'player'; // 'player' or 'admin'
    this.playerColor = this.params.color || 'red';
    
    // API Base URL config
    this.baseUrl = this.params.apiUrl || (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? window.location.origin : '');
    if (this.baseUrl.endsWith('/')) this.baseUrl = this.baseUrl.slice(0, -1);

    this.pollingInterval = 1000;
    this.pollingTimer = null;
    this.isPolling = false;
    this.consecutiveErrors = 0;
    this.latestStateVersion = 0;
    this.onStateUpdate = null;
    this.onMatchComplete = null;
    this.onError = null;
  }

  parseQueryParams() {
    const search = window.location.search.substring(1);
    if (!search) return {};
    const pairs = search.split('&');
    const result = {};
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      result[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
    return result;
  }

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.fetchState();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  async fetchState() {
    if (!this.isPolling) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/rooms/${this.roomCode}/state`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      this.consecutiveErrors = 0;

      if (data.success && data.gameState) {
        // Only trigger update if stateVersion is newer
        if (data.gameState.stateVersion > this.latestStateVersion) {
          this.latestStateVersion = data.gameState.stateVersion;
          if (this.onStateUpdate) {
            this.onStateUpdate(data.gameState, data.room);
          }
        }

        // Notify Flutter bridge
        this.notifyFlutter('STATE_UPDATE', { gameState: data.gameState, room: data.room });

        if (data.gameState.status === 'COMPLETED') {
          if (this.onMatchComplete) {
            this.onMatchComplete(data.gameState, data.room);
          }
          this.notifyFlutter('MATCH_COMPLETED', {
            winnerId: data.gameState.winnerId,
            winnerColor: data.gameState.winnerColor,
            roomCode: this.roomCode
          });
          this.stopPolling();
          return;
        }
      }
    } catch (err) {
      this.consecutiveErrors++;
      console.warn('Polling error:', err.message);
      if (this.onError) {
        this.onError(err);
      }
    } finally {
      if (this.isPolling) {
        const backoff = Math.min(4000, this.pollingInterval * Math.pow(1.3, Math.min(this.consecutiveErrors, 3)));
        this.pollingTimer = setTimeout(() => this.fetchState(), backoff);
      }
    }
  }

  async rollDice() {
    const actionId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    try {
      const response = await fetch(`${this.baseUrl}/api/rooms/${this.roomCode}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': this.sessionToken,
          'x-player-id': this.playerId
        },
        body: JSON.stringify({
          playerId: this.playerId,
          sessionToken: this.sessionToken,
          stateVersion: this.latestStateVersion,
          actionId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to roll dice');
      }

      if (data.gameState) {
        this.latestStateVersion = data.gameState.stateVersion;
        if (this.onStateUpdate) {
          this.onStateUpdate(data.gameState);
        }
      }
      return data;
    } catch (err) {
      console.error('Roll error:', err);
      // Re-fetch state in case of version mismatch
      this.fetchState();
      throw err;
    }
  }

  async moveToken(tokenIndex) {
    const actionId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    try {
      const response = await fetch(`${this.baseUrl}/api/rooms/${this.roomCode}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': this.sessionToken,
          'x-player-id': this.playerId
        },
        body: JSON.stringify({
          tokenIndex,
          playerId: this.playerId,
          sessionToken: this.sessionToken,
          stateVersion: this.latestStateVersion,
          actionId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to move token');
      }

      if (data.gameState) {
        this.latestStateVersion = data.gameState.stateVersion;
        if (this.onStateUpdate) {
          this.onStateUpdate(data.gameState);
        }
      }
      return data;
    } catch (err) {
      console.error('Move error:', err);
      // Re-fetch state to recover
      this.fetchState();
      throw err;
    }
  }

  notifyFlutter(type, payload = {}) {
    const message = JSON.stringify({ type, ...payload });
    try {
      if (window.FlutterGameBridge && typeof window.FlutterGameBridge.postMessage === 'function') {
        window.FlutterGameBridge.postMessage(message);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ from: 'LudoGame', ...payload, type }, '*');
      }
    } catch (_) {}
  }
}

window.ApiBridge = ApiBridge;
