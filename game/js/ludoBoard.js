/**
 * Ludo Board Coordinate System and Geometry
 * 15x15 Grid Layout - Cyber Purple & Black HD Theme
 */

const LUDO_COORDINATES = {
  // Main loop track: 52 tiles indexed 0 to 51
  track: [
    { c: 1, r: 6 },  // 0  Red Start [SAFE]
    { c: 2, r: 6 },  // 1
    { c: 3, r: 6 },  // 2
    { c: 4, r: 6 },  // 3
    { c: 5, r: 6 },  // 4
    { c: 6, r: 5 },  // 5
    { c: 6, r: 4 },  // 6
    { c: 6, r: 3 },  // 7
    { c: 6, r: 2 },  // 8  [SAFE]
    { c: 6, r: 1 },  // 9
    { c: 6, r: 0 },  // 10
    { c: 7, r: 0 },  // 11
    { c: 8, r: 0 },  // 12
    { c: 8, r: 1 },  // 13 [SAFE]
    { c: 8, r: 2 },  // 14
    { c: 8, r: 3 },  // 15
    { c: 8, r: 4 },  // 16
    { c: 8, r: 5 },  // 17
    { c: 9, r: 6 },  // 18
    { c: 10, r: 6 }, // 19
    { c: 11, r: 6 }, // 20
    { c: 12, r: 6 }, // 21 [SAFE]
    { c: 13, r: 6 }, // 22
    { c: 14, r: 6 }, // 23
    { c: 14, r: 7 }, // 24
    { c: 14, r: 8 }, // 25
    { c: 13, r: 8 }, // 26 Yellow Start [SAFE]
    { c: 12, r: 8 }, // 27
    { c: 11, r: 8 }, // 28
    { c: 10, r: 8 }, // 29
    { c: 9, r: 8 },  // 30
    { c: 8, r: 9 },  // 31
    { c: 8, r: 10 }, // 32
    { c: 8, r: 11 }, // 33
    { c: 8, r: 12 }, // 34 [SAFE]
    { c: 8, r: 13 }, // 35
    { c: 8, r: 14 }, // 36
    { c: 7, r: 14 }, // 37
    { c: 6, r: 14 }, // 38
    { c: 6, r: 13 }, // 39 [SAFE]
    { c: 6, r: 12 }, // 40
    { c: 6, r: 11 }, // 41
    { c: 6, r: 10 }, // 42
    { c: 6, r: 9 },  // 43
    { c: 5, r: 8 },  // 44
    { c: 4, r: 8 },  // 45
    { c: 3, r: 8 },  // 46
    { c: 2, r: 8 },  // 47 [SAFE]
    { c: 1, r: 8 },  // 48
    { c: 0, r: 8 },  // 49
    { c: 0, r: 7 },  // 50
    { c: 0, r: 6 }   // 51
  ],

  // Red Home Column (steps 51 to 55) & Goal (step 56)
  redHome: [
    { c: 1, r: 7 }, // step 51
    { c: 2, r: 7 }, // step 52
    { c: 3, r: 7 }, // step 53
    { c: 4, r: 7 }, // step 54
    { c: 5, r: 7 }, // step 55
    { c: 6.8, r: 7 } // step 56 (Center Goal)
  ],

  // Yellow Home Column (steps 51 to 55) & Goal (step 56)
  yellowHome: [
    { c: 13, r: 7 }, // step 51
    { c: 12, r: 7 }, // step 52
    { c: 11, r: 7 }, // step 53
    { c: 10, r: 7 }, // step 54
    { c: 9, r: 7 },  // step 55
    { c: 7.2, r: 7 } // step 56 (Center Goal)
  ],

  // Yards (Home Base tokens)
  yards: {
    red: [
      { c: 1.5, r: 1.5 },
      { c: 3.5, r: 1.5 },
      { c: 1.5, r: 3.5 },
      { c: 3.5, r: 3.5 }
    ],
    yellow: [
      { c: 10.5, r: 10.5 },
      { c: 12.5, r: 10.5 },
      { c: 10.5, r: 12.5 },
      { c: 12.5, r: 12.5 }
    ]
  },

  safeTiles: [0, 8, 13, 21, 26, 34, 39, 47]
};

