// Game Configuration
const CONFIG = {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 600,
    PLAYER_WIDTH: 60, // Character width (1.5x of 40)
    PLAYER_HEIGHT: 75, // Character height (1.5x of 50)
    PLAYER_SPEED: 5,
    JUMP_FORCE: 12,
    GRAVITY: 0.5,
    MAX_CHAIN_LENGTH: 150,
    CHAIN_STIFFNESS: 0.3,
    GROUND_Y: 550
};

// Game State
let socket;
let gameState = {
    playerId: null,
    roomId: null,
    players: new Map(),
    gameStarted: false,
    localPlayer: null,
    isCreator: false,
    myCharacter: null
};

// Score tracking
let sessionHighScore = 0;
let currentScore = 0;

// Camera system for infinite scrolling
let camera = {
    x: 0,
    y: 0,
    targetX: 0,
    smoothing: 0.1
};

// World generation
let worldSeed = 12345;
const CHUNK_SIZE = 400;
let generatedChunks = new Map();
const MAX_JUMP_DISTANCE = 180;
const MAX_JUMP_HEIGHT = 150;
let gameOver = false;

// Canvas and rendering
let canvas, ctx;

// Input handling
const keys = {};

// Assets
let backdropImage = new Image();
let duckImage = new Image();
let dogImage = new Image();
let assetsLoaded = 0;
const totalAssets = 3;

// Jungle decoration particles
let jungleParticles = [];
let vines = [];
let butterflies = [];
let groundFlowers = [];
let platformMoss = new Map();

// Screen management
const screens = {
    menu: document.getElementById('menu-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

// Initialize when page loads
window.addEventListener('load', init);

function init() {
    setupCanvas();
    loadAssets();
    setupMenuHandlers();
    setupSocketConnection();
}

function loadAssets() {
    backdropImage.onload = () => {
        assetsLoaded++;
        checkAssetsLoaded();
    };
    backdropImage.src = 'assets/backdrop.png';

    duckImage.onload = () => {
        assetsLoaded++;
        checkAssetsLoaded();
    };
    duckImage.src = 'assets/duck.png';

    dogImage.onload = () => {
        assetsLoaded++;
        checkAssetsLoaded();
    };
    dogImage.src = 'assets/dog.png';
}

function checkAssetsLoaded() {
    if (assetsLoaded === totalAssets) {
        console.log('All assets loaded!');
    }
}

function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Enable pixelated rendering
    ctx.imageSmoothingEnabled = false;
    canvas.style.imageRendering = 'pixelated';
    canvas.style.imageRendering = '-moz-crisp-edges';
    canvas.style.imageRendering = 'crisp-edges';
    
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
}

function setupMenuHandlers() {
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomCodeInput = document.getElementById('room-code-input');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const restartBtn = document.getElementById('restart-btn');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modal = document.getElementById('how-to-play-modal');
    
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', () => joinRoom(roomCodeInput.value.trim().toUpperCase()));
    copyCodeBtn.addEventListener('click', copyRoomCode);
    copyLinkBtn.addEventListener('click', copyRoomLink);
    startGameBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', restartGame);
    restartGameBtn.addEventListener('click', restartGame);
    
    // Modal handlers
    howToPlayBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Character selection
    document.querySelectorAll('.character-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const character = e.currentTarget.dataset.character;
            selectCharacter(character);
        });
    });
    
    // Enter key to join room
    roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom(roomCodeInput.value.trim().toUpperCase());
    });
}

function setupSocketConnection() {
    socket = io();
    
    socket.on('room-created', (data) => {
        gameState.playerId = data.playerId;
        gameState.roomId = data.roomId;
        gameState.isCreator = true;
        
        data.players.forEach(playerData => {
            const player = createPlayer(playerData);
            gameState.players.set(playerData.id, player);
            
            if (playerData.id === gameState.playerId) {
                gameState.localPlayer = player;
            }
        });
        
        showWaitingRoom();
        displayRoomInfo();
        updateWaitingList(data.players, data.playerId);
    });
    
    socket.on('room-joined', (data) => {
        gameState.playerId = data.playerId;
        gameState.roomId = data.roomId;
        gameState.isCreator = false;
        
        data.players.forEach(playerData => {
            const player = createPlayer(playerData);
            gameState.players.set(playerData.id, player);
            
            if (playerData.id === gameState.playerId) {
                gameState.localPlayer = player;
            }
        });
        
        showWaitingRoom();
        displayRoomInfo();
        updateWaitingList(data.players, data.creatorId);
        updateStartButton(data.players, data.creatorId);
    });
    
    socket.on('player-list-updated', (data) => {
        // Update players list
        data.players.forEach(playerData => {
            if (gameState.players.has(playerData.id)) {
                const player = gameState.players.get(playerData.id);
                player.character = playerData.character;
            } else {
                const player = createPlayer(playerData);
                gameState.players.set(playerData.id, player);
            }
        });
        
        updateWaitingList(data.players, data.creatorId);
        updateStartButton(data.players, data.creatorId);
    });
    
    socket.on('player-moved', (data) => {
        const player = gameState.players.get(data.playerId);
        if (player && data.playerId !== gameState.playerId) {
            player.x = data.x;
            player.y = data.y;
            player.vx = data.vx || 0;
            player.vy = data.vy || 0;
        }
    });
    
    socket.on('player-disconnected', (playerId) => {
        gameState.players.delete(playerId);
        if (gameState.gameStarted) {
            triggerGameOver('Partner disconnected!');
        }
    });
    
    socket.on('game-started', () => {
        gameState.gameStarted = true;
        gameOver = false;
        currentScore = 0;
        hideGameOverCard();
        showGame();
        startGameLoop();
    });
    
    socket.on('game-restart', () => {
        gameOver = false;
        camera.x = 0;
        camera.targetX = 0;
        generatedChunks.clear();
        
        let index = 0;
        gameState.players.forEach(player => {
            player.x = 100 + index * 60;
            player.y = CONFIG.GROUND_Y - 50 - player.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.onGround = true;
            index++;
        });
        
        initializeJungleDecorations();
        
        const messageEl = document.getElementById('game-message');
        messageEl.classList.remove('show');
        hideGameOverCard();
    });
    
    socket.on('room-full', () => {
        alert('Room is full!');
    });
    
    socket.on('room-not-found', () => {
        alert('Room not found! Please check the code.');
    });
}

