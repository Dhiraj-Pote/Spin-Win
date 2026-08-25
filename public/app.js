/* ============================================================
   Raksha Bandhan Spin & Win  —  sister's app
   ============================================================ */
(() => {
  'use strict';

  const socket = io();
  const TWO_PI = Math.PI * 2;

  const state = {
    gifts: [],
    rotation: 0,
    isSpinning: false,
    dragging: false,
    demosLeft: 2,
    finalArmed: false,
    finalDone: false,
    result: null,
  };

  const $ = (id) => document.getElementById(id);
  const screens = {
    welcome: $('screen-welcome'),
    wheel:   $('screen-wheel'),
    result:  $('screen-result'),
    message: $('screen-message'),
    done:    $('screen-done'),
  };
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('is-active'));
    screens[name].classList.add('is-active');
  }

  /* ============================================================
     1.  DETAILS FORM
     ============================================================ */
  const detailsForm = $('detailsForm');
  const nameInput = $('nameInput');
  const mobileInput = $('mobileInput');
  const codeInput = $('codeInput');
  const formError = $('formError');

  mobileInput.addEventListener('input', () => {
    mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
  });

  detailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const mobile = mobileInput.value.trim();
    const secretCode = codeInput.value.trim();
    formError.textContent = '';

    if (name.length < 2) { formError.textContent = 'Please enter your name.'; return; }
    if (mobile.length !== 10) { formError.textContent = 'Please enter a valid 10-digit mobile number.'; return; }
    if (!secretCode) { formError.textContent = 'Please choose a secret code.'; return; }

    audio.resume();
    const btn = $('startBtn');
    btn.disabled = true;

    socket.emit('register', { name, mobile, secretCode }, (res) => {
      btn.disabled = false;
      if (!res || !res.ok) {
        formError.textContent = (res && res.error) || 'Something went wrong. Please try again.';
        return;
      }
      if (res.alreadySpun) {
        state.result = { index: res.giftIndex, name: res.giftName };
        state.finalDone = true;
        revealResult();
        return;
      }
      startWheelScreen();
    });
  });

  /* ============================================================
     2.  WHEEL DRAWING
     ============================================================ */
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const SIZE = canvas.width;
  const CENTER = SIZE / 2;
  const RADIUS = CENTER - 14;

  // light, festive rotating palette (pops on the airy background)
  const COLORS = [
    { fill: '#f0955a', text: '#fff6ec' }, // coral
    { fill: '#f7c650', text: '#6e4a10' }, // marigold
    { fill: '#ec8ea3', text: '#5a1626' }, // rose
    { fill: '#f6d98a', text: '#6e4a10' }, // soft gold
  ];

  function segAngle() { return TWO_PI / Math.max(state.gifts.length, 1); }

  function drawWheel() {
    const n = state.gifts.length;
    if (!n) return;
    const seg = segAngle();

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(state.rotation);

    for (let i = 0; i < n; i++) {
      const start = -Math.PI / 2 + i * seg;
      const end = start + seg;
      const pal = COLORS[i % COLORS.length];

      const grad = ctx.createRadialGradient(0, 0, RADIUS * 0.12, 0, 0, RADIUS);
      grad.addColorStop(0, shade(pal.fill, 30));
      grad.addColorStop(1, shade(pal.fill, -6));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, RADIUS, start, end);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      drawLabel(state.gifts[i].name, start + seg / 2, pal.text);
    }
    ctx.restore();
    drawRim();
  }

  function drawLabel(text, mid, color) {
    ctx.save();
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 2;

    const lines = wrapText(text, 15);
    const fontSize = lines.length > 2 ? 31 : 36;
    ctx.font = `600 ${fontSize}px 'Poppins', sans-serif`;
    const lineH = fontSize + 4;
    const startY = -((lines.length - 1) * lineH) / 2;
    const x = RADIUS - 24;
    lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH));
    ctx.restore();
  }

  function wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur.trim()); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }

  function drawRim() {
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.beginPath();
    ctx.arc(0, 0, RADIUS + 3, 0, TWO_PI);
    ctx.lineWidth = 15;
    const rimGrad = ctx.createLinearGradient(-RADIUS, -RADIUS, RADIUS, RADIUS);
    rimGrad.addColorStop(0, '#f6d98a');
    rimGrad.addColorStop(0.5, '#d99a34');
    rimGrad.addColorStop(1, '#f6d98a');
    ctx.strokeStyle = rimGrad;
    ctx.stroke();

    const beads = 24;
    for (let i = 0; i < beads; i++) {
      const a = (i / beads) * TWO_PI;
      const bx = Math.cos(a) * (RADIUS + 3);
      const by = Math.sin(a) * (RADIUS + 3);
      ctx.beginPath();
      ctx.arc(bx, by, 5.5, 0, TWO_PI);
      ctx.fillStyle = i % 2 ? '#fff' : '#ef8354';
      ctx.fill();
    }
    ctx.restore();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  /* ============================================================
     3.  SPIN PHYSICS
     ============================================================ */
  const spinBtn = $('spinBtn');
  const tapShield = $('tapShield');
  let samples = [];
  let lastPointerAngle = 0;

  function pointerAngle(x, y) {
    const r = canvas.getBoundingClientRect();
    return Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2));
  }
  function normalize(a) { a %= TWO_PI; return a < 0 ? a + TWO_PI : a; }
  function shortDelta(a) { while (a > Math.PI) a -= TWO_PI; while (a < -Math.PI) a += TWO_PI; return a; }

  function canSpinNow() {
    if (state.isSpinning) return false;
    if (state.demosLeft > 0) return true;
    return state.finalArmed && !state.finalDone;
  }

  function onDown(e) {
    if (!canSpinNow()) return;
    const pt = e.touches ? e.touches[0] : e;
    state.dragging = true;
    lastPointerAngle = pointerAngle(pt.clientX, pt.clientY);
    samples = [{ t: performance.now(), r: state.rotation }];
    if (e.cancelable) e.preventDefault();
  }
  function onMove(e) {
    if (!state.dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const a = pointerAngle(pt.clientX, pt.clientY);
    state.rotation += shortDelta(a - lastPointerAngle);
    lastPointerAngle = a;
    const now = performance.now();
    samples.push({ t: now, r: state.rotation });
    samples = samples.filter(s => now - s.t < 140);
    drawWheel();
    if (e.cancelable) e.preventDefault();
  }
  function onUp() {
    if (!state.dragging) return;
    state.dragging = false;
    let vel = 0;
    if (samples.length >= 2) {
      const f = samples[0], l = samples[samples.length - 1];
      const dt = l.t - f.t;
      if (dt > 0) vel = (l.r - f.r) / dt;
    }
    if (Math.abs(vel) < 0.004) vel = 0.035;
    launchSpin(vel);
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  spinBtn.addEventListener('click', () => {
    if (state.dragging || !canSpinNow()) return;
    audio.resume();
    launchSpin(0.045 + Math.random() * 0.02);
  });

  function launchSpin(velocity) {
    if (state.isSpinning) return;

    if (state.demosLeft > 0) {
      const target = Math.floor(Math.random() * state.gifts.length);
      beginSpinAnimation(target, velocity, false);
    } else if (state.finalArmed && !state.finalDone) {
      state.isSpinning = true;
      lockUI(true);
      spinBtn.disabled = true;
      socket.emit('finalSpin', (res) => {
        if (!res || !res.ok) {
          state.isSpinning = false; lockUI(false); spinBtn.disabled = false;
          $('footNote').textContent = (res && res.error) || 'Connection issue — try again.';
          return;
        }
        state.result = { index: res.giftIndex, name: res.giftName };
        state.isSpinning = false;
        beginSpinAnimation(res.giftIndex, velocity, true);
      });
    }
  }

  function beginSpinAnimation(targetIndex, velocity, isFinal) {
    state.isSpinning = true;
    lockUI(true);
    spinBtn.disabled = true;

    const seg = segAngle();
    const speedAbs = Math.min(Math.abs(velocity), 0.09);
    const dir = velocity < 0 ? -1 : 1;
    // MUST be a whole number of turns so the wheel lands exactly on target.
    const fullTurns = Math.max(3, Math.round(3 + (speedAbs / 0.09) * 8));
    const duration = 3200 + (speedAbs / 0.09) * 3000;

    // land within the segment but not always dead-centre (kept inside the slice)
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const targetMod = normalize(-(targetIndex + 0.5) * seg + jitter);
    const currentMod = normalize(state.rotation);
    const delta = dir > 0 ? normalize(targetMod - currentMod) : -normalize(currentMod - targetMod);

    const startRot = state.rotation;
    const endRot = startRot + dir * (fullTurns * TWO_PI) + delta;

    const t0 = performance.now();
    let lastTickSeg = currentSegment();

    function frame(now) {
      let p = (now - t0) / duration;
      if (p > 1) p = 1;
      const eased = 1 - Math.pow(1 - p, 4);
      state.rotation = startRot + (endRot - startRot) * eased;
      drawWheel();
      const segNow = currentSegment();
      if (segNow !== lastTickSeg) { audio.tick(); lastTickSeg = segNow; }
      if (p < 1) requestAnimationFrame(frame);
      else {
        state.rotation = normalize(endRot);
        drawWheel();
        state.isSpinning = false;
        onSpinComplete(targetIndex, isFinal);
      }
    }
    requestAnimationFrame(frame);
  }

  function currentSegment() {
    const seg = segAngle();
    return Math.floor(normalize(-state.rotation) / seg) % state.gifts.length;
  }
  function lockUI(on) { tapShield.hidden = !on; }

  /* ============================================================
     4.  DEMO  →  FINAL FLOW
     ============================================================ */
  function startWheelScreen() {
    showScreen('wheel');
    updateWheelUI();
    requestAnimationFrame(drawWheel);
    // greet with the practice-spins explainer
    $('demoModal').hidden = false;
    if (navigator.vibrate) navigator.vibrate(50);
  }

  $('demoReadyBtn').addEventListener('click', () => {
    $('demoModal').hidden = true;
    audio.resume();
  });

  function updateWheelUI() {
    const banner = $('modeBanner');
    const badge = $('modeBadge');
    const modeText = $('modeText');
    const dots = document.querySelectorAll('#demoDots .dot');
    const doneCount = 2 - state.demosLeft;

    if (!state.finalArmed) {
      // practice mode
      banner.className = 'mode-banner mode-banner--demo';
      badge.textContent = 'PRACTICE';
      modeText.textContent = '2 free spins to try';
      $('demoDots').style.display = '';
      dots.forEach((d, i) => {
        d.classList.toggle('done', i < doneCount);
        d.classList.toggle('active', i === doneCount);
      });
      $('wheelTitle').textContent = 'Practice Spin';
      $('wheelHint').textContent = 'Flick the wheel to spin.';
      $('footNote').textContent = `Spin ${Math.min(doneCount + 1, 2)} of 2`;
      $('hubLabel').textContent = 'SPIN';
    } else {
      // final mode
      banner.className = 'mode-banner mode-banner--final';
      badge.textContent = 'FINAL';
      modeText.textContent = 'This one counts!';
      $('demoDots').style.display = 'none';
      $('wheelTitle').textContent = 'Your Real Spin';
      $('wheelHint').textContent = 'Good luck! 🍀';
      $('footNote').textContent = '';
      $('hubLabel').textContent = 'GO!';
    }
  }

  function onSpinComplete(targetIndex, isFinal) {
    spinBtn.disabled = false;
    lockUI(false);

    if (!isFinal) {
      state.demosLeft -= 1;
      if (state.demosLeft > 0) {
        $('footNote').textContent = 'One more free spin.';
        setTimeout(updateWheelUI, 1400);
      } else {
        $('footNote').textContent = 'Get ready…';
        setTimeout(showFinalModal, 900);
      }
      return;
    }

    state.finalDone = true;
    setTimeout(revealResult, 600);
  }

  /* ---- final modal ---- */
  const finalModal = $('finalModal');
  function showFinalModal() {
    finalModal.hidden = false;
    audio.chime();
    if (navigator.vibrate) navigator.vibrate(80);
  }
  $('readyBtn').addEventListener('click', () => {
    finalModal.hidden = true;
    state.finalArmed = true;
    updateWheelUI();
  });

  /* ============================================================
     5.  RESULT + MESSAGE + DONE
     ============================================================ */
  function revealResult() {
    const r = state.result || { name: '—' };
    $('giftText').textContent = r.name;
    $('doneGift').textContent = r.name;
    showScreen('result');
    audio.chime();
    confetti.celebrate();
    if (navigator.vibrate) navigator.vibrate([40, 60, 120]);
  }

  $('toMessageBtn').addEventListener('click', () => showScreen('message'));

  const messageForm = $('messageForm');
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('messageInput').value.trim();
    $('sendMsgBtn').disabled = true;
    socket.emit('thankYouMessage', msg, () => finishUp());
    setTimeout(finishUp, 1200);
  });
  $('skipMsgBtn').addEventListener('click', finishUp);

  let finished = false;
  function finishUp() {
    if (finished) return;
    finished = true;
    showScreen('done');
    confetti.celebrate();
  }

  /* ============================================================
     6.  SOUND ENGINE
     ============================================================ */
  const audio = (() => {
    let ac = null;
    function ensure() {
      if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
      return ac;
    }
    return {
      resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
      tick() {
        const c = ensure(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = 1250;
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.06);
      },
      chime() {
        const c = ensure(); if (!c) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'sine'; o.frequency.value = f;
          const t = c.currentTime + i * 0.12;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          o.connect(g).connect(c.destination);
          o.start(t); o.stop(t + 0.65);
        });
      },
    };
  })();

  /* ============================================================
     7.  CONFETTI
     ============================================================ */
  const confetti = (() => {
    const fx = $('fx');
    const fctx = fx.getContext('2d');
    let parts = []; let running = false;
    const CS = ['#f6b93b', '#ef8354', '#e0607f', '#d99a34', '#ffd9a1', '#f6d98a'];
    function resize() { fx.width = innerWidth; fx.height = innerHeight; }
    addEventListener('resize', resize); resize();
    function spawn() {
      const cx = fx.width / 2;
      for (let i = 0; i < 140; i++) {
        parts.push({
          x: cx + (Math.random() - 0.5) * 140,
          y: fx.height * 0.26 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 9,
          g: 0.22 + Math.random() * 0.12, size: 6 + Math.random() * 7,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          color: CS[(Math.random() * CS.length) | 0], life: 1,
          shape: Math.random() < 0.5 ? 'rect' : 'circ',
        });
      }
    }
    function loop() {
      fctx.clearRect(0, 0, fx.width, fx.height);
      parts.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.006;
        fctx.save(); fctx.globalAlpha = Math.max(0, p.life);
        fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.fillStyle = p.color;
        if (p.shape === 'rect') fctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        else { fctx.beginPath(); fctx.arc(0, 0, p.size / 2, 0, TWO_PI); fctx.fill(); }
        fctx.restore();
      });
      parts = parts.filter(p => p.life > 0 && p.y < fx.height + 40);
      if (parts.length) requestAnimationFrame(loop);
      else { running = false; fctx.clearRect(0, 0, fx.width, fx.height); }
    }
    return { celebrate() { spawn(); setTimeout(spawn, 250); setTimeout(spawn, 550); if (!running) { running = true; requestAnimationFrame(loop); } } };
  })();

  /* ============================================================
     8.  FLOATING PETALS (ambient background)
     ============================================================ */
  (() => {
    const pc = $('petals');
    const pctx = pc.getContext('2d');
    let petals = [];
    function resize() { pc.width = innerWidth; pc.height = innerHeight; init(); }
    function init() {
      const count = Math.min(18, Math.round(innerWidth / 60));
      petals = Array.from({ length: count }, () => make(Math.random() * pc.height));
    }
    function make(y) {
      return {
        x: Math.random() * pc.width, y,
        r: 6 + Math.random() * 8,
        sway: Math.random() * TWO_PI, swaySpeed: 0.01 + Math.random() * 0.02,
        vy: 0.3 + Math.random() * 0.6, rot: Math.random() * TWO_PI, vr: (Math.random() - 0.5) * 0.02,
        hue: Math.random() < 0.5 ? '#f7c9a3' : '#f4b8c4', alpha: 0.35 + Math.random() * 0.35,
      };
    }
    function loop() {
      pctx.clearRect(0, 0, pc.width, pc.height);
      petals.forEach(p => {
        p.sway += p.swaySpeed; p.y += p.vy; p.x += Math.sin(p.sway) * 0.6; p.rot += p.vr;
        if (p.y > pc.height + 20) { Object.assign(p, make(-20)); }
        pctx.save(); pctx.globalAlpha = p.alpha;
        pctx.translate(p.x, p.y); pctx.rotate(p.rot); pctx.fillStyle = p.hue;
        pctx.beginPath();
        pctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TWO_PI);
        pctx.fill(); pctx.restore();
      });
      requestAnimationFrame(loop);
    }
    addEventListener('resize', resize); resize(); loop();
  })();

  /* ============================================================
     9.  BOOTSTRAP
     ============================================================ */
  fetch('/api/gifts').then(r => r.json()).then(gifts => {
    state.gifts = gifts;
    state.rotation = Math.random() * TWO_PI; // random starting angle each visit
    drawWheel();
  }).catch(() => {
    state.gifts = [
      { name: 'Designer Diary with Knob' }, { name: 'Mixed Dry Fruits Set' },
      { name: 'Perfume Set' }, { name: '\u20B9500 Cash' },
      { name: 'Foxtail SPA 70+ Sunscreen' }, { name: 'Diary with Password Lock' },
      { name: 'Mini Bluetooth Speaker' }, { name: 'Hair Dryer' },
    ];
    drawWheel();
  });
})();
