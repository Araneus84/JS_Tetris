const canvas = document.getElementById('tetrisCanvas');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start');

const nextPieceCanvas = document.getElementById('next-piece');
const nextContext = nextPieceCanvas.getContext('2d');

let nextPiece = null;
let previousScore = 0;
let lastMove = null;
let highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let score = 0;
let gameRunning = false;

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0
};

function createMatrix(w, h) {
    return Array(h).fill().map(() => Array(w).fill(0));
}

const arena = createMatrix(12, 20);

const aiButton = document.createElement('button');
aiButton.textContent = 'Toggle AI';
aiButton.id = 'aiButton';
document.querySelector('.info').appendChild(aiButton);

const ai = new TetrisAI();
let aiEnabled = false;

aiButton.addEventListener('click', () => {
    aiEnabled = !aiEnabled;
    aiButton.textContent = aiEnabled ? 'Disable AI' : 'Enable AI';
    if (aiEnabled && !gameRunning) {
        gameRunning = true;
        update();
    }
});
const trainButton = document.createElement('button');
trainButton.textContent = 'Train AI (100 Games)';
document.querySelector('.info').appendChild(trainButton);

trainButton.addEventListener('click', async () => {
    const wasRunning = gameRunning;
    gameRunning = false;
    trainButton.disabled = true;
    trainButton.textContent = 'Training...';
    
    await ai.trainAI(1000);
    
    trainButton.disabled = false;
    trainButton.textContent = 'Train AI (100 Games)';
    gameRunning = wasRunning;
    if (wasRunning) {
        update();
    }
});

function generateNextPiece() {
    const pieces = 'ILJOTSZ';
    return createPiece(pieces[Math.floor(pieces.length * Math.random())]);
}

function drawNextPiece() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, 40, 40);
    if (nextPiece) {
        const scale = 8;
        const offsetX = (40 - nextPiece[0].length * scale) / 2;
        const offsetY = (40 - nextPiece.length * scale) / 2;
        nextPiece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextContext.fillStyle = colors[value];
                    nextContext.fillRect(
                        x * scale + offsetX,
                        y * scale + offsetY,
                        scale - 1,
                        scale - 1
                    );
                }
            });
        });
    }
}
function updateScore() {
    scoreElement.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore.toString());
        document.getElementById('highScore').textContent = highScore;
    }
}

document.getElementById('highScore').textContent = highScore;
context.scale(20, 20);

let aiMoveCounter = 0;
const AI_MOVE_INTERVAL = 50;
let lastAIMove = null;

function executeAIMove(move) {
    if (!move || !player.matrix) return;
    
    // Smart piece rotation with lookahead
    let rotationCount = 0;
    const targetRotation = move.rotation;
    while (!matricesEqual(player.matrix, targetRotation) && rotationCount < 4) {
        const clockwiseMatch = matricesEqual(playerRotatePreview(1), targetRotation);
        const counterClockwiseMatch = matricesEqual(playerRotatePreview(-1), targetRotation);
        
        if (clockwiseMatch || !counterClockwiseMatch) {
            playerRotate(1);
        } else {
            playerRotate(-1);
        }
        rotationCount++;
    }
    
    // Optimized horizontal movement with path finding
    const path = findOptimalPath(player.pos.x, move.x, arena, player.matrix);
    for (const step of path) {
        playerMove(step);
    }
          // Dynamic drop speed based on current game state
          const currentHeight = getStackHeight();
          const dangerZone = arena.length * 0.7;
          dropInterval = move.drop ? 
              (currentHeight > dangerZone ? 25 : 50) : 
              1000;
      }

      // Update AI toggle event listener
      aiButton.addEventListener('click', () => {
          aiEnabled = !aiEnabled;
          aiButton.textContent = aiEnabled ? 'Disable AI' : 'Enable AI';
          if (aiEnabled) {
              if (!gameRunning) {
                  gameRunning = true;
                  arena.forEach(row => row.fill(0));
                  score = 0;
                  updateScore();
                  nextPiece = generateNextPiece();
                  drawNextPiece();
                  playerReset();
              }
              dropInterval = 50; // Make AI move faster
              update();
          } else {
              dropInterval = 1000; // Reset to normal speed
          }
      });

      // Update the game loop to handle AI moves more effectively
      function update(time = 0) {
          if (!gameRunning) return;
    
          const deltaTime = time - lastTime;
          lastTime = time;
          dropCounter += deltaTime;
    
          if (aiEnabled) {
              const gameState = {
                  arena: arena.map(row => [...row]),
                  currentPiece: player.matrix,
                  position: {...player.pos},
                  nextPiece: nextPiece
              };
        
              const move = ai.calculateMove(gameState);
              if (move) {
                  executeAIMove(move);
              }
          }

          if (dropCounter > dropInterval) {
              playerDrop();
              dropCounter = 0;
          }
    
          draw();
          requestAnimationFrame(update);
      }

