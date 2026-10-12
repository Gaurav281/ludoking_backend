/**
 * Main Phaser 3 Ludo Game Scene
 * Responsive, Anti-Stacking, Accurate Touch Targeting
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
    this.tokenBounceTweens = [];
    this.gameState = null;
    this.bridge = null;
  }

  create() {
    this.bridge = window.bridge;
    this.calculateDimensions();

    // 1. Draw Board Graphics
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

    // Responsive board size with balanced margin
    this.boardSize = Math.floor(minDim * 0.94);
    this.cellSize = this.boardSize / 15;
    this.boardX = Math.floor((width - this.boardSize) / 2);
    this.boardY = Math.floor((height - this.boardSize) / 2);
  }

  handleResize() {
    this.calculateDimensions();
    window.LudoBoard.drawLudoBoard(this.boardGraphics, this, this.boardX, this.boardY, this.boardSize);
    this.refreshAllTokenPositions();
    this.highlightLegalMoves();
  }

  createTokenSprites() {
    ['red', 'yellow'].forEach(color => {
      for (let i = 0; i < 4; i++) {
        const container = this.add.container(0, 0);

        // Accurate centered circular hitArea matching finger touch radius
        const hitRadius = Math.max(18, this.cellSize * 0.48);
        container.setInteractive(
          new Phaser.Geom.Circle(0, 0, hitRadius),
          Phaser.Geom.Circle.Contains
        );
        if (container.input) {
          container.input.cursor = 'pointer';
        }

        // Token shadow
        const shadow = this.add.circle(2, 3, this.cellSize * 0.36, 0x000000, 0.45);

        // Token outer rim
        const rimColor = color === 'red' ? 0x991b1b : 0xb45309;
        const rim = this.add.circle(0, 0, this.cellSize * 0.38, rimColor);

        // Token body
        const fillColor = color === 'red' ? 0xef4444 : 0xf59e0b;
        const body = this.add.circle(0, 0, this.cellSize * 0.32, fillColor);

        // Token glossy shine
        const shine = this.add.circle(-this.cellSize * 0.08, -this.cellSize * 0.08, this.cellSize * 0.12, 0xffffff, 0.55);

        // Token number label (1..4)
        const text = this.add.text(0, 0, `${i + 1}`, {
          fontSize: `${Math.round(this.cellSize * 0.36)}px`,
          fontStyle: 'bold',
          color: color === 'red' ? '#ffffff' : '#78350f'
        }).setOrigin(0.5);

        container.add([shadow, rim, body, shine, text]);
        container.setDepth(15 + i);

        // Click handler
        container.on('pointerdown', (pointer) => {
          this.handleTokenClick(color, i);
        });

        this.tokens[color].push({
          container,
          color,
          index: i,
          currentStep: -1,
          scale: 1.0
        });
      }
    });

    this.refreshAllTokenPositions();
  }

  /**
   * Calculates cell grouping and anti-stacking offsets for all tokens
   */
  calculateTokenLayoutMap() {
    const layoutMap = new Map();

    // Group all 8 tokens by their cell key
    ['red', 'yellow'].forEach(color => {
      this.tokens[color].forEach(tok => {
        const key = window.LudoBoard.getCellKey(color, tok.currentStep, tok.index);
        if (!layoutMap.has(key)) {
          layoutMap.set(key, []);
        }
        layoutMap.get(key).push(tok);
      });
    });

    return layoutMap;
  }

  refreshAllTokenPositions() {
    const layoutMap = this.calculateTokenLayoutMap();

    layoutMap.forEach((tokensInCell) => {
      const count = tokensInCell.length;
      tokensInCell.forEach((tok, slotIndex) => {
        const pos = window.LudoBoard.getTokenPixelPositionWithOffset(
          tok.color,
          tok.currentStep,
          tok.index,
          this.boardX,
          this.boardY,
          this.cellSize,
          slotIndex,
          count
        );

        tok.container.setPosition(pos.x, pos.y);
        tok.container.setScale(pos.scale);
        tok.scale = pos.scale;
      });
    });
  }

  handleStateUpdate(state) {
    this.gameState = state;
    this.updateDomUI(state);

    // Update tokens & animate movements
    const layoutMap = new Map();
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

    // Re-layout tokens that are stationary
    this.refreshAllTokenPositions();
    this.highlightLegalMoves();
  }

  animateTokenMove(tokenObj, fromStep, toStep) {
    // Hop scale tween
    this.tweens.add({
      targets: tokenObj.container,
      scaleX: tokenObj.scale * 1.35,
      scaleY: tokenObj.scale * 1.35,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeInOut'
    });

    // Destination position
    const targetPos = window.LudoBoard.getTokenPixelPosition(
      tokenObj.color,
      toStep,
      tokenObj.index,
      this.boardX,
      this.boardY,
      this.cellSize
    );

    this.tweens.add({
      targets: tokenObj.container,
      x: targetPos.x,
      y: targetPos.y,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.refreshAllTokenPositions();
        this.highlightLegalMoves();
      }
    });
  }

  highlightLegalMoves() {
    // Clear old highlights & bounce tweens
    this.tokenHighlights.forEach(h => h.destroy());
    this.tokenHighlights = [];

    this.tokenBounceTweens.forEach(t => t.stop());
    this.tokenBounceTweens = [];

    // Reset depths
    ['red', 'yellow'].forEach(color => {
      this.tokens[color].forEach((t, i) => {
        t.container.setDepth(15 + i);
      });
    });

    if (!this.gameState || this.gameState.status !== 'IN_PROGRESS') return;

    const isMyTurn = this.gameState.currentTurnPlayerId === this.bridge.playerId;
    if (!isMyTurn || !this.gameState.mustMove || !this.gameState.legalMoves) return;

    const myColor = this.gameState.currentTurnColor;
    const legalTokenIndices = this.gameState.legalMoves.map(m => m.tokenIndex);

    legalTokenIndices.forEach(idx => {
      const tok = this.tokens[myColor][idx];
      if (!tok) return;

      // Bring legal token above other objects
      tok.container.setDepth(80 + idx);

      // Neon Purple/Gold Glowing Ring
      const ring = this.add.circle(tok.container.x, tok.container.y, this.cellSize * 0.48);
      ring.setStrokeStyle(3.5, 0xa855f7, 1);
      ring.setDepth(79);

      this.tweens.add({
        targets: ring,
        scale: 1.28,
        alpha: 0.35,
        duration: 550,
        yoyo: true,
        repeat: -1
      });

      // Gentle hopping bounce on legal token
      const bounce = this.tweens.add({
        targets: tok.container,
        y: tok.container.y - 4,
        duration: 320,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.tokenHighlights.push(ring);
      this.tokenBounceTweens.push(bounce);
    });
  }

  /**
   * Intelligently handles token tap with multi-token stacking support
   */
  handleTokenClick(color, tokenIndex) {
    if (!this.gameState || this.gameState.status !== 'IN_PROGRESS') return;

    const isMyTurn = this.gameState.currentTurnPlayerId === this.bridge.playerId;
    if (!isMyTurn) {
      this.showHint("Wait for your turn");
      return;
    }

    if (!this.gameState.mustMove) {
      this.showHint("Roll the dice first");
      return;
    }

    const legalMoves = this.gameState.legalMoves || [];
    if (legalMoves.length === 0) {
      return;
    }

    const myColor = this.gameState.currentTurnColor;

    // Check if the directly clicked token is legal
    const directLegal = legalMoves.some(m => m.tokenIndex === tokenIndex && color === myColor);
    if (directLegal) {
      this.bridge.moveToken(tokenIndex);
      return;
    }

    // Check if another token of this player on the SAME CELL is legal
    const clickedTok = this.tokens[color][tokenIndex];
    if (clickedTok) {
      const clickedKey = window.LudoBoard.getCellKey(color, clickedTok.currentStep, tokenIndex);
      const legalOnSameCell = legalMoves.find(m => {
        const legalTok = this.tokens[myColor][m.tokenIndex];
        if (!legalTok) return false;
        return window.LudoBoard.getCellKey(myColor, legalTok.currentStep, legalTok.index) === clickedKey;
      });

      if (legalOnSameCell) {
        this.bridge.moveToken(legalOnSameCell.tokenIndex);
        return;
      }
    }

    // If player has ONLY 1 legal move on the entire board, execute it smoothly
    if (legalMoves.length === 1 && color === myColor) {
      this.bridge.moveToken(legalMoves[0].tokenIndex);
      return;
    }

    // Token cannot move: gentle shake animation (no blocking alert)
    if (clickedTok) {
      this.tweens.add({
        targets: clickedTok.container,
        x: clickedTok.container.x + 4,
        duration: 60,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut'
      });
      this.showHint(`Cannot move Token ${tokenIndex + 1} with a ${this.gameState.diceRoll}`);
    }
  }

  showHint(msg) {
    const hint = document.getElementById('action-hint');
    if (hint) {
      hint.textContent = msg;
    }
  }

  handleMatchComplete(state) {
    const overlay = document.getElementById('victory-modal');
    const winnerNameEl = document.getElementById('winner-name');

    if (overlay && winnerNameEl) {
      const winnerName = state.players[state.winnerColor]?.name || 'Player';
      winnerNameEl.textContent = `${winnerName} (${state.winnerColor.toUpperCase()})`;
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
      if (isMyTurn) {
        turnPill.textContent = 'YOUR TURN';
        turnPill.className = 'turn-pill active-turn';
      } else {
        turnPill.textContent = `${turnColor.toUpperCase()}'S TURN`;
        turnPill.className = `turn-pill ${turnColor}`;
      }
    }

    const turnPlayerEl = document.getElementById('turn-player-name');
    if (turnPlayerEl) {
      turnPlayerEl.textContent = isMyTurn ? 'You' : turnPlayerName;
    }

    // Action Hint with simple English
    const actionHint = document.getElementById('action-hint');
    if (actionHint) {
      if (state.status === 'COMPLETED') {
        actionHint.textContent = `Winner: ${state.players[state.winnerColor]?.name}`;
      } else if (isMyTurn) {
        if (!state.diceRolled) {
          actionHint.textContent = 'Your turn! Tap dice to roll';
        } else if (state.mustMove) {
          actionHint.textContent = `Rolled ${state.diceRoll}! Tap glowing token to move`;
        }
      } else {
        actionHint.textContent = `Waiting for ${turnPlayerName}...`;
      }
    }

    // Update Dice face and button state
    const diceBtn = document.getElementById('dice-btn');
    if (diceBtn) {
      const canRoll = isMyTurn && !state.diceRolled;
      diceBtn.disabled = !canRoll && !(isMyTurn && state.mustMove && state.legalMoves?.length === 1);
      
      if (canRoll) {
        diceBtn.classList.add('pulse-active');
      } else {
        diceBtn.classList.remove('pulse-active');
      }

      if (state.diceRoll) {
        this.renderDicePips(state.diceRoll);
      }
    }
  }

  renderDicePips(value) {
    const face = document.getElementById('dice-face');
    if (!face) return;
    face.innerHTML = '';

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
