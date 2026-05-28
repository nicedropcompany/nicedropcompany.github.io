// ════════════════════════════════════════════════════════════════════════════
// APP.JS — Global Initialization & Utilities
// ════════════════════════════════════════════════════════════════════════════

// 1. Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: false,
      offset: 100
    });
  }
});

// 2. Theme Toggle
(function () {
  const saved = localStorage.getItem('nd-theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
    localStorage.setItem('nd-theme', isLight ? 'dark' : 'light');
  });
}

// 3. Toast Notifications
function showToast(msg, type) {
  type = type || 'info';
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '9000',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', warning: '⚠', info: '◈' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML =
    '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
    '<span class="toast-msg">' + msg + '</span>';
  container.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('out');
    setTimeout(function () { toast.remove(); }, 320);
  }, 3200);
}

window.showToast = showToast;

// 4. Button Loading State
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._origHtml = btn.innerHTML;
    btn._origDisabled = btn.disabled;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
  } else {
    if (btn._origHtml !== undefined) btn.innerHTML = btn._origHtml;
    btn.disabled = btn._origDisabled || false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}
window.setButtonLoading = setButtonLoading;

// 6. Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', function () {
  initThemeToggle();
});
