/**
 * API Bridge for Simple Multiplayer Ludo
 * Handles HTTP Polling, Action Submissions, Sound FX, and Flutter Bridge
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

    // Web Audio FX
    this.soundEnabled = true;
    this.audioCtx = null;
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

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playSound(type) {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'roll') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'capture') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.25);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'win') {
        // Simple victorious arpeggio
        [440, 554, 659, 880].forEach((freq, i) => {
          const noteOsc = this.audioCtx.createOscillator();
          const noteGain = this.audioCtx.createGain();
          noteOsc.connect(noteGain);
          noteGain.connect(this.audioCtx.destination);
          noteOsc.frequency.value = freq;
          noteGain.gain.setValueAtTime(0.2, now + i * 0.12);
          noteGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25);
          noteOsc.start(now + i * 0.12);
          noteOsc.stop(now + i * 0.12 + 0.25);
        });
      }
    } catch (e) {
      // Audio not permitted or interrupted
    }
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
        // Exponential backoff up to 5s if consecutive errors occur
        const backoff = Math.min(5000, this.pollingInterval * Math.pow(1.5, Math.min(this.consecutiveErrors, 4)));
        this.pollingTimer = setTimeout(() => this.fetchState(), backoff);
      }
    }
  }

  async rollDice() {
    const actionId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    this.playSound('roll');

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
      alert(err.message);
      throw err;
    }
  }

  async moveToken(tokenIndex) {
    const actionId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    this.playSound('move');

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
        if (data.gameState.lastAction?.captured) {
          this.playSound('capture');
        }
        this.latestStateVersion = data.gameState.stateVersion;
        if (this.onStateUpdate) {
          this.onStateUpdate(data.gameState);
        }
      }
      return data;
    } catch (err) {
      console.error('Move error:', err);
      alert(err.message);
      throw err;
    }
  }

  notifyFlutter(eventType, payload) {
    try {
      const msg = JSON.stringify({ type: eventType, data: payload });
      if (window.FlutterGameBridge && typeof window.FlutterGameBridge.postMessage === 'function') {
        window.FlutterGameBridge.postMessage(msg);
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {
      // Flutter bridge not active in standalone browser mode
    }
  }
}

window.ApiBridge = ApiBridge;