function executeAIMove(move) {
    if (!move || !player.matrix) return;
    
    let rotationCount = 0;
    while (!matricesEqual(player.matrix, move.rotation) && rotationCount < 4) {
        playerRotate(1);
        rotationCount++;
    }
    
    const diffX = move.x - player.pos.x;
    if (diffX !== 0) {
        playerMove(Math.sign(diffX));
    }
    
    dropInterval = move.drop && player.pos.x === move.x ? 50 : 1000;
}

function matricesEqual(matrix1, matrix2) {
    if (!matrix1 || !matrix2) return false;
    if (matrix1.length !== matrix2.length) return false;
    for (let i = 0; i < matrix1.length; i++) {
        if (!matrix1[i] || !matrix2[i] || matrix1[i].length !== matrix2[i].length) return false;
        for (let j = 0; j < matrix1[i].length; j++) {
            if (matrix1[i][j] !== matrix2[i][j]) return false;
        }
    }
    return true;
}

function playerReset() {
    if (!nextPiece) {
        nextPiece = generateNextPiece();
    }
    player.matrix = nextPiece;
    nextPiece = generateNextPiece();
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    drawNextPiece();
    
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        score = 0;
        updateScore();
        
        if (aiEnabled) {
            gameRunning = true;
            update();
        }
    }
}

const colors = [
    null,
    '#FF0D72',
    '#0DC2FF',
    '#0DFF72',
    '#F538FF',
    '#FF8E0D',
    '#FFE138',
    '#3877FF'
];

function playerRotatePreview(dir) {
    const matrix = player.matrix.map(row => [...row]);
    rotate(matrix, dir);
    return matrix;
}

function getHeight(y) {
    let maxHeight = 0;
    for (let x = 0; x < arena[0].length; x++) {
        for (let y = 0; y < arena.length; y++) {
            if (arena[y][x] !== 0) {
                maxHeight = Math.max(maxHeight, arena.length - y);
                break;
            }
        }
    }
    return maxHeight;
}

function collide(arena, player) {
    const matrix = player.matrix;
    const pos = player.pos;
    
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < matrix[y].length; ++x) {
            if (matrix[y][x] !== 0 &&
                (arena[y + pos.y] === undefined ||
                arena[y + pos.y][x + pos.x] === undefined ||
                arena[y + pos.y][x + pos.x] !== 0)) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    if (!player.matrix) return;
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    if (!matrix) return;
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    if (!player.matrix) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function createPiece(type) {
    switch(type) {
        case 'T': return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
        case 'O': return [[2, 2], [2, 2]];
        case 'L': return [[0, 0, 0], [3, 3, 3], [3, 0, 0]];
        case 'J': return [[0, 0, 0], [4, 4, 4], [0, 0, 4]];
        case 'I': return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
        case 'S': return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
        case 'Z': return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
    }
}

function arenaSweep() {
    let rowCount = 1;
    let linesCleared = 0;

    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        linesCleared++;
        score += rowCount * 10;
        rowCount *= 2;
    }

    if (linesCleared === 4) {
        score += 800;
    }
}

function drawGhostPiece(ghostPosition) {
    if (!ghostPosition) return;
    
    context.globalAlpha = 0.3;
    ghostPosition.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(
                    x + ghostPosition.x,
                    y + ghostPosition.y,
                    1, 1
                );
            }
        });
    });
    context.globalAlpha = 1.0;
}

function draw() {
    // Clear canvas
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw game field
    drawMatrix(arena, {x: 0, y: 0});
    
    // Draw current piece
    if (player.matrix) {
        drawMatrix(player.matrix, player.pos);
    }
    
    // Draw ghost piece if AI is enabled
    if (aiEnabled && lastMove) {
        const ghostPos = calculateGhostPosition({
            arena,
            currentPiece: player.matrix,
            position: player.pos
        }, lastMove);
        drawGhostPiece(ghostPos);
    }
}

function drawMatrix(matrix, offset) {
    if (!matrix) return;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

document.addEventListener('keydown', event => {
    if (!gameRunning || aiEnabled) return;
    
    switch(event.keyCode) {
        case 37: playerMove(-1); break;
        case 39: playerMove(1); break;
        case 40: playerDrop(); break;
        case 81: playerRotate(-1); break;
        case 87: playerRotate(1); break;
    }
});
  startButton.addEventListener('click', () => {
      if (!gameRunning) {
          gameRunning = true;
          score = 0;
          updateScore();
          playerReset();
          lastTime = 0;
          update();
          startButton.textContent = 'Reset Game';
      } else {
          gameRunning = false;
          arena.forEach(row => row.fill(0));
          score = 0;
          updateScore();
          draw();
          startButton.textContent = 'Start Game';
      }
  });

  // Fix AI toggle
  aiButton.addEventListener('click', () => {
      aiEnabled = !aiEnabled;
      aiButton.textContent = aiEnabled ? 'Disable AI' : 'Enable AI';
      if (aiEnabled && !gameRunning) {
          gameRunning = true;
          update();
      }
  });