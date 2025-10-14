const headerContainer = document.getElementById('site-header');
function initHeaderToggle() {
  const toggle = document.querySelector('.menu-toggle');
  if (!toggle || toggle.dataset.bound === '1') return;
  const nav = document.getElementById(toggle.getAttribute('aria-controls') || 'main-nav');

  if (!nav) return;
  const open = () => {
    nav.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    document.documentElement.classList.add('menu-open');

  };
  const close = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    document.documentElement.classList.remove('menu-open');
  };
  toggle.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true') ? close() : open());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', e => { if (!nav.contains(e.target) && !toggle.contains(e.target)) close(); });
  toggle.dataset.bound = '1';


  // attempt to init on DOMContentLoaded if header HTML is embedded server-side
  document.addEventListener('DOMContentLoaded', () => initHeaderToggle());

  // delegated anchor handling: close menu and allow/force navigation
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    // Close the menu immediately
    close();
    // If a normal HTML page link and something else may block navigation, ensure navigation:
    // if (href && !href.startsWith('#') && !a.hasAttribute('target')) {
    //   setTimeout(() => { window.location.href = href; }, 100);
    // }
  });

  // tighten document click: only close when clicking outside nav/toggle
  document.addEventListener('click', (e) => {
    if (nav.contains(e.target) || toggle.contains(e.target))return;
    close();
  });
  toggle.dataset.bound = '1';


}

if (headerContainer) {
  const headerUrl = new URL('../header.html', import.meta.url).href;
  fetch(headerUrl)
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load header');
      return res.text();
    })
    .then((html) => {
      headerContainer.innerHTML = html;
      const currentFile = location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.main-nav a').forEach((a) => {
        const href = a.getAttribute('href');
        if (href === currentFile) a.classList.add('active');
      });
      initHeaderToggle();
    })
    .catch((err) => {
      console.error('Header load error:', err);
    });
}

// Menu open/close:
document.body.classList.add('menu-open');    // open
document.body.classList.remove('menu-open'); // close
// or toggle:
// document.body.classList.toggle('menu-open');