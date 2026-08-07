// controller.js — läuft auf dem Handy
(() => {
  const params = new URLSearchParams(location.search);
  const peerTo = params.get('peer');
  const status = document.getElementById('status');
  
  if (!peerTo) {
    status.textContent = 'Keine Peer-ID in der URL. Scanne den QR-Code vom Bildschirm.';
    return;
  }

  // Configuration
  const config = {
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    messageQueueMax: 100,
    debounceMs: 16 // ~60fps
  };

  // State management
  const state = {
    peer: null,
    conn: null,
    reconnectCount: 0,
    connected: false,
    messageQueue: [],
    lastSendTime: 0,
    buttonStates: { left: false, right: false, jump: false },
    reconnectTimeout: null,
    supportsTouchEvents: 'ontouchstart' in window,
    supportsPointerEvents: 'PointerEvent' in window
  };

  // Initialize Peer with error handling
  function initPeer() {
    if (state.peer) state.peer.destroy();
    
    state.peer = new Peer({
      config: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] }
        ]
      }
    });

    state.peer.on('open', (id) => {
      attemptConnection();
    });

    state.peer.on('error', (err) => {
      updateStatus(`Fehler: ${err.type}`, 'error');
      if (err.type === 'network' || err.type === 'peer-unavailable') {
        scheduleReconnect();
      }
    });

    state.peer.on('disconnected', () => {
      updateStatus('Verbindung getrennt', 'disconnected');
      scheduleReconnect();
    });
  }

  // Connection management
  function attemptConnection() {
    if (state.connected || !state.peer) return;

    state.conn = state.peer.connect(peerTo, {
      reliable: true,
      serialization: 'json'
    });

    state.conn.on('open', () => {
      state.connected = true;
      state.reconnectCount = 0;
      updateStatus(`Verbunden mit ${peerTo.slice(0, 8)}...`, 'connected');
      processMessageQueue();
    });

    state.conn.on('close', () => {
      state.connected = false;
      updateStatus('Verbindung geschlossen', 'disconnected');
      scheduleReconnect();
    });

    state.conn.on('error', (err) => {
      state.connected = false;
      updateStatus(`Verbindungsfehler: ${err}`, 'error');
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (state.reconnectCount >= config.maxReconnectAttempts) {
      updateStatus('Maximale Reconnect-Versuche erreicht', 'error');
      return;
    }

    if (state.reconnectTimeout) clearTimeout(state.reconnectTimeout);
    
    state.reconnectCount++;
    const delay = config.reconnectDelay * Math.pow(1.5, state.reconnectCount - 1);
    updateStatus(`Verbinde neu... (${state.reconnectCount}/${config.maxReconnectAttempts})`, 'connecting');
    
    state.reconnectTimeout = setTimeout(() => {
      if (!state.connected) attemptConnection();
    }, delay);
  }

  // Message queue and sending
  function queueMessage(action, buttonState) {
    if (state.messageQueue.length >= config.messageQueueMax) {
      state.messageQueue.shift(); // Drop oldest if queue full
    }
    
    state.messageQueue.push({
      action,
      state: buttonState,
      timestamp: performance.now()
    });

    sendNextMessage();
  }

  function sendNextMessage() {
    if (!state.connected || state.messageQueue.length === 0) return;

    const now = performance.now();
    if (now - state.lastSendTime < config.debounceMs) return;

    const msg = state.messageQueue.shift();
    try {
      state.conn.send(msg);
      state.lastSendTime = now;
    } catch (e) {
      console.error('Send error:', e);
      state.messageQueue.unshift(msg); // Re-queue on failure
    }
  }

  function processMessageQueue() {
    while (state.messageQueue.length > 0) {
      sendNextMessage();
    }
  }

  // Status updates with visual feedback
  function updateStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status-${type}`;
    console.log(`[${type.toUpperCase()}]`, message);
  }

  // Button binding with modern event handling
  function bindButton(el, action) {
    const handlers = {
      pointerdown: (e) => handleButtonDown(e, el, action),
      pointerup: (e) => handleButtonUp(e, el, action),
      pointerleave: (e) => handleButtonUp(e, el, action)
    };

    // Use pointer events if available (handles mouse, touch, pen)
    if (state.supportsPointerEvents) {
      Object.entries(handlers).forEach(([event, handler]) => {
        el.addEventListener(event, handler, { passive: false });
      });
    } else {
      // Fallback for older browsers
      el.addEventListener('touchstart', (e) => { e.preventDefault(); handleButtonDown(e, el, action); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); handleButtonUp(e, el, action); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); handleButtonDown(e, el, action); });
      el.addEventListener('mouseup', (e) => { e.preventDefault(); handleButtonUp(e, el, action); });
      el.addEventListener('mouseleave', (e) => { e.preventDefault(); handleButtonUp(e, el, action); });
    }
  }

  function handleButtonDown(e, el, action) {
    e.preventDefault();
    if (!state.buttonStates[action]) {
      state.buttonStates[action] = true;
      el.classList.add('active');
      queueMessage(action, 'down');
    }
  }

  function handleButtonUp(e, el, action) {
    e.preventDefault();
    if (state.buttonStates[action]) {
      state.buttonStates[action] = false;
      el.classList.remove('active');
      queueMessage(action, 'up');
    }
  }

  // Special handling for jump (single press)
  function bindJumpButton(el) {
    const jumpHandler = (e) => {
      e.preventDefault();
      el.classList.add('active');
      queueMessage('jump', 'down');
      setTimeout(() => el.classList.remove('active'), 100);
    };

    if (state.supportsPointerEvents) {
      el.addEventListener('pointerup', jumpHandler, { passive: false });
    } else {
      el.addEventListener('click', jumpHandler);
    }
  }

  // Device orientation support
  function setupDeviceOrientation() {
    if (!state.supportsTouchEvents || !window.DeviceOrientationEvent) return;

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      const button = document.createElement('button');
      button.textContent = 'Bewegungssteuerung aktivieren';
      button.style.cssText = 'display:block;margin:10px auto;padding:10px;font-size:14px;';
      document.body.appendChild(button);

      button.addEventListener('click', () => {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleDeviceOrientation);
              button.remove();
              updateStatus('Bewegungssteuerung aktiv', 'info');
            }
          })
          .catch(console.error);
      });
    } else {
      // Non-iOS devices
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
  }

  function handleDeviceOrientation(event) {
    const gamma = event.gamma; // -90 to 90, left to right
    const threshold = 20;

    const wasLeft = state.buttonStates.left;
    const wasRight = state.buttonStates.right;

    state.buttonStates.left = gamma < -threshold;
    state.buttonStates.right = gamma > threshold;

    if (wasLeft !== state.buttonStates.left) {
      queueMessage('left', state.buttonStates.left ? 'down' : 'up');
    }
    if (wasRight !== state.buttonStates.right) {
      queueMessage('right', state.buttonStates.right ? 'down' : 'up');
    }
  }

  // Initialize
  function init() {
    initPeer();

    const left = document.getElementById('left');
    const right = document.getElementById('right');
    const jump = document.getElementById('jump');

    if (left && right && jump) {
      bindButton(left, 'left');
      bindButton(right, 'right');
      bindJumpButton(jump);
      
      // Optional: device orientation
      // setupDeviceOrientation();
    }

    updateStatus('Verbinde...', 'connecting');
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (state.reconnectTimeout) clearTimeout(state.reconnectTimeout);
    if (state.conn) state.conn.close();
    if (state.peer) state.peer.destroy();
  });

  init();
})();
