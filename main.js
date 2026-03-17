// Initialize PeerJS
const peer = new Peer();
let conn = null;
let myId = null;

// Game State
const BOARD_SIZE = 15;
let board = [];
let currentPlayer = 'black';
let myColor = 'black';
let gameActive = false;
let gameMode = 'online';
let aiLevel = 'intermediate'; // beginner, intermediate, expert
let timerInterval = null;
let timeLeft = 30;

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
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const timeLeftEl = document.getElementById('time-left');

// --- Audio Synthesis (Realistic Stone 'Tak' Sound) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playStoneSound() {
    const now = audioCtx.currentTime;
    
    // 1. 타격음 (High-frequency Click)
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1500, now);
    clickOsc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    // 2. 나무 판 울림 (Lower Thump)
    const thumpOsc = audioCtx.createOscillator();
    const thumpGain = audioCtx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(200, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    thumpGain.gain.setValueAtTime(0.3, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(audioCtx.destination);

    // 3. 텍스처 (Noise Burst for 'Tak')
    const bufferSize = audioCtx.sampleRate * 0.02; // Very short burst
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.15);
    noise.start(now);
    noise.stop(now + 0.02);
}

// --- PeerJS & Mode Selection ---

peer.on('open', (id) => {
    myId = id;
    myPeerIdEl.textContent = id;
});

peer.on('connection', (connection) => {
    handleConnection(connection);
    myColor = 'black';
    gameMode = 'online';
    startGame();
});

connectBtn.addEventListener('click', () => {
    const opponentId = opponentIdInput.value.trim();
    if (!opponentId) return alert("상대방 ID를 입력하세요.");
    const connection = peer.connect(opponentId);
    handleConnection(connection);
    myColor = 'white';
    gameMode = 'online';
});

document.querySelectorAll('.ai-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        aiLevel = btn.dataset.level;
        gameMode = 'ai';
        myColor = 'black';
        startGame();
    });
});

backToMenuBtn.addEventListener('click', () => {
    if (conn) conn.close();
    stopTimer();
    resetGameUI();
});

function handleConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        startGame();
        conn.send({ type: 'ready' });
    });
    conn.on('data', (data) => {
        if (data.type === 'move') {
            placeStone(data.row, data.col, data.color, false);
        } else if (data.type === 'reset') {
            resetBoard();
        }
    });
    conn.on('close', () => {
        alert("연결이 끊어졌습니다.");
        resetGameUI();
    });
}

// --- Timer Logic ---

function startTimer() {
    stopTimer();
    timeLeft = 30;
    timeLeftEl.textContent = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timeLeftEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            stopTimer();
            timeOutLose();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function timeOutLose() {
    gameActive = false;
    const winnerColor = currentPlayer === 'black' ? '백' : '흑';
    turnIndicator.textContent = `시간 초과! ${winnerColor} 승리!`;
    turnIndicator.style.color = 'var(--error-color)';
    resetBtn.style.display = 'block';
}

// --- Game Logic ---

function initBoard() {
    boardEl.innerHTML = '';
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
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
    stopTimer();
}

function resetBoard() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    document.querySelectorAll('.stone').forEach(s => s.remove());
    currentPlayer = 'black';
    gameActive = true;
    updateTurnIndicator();
    resetBtn.style.display = 'none';
    startTimer();
}

function handleCellClick(row, col) {
    if (!gameActive || board[row][col]) return;
    if (gameMode === 'online' && currentPlayer !== myColor) return;
    if (gameMode === 'ai' && currentPlayer !== 'black') return;

    placeStone(row, col, currentPlayer, true);
    
    if (gameMode === 'online' && conn && conn.open) {
        conn.send({ type: 'move', row, col, color: myColor });
    }

    if (gameMode === 'ai' && gameActive) {
        stopTimer();
        setTimeout(makeAiMove, 600);
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
    
    playStoneSound();

    if (checkWin(row, col, color)) {
        gameActive = false;
        stopTimer();
        const winnerName = (color === 'black' ? '흑' : '백');
        turnIndicator.textContent = winnerName + " 승리!";
        turnIndicator.style.color = 'var(--win-color)';
        resetBtn.style.display = 'block';
        return;
    }

    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    updateTurnIndicator();
    startTimer();
}

function updateTurnIndicator() {
    if (!gameActive) return;
    const isMyTurn = (currentPlayer === myColor);
    turnIndicator.style.color = isMyTurn ? 'var(--highlight)' : '#666';
    const colorName = (currentPlayer === 'black' ? '흑' : '백');
    
    if (gameMode === 'ai' && currentPlayer === 'white') {
        turnIndicator.textContent = "AI 생각 중...";
    } else {
        turnIndicator.textContent = (isMyTurn ? "나의 턴" : "상대방 턴") + " (" + colorName + ")";
    }
}

// --- AI Logic (Advanced Scoring) ---

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

    // Difficulty Factor: Add randomness to Beginner/Intermediate
    let randomness = 0;
    if (aiLevel === 'beginner') randomness = 0.4;
    else if (aiLevel === 'intermediate') randomness = 0.1;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!board[r][c]) {
                let score = calculateScore(r, c);
                if (Math.random() < randomness) score *= 0.5; // Beginner makes mistakes

                if (score > maxScore) {
                    maxScore = score;
                    candidates = [{row: r, col: c}];
                } else if (score === maxScore) {
                    candidates.push({row: r, col: c});
                }
            }
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function calculateScore(row, col) {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    // Expert AI has higher defensive weights
    const defenseMultiplier = (aiLevel === 'expert') ? 1.2 : 0.8;

    for (const [dr, dc] of directions) {
        score += evaluateLine(row, col, dr, dc, 'white'); // Offense (AI)
        score += evaluateLine(row, col, dr, dc, 'black') * defenseMultiplier; // Defense (Player)
    }
    return score;
}

function evaluateLine(row, col, dr, dc, color) {
    let count = 1;
    let block = 0;
    [1, -1].forEach(dir => {
        let r = row + dr * dir, c = col + dc * dir;
        let lineCount = 0;
        while (isValid(r, c) && board[r][c] === color) { lineCount++; r += dr * dir; c += dc * dir; }
        if (!isValid(r, c) || (board[r][c] && board[r][c] !== color)) block++;
        count += lineCount;
    });

    if (count >= 5) return 100000;
    if (count === 4) return block === 0 ? 15000 : (block === 1 ? 4000 : 0);
    if (count === 3) return block === 0 ? 3000 : (block === 1 ? 600 : 0);
    if (count === 2) return block === 0 ? 400 : (block === 1 ? 50 : 0);
    return count;
}

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