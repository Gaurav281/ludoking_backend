/**
 * Main Phaser 3 Ludo Game Scene
 */

class LudoScene extends Phaser.Scene {
  constructor() {
    super('LudoScene');
    this.boardSize = 480;
    this.boardX = 0;
    this.boardY = 0;
    this.cellSize = 32;

    this.tokens = {
      red: [],
      yellow: []
    };

    this.tokenHighlights = [];
    this.gameState = null;
    this.bridge = null;
    this.isRollingAnim = false;
  }

  create() {
    this.bridge = window.bridge;
    this.calculateDimensions();

    // 1. Draw Board
    this.boardGraphics = this.add.graphics();
    window.LudoBoard.drawLudoBoard(this.boardGraphics, this, this.boardX, this.boardY, this.boardSize);

    // 2. Create Token GameObjects
    this.createTokenSprites();

    // 3. Connect API Bridge Listener
    if (this.bridge) {
      this.bridge.onStateUpdate = (gameState, room) => this.handleStateUpdate(gameState, room);
      this.bridge.onMatchComplete = (gameState, room) => this.handleMatchComplete(gameState, room);
      this.bridge.startPolling();
    }

    // Handle responsive window resize
    this.scale.on('resize', this.handleResize, this);
  }

  calculateDimensions() {
    const width = this.scale.width;
    const height = this.scale.height;
    const minDim = Math.min(width, height);

    // Leave a small margin
    this.boardSize = Math.floor(minDim * 0.94);
    this.cellSize = this.boardSize / 15;
    this.boardX = Math.floor((width - this.boardSize) / 2);
    this.boardY = Math.floor((height - this.boardSize) / 2);
  }

  handleResize() {
    this.calculateDimensions();
    window.LudoBoard.drawLudoBoard(this.boardGraphics, this, this.boardX, this.boardY, this.boardSize);
    this.refreshAllTokenPositions();
  }

  createTokenSprites() {
    ['red', 'yellow'].forEach(color => {
      for (let i = 0; i < 4; i++) {
        const container = this.add.container(0, 0);
        container.setSize(this.cellSize * 0.85, this.cellSize * 0.85);
        container.setInteractive({ useHandCursor: true });

        // Token shadow
        const shadow = this.add.circle(2, 3, this.cellSize * 0.35, 0x000000, 0.4);

        // Token outer rim
        const rimColor = color === 'red' ? 0xb91c1c : 0xb45309;
        const rim = this.add.circle(0, 0, this.cellSize * 0.36, rimColor);

        // Token body
        const fillColor = color === 'red' ? 0xef4444 : 0xfbbf24;
        const body = this.add.circle(0, 0, this.cellSize * 0.3, fillColor);

        // Token inner shiny highlight
        const shine = this.add.circle(-this.cellSize * 0.08, -this.cellSize * 0.08, this.cellSize * 0.12, 0xffffff, 0.6);

        // Token number label (1..4)
        const text = this.add.text(0, 0, `${i + 1}`, {
          fontSize: `${Math.round(this.cellSize * 0.35)}px`,
          fontStyle: 'bold',
          color: color === 'red' ? '#ffffff' : '#78350f'
        }).setOrigin(0.5);

        container.add([shadow, rim, body, shine, text]);
        container.setDepth(10 + i);

        // Token click handler
        container.on('pointerdown', () => this.handleTokenClick(color, i));

        this.tokens[color].push({
          container,
          color,
          index: i,
          currentStep: -1
        });
      }
    });

    this.refreshAllTokenPositions();
  }

  refreshAllTokenPositions() {
    ['red', 'yellow'].forEach(color => {
      this.tokens[color].forEach(tok => {
        const pos = window.LudoBoard.getTokenPixelPosition(
          color,
          tok.currentStep,
          tok.index,
          this.boardX,
          this.boardY,
          this.cellSize
        );
        tok.container.setPosition(pos.x, pos.y);
      });
    });
  }

  handleStateUpdate(state) {
    this.gameState = state;
    this.updateDomUI(state);

    // Animate token moves
    ['red', 'yellow'].forEach(color => {
      const serverTokens = state.players[color].tokens;
      this.tokens[color].forEach((tok, i) => {
        const prevStep = tok.currentStep;
        const newStep = serverTokens[i];

        if (prevStep !== newStep) {
          tok.currentStep = newStep;
          this.animateTokenMove(tok, prevStep, newStep);
        }
      });
    });

    this.highlightLegalMoves();
  }

  animateTokenMove(tokenObj, fromStep, toStep) {
    const targetPos = window.LudoBoard.getTokenPixelPosition(
      tokenObj.color,
      toStep,
      tokenObj.index,
      this.boardX,
      this.boardY,
      this.cellSize
    );

    // Hop animation
    this.tweens.add({
      targets: tokenObj.container,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeInOut'
    });

    this.tweens.add({
      targets: tokenObj.container,
      x: targetPos.x,
      y: targetPos.y,
      duration: 380,
      ease: 'Cubic.easeOut'
    });
  }

