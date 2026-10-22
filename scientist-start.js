'use strict';

// Entry points reuse the existing navigation and never change experiment data.
(() => {
  const panel = document.getElementById('scientistStart');
  if (!panel) return;
  const requestedView = new URLSearchParams(location.search).get('view');
  panel.open = requestedView === 'overview';
  const main = document.querySelector('main');
  new MutationObserver(() => {
    if (main.classList.contains('focused-view')) panel.open = false;
  }).observe(main, { attributes: true, attributeFilter: ['class'] });

  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-start-view]');
    if (!button) return;
    const destination = document.querySelector('nav [data-view="' + button.dataset.startView + '"]');
    if (!destination || destination.hidden) return;
    panel.open = false;
    destination.click();
    const focusTarget = document.getElementById(button.dataset.startFocus || 'pageTitle');
    if (!focusTarget || focusTarget.hidden) return;
    // Headings need a focus target for keyboard users entering a new view.
    if (!focusTarget.matches('input,select,button,a,textarea')) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    focusTarget.scrollIntoView({ block: 'center' });
  });
})();
