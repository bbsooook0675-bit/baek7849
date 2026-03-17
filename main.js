// Initialize PeerJS
const peer = new Peer();
let conn = null;
let myId = null;

// Game State
const BOARD_SIZE = 15;
let board = [];
let currentPlayer = 'black'; // 'black' goes first
let myColor = 'black'; // Assigned when connection is established or AI mode
let gameActive = false;
let gameMode = 'online'; // 'online' or 'ai'

// DOM Elements
const myPeerIdEl = document.getElementById('my-peer-id');
const copyIdBtn = document.getElementById('copy-id-btn');
const opponentIdInput = document.getElementById('opponent-id-input');
const connectBtn = document.getElementById('connect-btn');
const statusEl = document.getElementById('connection-status');
const connectionPanel = document.getElementById('connection-panel');
const gameArea = document.getElementById('game-area');
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const resetBtn = document.getElementById('reset-btn');
const aiModeBtn = document.getElementById('ai-mode-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// --- PeerJS Connection Setup ---

peer.on('open', (id) => {
    myId = id;
    myPeerIdEl.textContent = id;
    statusEl.textContent = "상대방에게 내 ID를 공유하거나, 상대방 ID를 입력하세요.";
});

peer.on('connection', (connection) => {
    handleConnection(connection);
    myColor = 'black'; // If I received a connection, I am Host (Black)
    gameMode = 'online';
    statusEl.textContent = "상대방이 연결되었습니다! 게임을 시작합니다.";
    startGame();
});

connectBtn.addEventListener('click', () => {
    const opponentId = opponentIdInput.value.trim();
    if (!opponentId) return alert("상대방 ID를 입력하세요.");
    
    const connection = peer.connect(opponentId);
    handleConnection(connection);
    myColor = 'white'; // If I initiated the connection, I am Guest (White)
    gameMode = 'online';
});

aiModeBtn.addEventListener('click', () => {
    gameMode = 'ai';
    myColor = 'black'; // Player is always Black in AI mode
    startGame();
});

backToMenuBtn.addEventListener('click', () => {
    if (conn) conn.close();
    resetGameUI();
});

function handleConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        statusEl.textContent = "연결 성공! 게임을 시작합니다.";
        startGame();
        conn.send({ type: 'ready' });
    });
    conn.on('data', handleData);
    conn.on('close', () => {
        alert("상대방과의 연결이 끊어졌습니다.");
        resetGameUI();
    });
}

function handleData(data) {
    if (data.type === 'move') {
        placeStone(data.row, data.col, data.color, false);
    } else if (data.type === 'reset') {
        resetBoard();
    }
}

// --- Game Logic ---

function initBoard() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleCellClick(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function startGame() {
    connectionPanel.style.display = 'none';
    gameArea.style.display = 'block';
    resetBoard();
}

function resetGameUI() {
    gameArea.style.display = 'none';
    connectionPanel.style.display = 'flex';
    gameActive = false;
    conn = null;
}

function resetBoard() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    const stones = document.querySelectorAll('.stone');
    stones.forEach(s => s.remove());
    currentPlayer = 'black';
    gameActive = true;
    updateTurnIndicator();
    resetBtn.style.display = 'none';
}

function handleCellClick(row, col) {
    if (!gameActive || board[row][col]) return;
    if (gameMode === 'online' && currentPlayer !== myColor) return;
    if (gameMode === 'ai' && currentPlayer !== 'black') return; // In AI mode, player is black

    placeStone(row, col, currentPlayer, true);
    
    if (gameMode === 'online' && conn && conn.open) {
        conn.send({ type: 'move', row, col, color: myColor });
    }

    if (gameMode === 'ai' && gameActive) {
        // AI Turn
        setTimeout(makeAiMove, 500);
    }
}

function placeStone(row, col, color, isMyMove) {
    board[row][col] = color;
    const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
    const stone = document.createElement('div');
    stone.classList.add('stone', color);
    document.querySelectorAll('.stone').forEach(s => s.classList.remove('last-move'));
    stone.classList.add('last-move');
    cell.appendChild(stone);

    if (checkWin(row, col, color)) {
        gameActive = false;
        const winnerName = (color === 'black' ? '흑' : '백');
        turnIndicator.textContent = winnerName + " 승리!";
        turnIndicator.style.color = 'var(--win-color)';
        resetBtn.style.display = 'block';
        return;
    }

    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    updateTurnIndicator();
}

function updateTurnIndicator() {
    if (!gameActive) return;
    turnIndicator.style.color = (currentPlayer === myColor) ? 'var(--highlight)' : '#666';
    const colorName = (currentPlayer === 'black' ? '흑' : '백');
    if (gameMode === 'ai') {
        turnIndicator.textContent = (currentPlayer === 'black' ? "나의 턴" : "AI 생각 중...");
    } else {
        turnIndicator.textContent = (currentPlayer === myColor ? "나의 턴" : "상대방 턴") + " (" + colorName + ")";
    }
}

// --- AI Logic ---

function makeAiMove() {
    if (!gameActive) return;
    const bestMove = getBestMove();
    if (bestMove) {
        placeStone(bestMove.row, bestMove.col, 'white', false);
    }
}

function getBestMove() {
    let maxScore = -1;
    let candidates = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!board[r][c]) {
                const score = calculateScore(r, c);
                if (score > maxScore) {
                    maxScore = score;
                    candidates = [{row: r, col: c}];
                } else if (score === maxScore) {
                    candidates.push({row: r, col: c});
                }
            }
        }
    }
    // Random choice among same-score moves
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function calculateScore(row, col) {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
        // Evaluate AI's potential (White)
        score += evaluateLine(row, col, dr, dc, 'white');
        // Evaluate Blocking player's potential (Black)
        score += evaluateLine(row, col, dr, dc, 'black') * 0.8; // Slightly prioritize offense
    }
    return score;
}

function evaluateLine(row, col, dr, dc, color) {
    let count = 1;
    let block = 0;
    
    // Check both directions
    [1, -1].forEach(dir => {
        let r = row + dr * dir;
        let c = col + dc * dir;
        let lineCount = 0;
        while (isValid(r, c) && board[r][c] === color) {
            lineCount++;
            r += dr * dir;
            c += dc * dir;
        }
        if (!isValid(r, c) || (board[r][c] && board[r][c] !== color)) block++;
        count += lineCount;
    });

    // Heuristic scoring
    if (count >= 5) return 100000;
    if (count === 4) return block === 0 ? 10000 : (block === 1 ? 2000 : 0);
    if (count === 3) return block === 0 ? 1000 : (block === 1 ? 200 : 0);
    if (count === 2) return block === 0 ? 100 : (block === 1 ? 20 : 0);
    return count;
}

// --- Win Detection ---

function checkWin(row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 1;
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i, c = col + dc * i;
            if (isValid(r, c) && board[r][c] === color) count++; else break;
        }
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i, c = col - dc * i;
            if (isValid(r, c) && board[r][c] === color) count++; else break;
        }
        if (count >= 5) return true;
    }
    return false;
}

function isValid(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

resetBtn.addEventListener('click', resetBoard);
initBoard();