function setF() {
  mf = Array.from(D.modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(e => !e.disabled);
}

function openModal() {
  // Auto-close mobile menu when modal opens
  if (D.nav && D.nav.classList.contains('open')) {
    D.nav.classList.remove('open');
    D.menu.classList.remove('active');
    D.menu.setAttribute('aria-expanded', 'false');
    D.navBackdrop.classList.remove('show');
  }
  // Show loading overlay
  if (D.loadingOverlay) {
    D.loadingOverlay.classList.add('show');
    D.loadingOverlay.setAttribute('aria-hidden', 'false');
  }
  prev = document.activeElement;
  D.ov.classList.add('on');
  D.ov.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no');
  setF();
  D.modal.focus();
  document.addEventListener('keydown', onModalKey);
  // Simulate content load - hide loading overlay after 0.8s
  setTimeout(() => {
    if (D.loadingOverlay) {
      D.loadingOverlay.classList.remove('show');
      D.loadingOverlay.setAttribute('aria-hidden', 'true');
    }
  }, 800);
}

function openPaymentModal(title, url) {
  // Auto-close mobile menu when payment modal opens
  if (D.nav && D.nav.classList.contains('open')) {
    D.nav.classList.remove('open');
    D.menu.classList.remove('active');
    D.menu.setAttribute('aria-expanded', 'false');
    D.navBackdrop.classList.remove('show');
  }
  // Show loading overlay
  if (D.loadingOverlay) {
    if (D.loadingText) {
      D.loadingText.textContent = 'Processing Your Payment';
    }
    D.loadingOverlay.classList.add('show');
    D.loadingOverlay.setAttribute('aria-hidden', 'false');
  }
  const overlay = qs('.payment-overlay');
  const heading = overlay.querySelector('.payment-header h3');
  const iframeContainer = overlay.querySelector('.payment-body');
  heading.textContent = title;
  clearEl(iframeContainer);
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allow = 'payment';
  iframeContainer.appendChild(iframe);
  overlay.classList.add('on');
  document.body.classList.add('no');
  // Hide loading overlay after iframe loads
  iframe.onload = () => {
    if (D.loadingOverlay) {
      D.loadingOverlay.classList.remove('show');
      D.loadingOverlay.setAttribute('aria-hidden', 'true');
    }
  };
  // Also hide after 1.2s timeout as fallback
  setTimeout(() => {
    if (D.loadingOverlay) {
      D.loadingOverlay.classList.remove('show');
      D.loadingOverlay.setAttribute('aria-hidden', 'true');
    }
  }, 1200);
}

function closePaymentModal() {
  const overlay = qs('.payment-overlay');
  overlay.classList.remove('on');
  document.body.classList.remove('no');
  if (D.loadingOverlay) {
    D.loadingOverlay.classList.remove('show');
    D.loadingOverlay.setAttribute('aria-hidden', 'true');
  }
}

function closeModal() {
  D.ov.classList.remove('on');
  D.ov.setAttribute('aria-hidden', 'true');
  mc = null;
  document.body.classList.remove('no');
  document.removeEventListener('keydown', onModalKey);
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (D.loadingOverlay) {
    D.loadingOverlay.classList.remove('show');
    D.loadingOverlay.setAttribute('aria-hidden', 'true');
  }
  if (prev && prev.focus) prev.focus();
}

function onModalKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.key !== 'Tab' || !D.ov.classList.contains('on')) return;
  setF();
  if (!mf.length) return;
  const f = mf[0];
  const l = mf[mf.length - 1];
  if (e.shiftKey && document.activeElement === f) {
    e.preventDefault();
    l.focus();
  } else if (!e.shiftKey && document.activeElement === l) {
    e.preventDefault();
    f.focus();
  }
}

function startCountdown(endAt, container) {
  if (countdownTimer) clearInterval(countdownTimer);
  clearEl(container);
  if (!endAt) {
    return;
  }
  function tick() {
    const now = Date.now();
    const diff = endAt.getTime() - now;
    clearEl(container);
    if (diff <= 0) {
      container.appendChild(el('div', 'section-body', 'Event Ended'));
      return;
    }
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const parts = [
      { label: 'Days', value: d },
      { label: 'Hours', value: h },
      { label: 'Mins', value: m },
      { label: 'Secs', value: ss }
    ];
    parts.forEach(p => {
      const box = el('div', 'countbox');
      box.appendChild(el('div', '', String(p.value)));
      box.appendChild(el('div', 'muted', p.label));
      container.appendChild(box);
    });
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}
