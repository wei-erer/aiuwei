const header = document.querySelector('[data-header]');
const menu = document.querySelector('[data-mobile-menu]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const menuClose = document.querySelector('[data-menu-close]');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onScroll() {
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 12);
}

if (header) {
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function openMenu() {
  if (!menu || !menuToggle) return;
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  menuClose?.focus({ preventScroll: true });
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!menu || !menuToggle) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  if (restoreFocus) menuToggle.focus({ preventScroll: true });
}

menuToggle?.addEventListener('click', () => {
  if (menu?.classList.contains('is-open')) closeMenu();
  else openMenu();
});

menuClose?.addEventListener('click', () => closeMenu());

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => closeMenu({ restoreFocus: false }));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.classList.contains('is-open')) {
    closeMenu();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 1080 && menu?.classList.contains('is-open')) {
    closeMenu({ restoreFocus: false });
  }
});

const revealItems = document.querySelectorAll('[data-reveal]');

if (prefersReduced || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
  );

  revealItems.forEach((item) => observer.observe(item));
}

requestAnimationFrame(() => {
  document.body.classList.add('is-ready');
});

const yearTargets = document.querySelectorAll('[data-year]');
if (yearTargets.length) {
  const year = String(new Date().getFullYear());
  yearTargets.forEach((target) => {
    target.textContent = year;
  });
}
