/* ============================================================
   Live results dashboard  —  brother's view (no password)
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const socket = io();

  const statusEl = $('status');
  const entries = new Map(); // nameKey/mobile -> element

  socket.on('connect', () => {
    socket.emit('adminJoin');
    setStatus(true);
  });
  socket.on('disconnect', () => setStatus(false));

  socket.on('adminWelcome', (data) => {
    setStatus(true);
    (data.participants || []).forEach(p => upsert(p, false));
    refreshStats();
  });

  socket.on('participantUpdate', (p) => {
    upsert(p, true);
    refreshStats();
  });

  function setStatus(live) {
    statusEl.classList.toggle('live', live);
    statusEl.innerHTML = `<span class="pip"></span> ${live ? 'Live' : 'Reconnecting…'}`;
  }

  // Exact date + time in Indian Standard Time (IST)
  function fmtIST(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function keyOf(p) {
    return (p.name || '').toLowerCase().trim() + '|' + (p.mobile || '');
  }

  function renderEntry(el, p) {
    const codeBlock = p.secretCode
      ? `<div class="code-row"><span class="code-label">Secret code</span><span class="code-val">${esc(p.secretCode)}</span></div>`
      : '';

    const giftBlock = p.spun
      ? `<div class="gift-row"><span class="gift-pill">🎁 ${esc(p.giftName)}</span></div>`
      : `<div class="gift-row"><span class="pending">Registered — hasn't spun yet…</span></div>`;

    const whenLabel = p.spun ? 'Spun on' : 'Joined';
    const whenTime = fmtIST(p.spunAt || p.registeredAt);
    const timeBlock = `<div class="time-row"><span class="time-label">🕒 ${whenLabel}</span> ${esc(whenTime)} IST</div>`;

    const msgBlock = p.message
      ? `<div class="msg"><span class="msg-label">Her message 💛</span>${esc(p.message)}</div>`
      : '';

    el.innerHTML = `
      <div class="entry-top">
        <div class="entry-name">${esc(p.name)}</div>
        <div class="entry-mobile">📱 ${esc(p.mobile)}</div>
      </div>
      ${codeBlock}
      ${giftBlock}
      ${timeBlock}
      ${msgBlock}
    `;
  }

  function upsert(p, flash) {
    const empty = $('emptyState');
    if (empty) empty.remove();

    const k = keyOf(p);
    let el = entries.get(k);
    if (!el) {
      el = document.createElement('article');
      el.className = 'entry';
      entries.set(k, el);
      $('feed').prepend(el);
    }
    renderEntry(el, p);
    if (flash) {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
  }

  function refreshStats() {
    let spun = 0, msgs = 0;
    entries.forEach((el) => {
      if (el.querySelector('.gift-pill')) spun++;
      if (el.querySelector('.msg')) msgs++;
    });
    $('statTotal').textContent = entries.size;
    $('statSpun').textContent = spun;
    $('statMsgs').textContent = msgs;
  }
})();
