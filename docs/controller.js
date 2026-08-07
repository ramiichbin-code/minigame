// controller.js — läuft auf dem Handy
(() => {
  const params = new URLSearchParams(location.search);
  const peerTo = params.get('peer');
  const status = document.getElementById('status');
  
  if (!peerTo) {
    status.textContent = 'Keine Peer-ID in der URL';
    return;
  }

  // State
  const state = {
    peer: null,
    conn: null,
    connected: false,
    buttonStates: { left: false, right: false, jump: false },
    reconnectCount: 0,
    peerjsReady: false
  };

  // Status Update
  function updateStatus(msg, type = 'info') {
    status.textContent = msg;
    status.className = `status-${type}`;
    console.log(`[${type}]`, msg);
  }

  // Wait for PeerJS or timeout
  function ensurePeerJS() {
    return new Promise((resolve) => {
      if (window.Peer) {
        state.peerjsReady = true;
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (window.Peer) {
          state.peerjsReady = true;
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // HARD TIMEOUT nach 5 Sekunden
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!state.peerjsReady) {
          console.error('PeerJS failed to load after 5s');
          updateStatus('PeerJS Fehler - Versuche trotzdem...', 'error');
        }
        resolve();
      }, 5000);
    });
  }

  // Init Peer mit Fehlertoleranz
  async function initPeer() {
    if (!window.Peer) {
      console.warn('Peer not available yet');
      setTimeout(initPeer, 1000);
      return;
    }

    try {
      state.peer = new Peer();
      
      state.peer.on('open', (id) => {
        console.log('Peer opened:', id);
        attemptConnection();
      });

      state.peer.on('error', (err) => {
        console.error('Peer error:', err.type, err);
        updateStatus(`Fehler: ${err.type}`, 'error');
      });

      state.peer.on('disconnected', () => {
        state.connected = false;
        updateStatus('Getrennt - versuche erneut...', 'disconnected');
        setTimeout(() => {
          if (!state.connected && state.peer) {
            state.peer.reconnect();
          }
        }, 1500);
      });
    } catch (e) {
      console.error('Peer init error:', e);
      setTimeout(initPeer, 2000);
    }
  }

  // Connect to game screen
  function attemptConnection() {
    if (state.connected || !state.peer) return;

    try {
      state.conn = state.peer.connect(peerTo, {
        reliable: true,
        serialization: 'json'
      });

      state.conn.on('open', () => {
        state.connected = true;
        state.reconnectCount = 0;
        updateStatus('✓ Verbunden!', 'connected');
        console.log('Connected to peer:', peerTo);
      });

      state.conn.on('close', () => {
        state.connected = false;
        updateStatus('Verbindung weg', 'disconnected');
        retryConnection();
      });

      state.conn.on('error', (err) => {
        state.connected = false;
        console.error('Conn error:', err);
        updateStatus('Verbindungsfehler', 'error');
        retryConnection();
      });
    } catch (e) {
      console.error('Connect error:', e);
      retryConnection();
    }
  }

  function retryConnection() {
    if (state.reconnectCount >= 3) {
      updateStatus('Zu viele Versuche', 'error');
      return;
    }
    state.reconnectCount++;
    updateStatus(`Retry ${state.reconnectCount}...`, 'connecting');
    setTimeout(() => {
      if (!state.connected && state.peer) {
        attemptConnection();
      }
    }, 800 + state.reconnectCount * 300);
  }

  // Send input
  function send(action, buttonState) {
    if (!state.connected || !state.conn) {
      console.debug('Not connected, skipping send');
      return;
    }
    try {
      state.conn.send({ action, state: buttonState });
    } catch (e) {
      console.error('Send error:', e);
    }
  }

  // Button Handler
  function bindButton(el, action) {
    const down = (e) => {
      e.preventDefault();
      if (!state.buttonStates[action]) {
        state.buttonStates[action] = true;
        el.classList.add('active');
        send(action, 'down');
      }
    };

    const up = (e) => {
      e.preventDefault();
      if (state.buttonStates[action]) {
        state.buttonStates[action] = false;
        el.classList.remove('active');
        send(action, 'up');
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  // Jump (single)
  function bindJumpButton(el) {
    el.addEventListener('pointerup', (e) => {
      e.preventDefault();
      send('jump', 'down');
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 100);
    });
  }

  // INIT
  async function init() {
    updateStatus('Lade...', 'connecting');
    
    // Buttons sofort ready
    const left = document.getElementById('left');
    const right = document.getElementById('right');
    const jump = document.getElementById('jump');

    if (left && right && jump) {
      bindButton(left, 'left');
      bindButton(right, 'right');
      bindJumpButton(jump);
      updateStatus('Buttons bereit', 'connecting');
    }

    // Wait for PeerJS (max 5s)
    await ensurePeerJS();

    // Init peer
    if (window.Peer) {
      initPeer();
    } else {
      updateStatus('PeerJS offline', 'error');
      console.error('PeerJS not loaded');
    }
  }

  init();

  // Cleanup
  window.addEventListener('beforeunload', () => {
    if (state.conn) state.conn.close();
    if (state.peer) state.peer.destroy();
  });
})();