/**
 * Returns a unique string key representing the board square a token is on.
 */
function getCellKey(color, step, tokenIndex) {
  if (step === -1) {
    return `yard_${color}_${tokenIndex}`;
  }
  if (step >= 0 && step <= 50) {
    const startTile = color === 'red' ? 0 : 26;
    const tileIndex = (startTile + step) % 52;
    return `track_${tileIndex}`;
  }
  if (step >= 51 && step <= 55) {
    return `home_${color}_${step}`;
  }
  if (step === 56) {
    return `goal_${color}`;
  }
  return `cell_${color}_${step}_${tokenIndex}`;
}

/**
 * Calculates base pixel coordinates for a token
 */
function getTokenPixelPosition(color, step, tokenIndex, boardX, boardY, cellSize) {
  // In yard
  if (step === -1) {
    const yardCoord = LUDO_COORDINATES.yards[color][tokenIndex];
    return {
      x: boardX + yardCoord.c * cellSize + cellSize / 2,
      y: boardY + yardCoord.r * cellSize + cellSize / 2
    };
  }

  // Common track (0..50)
  if (step >= 0 && step <= 50) {
    const startTile = color === 'red' ? 0 : 26;
    const tileIndex = (startTile + step) % 52;
    const coord = LUDO_COORDINATES.track[tileIndex];
    return {
      x: boardX + coord.c * cellSize + cellSize / 2,
      y: boardY + coord.r * cellSize + cellSize / 2
    };
  }

  // Home Column & Goal (51..56)
  if (step >= 51 && step <= 56) {
    const homeArray = color === 'red' ? LUDO_COORDINATES.redHome : LUDO_COORDINATES.yellowHome;
    const coord = homeArray[step - 51];
    return {
      x: boardX + coord.c * cellSize + cellSize / 2,
      y: boardY + coord.r * cellSize + cellSize / 2
    };
  }

  return { x: boardX, y: boardY };
}

/**
 * Calculates pixel coordinates with anti-stacking offsets when multiple tokens occupy the same square
 */
function getTokenPixelPositionWithOffset(color, step, tokenIndex, boardX, boardY, cellSize, slotIndex = 0, totalSlots = 1) {
  const base = getTokenPixelPosition(color, step, tokenIndex, boardX, boardY, cellSize);
  if (totalSlots <= 1 || step === -1) {
    return { x: base.x, y: base.y, scale: 1.0 };
  }

  const d = cellSize * 0.22;
  if (totalSlots === 2) {
    if (slotIndex === 0) return { x: base.x - d, y: base.y - d, scale: 0.82 };
    return { x: base.x + d, y: base.y + d, scale: 0.82 };
  }
  if (totalSlots === 3) {
    if (slotIndex === 0) return { x: base.x - d, y: base.y - d, scale: 0.74 };
    if (slotIndex === 1) return { x: base.x + d, y: base.y - d, scale: 0.74 };
    return { x: base.x, y: base.y + d, scale: 0.74 };
  }
  // 4 or more
  const offsets = [
    { x: -d, y: -d },
    { x: d, y: -d },
    { x: -d, y: d },
    { x: d, y: d }
  ];
  const off = offsets[slotIndex % 4];
  return { x: base.x + off.x, y: base.y + off.y, scale: 0.68 };
}

/**
 * Render the modern White, Purple, Black HD Ludo board
 */
