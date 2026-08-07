// game.js — läuft auf dem großen Bildschirm
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
  let score = 0;
  let difficulty = 1;

  // Erstelle PeerJS Peer
  const peer = new Peer();
  let conn = null;

  peer.on('open', (id) => {
    // build a controller URL
    const base = location.origin + location.pathname.replace(/\/$/, '');
    const controllerUrl = base + '/controller.html?peer=' + encodeURIComponent(id);

    // Generate QR code
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

    // Start game when connected
    setTimeout(() => {
      startGame();
    }, 500);

    conn.on('data', (data) => {
      handleInput(data);
    });

    conn.on('close', () => {
      info.textContent = 'Controller getrennt';
      info.className = 'waiting';
      endGame();
    });
  });

  // Game state
  const inputs = { left: false, right: false, jump: false };
  const player = {
    x: 60,
    y: 280,
    vy: 0,
    w: 28,
    h: 44,
    onGround: true,
    color: '#00ff88',
    trail: []
  };
  const obstacles = [];
  let spawnTimer = 0;
  let gameTimer = 0;
  let frameCount = 0;
  let lastFpsTime = performance.now();

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

  function spawn() {
    const h = 20 + Math.random() * 60;
    const speed = 220 + difficulty * 30;
    obstacles.push({
      x: canvas.width + 30,
      w: 28,
      h: h,
      y: canvas.height - h - 10,
      speed: speed,
      color: `hsl(${Math.random() * 60}, 100%, 50%)`
    });
  }

  function startGame() {
    if (gameRunning) return;

    gameRunning = true;
    score = 0;
    difficulty = 1;
    gameTimer = 0;
    obstacles.length = 0;
    spawnTimer = 0;

    // Hide start screen
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');

    info.textContent = 'SPIELEN!';
    info.className = 'connected';

    console.log('Game started!');
  }

  function endGame() {
    gameRunning = false;
    finalScoreEl.textContent = `Score: ${Math.floor(score)}`;
    gameOverScreen.classList.add('active');
    info.textContent = 'Controller getrennt - Warte...';
    info.className = 'waiting';
  }

  function update(dt) {
    if (!gameRunning) return;

    gameTimer += dt;
    difficulty = 1 + gameTimer / 20; // Schwierigkeit nimmt zu

    // Player movement
    if (inputs.left && player.x > 0) player.x -= 200 * dt;
    if (inputs.right && player.x < canvas.width - player.w) player.x += 200 * dt;

    // Jump
    if (inputs.jump && player.onGround) {
      player.vy = -9;
      player.onGround = false;
      inputs.jump = false;
    }

    // Gravity
    player.vy += 24 * dt;
    player.y += player.vy;

    // Ground collision
    if (player.y > canvas.height - player.h - 10) {
      player.y = canvas.height - player.h - 10;
      player.vy = 0;
      player.onGround = true;
    }

    // Obstacles
    for (const o of obstacles) {
      o.x -= o.speed * dt;
    }

    // Remove offscreen obstacles
    while (obstacles.length && obstacles[0].x + obstacles[0].w < -50) {
      obstacles.shift();
      score += 10 * difficulty;
    }

    // Collisions
    for (const o of obstacles) {
      if (
        player.x < o.x + o.w &&
        player.x + player.w > o.x &&
        player.y < o.y + o.h &&
        player.y + player.h > o.y
      ) {
        // Collision
        endGame();
        return;
      }
    }

    // Spawn obstacles
    spawnTimer += dt;
    const spawnRate = Math.max(0.6, 1.2 - difficulty * 0.1);
    if (spawnTimer > spawnRate) {
      spawn();
      spawnTimer = 0;
    }
  }

  function drawBackground() {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#1a1a3a');
    gradient.addColorStop(1, '#0a0a2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 20; i++) {
      const x = (gameTimer * 10 + i * 40) % canvas.width;
      const y = 20 + (i * 7) % 100;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawGround() {
    ctx.fillStyle = '#444';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    // Animated ground pattern
    const pattern = ctx.createPattern(
      createPattern(),
      'repeat'
    );
    ctx.fillStyle = '#555';
    for (let i = 0; i < canvas.width; i += 40) {
      const offset = (gameTimer * 100) % 40;
      ctx.fillRect(i - offset, canvas.height - 8, 20, 8);
    }
  }

  function createPattern() {
    const p = document.createElement('canvas');
    p.width = 40;
    p.height = 8;
    const pctx = p.getContext('2d');
    pctx.fillStyle = '#666';
    pctx.fillRect(0, 0, 20, 8);
    return p;
  }

  function drawPlayer() {
    // Player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x + player.w / 2, canvas.height - 8, player.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player glow
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;

    // Player body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);

    // Player shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(player.x + 2, player.y + 2, player.w - 4, 8);

    ctx.shadowBlur = 0;
  }

  function drawObstacles() {
    for (const o of obstacles) {
      // Obstacle glow
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 10;

      // Main obstacle
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 4);

      ctx.shadowBlur = 0;
    }
  }

  function drawUI() {
    // Score
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);

    // Difficulty
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Lvl: ${Math.floor(difficulty * 10) / 10}`, 20, 55);

    // Connected status
    if (conn && conn.open) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('🎮 Connected', canvas.width - 20, 30);
    }
  }

  function draw() {
    // Clear and draw background
    drawBackground();
    drawGround();

    // Draw game elements
    drawObstacles();
    drawPlayer();
    drawUI();
  }

  // FPS Counter
  let fps = 60;
  let lastTime = performance.now();

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
