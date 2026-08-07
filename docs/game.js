// game.js — läuft auf dem großen Bildschirm
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const info = document.getElementById('info');
  const peerIdEl = document.getElementById('peerId');
  const qrDiv = document.getElementById('qr');

  // Erstelle PeerJS Peer (verwendet öffentlichen PeerServer)
  const peer = new Peer();
  let conn = null;

  peer.on('open', (id) => {
    peerIdEl.textContent = id;
    // build a controller URL that keeps the current path (works on GitHub Pages subpath)
    const base = location.origin + location.pathname.replace(/\/$/, '');
    const controllerUrl = base + '/controller.html?peer=' + encodeURIComponent(id);
    info.textContent = 'Scanne den QR-Code mit dem Handy-Controller oder öffne: ' + controllerUrl;

    // Generate QR client-side into a canvas to avoid external image failures
    qrDiv.innerHTML = '<p>Scan mit dem Handy:</p>';
    const canvasQr = document.createElement('canvas');
    canvasQr.width = 200; canvasQr.height = 200;
    qrDiv.appendChild(canvasQr);
    if (window.QRCode && typeof QRCode.toCanvas === 'function') {
      QRCode.toCanvas(canvasQr, controllerUrl, { width: 200 }, function (err) {
        if (err) console.error('QR generation error', err);
      });
    } else {
      // fallback: show plain link if QR lib missing
      const a = document.createElement('a');
      a.href = controllerUrl; a.textContent = controllerUrl; a.target = '_blank';
      qrDiv.appendChild(a);
    }
  });

  peer.on('connection', (c) => {
    conn = c;
    info.textContent = 'Controller verbunden: ' + (conn.peer || '');

    conn.on('data', (data) => {
      // data: { action: 'left'|'right'|'jump', state: 'down'|'up' }
      handleInput(data);
    });

    conn.on('close', () => {
      info.textContent = 'Controller getrennt. Warte...';
    });
  });

  // simple input state
  const inputs = { left:false, right:false, jump:false };

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

  // game objects
  const player = { x:60, y:280, vy:0, w:28, h:44, onGround:true };
  const obstacles = [];
  let spawnTimer = 0;

  function spawn() {
    const h = 20 + Math.random() * 80;
    obstacles.push({ x: canvas.width + 30, w: 28, h: h, y: canvas.height - h });
  }

  function update(dt) {
    if (inputs.left) player.x -= 180 * dt;
    if (inputs.right) player.x += 180 * dt;
    if (inputs.jump && player.onGround) { player.vy = -8.2; player.onGround = false; }
    inputs.jump = false;

    player.vy += 22 * dt;
    player.y += player.vy;
    if (player.y > canvas.height - player.h) { player.y = canvas.height - player.h; player.vy = 0; player.onGround = true; }

    for (const o of obstacles) o.x -= 220 * dt;
    while (obstacles.length && obstacles[0].x + obstacles[0].w < -50) obstacles.shift();

    // collisions
    for (const o of obstacles) {
      if (player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y) {
        // collision -> reset
        player.x = 60; player.y = canvas.height - player.h; player.vy = 0; obstacles.length = 0;
      }
    }

    spawnTimer += dt;
    if (spawnTimer > 1.0) { spawn(); spawnTimer = 0; }
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#121212'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // ground
    ctx.fillStyle = '#444'; ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
    // player
    ctx.fillStyle = '#0f0'; ctx.fillRect(player.x, player.y, player.w, player.h);
    // obstacles
    ctx.fillStyle = '#c33';
    for (const o of obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
