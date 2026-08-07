// controller.js — läuft auf dem Handy
(() => {
  const params = new URLSearchParams(location.search);
  const peerTo = params.get('peer');
  const status = document.getElementById('status');
  if (!peerTo) {
    status.textContent = 'Keine Peer-ID in der URL. Scanne den QR-Code vom Bildschirm.';
    return;
  }

  const peer = new Peer();
  let conn = null;

  peer.on('open', (id) => {
    // Verbinde zum Bildschirm-Peer
    conn = peer.connect(peerTo);
    conn.on('open', () => {
      status.textContent = 'Verbunden mit ' + peerTo;
    });
    conn.on('close', () => { status.textContent = 'Verbindung geschlossen'; });
    conn.on('error', () => { status.textContent = 'Verbindungsfehler'; });
  });

  function send(action, state='down') {
    if (!conn || conn.open === false) return;
    try { conn.send({ action, state }); } catch (e) {}
  }

  // Buttons
  const left = document.getElementById('left');
  const right = document.getElementById('right');
  const jump = document.getElementById('jump');

  // Touch and mouse handlers
  function bindButton(el, action) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); send(action,'down'); }, { passive:false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); send(action,'up'); }, { passive:false });
    el.addEventListener('mousedown', (e) => { e.preventDefault(); send(action,'down'); });
    el.addEventListener('mouseup', (e) => { e.preventDefault(); send(action,'up'); });
    el.addEventListener('mouseleave', (e) => { e.preventDefault(); send(action,'up'); });
  }

  bindButton(left, 'left');
  bindButton(right, 'right');
  // jump is a single press
  jump.addEventListener('click', (e) => { e.preventDefault(); send('jump','down'); });
})();
