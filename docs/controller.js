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
    reconnectCount: 0
  };

  // Schnelle Fehlerbehandlung
  function updateStatus(msg, type = 'info') {
    status.textContent = msg;
    status.className = `status-${type}`;
    console.log(`[${type}]`, msg);
  }

  // PeerJS mit TIMEOUT laden
  function loadPeerJS() {
    return new Promise((resolve) => {
      if (window.Peer) {
        resolve();
        return;
      }

      let loaded = false;
      const timeout = setTimeout(() => {
        if (!loaded) {
          console.warn('PeerJS timeout - trying fallback');
          updateStatus('PeerJS Fallback...', 'connecting');
          loadFallbackPeerJS().then(resolve);
        }
      }, 3000); // 3 Sekunden Timeout

      const checkPeer = setInterval(() => {
        if (window.Peer) {
          loaded = true;
          clearTimeout(timeout);
          clearInterval(checkPeer);
          resolve();
        }
      }, 100);
    });
  }

  // Fallback CDN
  function loadFallbackPeerJS() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.4.7/dist/peerjs.min.js';
      script.async = true;
      script.onload = () => {
        updateStatus('PeerJS geladen', 'connecting');
        resolve();
      };
      script.onerror = () => {
        updateStatus('PeerJS offline - Verbindung wird versucht...', 'error');
        resolve(); // Trotzdem weitermachen
      };
      document.head.appendChild(script);
    });
  }

  // Peer initialisieren
  function initPeer() {
    try {
      state.peer = new Peer();
      
      state.peer.on('open', (id) => {
        attemptConnection();
      });

      state.peer.on('error', (err) => {
        console.error('Peer error:', err);
        updateStatus(`Fehler: ${err.type}`, 'error');
      });

      state.peer.on('disconnected', () => {
        state.connected = false;
        scheduleReconnect();
      });
    } catch (e) {
      console.error('Init error:', e);
      updateStatus('Fehler beim Starten', 'error');
      setTimeout(initPeer, 2000);
    }
  }

  // Verbindung
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
      });

      state.conn.on('close', () => {
        state.connected = false;
        scheduleReconnect();
      });

      state.conn.on('error', (err) => {
        state.connected = false;
        updateStatus('Verbindung weg', 'disconnected');
        scheduleReconnect();
      });
    } catch (e) {
      console.error('Connection error:', e);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (state.reconnectCount >= 3) {
      updateStatus('Zu viele Versuche', 'error');
      return;
    }
    state.reconnectCount++;
    updateStatus(`Versuche ${state.reconnectCount}...`, 'connecting');
    setTimeout(() => {
      if (!state.connected && state.peer) attemptConnection();
    }, 1000 + state.reconnectCount * 500);
  }

  // Send mit Fehlertoleranz
  function send(action, buttonState) {
    if (!state.connected || !state.conn) return;
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

    // Pointer Events (modern)
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);

    // Fallback Touch/Mouse
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }

  // Jump (single press)
  function bindJumpButton(el) {
    el.addEventListener('pointerup', (e) => {
      e.preventDefault();
      send('jump', 'down');
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 100);
    });

    // Fallback
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (!state.connected) return;
      send('jump', 'down');
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 100);
    });
  }

  // INIT - schnell!
  async function init() {
    updateStatus('Lade...', 'connecting');
    
    // Buttons SOFORT interaktiv machen
    const left = document.getElementById('left');
    const right = document.getElementById('right');
    const jump = document.getElementById('jump');

    if (left && right && jump) {
      bindButton(left, 'left');
      bindButton(right, 'right');
      bindJumpButton(jump);
      updateStatus('Buttons bereit', 'connecting');
    }

    // PeerJS im Hintergrund laden
    await loadPeerJS();
    updateStatus('Starte Peer...', 'connecting');
    
    // Peer initialisieren
    if (window.Peer) {
      initPeer();
    } else {
      updateStatus('PeerJS nicht verfügbar', 'error');
    }
  }

  // Starte sofort!
  init();

  // Cleanup
  window.addEventListener('beforeunload', () => {
    if (state.conn) state.conn.close();
    if (state.peer) state.peer.destroy();
  });
})();
