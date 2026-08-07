// game.js — Obby Game (Parkour/Platformer)
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const info = document.getElementById('info');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');
  const statsEl = document.getElementById('stats');
  const qrCanvas = document.getElementById('qrCanvas');

  let gameRunning = false;
  let currentLevel = 1;
  let levelTimer = 0;
  let bestTime = localStorage.getItem('bestTime') || null;

  // Erstelle PeerJS Peer
  const peer = new Peer();
  let conn = null;

  peer.on('open', (id) => {
    const base = location.origin + location.pathname.replace(/\/$/, '');
    const controllerUrl = base + '/controller.html?peer=' + encodeURIComponent(id);

    if (window.QRCode && typeof QRCode.toCanvas === 'function') {
      QRCode.toCanvas(qrCanvas, controllerUrl, { width: 200 }, function (err) {
        if (err) console.error('QR error', err);
      });
    }
  });

  peer.on('connection', (c) => {
    conn = c;
    info.textContent = '✓ Controller verbunden!';
    info.className = 'connected';

    setTimeout(() => {
      startGame();
    }, 500);

    conn.on('data', (data) => {
      handleInput(data);
    });

    conn.on('close', () => {
      info.textContent = 'Controller getrennt';
      info.className = 'waiting';
      resetGame();
    });
  });

  // Game state
  const inputs = { left: false, right: false, jump: false };
  const player = {
    x: 50,
    y: 300,
    vx: 0,
    vy: 0,
    w: 24,
    h: 32,
    onGround: true,
    doubleJump: true,
    color: '#00ff88'
  };

  // Platforms
  let platforms = [];
  let checkpoints = [];
  let finishLine = null;

  function generateLevel(level) {
    platforms = [];
    checkpoints = [];

    // Start platform
    platforms.push({ x: 20, y: canvas.height - 50, w: 60, h: 20, color: '#667eea' });

    // Level 1 - Easy
    if (level === 1) {
      platforms.push({ x: 100, y: 400, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 180, y: 360, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 260, y: 320, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 340, y: 360, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 420, y: 400, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 500, y: 380, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 580, y: 340, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 660, y: 300, w: 60, h: 20, color: '#667eea' });
      platforms.push({ x: 720, y: 260, w: 70, h: 20, color: '#667eea' });
      finishLine = { x: 720, y: 240 };
    }
    // Level 2 - Medium
    else if (level === 2) {
      platforms.push({ x: 100, y: 380, w: 50, h: 15, color: '#f093fb' });
      platforms.push({ x: 170, y: 340, w: 50, h: 15, color: '#f093fb' });
      platforms.push({ x: 240, y: 300, w: 40, h: 15, color: '#f093fb' });
      platforms.push({ x: 300, y: 350, w: 50, h: 15, color: '#f093fb' });
      platforms.push({ x: 380, y: 320, w: 40, h: 15, color: '#f093fb' });
      platforms.push({ x: 440, y: 280, w: 50, h: 15, color: '#f093fb' });
      platforms.push({ x: 520, y: 240, w: 45, h: 15, color: '#f093fb' });
      platforms.push({ x: 590, y: 200, w: 50, h: 15, color: '#f093fb' });
      platforms.push({ x: 670, y: 160, w: 100, h: 20, color: '#f093fb' });
      finishLine = { x: 670, y: 140 };
    }
    // Level 3 - Hard
    else if (level === 3) {
      platforms.push({ x: 80, y: 380, w: 40, h: 15, color: '#f5576c' });
      platforms.push({ x: 140, y: 320, w: 35, h: 12, color: '#f5576c' });
      platforms.push({ x: 210, y: 280, w: 40, h: 12, color: '#f5576c' });
      platforms.push({ x: 280, y: 340, w: 35, h: 12, color: '#f5576c' });
      platforms.push({ x: 350, y: 300, w: 40, h: 12, color: '#f5576c' });
      platforms.push({ x: 420, y: 260, w: 35, h: 12, color: '#f5576c' });
      platforms.push({ x: 490, y: 200, w: 45, h: 15, color: '#f5576c' });
      platforms.push({ x: 570, y: 160, w: 40, h: 12, color: '#f5576c' });
      platforms.push({ x: 650, y: 120, w: 130, h: 20, color: '#f5576c' });
      finishLine = { x: 650, y: 100 };
    }
  }

  function handleInput(msg) {
    try {
      if (typeof msg === 'string') msg = JSON.parse(msg);
      if (msg && msg.action) {
        if (msg.action === 'left') inputs.left = msg.state === 'down';
        if (msg.action === 'right') inputs.right = msg.state === 'down';
        if (msg.action === 'jump' && msg.state === 'down') inputs.jump = true;
      }
    } catch (e) {}
  }

  function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    currentLevel = 1;
    levelTimer = 0;
    player.x = 50;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.doubleJump = true;

    generateLevel(currentLevel);

    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    info.textContent = '🏃 OBBY - Level ' + currentLevel;
    info.className = 'connected';
  }

  function nextLevel() {
    currentLevel++;
    levelTimer = 0;
    player.x = 50;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.doubleJump = true;

    if (currentLevel > 3) {
      endGame();
      return;
    }

    generateLevel(currentLevel);
    info.textContent = '🏃 OBBY - Level ' + currentLevel;
  }

  function endGame() {
    gameRunning = false;
    const totalTime = (levelTimer / 1000).toFixed(2);
    finalScoreEl.textContent = `Alle Levels fertig! Zeit: ${totalTime}s`;
    gameOverScreen.classList.add('active');
    info.textContent = 'Game finished!';
    info.className = 'waiting';

    if (!bestTime || parseFloat(totalTime) < parseFloat(bestTime)) {
      bestTime = totalTime;
      localStorage.setItem('bestTime', bestTime);
    }
  }

  function resetGame() {
    gameRunning = false;
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.remove('active');
  }

  function update(dt) {
    if (!gameRunning) return;

    levelTimer += dt * 1000;

    // Movement
    if (inputs.left) player.vx = -150;
    else if (inputs.right) player.vx = 150;
    else player.vx *= 0.8;

    // Apply velocity
    player.x += player.vx * dt;
    player.vy += 24 * dt; // Gravity
    player.y += player.vy * dt;

    // Bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

    // Platform collision
    player.onGround = false;
    for (const p of platforms) {
      if (
        player.x + player.w > p.x &&
        player.x < p.x + p.w &&
        player.vy >= 0 &&
        player.y + player.h >= p.y &&
        player.y + player.h <= p.y + p.h + 10
      ) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.doubleJump = true;
      }
    }

    // Jump
    if (inputs.jump) {
      if (player.onGround) {
        player.vy = -10;
        player.onGround = false;
        inputs.jump = false;
      } else if (player.doubleJump) {
        player.vy = -10;
        player.doubleJump = false;
        inputs.jump = false;
      }
    }

    // Fall death
    if (player.y > canvas.height) {
      player.y = 300;
      player.x = 50;
      player.vy = 0;
      player.onGround = true;
      player.doubleJump = true;
    }

    // Finish line
    if (
      finishLine &&
      player.x + player.w > finishLine.x &&
      player.x < finishLine.x + 100 &&
      player.y < finishLine.y + 50
    ) {
      nextLevel();
    }
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#1a1a3a');
    gradient.addColorStop(1, '#0a0a2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
  }

  function drawPlatforms() {
    for (const p of platforms) {
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(p.x, p.y + 2, p.w, p.h);

      // Platform
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // Shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(p.x, p.y, p.w, 4);

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  function drawPlayer() {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x + player.w / 2, player.y + player.h + 3, player.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 20;

    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);

    // Head
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, player.y - 8, player.w / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  function drawFinish() {
    if (!finishLine) return;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillRect(finishLine.x, finishLine.y, 100, 50);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏁', finishLine.x + 50, finishLine.y + 30);
  }

  function drawUI() {
    // Level
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${currentLevel}`, 20, 30);

    // Timer
    const time = (levelTimer / 1000).toFixed(2);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Time: ${time}s`, 20, 55);

    // Best time
    if (bestTime) {
      ctx.fillStyle = '#ff88ff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`Best: ${bestTime}s`, 20, 75);
    }

    // Connection
    if (conn && conn.open) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('🎮 Connected', canvas.width - 20, 30);
    }
  }

  function draw() {
    drawBackground();
    drawPlatforms();
    drawFinish();
    drawPlayer();
    drawUI();
  }

  // FPS Counter
  let fps = 60;
  let frameCount = 0;
  let lastFpsTime = performance.now();

  function updateFPS() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
      statsEl.textContent = `FPS: ${fps}`;
    }
  }

  // Game loop
  let lastTime = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastTime) / 1000);
    lastTime = t;

    update(dt);
    draw();
    updateFPS();

    requestAnimationFrame(loop);
  }

  // Restart button
  restartBtn.addEventListener('click', () => {
    if (conn && conn.open) {
      startGame();
    }
  });

  // Start loop
  requestAnimationFrame(loop);
})();