function createRoom() {
    socket.emit('create-room');
}

function joinRoom(roomCode) {
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    socket.emit('join-room', { roomId: roomCode });
}

function selectCharacter(character) {
    gameState.myCharacter = character;
    
    // Update UI
    document.querySelectorAll('.character-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelector(`[data-character="${character}"]`).classList.add('selected');
    
    // Send to server
    socket.emit('select-character', { character });
}

function displayRoomInfo() {
    document.getElementById('room-code').textContent = gameState.roomId;
    const link = `${window.location.origin}?room=${gameState.roomId}`;
    document.getElementById('room-link').value = link;
}

function copyRoomCode() {
    const code = gameState.roomId;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = '📋 Copy Code';
        }, 2000);
    });
}

function copyRoomLink() {
    const linkInput = document.getElementById('room-link');
    const link = linkInput.value;
    
    // Show the link input if it's hidden
    linkInput.classList.add('show');
    
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('copy-link-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = '🔗 Copy Link';
        }, 2000);
    });
}

function updateWaitingList(players, creatorId) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    
    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'waiting-player-item';
        
        const characterIcon = player.character === 'duck' ? '🦆' : 
                            player.character === 'dog' ? '🐕' : '❓';
        const characterName = player.character ? 
                            (player.character === 'duck' ? 'Duck' : 'Dog') : 
                            'Not selected';
        const role = player.id === creatorId ? 'Host' : 'Guest';
        
        item.innerHTML = `
            <div class="player-info">
                <div class="character-icon">${characterIcon}</div>
                <div class="player-status">
                    <div class="player-role">${role}</div>
                    <div class="character-name">${characterName}</div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function updateStartButton(players, creatorId) {
    const startBtn = document.getElementById('start-game-btn');
    const message = document.querySelector('.waiting-message');
    
    // Check if both players selected characters
    let allSelected = players.length === 2;
    players.forEach(player => {
        if (!player.character) {
            allSelected = false;
        }
    });
    
    if (gameState.playerId === creatorId) {
        if (players.length < 2) {
            startBtn.disabled = true;
            message.textContent = 'Waiting for another player to join...';
        } else if (!allSelected) {
            startBtn.disabled = true;
            message.textContent = 'Waiting for both players to select characters...';
        } else {
            startBtn.disabled = false;
            message.textContent = 'Ready to start!';
        }
    } else {
        startBtn.style.display = 'none';
        if (players.length < 2) {
            message.textContent = 'Waiting for another player...';
        } else if (!allSelected) {
            message.textContent = 'Waiting for character selection...';
        } else {
            message.textContent = 'Waiting for host to start the game...';
        }
    }
}

function startGame() {
    socket.emit('start-game');
}

function createPlayer(data) {
    return {
        id: data.id,
        character: data.character,
        x: data.x,
        y: CONFIG.GROUND_Y - 50 - CONFIG.PLAYER_HEIGHT,
        vx: 0,
        vy: 0,
        onGround: true,
        width: CONFIG.PLAYER_WIDTH,
        height: CONFIG.PLAYER_HEIGHT
    };
}

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showWaitingRoom() {
    showScreen('waiting');
}

function showGame() {
    showScreen('game');
    setupGameControls();
}

function showMessage(text, duration = 3000) {
    const messageEl = document.getElementById('game-message');
    messageEl.textContent = text;
    messageEl.classList.add('show');
    
    if (duration > 0) {
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, duration);
    }
}

function setupGameControls() {
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
}

// Check URL for room code
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode) {
        // Auto-fill and focus on join
        document.getElementById('room-code-input').value = roomCode.toUpperCase();
    }
});

// Game Loop
let lastTime = 0;
let animationId = null;

function startGameLoop() {
    initializeJungleDecorations();
    lastTime = performance.now();
    gameLoop();
}

function gameLoop(currentTime = 0) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;
    
    update(deltaTime);
    render();
    
    animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (!gameState.gameStarted) return;
    
    updateJungleAnimations(dt);
    
    if (!gameState.localPlayer || gameOver) return;
    
    const player = gameState.localPlayer;
    
    // Input handling
    let ax = 0;
    if (keys['arrowleft'] || keys['a']) ax -= 1;
    if (keys['arrowright'] || keys['d']) ax += 1;
    
    // Jump
    if ((keys['arrowup'] || keys['w'] || keys[' ']) && player.onGround) {
        player.vy = -CONFIG.JUMP_FORCE;
        player.onGround = false;
    }
    
    // Apply movement
    player.vx = ax * CONFIG.PLAYER_SPEED;
    player.x += player.vx;
    
    // Apply gravity
    player.vy += CONFIG.GRAVITY;
    player.y += player.vy;
    
    // Get platforms and hazards in visible range
    const visibleRange = 500;
    const platforms = getPlatformsInRange(
        camera.x - visibleRange,
        camera.x + CONFIG.CANVAS_WIDTH + visibleRange
    );
    const hazards = getHazardsInRange(
        camera.x - visibleRange,
        camera.x + CONFIG.CANVAS_WIDTH + visibleRange
    );
    
    // Platform collision
    player.onGround = false;
    
    for (const platform of platforms) {
        if (checkPlatformCollision(player, platform)) {
            player.onGround = true;
            break;
        }
    }
    
    // Ground collision (only if not in a valley)
    let inValley = false;
    for (const valley of hazards.valleys) {
        if (player.x > valley.x && player.x < valley.x + valley.width) {
            inValley = true;
            break;
        }
    }
    
    if (!inValley && player.y + player.height / 2 >= CONFIG.GROUND_Y) {
        player.y = CONFIG.GROUND_Y - player.height / 2;
        player.vy = 0;
        player.onGround = true;
    }
    
    // Check spike collision for local player
    for (const spike of hazards.spikes) {
        if (checkSpikeCollision(player, spike)) {
            triggerGameOver('Player hit spikes!');
            return;
        }
    }
    
    // Check if player fell into valley
    if (player.y > CONFIG.GROUND_Y + 150) {
        let canBeSaved = false;
        gameState.players.forEach(p => {
            if (p.id !== player.id && p.y < CONFIG.GROUND_Y + 50) {
                canBeSaved = true;
            }
        });
        
        if (!canBeSaved) {
            triggerGameOver('Both players fell into the abyss!');
            return;
        }
    }
    
    // Left boundary
    const leftBoundary = camera.x + player.width / 2;
    if (player.x < leftBoundary) {
        player.x = leftBoundary;
        player.vx = 0;
    }
    
    updateCamera();
    applyChainPhysics();
    
    // Send position to server (throttled)
    if (Math.random() < 0.3) {
        socket.emit('player-move', {
            x: player.x,
            y: player.y,
            vx: player.vx,
            vy: player.vy
        });
    }
}

function restartGame() {
    gameOver = false;
    currentScore = 0;
    camera.x = 0;
    camera.targetX = 0;
    generatedChunks.clear();
    
    let index = 0;
    gameState.players.forEach(player => {
        player.x = 100 + index * 60;
        player.y = CONFIG.GROUND_Y - 50 - player.height / 2;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        index++;
    });
    
    initializeJungleDecorations();
    
    const messageEl = document.getElementById('game-message');
    messageEl.classList.remove('show');
    hideGameOverCard();
    
    socket.emit('game-restart');
}

// Continue in next part due to character limit...

function updateCamera() {
    let sumX = 0;
    let count = 0;
    
    gameState.players.forEach(player => {
        sumX += player.x;
        count++;
    });
    
    if (count > 0) {
        const avgX = sumX / count;
        camera.targetX = Math.max(camera.targetX, avgX - CONFIG.CANVAS_WIDTH / 2);
    }
    
    camera.x += (camera.targetX - camera.x) * camera.smoothing;
    camera.x = Math.max(0, camera.x);
}

function updateJungleAnimations(dt) {
    const time = performance.now() / 1000;
    
    jungleParticles.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.rotation += particle.rotationSpeed;
        
        const screenY = particle.y;
        if (screenY > CONFIG.CANVAS_HEIGHT) {
            particle.y = -10;
            particle.x = camera.x + Math.random() * CONFIG.CANVAS_WIDTH;
        }
        
        if (particle.x < camera.x - 50) {
            particle.x = camera.x + CONFIG.CANVAS_WIDTH + 50;
        }
        if (particle.x > camera.x + CONFIG.CANVAS_WIDTH + 50) {
            particle.x = camera.x - 50;
        }
    });
    
    vines.forEach(vine => {
        vine.segments.forEach(segment => {
            segment.swayOffset += segment.swaySpeed;
        });
    });
    
    butterflies.forEach(butterfly => {
        if (Math.random() < 0.01) {
            butterfly.targetX = camera.x + Math.random() * CONFIG.CANVAS_WIDTH;
            butterfly.targetY = Math.random() * (CONFIG.CANVAS_HEIGHT * 0.6);
        }
        
        const dx = butterfly.targetX - butterfly.x;
        const dy = butterfly.targetY - butterfly.y;
        butterfly.x += dx * 0.005 * butterfly.speed;
        butterfly.y += dy * 0.005 * butterfly.speed;
        
        butterfly.wingPhase += 0.15;
    });
}

function applyChainPhysics() {
    const players = Array.from(gameState.players.values());
    players.sort((a, b) => a.id.localeCompare(b.id));
    
    for (let i = 0; i < players.length - 1; i++) {
        const p1 = players[i];
        const p2 = players[i + 1];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > CONFIG.MAX_CHAIN_LENGTH) {
            const diff = distance - CONFIG.MAX_CHAIN_LENGTH;
            const percent = (diff / distance) * CONFIG.CHAIN_STIFFNESS;
            
            const offsetX = dx * percent;
            const offsetY = dy * percent;
            
            if (p1.id === gameState.playerId) {
                p1.x += offsetX;
                p1.y += offsetY;
            }
            if (p2.id === gameState.playerId) {
                p2.x -= offsetX;
                p2.y -= offsetY;
            }
        }
    }
}

function checkSpikeCollision(player, spike) {
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerBottom = player.y + player.height / 2;
    
    const spikeLeft = spike.x;
    const spikeRight = spike.x + spike.width;
    const spikeTop = spike.y - spike.height;
    
    return playerRight > spikeLeft && 
           playerLeft < spikeRight && 
           playerBottom > spikeTop &&
           playerBottom <= spike.y + 5;
}

function triggerGameOver(message) {
    if (gameOver) return;
    gameOver = true;
    
    // Calculate final score based on distance
    currentScore = Math.floor(camera.x / 10);
    
    // Update high score if needed
    if (currentScore > sessionHighScore) {
        sessionHighScore = currentScore;
    }
    
    // Show game over card
    showGameOverCard();
    
    // Hide the in-game restart button
    const restartBtn = document.getElementById('restart-btn');
    restartBtn.classList.add('hidden');
}

function showGameOverCard() {
    const card = document.getElementById('game-over-card');
    const finalScoreEl = document.getElementById('final-score');
    const highScoreEl = document.getElementById('high-score');
    
    finalScoreEl.textContent = currentScore;
    highScoreEl.textContent = sessionHighScore;
    
    card.classList.add('show');
}

function hideGameOverCard() {
    const card = document.getElementById('game-over-card');
    card.classList.remove('show');
    
    // Show the in-game restart button again
    const restartBtn = document.getElementById('restart-btn');
    restartBtn.classList.remove('hidden');
}

// Platform generation and collision (same as before)
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function getPlatformsInRange(startX, endX) {
    const platforms = [];
    const chunkStart = Math.floor(startX / CHUNK_SIZE);
    const chunkEnd = Math.ceil(endX / CHUNK_SIZE);
    
    for (let chunkIndex = chunkStart; chunkIndex <= chunkEnd; chunkIndex++) {
        if (!generatedChunks.has(chunkIndex)) {
            generatedChunks.set(chunkIndex, generateChunk(chunkIndex));
        }
        const chunkData = generatedChunks.get(chunkIndex);
        platforms.push(...chunkData.platforms);
    }
    
    return platforms;
}

function getHazardsInRange(startX, endX) {
    const hazards = { spikes: [], valleys: [] };
    const chunkStart = Math.floor(startX / CHUNK_SIZE);
    const chunkEnd = Math.ceil(endX / CHUNK_SIZE);
    
    for (let chunkIndex = chunkStart; chunkIndex <= chunkEnd; chunkIndex++) {
        if (!generatedChunks.has(chunkIndex)) {
            generatedChunks.set(chunkIndex, generateChunk(chunkIndex));
        }
        const chunkData = generatedChunks.get(chunkIndex);
        hazards.spikes.push(...chunkData.spikes);
        hazards.valleys.push(...chunkData.valleys);
    }
    
    return hazards;
}

function generateChunk(chunkIndex) {
    const platforms = [];
    const spikes = [];
    const valleys = [];
    const chunkStartX = chunkIndex * CHUNK_SIZE;
    const seed = worldSeed + chunkIndex * 1000;
    
    if (chunkIndex === 0) {
        platforms.push({
            x: 50,
            y: CONFIG.GROUND_Y - 30,
            width: 300,
            height: 20
        });
        
        platforms.push({
            x: 380,
            y: CONFIG.GROUND_Y - 80,
            width: 150,
            height: 20
        });
        
        return { platforms, spikes, valleys };
    }
    
    let lastPlatformEnd = chunkStartX;
    let lastPlatformY = CONFIG.GROUND_Y;
    
    if (chunkIndex > 0 && generatedChunks.has(chunkIndex - 1)) {
        const prevChunk = generatedChunks.get(chunkIndex - 1);
        if (prevChunk.platforms.length > 0) {
            const lastPlat = prevChunk.platforms[prevChunk.platforms.length - 1];
            lastPlatformEnd = lastPlat.x + lastPlat.width;
            lastPlatformY = lastPlat.y;
        }
    }
    
    let currentX = Math.max(chunkStartX, lastPlatformEnd);
    const chunkEndX = chunkStartX + CHUNK_SIZE;
    let platformIndex = 0;
    
    const numPlatforms = 2 + Math.floor(seededRandom(seed) * 2);
    
    while (platformIndex < numPlatforms && currentX < chunkEndX) {
        const platformSeed = seed + platformIndex * 100;
        
        const hasGroundPath = seededRandom(platformSeed + 50) < 0.2;
        
        if (!hasGroundPath) {
            const isValley = seededRandom(platformSeed + 51) < 0.5; // 50-50 between valleys and spikes
            
            if (isValley) {
                const valleyWidth = 100 + seededRandom(platformSeed + 52) * 120;
                valleys.push({
                    x: currentX + 10,
                    width: valleyWidth
                });
                currentX += valleyWidth + 10;
            } else {
                const spikeWidth = 50 + seededRandom(platformSeed + 53) * 50;
                spikes.push({
                    x: currentX + 10,
                    y: CONFIG.GROUND_Y,
                    width: spikeWidth,
                    height: 25
                });
                currentX += spikeWidth + 10;
            }
        } else {
            currentX += 60 + seededRandom(platformSeed + 54) * 40;
        }
        
        const platformWidth = 100 + seededRandom(platformSeed + 1) * 80;
        const platformHeight = 20;
        
        const maxHeightDiff = 80;
        const minY = Math.max(280, lastPlatformY - maxHeightDiff);
        const maxY = Math.min(CONFIG.GROUND_Y - 80, lastPlatformY + maxHeightDiff);
        const platformY = minY + seededRandom(platformSeed + 2) * (maxY - minY);
        
        const horizontalDistance = currentX - lastPlatformEnd;
        const verticalDistance = Math.abs(platformY - lastPlatformY);
        
        if (isJumpPossible(horizontalDistance, verticalDistance)) {
            platforms.push({
                x: currentX,
                y: platformY,
                width: platformWidth,
                height: platformHeight
            });
            
            lastPlatformEnd = currentX + platformWidth;
            lastPlatformY = platformY;
            currentX = lastPlatformEnd;
            platformIndex++;
        } else {
            const adjustedY = lastPlatformY + (seededRandom(platformSeed + 3) < 0.5 ? -50 : 50);
            const finalY = Math.max(280, Math.min(CONFIG.GROUND_Y - 80, adjustedY));
            
            platforms.push({
                x: currentX,
                y: finalY,
                width: platformWidth,
                height: platformHeight
            });
            
            lastPlatformEnd = currentX + platformWidth;
            lastPlatformY = finalY;
            currentX = lastPlatformEnd;
            platformIndex++;
        }
    }
    
    return { platforms, spikes, valleys };
}

function isJumpPossible(horizontalDistance, verticalDistance) {
    if (horizontalDistance > MAX_JUMP_DISTANCE) return false;
    if (verticalDistance > MAX_JUMP_HEIGHT) return false;
    
    if (verticalDistance > 0) {
        const maxHorizontalForHeight = MAX_JUMP_DISTANCE * (1 - verticalDistance / MAX_JUMP_HEIGHT);
        return horizontalDistance <= maxHorizontalForHeight;
    }
    
    return true;
}

function checkPlatformCollision(player, platform) {
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerTop = player.y - player.height / 2;
    const playerBottom = player.y + player.height / 2;
    
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.width;
    const platformTop = platform.y;
    const platformBottom = platform.y + platform.height;
    
    if (playerRight > platformLeft && 
        playerLeft < platformRight && 
        playerBottom > platformTop && 
        playerTop < platformBottom) {
        
        const overlapLeft = playerRight - platformLeft;
        const overlapRight = platformRight - playerLeft;
        const overlapTop = playerBottom - platformTop;
        const overlapBottom = platformBottom - playerTop;
        
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        
        if (minOverlap === overlapTop && player.vy > 0) {
            player.y = platformTop - player.height / 2;
            player.vy = 0;
            return true;
        } else if (minOverlap === overlapBottom && player.vy < 0) {
            player.y = platformBottom + player.height / 2;
            player.vy = 0;
        } else if (minOverlap === overlapLeft) {
            player.x = platformLeft - player.width / 2;
            player.vx = 0;
        } else if (minOverlap === overlapRight) {
            player.x = platformRight + player.width / 2;
            player.vx = 0;
        }
    }
    
    return false;
}

// Rendering continues in next message...

function initializeJungleDecorations() {
    jungleParticles = [];
    vines = [];
    butterflies = [];
    groundFlowers = [];
    platformMoss = new Map();
    
    for (let i = 0; i < 30; i++) {
        jungleParticles.push({
            x: Math.random() * CONFIG.CANVAS_WIDTH,
            y: Math.random() * CONFIG.CANVAS_HEIGHT,
            size: Math.random() * 3 + 2,
            speedX: Math.random() * 0.5 - 0.25,
            speedY: Math.random() * 0.3 + 0.1,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: Math.random() * 0.02 - 0.01,
            opacity: Math.random() * 0.4 + 0.3,
            color: ['#2D5016', '#3D6B1F', '#4A7C2C'][Math.floor(Math.random() * 3)]
        });
    }
    
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * CONFIG.CANVAS_WIDTH;
        const segments = [];
        const numSegments = Math.floor(Math.random() * 10) + 8;
        
        for (let j = 0; j < numSegments; j++) {
            segments.push({
                x: x + Math.sin(j * 0.5) * 10,
                y: j * 15,
                swayOffset: Math.random() * Math.PI * 2,
                swaySpeed: 0.02 + Math.random() * 0.01
            });
        }
        
        vines.push({ segments, thickness: Math.random() * 2 + 2 });
    }
    
    for (let i = 0; i < 5; i++) {
        butterflies.push({
            x: Math.random() * CONFIG.CANVAS_WIDTH,
            y: Math.random() * (CONFIG.CANVAS_HEIGHT * 0.6),
            targetX: 0,
            targetY: 0,
            speed: 0.3 + Math.random() * 0.3,
            wingPhase: Math.random() * Math.PI * 2,
            color1: ['#FF6B9D', '#FFD93D', '#6BCF7F', '#FF8C42'][Math.floor(Math.random() * 4)],
            color2: ['#C44569', '#FFA62B', '#3EA55D', '#D64933'][Math.floor(Math.random() * 4)]
        });
    }
}

function render() {
    if (!ctx) return;
    
    ctx.save();
    ctx.translate(-Math.floor(camera.x), 0);
    
    // Draw backdrop image (repeating)
    drawBackdrop();
    
    // Draw ground on top of backdrop
    drawGround();
    
    // Draw obstacles and hazards
    drawObstacles();
    
    // Draw chains
    drawChains();
    
    // Draw players
    gameState.players.forEach(player => {
        drawPlayer(player);
    });
    
    ctx.restore();
    
    drawUI();
}

function drawBackdrop() {
    if (backdropImage.complete) {
        const backdropWidth = backdropImage.width;
        const backdropHeight = backdropImage.height;
        
        // Scale to fit canvas height
        const scale = CONFIG.CANVAS_HEIGHT / backdropHeight;
        const scaledWidth = backdropWidth * scale;
        
        // Calculate how many times to repeat
        const startX = Math.floor((camera.x) / scaledWidth) * scaledWidth;
        const numRepeats = Math.ceil(CONFIG.CANVAS_WIDTH / scaledWidth) + 2;
        
        for (let i = 0; i < numRepeats; i++) {
            ctx.drawImage(
                backdropImage,
                startX + (i * scaledWidth),
                0,
                scaledWidth,
                CONFIG.CANVAS_HEIGHT
            );
        }
    } else {
        // Fallback background
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, '#4A90E2');
        gradient.addColorStop(1, '#B8E0D2');
        ctx.fillStyle = gradient;
        ctx.fillRect(camera.x, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }
}

function drawGround() {
    // Calculate visible range for procedural generation
    const startX = Math.floor(camera.x / 40) * 40 - 40;
    const endX = camera.x + CONFIG.CANVAS_WIDTH + 40;
    const time = performance.now() / 1000;
    
    // Draw solid ground base
    ctx.fillStyle = '#2D5016';
    ctx.fillRect(camera.x, CONFIG.GROUND_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y);
    
    // Ground top layer (grass)
    ctx.fillStyle = '#4A7C2C';
    ctx.fillRect(camera.x, CONFIG.GROUND_Y - 5, CONFIG.CANVAS_WIDTH, 5);
    
    // Grass blades with gentle breeze (procedural)
    ctx.strokeStyle = '#5D8C3E';
    ctx.lineWidth = 2;
    for (let x = startX; x < endX; x += 15) {
        for (let i = 0; i < 3; i++) {
            const gx = x + i * 5 + (i * 1.5);
            const height = 10 + (i * 3);
            const sway = Math.sin(time * 0.8 + x * 0.01 + i) * 2;
            
            ctx.beginPath();
            ctx.moveTo(gx, CONFIG.GROUND_Y);
            ctx.quadraticCurveTo(
                gx + sway,
                CONFIG.GROUND_Y - height/2,
                gx + sway * 1.5,
                CONFIG.GROUND_Y - height
            );
            ctx.stroke();
        }
    }
    
    // Colorful flowers with gentle sway (procedural placement)
    const flowerStartX = Math.floor((startX - 50) / 80) * 80 + 50;
    const flowerColors = ['#FF6B9D', '#FFD93D', '#9B59B6', '#FF8C42'];
    
    for (let x = flowerStartX; x < endX; x += 80) {
        const flowerSeed = Math.floor(x / 80);
        const fx = x + (seededRandom(flowerSeed * 1000) * 20);
        const colorIndex = Math.floor(seededRandom(flowerSeed * 1001) * flowerColors.length);
        const swayPhase = seededRandom(flowerSeed * 1002) * Math.PI * 2;
        const swaySpeed = 0.5 + seededRandom(flowerSeed * 1003) * 0.5;
        const sway = Math.sin(time * swaySpeed + swayPhase) * 1.5;
        
        ctx.fillStyle = flowerColors[colorIndex];
        for (let petal = 0; petal < 5; petal++) {
            const angle = (petal / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(
                fx + sway + Math.cos(angle) * 3,
                CONFIG.GROUND_Y - 15 + Math.sin(angle) * 3,
                3,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        // Center
        ctx.fillStyle = '#FFD93D';
        ctx.beginPath();
        ctx.arc(fx + sway, CONFIG.GROUND_Y - 15, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawObstacles() {
    const platforms = getPlatformsInRange(camera.x - 100, camera.x + CONFIG.CANVAS_WIDTH + 100);
    const hazards = getHazardsInRange(camera.x - 100, camera.x + CONFIG.CANVAS_WIDTH + 100);
    
    // Draw valleys first (cuts into ground)
    hazards.valleys.forEach(valley => {
        drawValley(valley);
    });
    
    // Draw spikes (on top of ground)
    hazards.spikes.forEach(spike => {
        drawSpikeTrap(spike);
    });
    
    // Draw wooden platforms
    platforms.forEach(platform => {
        drawWoodenPlatform(platform);
    });
}

function drawValley(valley) {
    const { x, width } = valley;
    const depth = 200;
    
    // Clear the ground area (make it transparent/show backdrop)
    ctx.clearRect(x, CONFIG.GROUND_Y, width, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y);
    
    // Draw dark abyss gradient
    const gradient = ctx.createLinearGradient(0, CONFIG.GROUND_Y, 0, CONFIG.GROUND_Y + depth);
    gradient.addColorStop(0, 'rgba(45, 62, 31, 0.8)');
    gradient.addColorStop(0.2, 'rgba(26, 36, 16, 0.9)');
    gradient.addColorStop(0.5, 'rgba(13, 15, 8, 0.95)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, CONFIG.GROUND_Y, width, depth);
    
    // Draw crumbling rock edges
    const numRocks = 6;
    
    // Left edge rocks
    for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = layer === 0 ? '#5B6B48' : layer === 1 ? '#4A5938' : '#3A4628';
        
        for (let i = 0; i < numRocks; i++) {
            const rockY = CONFIG.GROUND_Y + (i / numRocks) * 80;
            const rockSize = 8 - layer * 2 + Math.sin(x + i) * 3;
            const offsetX = -layer * 4;
            
            ctx.beginPath();
            ctx.arc(x + offsetX, rockY, rockSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Right edge rocks
    for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = layer === 0 ? '#5B6B48' : layer === 1 ? '#4A5938' : '#3A4628';
        
        for (let i = 0; i < numRocks; i++) {
            const rockY = CONFIG.GROUND_Y + (i / numRocks) * 80;
            const rockSize = 8 - layer * 2 + Math.sin(x + width + i) * 3;
            const offsetX = layer * 4;
            
            ctx.beginPath();
            ctx.arc(x + width + offsetX, rockY, rockSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Hanging grass/vegetation from edges
    ctx.fillStyle = '#4A7C2C';
    ctx.strokeStyle = '#3D6B1F';
    ctx.lineWidth = 2;
    
    // Left edge grass
    for (let i = 0; i < 4; i++) {
        const grassX = x - 5 + Math.sin(x + i) * 8;
        const grassY = CONFIG.GROUND_Y - 8;
        const hangLength = 10 + Math.sin(x * 0.1 + i) * 8;
        
        ctx.beginPath();
        ctx.moveTo(grassX, grassY);
        ctx.quadraticCurveTo(
            grassX + 3,
            grassY + hangLength / 2,
            grassX + 2,
            grassY + hangLength
        );
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(grassX + 2, grassY + hangLength, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Right edge grass
    for (let i = 0; i < 4; i++) {
        const grassX = x + width + 5 + Math.sin(x + width + i) * 8;
        const grassY = CONFIG.GROUND_Y - 8;
        const hangLength = 10 + Math.sin((x + width) * 0.1 + i) * 8;
        
        ctx.beginPath();
        ctx.moveTo(grassX, grassY);
        ctx.quadraticCurveTo(
            grassX - 3,
            grassY + hangLength / 2,
            grassX - 2,
            grassY + hangLength
        );
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(grassX - 2, grassY + hangLength, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Dark vignette at bottom for depth
    ctx.save();
    ctx.globalAlpha = 0.8;
    const bottomGradient = ctx.createRadialGradient(
        x + width / 2, CONFIG.GROUND_Y + depth - 20,
        width / 4,
        x + width / 2, CONFIG.GROUND_Y + depth - 20,
        width / 2
    );
    bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(x, CONFIG.GROUND_Y + depth - 40, width, 40);
    ctx.restore();
}

function drawSpikeTrap(spike) {
    const { x, y, width, height } = spike;
    const numSpikes = Math.floor(width / 16);
    
    const baseGradient = ctx.createLinearGradient(0, y - 8, 0, y);
    baseGradient.addColorStop(0, '#4A4A4A');
    baseGradient.addColorStop(1, '#2C2C2C');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(x, y - 8, width, 8);
    
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(x, y - 8, width, 2);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x, y, width, 3);
    
    for (let i = 0; i < numSpikes; i++) {
        const spikeX = x + (i * width / numSpikes) + (width / numSpikes / 2);
        const spikeBase = y - 8;
        const spikeTip = spikeBase - height;
        const spikeWidth = 10;
        
        const spikeGradient = ctx.createLinearGradient(
            spikeX - spikeWidth/2, spikeBase,
            spikeX + spikeWidth/2, spikeBase
        );
        spikeGradient.addColorStop(0, '#3A3A3A');
        spikeGradient.addColorStop(0.3, '#6A6A6A');
        spikeGradient.addColorStop(0.5, '#8A8A8A');
        spikeGradient.addColorStop(0.7, '#5A5A5A');
        spikeGradient.addColorStop(1, '#2A2A2A');
        
        ctx.fillStyle = spikeGradient;
        ctx.beginPath();
        ctx.moveTo(spikeX - spikeWidth/2, spikeBase);
        ctx.lineTo(spikeX, spikeTip);
        ctx.lineTo(spikeX + spikeWidth/2, spikeBase);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(spikeX - spikeWidth/2 + 1, spikeBase);
        ctx.lineTo(spikeX, spikeTip + 2);
        ctx.stroke();
    }
    
    const time = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = Math.sin(time * 4) * 0.15 + 0.25;
    
    const warningGradient = ctx.createRadialGradient(
        x + width / 2, y - height,
        0,
        x + width / 2, y - height,
        width / 2
    );
    warningGradient.addColorStop(0, 'rgba(255, 50, 50, 0.6)');
    warningGradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
    ctx.fillStyle = warningGradient;
    ctx.fillRect(x - 20, y - height - 10, width + 40, height + 10);
    ctx.restore();
}

function drawWoodenPlatform(platform) {
    const { x, y, width, height } = platform;
    const time = performance.now() / 1000;
    
    const platformKey = `${x}_${y}_${width}`;
    
    if (!platformMoss.has(platformKey)) {
        const mossPatches = [];
        const numPatches = Math.floor(width / 20);
        for (let i = 0; i < numPatches; i++) {
            mossPatches.push({
                offsetX: i * 20 + (i * 3 % 20),
                width: 8 + (i % 3) * 3,
                swayPhase: i * 0.5
            });
        }
        platformMoss.set(platformKey, mossPatches);
    }
    
    const woodGradient = ctx.createLinearGradient(x, y, x, y + height);
    woodGradient.addColorStop(0, '#A0826D');
    woodGradient.addColorStop(0.5, '#8B6F47');
    woodGradient.addColorStop(1, '#6B4423');
    ctx.fillStyle = woodGradient;
    ctx.fillRect(x, y, width, height);
    
    const plankWidth = 30;
    for (let px = x; px < x + width; px += plankWidth) {
        ctx.strokeStyle = 'rgba(61, 39, 19, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + height);
        ctx.stroke();
    }
    
    ctx.strokeStyle = 'rgba(107, 68, 35, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const gy = y + (i / 5) * height + (i % 2);
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + width, gy);
        ctx.stroke();
    }
    
    const mosses = platformMoss.get(platformKey);
    ctx.fillStyle = '#4A7C2C';
    mosses.forEach(moss => {
        const sway = Math.sin(time * 0.6 + moss.swayPhase) * 1;
        ctx.beginPath();
        ctx.ellipse(x + moss.offsetX + sway, y - 2, moss.width, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.strokeStyle = '#C4A57B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + width, y + 1);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y + height - 2, width, 2);
}

function drawChains() {
    const players = Array.from(gameState.players.values());
    players.sort((a, b) => a.id.localeCompare(b.id));
    
    for (let i = 0; i < players.length - 1; i++) {
        const p1 = players[i];
        const p2 = players[i + 1];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const isStretched = distance > CONFIG.MAX_CHAIN_LENGTH * 0.8;
        
        const segments = Math.ceil(distance / 15);
        
        ctx.strokeStyle = isStretched ? '#8B4513' : '#654321';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
            const t = s / segments;
            const x = p1.x + dx * t;
            const sag = Math.sin(t * Math.PI) * Math.min(distance * 0.1, 20);
            const y = p1.y + dy * t + sag;
            
            if (s === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        ctx.strokeStyle = isStretched ? '#A0522D' : '#8B6F47';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
            const t = s / segments;
            const x = p1.x + dx * t;
            const sag = Math.sin(t * Math.PI) * Math.min(distance * 0.1, 20);
            const y = p1.y + dy * t + sag;
            
            if (s === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        if (isStretched) {
            const time = performance.now() / 1000;
            ctx.save();
            ctx.globalAlpha = Math.sin(time * 8) * 0.3 + 0.4;
            ctx.strokeStyle = '#FF4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }
}

function drawPlayer(player) {
    // Determine player number (P1 or P2)
    const playerArray = Array.from(gameState.players.values()).sort((a, b) => a.id.localeCompare(b.id));
    const playerIndex = playerArray.findIndex(p => p.id === player.id);
    const playerNumber = playerIndex + 1; // P1 or P2
    
    // Get character image
    let characterImg = player.character === 'duck' ? duckImage : dogImage;
    
    if (characterImg && characterImg.complete) {
        // Draw character sprite standing upright (not squeezed)
        ctx.drawImage(
            characterImg,
            player.x - player.width / 2,
            player.y - player.height / 2,
            player.width,
            player.height
        );
        
        // Outline for players - blue for local player, pink for other player
        // Only show outline if we can detect transparency (images have transparent backgrounds)
        const isLocalPlayer = player.id === gameState.playerId;
        ctx.strokeStyle = isLocalPlayer ? '#4A90E2' : '#FF69B4';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            player.x - player.width / 2,
            player.y - player.height / 2,
            player.width,
            player.height
        );
    } else {
        // Fallback: draw emoji
        ctx.font = `${player.height}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.character === 'duck' ? '🦆' : '🐕', player.x, player.y);
    }
    
    // Draw P1/P2 label with triangular pointer above character
    const labelY = player.y - player.height / 2 - 20;
    const labelText = `P${playerNumber}`;
    const triangleSize = 8;
    const labelPadding = 8;
    
    // Measure text
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const textMetrics = ctx.measureText(labelText);
    const labelWidth = textMetrics.width + labelPadding * 2;
    const labelHeight = 18;
    
    // Draw background rectangle (pixelated style - no rounded corners)
    const labelX = player.x - labelWidth / 2;
    ctx.fillStyle = 'rgba(26, 26, 26, 0.9)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(labelX, labelY - labelHeight, labelWidth, labelHeight);
    ctx.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);
    
    // Draw triangular pointer pointing down (pixelated style)
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x - triangleSize, labelY);
    ctx.lineTo(player.x, labelY + triangleSize);
    ctx.lineTo(player.x + triangleSize, labelY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(labelText, player.x, labelY - 4);
}

function drawUI() {
    // Update current score continuously
    if (!gameOver) {
        currentScore = Math.floor(camera.x / 10);
    }
    
    ctx.save();
    ctx.fillStyle = 'rgba(26, 26, 26, 0.9)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 200, 50);
    ctx.fillRect(10, 10, 200, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'left';
    
    const distance = Math.floor(camera.x / 10);
    ctx.fillText(`DISTANCE: ${distance}m`, 20, 35);
    
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`PLAYERS: ${gameState.players.size}`, 20, 52);
    
    ctx.restore();
}


