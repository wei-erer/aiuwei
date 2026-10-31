const cover = document.querySelector('[data-cover]');

if (cover) {
  const html = document.documentElement;
  const body = document.body;
  const enterButton = cover.querySelector('[data-cover-enter]');
  const forced = new URLSearchParams(window.location.search).has('cover');
  let seen = false;

  try {
    seen = sessionStorage.getItem('aiuwei:cover-seen') === '1';
  } catch {
    seen = false;
  }

  if (seen && !forced) {
    cover.remove();
    body.classList.add('cover-complete');
    html.classList.add('cover-skip');
  } else {
    body.classList.add('cover-open', 'has-cover');
    html.classList.remove('cover-skip');

    const finish = () => {
      cover.remove();
      body.classList.remove('cover-open', 'has-cover');
      body.classList.add('cover-complete');
      html.classList.add('cover-skip');
      document.dispatchEvent(new CustomEvent('aiuwei:cover-complete'));
    };

    const enter = () => {
      if (cover.classList.contains('is-leaving')) return;
      cover.classList.add('is-leaving');
      cover.style.pointerEvents = 'none';
      body.classList.remove('cover-open');

      try {
        sessionStorage.setItem('aiuwei:cover-seen', '1');
      } catch {
        /* sessionStorage can be unavailable. */
      }

      if (forced) {
        const url = new URL(window.location.href);
        url.searchParams.delete('cover');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
      } else {
        window.setTimeout(finish, 900);
      }
    };

    enterButton?.addEventListener('click', enter);
    document.addEventListener('keydown', (event) => {
      if (cover.classList.contains('is-leaving')) return;
      if (event.key === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        enter();
      }
    });

    window.setTimeout(() => enterButton?.focus({ preventScroll: true }), 80);
  }
}