function drawLudoBoard(graphics, scene, boardX, boardY, boardSize) {
  const cellSize = boardSize / 15;
  graphics.clear();

  // Outer Border & Glow Frame
  graphics.fillStyle(0x09090b, 1);
  graphics.fillRoundedRect(boardX - 6, boardY - 6, boardSize + 12, boardSize + 12, 18);
  graphics.lineStyle(2, 0x2e2a44, 0.8);
  graphics.strokeRoundedRect(boardX - 6, boardY - 6, boardSize + 12, boardSize + 12, 18);

  // Board Base
  graphics.fillStyle(0x14131b, 1);
  graphics.fillRoundedRect(boardX, boardY, boardSize, boardSize, 14);

  // Yard Bases (6x6 cells each)
  const drawYardBase = (c, r, bgColor, borderColor, isInactive = false) => {
    const x = boardX + c * cellSize;
    const y = boardY + r * cellSize;
    const w = 6 * cellSize;

    if (isInactive) {
      // Sleek Dark Obsidian Corner with subtle purple accent
      graphics.fillStyle(0x181724, 1);
      graphics.fillRoundedRect(x + 4, y + 4, w - 8, w - 8, 12);
      graphics.lineStyle(1, 0x2e2a44, 0.5);
      graphics.strokeRoundedRect(x + 4, y + 4, w - 8, w - 8, 12);

      graphics.fillStyle(0x12111a, 0.8);
      graphics.fillRoundedRect(x + cellSize * 1, y + cellSize * 1, w - cellSize * 2, w - cellSize * 2, 10);
      return;
    }

    // Active player yard
    graphics.fillStyle(bgColor, 1);
    graphics.fillRoundedRect(x + 4, y + 4, w - 8, w - 8, 12);

    // Inner White Container
    graphics.fillStyle(0xffffff, 0.96);
    graphics.fillRoundedRect(x + cellSize * 1, y + cellSize * 1, w - cellSize * 2, w - cellSize * 2, 10);

    // 4 Token Sockets
    graphics.fillStyle(borderColor, 0.18);
    graphics.lineStyle(2, borderColor, 0.85);
    
    const socketPositions = [
      { ox: 1.5, oy: 1.5 },
      { ox: 3.5, oy: 1.5 },
      { ox: 1.5, oy: 3.5 },
      { ox: 3.5, oy: 3.5 }
    ];

    socketPositions.forEach(pos => {
      const sx = x + pos.ox * cellSize + cellSize / 2;
      const sy = y + pos.oy * cellSize + cellSize / 2;
      graphics.fillCircle(sx, sy, cellSize * 0.42);
      graphics.strokeCircle(sx, sy, cellSize * 0.42);
    });
  };

  // Red Yard (Top Left - Active Player 1)
  drawYardBase(0, 0, 0xef4444, 0xdc2626, false);

  // Decorative Top Right (Inactive)
  drawYardBase(9, 0, 0x1e1b2e, 0x2e2a44, true);

  // Decorative Bottom Left (Inactive)
  drawYardBase(0, 9, 0x1e1b2e, 0x2e2a44, true);

  // Yellow Yard (Bottom Right - Active Player 2)
  drawYardBase(9, 9, 0xf59e0b, 0xd97706, false);

  // Draw Grid Tiles (Common Track)
  LUDO_COORDINATES.track.forEach((tile, index) => {
    const tx = boardX + tile.c * cellSize;
    const ty = boardY + tile.r * cellSize;

    let fillColor = 0xffffff;
    let alpha = 0.98;

    // Red start tile
    if (index === 0) {
      fillColor = 0xfecaca;
    }
    // Yellow start tile
    else if (index === 26) {
      fillColor = 0xfef08a;
    }
    // Safe star tiles - Sleek lavender / purple star
    else if (LUDO_COORDINATES.safeTiles.includes(index)) {
      fillColor = 0xf3e8ff; // Soft purple tint
    }

    graphics.fillStyle(fillColor, alpha);
    graphics.lineStyle(1, 0xd4d4d8, 0.8);
    graphics.fillRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);
    graphics.strokeRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);

    // Draw Royal Purple Star on safe tiles
    if (LUDO_COORDINATES.safeTiles.includes(index)) {
      graphics.fillStyle(0x7c3aed, 1);
      const cx = tx + cellSize / 2;
      const cy = ty + cellSize / 2;
      const r = cellSize * 0.22;
      drawStarShape(graphics, cx, cy, 5, r, r * 0.45);
    }
  });

  // Draw Red Home Column (steps 51..55)
  for (let i = 0; i < 5; i++) {
    const tile = LUDO_COORDINATES.redHome[i];
    const tx = boardX + tile.c * cellSize;
    const ty = boardY + tile.r * cellSize;
    graphics.fillStyle(0xef4444, 1);
    graphics.lineStyle(1, 0xb91c1c, 0.9);
    graphics.fillRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);
    graphics.strokeRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);
  }

  // Draw Yellow Home Column (steps 51..55)
  for (let i = 0; i < 5; i++) {
    const tile = LUDO_COORDINATES.yellowHome[i];
    const tx = boardX + tile.c * cellSize;
    const ty = boardY + tile.r * cellSize;
    graphics.fillStyle(0xf59e0b, 1);
    graphics.lineStyle(1, 0xb45309, 0.9);
    graphics.fillRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);
    graphics.strokeRoundedRect(tx + 1, ty + 1, cellSize - 2, cellSize - 2, 4);
  }

  // Draw Center Home Triangles (Goal: 6,6 to 8,8)
  const cx = boardX + 7.5 * cellSize;
  const cy = boardY + 7.5 * cellSize;

  // Center Red Triangle (Left)
  graphics.fillStyle(0xdc2626, 1);
  graphics.beginPath();
  graphics.moveTo(boardX + 6 * cellSize, boardY + 6 * cellSize);
  graphics.lineTo(cx, cy);
  graphics.lineTo(boardX + 6 * cellSize, boardY + 9 * cellSize);
  graphics.closePath();
  graphics.fillPath();

  // Center Yellow Triangle (Right)
  graphics.fillStyle(0xd97706, 1);
  graphics.beginPath();
  graphics.moveTo(boardX + 9 * cellSize, boardY + 6 * cellSize);
  graphics.lineTo(cx, cy);
  graphics.lineTo(boardX + 9 * cellSize, boardY + 9 * cellSize);
  graphics.closePath();
  graphics.fillPath();

  // Center Top & Bottom (Dark Purple / Black Theme)
  graphics.fillStyle(0x2e2a44, 1);
  graphics.beginPath();
  graphics.moveTo(boardX + 6 * cellSize, boardY + 6 * cellSize);
  graphics.lineTo(cx, cy);
  graphics.lineTo(boardX + 9 * cellSize, boardY + 6 * cellSize);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(0x2e2a44, 1);
  graphics.beginPath();
  graphics.moveTo(boardX + 6 * cellSize, boardY + 9 * cellSize);
  graphics.lineTo(cx, cy);
  graphics.lineTo(boardX + 9 * cellSize, boardY + 9 * cellSize);
  graphics.closePath();
  graphics.fillPath();

  // Center Crown / Trophy Circle
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(cx, cy, cellSize * 0.44);
  graphics.lineStyle(2, 0x7c3aed, 1);
  graphics.strokeCircle(cx, cy, cellSize * 0.44);
}

function drawStarShape(graphics, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  graphics.beginPath();
  graphics.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    graphics.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    graphics.lineTo(x, y);
    rot += step;
  }
  graphics.lineTo(cx, cy - outerRadius);
  graphics.closePath();
  graphics.fillPath();
}

window.LUDO_COORDINATES = LUDO_COORDINATES;
window.LudoBoard = {
  LUDO_COORDINATES,
  getCellKey,
  getTokenPixelPosition,
  getTokenPixelPositionWithOffset,
  drawLudoBoard
};
