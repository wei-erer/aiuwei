const tabs = [...document.querySelectorAll('[data-lab-tab]')];
const panels = [...document.querySelectorAll('[data-lab-panel]')];

if (tabs.length && panels.length) {
  const names = new Set(tabs.map((tab) => tab.dataset.labTab));

  function activate(name, { updateHash = true } = {}) {
    if (!names.has(name)) return;
    tabs.forEach((tab) => {
      const active = tab.dataset.labTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.labPanel !== name;
    });
    if (updateHash) {
      window.history.replaceState({}, '', `#${name}`);
    }
    document.dispatchEvent(new CustomEvent('lab:tab', { detail: { name } }));
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.labTab));
  });

  window.addEventListener('hashchange', () => {
    const name = window.location.hash.replace('#', '');
    if (names.has(name)) activate(name, { updateHash: false });
  });

  const initial = window.location.hash.replace('#', '');
  activate(names.has(initial) ? initial : 'ai-or-human', { updateHash: false });
}
