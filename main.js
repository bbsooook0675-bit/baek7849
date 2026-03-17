// Initialize PeerJS
const peer = new Peer();
let conn = null;
let myId = null;

// Game State
const BOARD_SIZE = 15;
let board = [];
let currentPlayer = 'black'; // 'black' goes first
let myColor = null; // Assigned when connection is established
let gameActive = false;

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

// --- PeerJS Connection Setup ---

peer.on('open', (id) => {
    myId = id;
    myPeerIdEl.textContent = id;
    statusEl.textContent = "상대방에게 내 ID를 공유하거나, 상대방 ID를 입력하세요.";
});

peer.on('connection', (connection) => {
    handleConnection(connection);
    // If I received a connection, I am the Host (Black)
    myColor = 'black';
    statusEl.textContent = "상대방이 연결되었습니다! 게임을 시작합니다.";
    startGame();
});

peer.on('error', (err) => {
    console.error(err);
    alert("오류가 발생했습니다: " + err.type);
});

connectBtn.addEventListener('click', () => {
    const opponentId = opponentIdInput.value.trim();
    if (!opponentId) return alert("상대방 ID를 입력하세요.");
    
    const connection = peer.connect(opponentId);
    handleConnection(connection);
    // If I initiated the connection, I am the Guest (White)
    myColor = 'white'; 
});

copyIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myId).then(() => {
        alert("ID가 복사되었습니다!");
    });
});

function handleConnection(connection) {
    conn = connection;
    
    conn.on('open', () => {
        statusEl.textContent = "연결 성공! 게임을 시작합니다.";
        startGame();
        
        // Send a handshake or ready signal if needed
        conn.send({ type: 'ready' });
    });

    conn.on('data', (data) => {
        handleData(data);
    });

    conn.on('close', () => {
        alert("상대방과의 연결이 끊어졌습니다.");
        resetGameUI();
    });
}

function handleData(data) {
    if (data.type === 'move') {
        placeStone(data.row, data.col, data.color, false); // false means 'not my move'
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
    gameArea.classList.remove('hidden');
    gameArea.style.display = 'block';
    resetBoard();
}

function resetGameUI() {
    gameArea.style.display = 'none';
    connectionPanel.style.display = 'flex';
    gameActive = false;
    conn = null;
    myColor = null;
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
    if (!gameActive) return;
    if (currentPlayer !== myColor) {
        // Not my turn
        return;
    }
    if (board[row][col]) return; // Already occupied

    // Place my stone
    placeStone(row, col, myColor, true);
    
    // Send move to opponent
    if (conn && conn.open) {
        conn.send({ type: 'move', row: row, col: col, color: myColor });
    }
}

function placeStone(row, col, color, isMyMove) {
    board[row][col] = color;
    
    const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
    const stone = document.createElement('div');
    stone.classList.add('stone', color);
    
    // Mark last move
    document.querySelectorAll('.stone').forEach(s => s.classList.remove('last-move'));
    stone.classList.add('last-move');
    
    cell.appendChild(stone);

    if (checkWin(row, col, color)) {
        gameActive = false;
        turnIndicator.textContent = isMyMove ? "승리했습니다!" : "패배했습니다...";
        turnIndicator.style.color = isMyMove ? 'var(--win-color)' : 'var(--error-color)';
        resetBtn.style.display = 'block';
        return;
    }

    // Switch turn
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    updateTurnIndicator();
}

function updateTurnIndicator() {
    if (!gameActive) return;
    
    if (currentPlayer === myColor) {
        turnIndicator.textContent = "나의 턴 (" + (myColor === 'black' ? '흑' : '백') + ")";
        turnIndicator.style.color = 'var(--highlight)';
    } else {
        turnIndicator.textContent = "상대방 턴 (" + (currentPlayer === 'black' ? '흑' : '백') + ")";
        turnIndicator.style.color = '#666';
    }
}

resetBtn.addEventListener('click', () => {
    resetBoard();
    if (conn && conn.open) {
        conn.send({ type: 'reset' });
    }
});

// --- Win Detection Logic ---

function checkWin(row, col, color) {
    const directions = [
        [0, 1],  // Horizontal
        [1, 0],  // Vertical
        [1, 1],  // Diagonal \
        [1, -1]  // Diagonal /
    ];

    for (const [dr, dc] of directions) {
        let count = 1;
        
        // Check forward
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (isValid(r, c) && board[r][c] === color) count++;
            else break;
        }
        
        // Check backward
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (isValid(r, c) && board[r][c] === color) count++;
            else break;
        }

        if (count >= 5) return true;
    }
    return false;
}

function isValid(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// Initial setup
initBoard();