const headerContainer = document.getElementById('site-header');
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
    })
    .catch((err) => {
      console.error('Header load error:', err);
    });
}