  highlightLegalMoves() {
    // Clear old highlights
    this.tokenHighlights.forEach(h => h.destroy());
    this.tokenHighlights = [];

    if (!this.gameState || this.gameState.status !== 'IN_PROGRESS') return;

    // Check if it's THIS user's turn
    const isMyTurn = this.gameState.currentTurnPlayerId === this.bridge.playerId;
    if (!isMyTurn || !this.gameState.mustMove || !this.gameState.legalMoves) return;

    const myColor = this.gameState.currentTurnColor;
    const legalTokenIndices = this.gameState.legalMoves.map(m => m.tokenIndex);

    legalTokenIndices.forEach(idx => {
      const tok = this.tokens[myColor][idx];
      if (!tok) return;

      const ring = this.add.circle(tok.container.x, tok.container.y, this.cellSize * 0.45);
      ring.setStrokeStyle(3, 0xfacc15, 1);
      ring.setDepth(9);

      this.tweens.add({
        targets: ring,
        scale: 1.25,
        alpha: 0.3,
        duration: 650,
        yoyo: true,
        repeat: -1
      });

      this.tokenHighlights.push(ring);
    });
  }

  handleTokenClick(color, tokenIndex) {
    if (!this.gameState || this.gameState.status !== 'IN_PROGRESS') return;

    const isMyTurn = this.gameState.currentTurnPlayerId === this.bridge.playerId;
    if (!isMyTurn) {
      return;
    }

    if (!this.gameState.mustMove) {
      alert("Please roll the dice first!");
      return;
    }

    const isLegal = this.gameState.legalMoves.some(m => m.tokenIndex === tokenIndex);
    if (!isLegal) {
      alert("This token cannot legally move with the current dice roll.");
      return;
    }

    // Submit move
    this.bridge.moveToken(tokenIndex);
  }

  handleMatchComplete(state) {
    const overlay = document.getElementById('victory-modal');
    const winnerNameEl = document.getElementById('winner-name');
    const winnerColorEl = document.getElementById('winner-color');

    if (overlay && winnerNameEl) {
      const winnerName = state.players[state.winnerColor]?.name || 'Player';
      winnerNameEl.textContent = winnerName;
      if (winnerColorEl) {
        winnerColorEl.textContent = state.winnerColor.toUpperCase();
      }
      overlay.classList.add('active');
    }
  }

  updateDomUI(state) {
    const isMyTurn = state.currentTurnPlayerId === this.bridge.playerId;
    const turnColor = state.currentTurnColor;
    const turnPlayerName = state.players[turnColor]?.name || 'Player';

    // Header player info
    const myPlayer = state.players[this.bridge.playerColor];
    if (myPlayer) {
      const pName = document.getElementById('current-player-name');
      if (pName) pName.textContent = myPlayer.name;
    }

    // Turn pill
    const turnPill = document.getElementById('turn-pill');
    if (turnPill) {
      turnPill.textContent = `${turnColor.toUpperCase()}'S TURN`;
      turnPill.className = `turn-pill ${turnColor}`;
    }

    const turnPlayerEl = document.getElementById('turn-player-name');
    if (turnPlayerEl) {
      turnPlayerEl.textContent = turnPlayerName;
    }

    // Action Hint
    const actionHint = document.getElementById('action-hint');
    if (actionHint) {
      if (state.status === 'COMPLETED') {
        actionHint.textContent = `Match Finished! Winner: ${state.players[state.winnerColor]?.name}`;
      } else if (isMyTurn) {
        if (!state.diceRolled) {
          actionHint.textContent = 'Your Turn! Tap the dice to roll.';
        } else if (state.mustMove) {
          actionHint.textContent = `Rolled a ${state.diceRoll}! Tap a highlighted token to move.`;
        }
      } else {
        actionHint.textContent = `Waiting for ${turnPlayerName} to ${state.mustMove ? 'move' : 'roll'}...`;
      }
    }

    // Update Dice face and button state
    const diceBtn = document.getElementById('dice-btn');
    if (diceBtn) {
      diceBtn.disabled = !isMyTurn || (state.diceRolled && state.mustMove);
      if (state.diceRoll) {
        this.renderDicePips(state.diceRoll);
      }
    }
  }

  renderDicePips(value) {
    const face = document.getElementById('dice-face');
    if (!face) return;
    face.innerHTML = '';

    // Standard 3x3 pip layouts
    const layouts = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const pips = layouts[value] || [4];
    face.style.gridTemplateColumns = 'repeat(3, 1fr)';
    face.style.gridTemplateRows = 'repeat(3, 1fr)';

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      if (pips.includes(i)) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        cell.appendChild(pip);
      }
      face.appendChild(cell);
    }
  }
}

window.LudoScene = LudoScene;
