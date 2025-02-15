class TetrisAI {
    constructor() {
        this.moveCache = new Map();
        this.cacheSize = 1000;
        this.memory = [];
        this.generation = 0;
        
        // Initialize with default weights
        this.weights = {
            heightWeight: -0.510066,
            linesWeight: 0.760666,
            holesWeight: -0.35663,
            bumpinessWeight: -0.184483,
            wallWeight: 0.25
        };
        
        // Load saved weights on initialization
        this.loadWeights();
        
        // Add weight observer
        this.weightObserver = setInterval(() => this.checkWeightUpdates(), 1000);
    }

    async loadWeights() {
        try {
            const response = await fetch('/api/weights');
            const data = await response.json();
            this.weights = data.weights;
            this.generation = data.generation;
            console.log('Loaded weights from server:', this.weights);
        } catch (error) {
            console.log('Using default weights');
        }
    }

    async saveWeights() {
        const response = await fetch('/api/weights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                weights: this.weights,
                generation: this.generation
            })
        });
        
        if (response.ok) {
            console.log('Weights saved successfully:', this.weights);
            console.log('Generation:', this.generation);
        }
    }

    async checkWeightUpdates() {
        if (this.isPlaying) {
            const response = await fetch('/api/weights');
            const data = await response.json();
            
            if (JSON.stringify(this.weights) !== JSON.stringify(data.weights)) {
                this.weights = data.weights;
                this.generation = data.generation;
                console.log('Weights updated during gameplay:', this.weights);
            }
        }
    }

    startPlaying() {
        this.isPlaying = true;
    }

    stopPlaying() {
        this.isPlaying = false;
    }
    createMatrix(w, h) {
        return Array(h).fill().map(() => Array(w).fill(0));
    }

    generateNextPiece() {
        const pieces = [
            [[1,1,1,1]],           // I
            [[1,1],[1,1]],         // O
            [[1,1,1],[0,1,0]],     // T
            [[1,1,1],[1,0,0]],     // L
            [[1,1,1],[0,0,1]],     // J
            [[1,1,0],[0,1,1]],     // S
            [[0,1,1],[1,1,0]]      // Z
        ];
        return pieces[Math.floor(Math.random() * pieces.length)];
    }

    calculateMove(gameState) {
        if (!gameState || !gameState.currentPiece) return null;
        
        const moves = this.generatePossibleMoves(gameState);
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of moves) {
            const simulatedState = this.simulateMove(gameState, move);
            const score = this.evaluateState(simulatedState);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    generatePossibleMoves(gameState) {
        const moves = [];
        let piece = gameState.currentPiece;
        const maxHeight = gameState.arena.length;
        
        for (let rotation = 0; rotation < 4; rotation++) {
            const rotatedPiece = this.rotatePiece(piece, rotation);
            for (let x = 0; x < gameState.arena[0].length - rotatedPiece[0].length + 1; x++) {
                // Find landing height for this position
                let y = 0;
                while (y < maxHeight && !this.checkCollision(gameState.arena, rotatedPiece, {x, y})) {
                    y++;
                }
                y--; // Move back to last valid position

                // Only add move if it's valid
                if (y >= 0 && y < maxHeight) {
                    moves.push({
                        x: x,
                        rotation: rotatedPiece,
                        drop: true,
                        y: y // Store the landing height
                    });
                }
            }
        }
        return moves;
    }

    simulateMove(gameState, move) {
        const simulatedArena = gameState.arena.map(row => [...row]);
        let y = 0;
        
        while (!this.checkCollision(simulatedArena, move.rotation, {x: move.x, y})) {
            y++;
        }
        y--;
        
        if (y >= 0) {
            this.placePiece(simulatedArena, move.rotation, {x: move.x, y});
        }
        
        return simulatedArena;
    }

    evaluateState(state) {
        const features = this.extractFeatures(state);
        const horizontalLineBonus = this.calculateHorizontalLines(state) * 3.0;
        const towerPenalty = this.calculateTowerPenalty(state) * -2.0;
        const sealedSpacesPenalty = this.calculateSealedSpaces(state) * -5.0;
        
        return Object.keys(this.weights).reduce((score, key) => {
            return score + features[key] * this.weights[key];
        }, 0) + horizontalLineBonus + towerPenalty + sealedSpacesPenalty;
    }

    calculateSealedSpaces(state) {
        let sealedCount = 0;
        const heights = this.getColumnHeights(state);
        
        // Check each column for sealed spaces
        for (let col = 0; col < state[0].length; col++) {
            let foundBlock = false;
            for (let row = state.length - 1; row >= 0; row--) {
                if (state[row][col] !== 0) {
                    foundBlock = true;
                } else if (foundBlock && this.isSealed(state, row, col)) {
                    sealedCount++;
                }
            }
        }
        return sealedCount;
    }

    isSealed(state, row, col) {
        // Check if space is sealed from above
        let sealed = false;
        for (let r = row - 1; r >= 0; r--) {
            if (state[r][col] !== 0) {
                sealed = true;
                break;
            }
        }
        
        // Check if space is sealed from sides
        if (sealed) {
            const leftBlocked = col === 0 || state[row][col - 1] !== 0;
            const rightBlocked = col === state[0].length - 1 || state[row][col + 1] !== 0;
            return leftBlocked && rightBlocked;
        }
        return false;
    }
    calculateHorizontalLines(state) {
        let potentialLines = 0;
        for (let row = state.length - 1; row >= 0; row--) {
            const filledCells = state[row].filter(cell => cell !== 0).length;
            if (filledCells >= state[row].length - 2) {  // Near complete lines
                potentialLines++;
            }
        }
        return potentialLines;
    }

    calculateTowerPenalty(state) {
        const heights = this.getColumnHeights(state);
        let towerScore = 0;
        
        // Penalize height differences between adjacent columns
        for (let i = 0; i < heights.length - 1; i++) {
            const heightDiff = Math.abs(heights[i] - heights[i + 1]);
            if (heightDiff > 3) {  // If difference is more than 3 blocks
                towerScore += heightDiff * 2;
            }
        }
        
        return towerScore;
    }
    extractFeatures(state) {
        return {
            heightWeight: this.calculateAggregateHeight(state),
            linesWeight: this.calculateCompleteLines(state),
            holesWeight: this.calculateHoles(state),
            bumpinessWeight: this.calculateBumpiness(state),
            wallWeight: this.calculateWallProximity(state)
        };
    }

    calculateAggregateHeight(state) {
        const heights = this.getColumnHeights(state);
        return heights.reduce((sum, height) => sum + height, 0);
    }

    calculateCompleteLines(state) {
        let lines = 0;
        for (let row = 0; row < state.length; row++) {
            if (state[row].every(cell => cell !== 0)) {
                lines++;
            }
        }
        return lines;
    }

    calculateHoles(state) {
        let holes = 0;
        const heights = this.getColumnHeights(state);
        
        for (let col = 0; col < state[0].length; col++) {
            for (let row = state.length - heights[col]; row < state.length; row++) {
                if (state[row][col] === 0) {
                    holes++;
                }
            }
        }
        return holes;
    }

    calculateBumpiness(state) {
        const heights = this.getColumnHeights(state);
        let bumpiness = 0;
        for (let i = 0; i < heights.length - 1; i++) {
            bumpiness += Math.abs(heights[i] - heights[i + 1]);
        }
        return bumpiness;
    }

    calculateWallProximity(state) {
        const heights = this.getColumnHeights(state);
        return heights[0] + heights[heights.length - 1];
    }

    getColumnHeights(state) {
        const heights = new Array(state[0].length).fill(0);
        for (let col = 0; col < state[0].length; col++) {
            for (let row = 0; row < state.length; row++) {
                if (state[row][col] !== 0) {
                    heights[col] = state.length - row;
                    break;
                }
            }
        }
        return heights;
    }

    rotatePiece(matrix, times = 1) {
        let rotated = matrix.map(row => [...row]);
        for (let i = 0; i < times % 4; i++) {
            rotated = rotated[0].map((_, index) => 
                rotated.map(row => row[index]).reverse()
            );
        }
        return rotated;
    }

    checkCollision(arena, piece, pos) {
        for (let y = 0; y < piece.length; y++) {
            for (let x = 0; x < piece[y].length; x++) {
                if (piece[y][x] !== 0) {
                    const arenaY = y + pos.y;
                    const arenaX = x + pos.x;
                    if (arenaY < 0 || arenaY >= arena.length || 
                        arenaX < 0 || arenaX >= arena[0].length || 
                        arena[arenaY][arenaX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    placePiece(arena, piece, pos) {
        if (!arena || !piece || !pos) return;
        
        piece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const targetY = y + pos.y;
                    const targetX = x + pos.x;
                    
                    if (targetY >= 0 && targetY < arena.length &&
                        targetX >= 0 && targetX < arena[0].length) {
                        arena[targetY][targetX] = value;
                    }
                }
            });
        });
    }

    async trainAI(numGames = 1000) {
        let totalScore = 0;
        let gamesPlayed = 0;
        let bestWeights = {...this.weights};
        let bestScore = 0;
        let bestGameState = null;

        console.log('Starting Training Session with initial weights:', this.weights);

        for (let game = 0; game < numGames; game++) {
            let gameScore = 0;
            let linesCleared = 0;
            const gameState = {
                arena: this.createMatrix(12, 20),
                currentPiece: this.generateNextPiece(),
                position: {x: 5, y: 0}
            };
            
            // Track moves and their outcomes for this game
            const gameMoves = [];
            
            let moves = 0;
            while (!this.isGameOver(gameState) && moves < 1000) {
                const move = this.calculateMove(gameState);
                if (move) {
                    const beforeState = JSON.stringify(gameState.arena);
                    this.applyMove(gameState, move);
                    const newLines = this.calculateCompleteLines(gameState.arena);
                    linesCleared += newLines;
                    gameScore += newLines * 100;
                    
                    gameMoves.push({
                        beforeState,
                        move,
                        linesCleared: newLines,
                        score: gameScore
                    });
                }
                moves++;
            }

            // If this game performed better, use it as the new reference
            if (gameScore > bestScore) {
                bestScore = gameScore;
                bestWeights = {...this.weights};
                bestGameState = gameMoves;
                
                // Adjust weights based on successful moves
                this.weights.linesWeight *= 1.1;
                this.weights.heightWeight *= 0.95;
                this.weights.holesWeight *= 0.9;
                this.weights.bumpinessWeight *= 0.95;
            } else {
                // If not better, learn from the best game
                this.weights = {...bestWeights};
                // Small random adjustments to explore new strategies
                Object.keys(this.weights).forEach(key => {
                    this.weights[key] *= (1 + (Math.random() - 0.5) * 0.1);
                });
            }

            totalScore += gameScore;
            gamesPlayed++;
            
            console.log(`Game ${gamesPlayed}/${numGames}:
                Score: ${gameScore}
                Lines: ${linesCleared}
                Moves: ${moves}
                Best Score So Far: ${bestScore}
                Current Weights:`, this.weights);
        }

        // Use the best performing weights
        this.weights = bestWeights;
        this.generation++;
        
        await this.saveWeights();

        console.log(`Training Complete:
            Games: ${gamesPlayed}
            Average Score: ${totalScore/gamesPlayed}
            Best Score: ${bestScore}
            Final Weights:`, this.weights);
    }
    isGameOver(gameState) {
        return gameState.arena[0].some(cell => cell !== 0);
    }

    applyMove(gameState, move) {
        gameState.currentPiece = move.rotation;
        gameState.position.x = move.x;
        while (!this.checkCollision(gameState.arena, gameState.currentPiece, gameState.position)) {
            gameState.position.y++;
        }
        gameState.position.y--;
        this.placePiece(gameState.arena, gameState.currentPiece, gameState.position);
        gameState.currentPiece = this.generateNextPiece();
        gameState.position = {x: 5, y: 0};
    }
}

if (typeof window !== 'undefined') {
    window.TetrisAI = TetrisAI;
}
