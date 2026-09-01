// Mobile navigation toggle. Progressive enhancement: with JS off the nav is
// always visible, because .site-nav is only collapsed once .js-nav is set.
// The .js-nav class itself is added by a tiny inline script in <head> (not
// here) so it lands before first paint and the collapsed nav never flashes
// open-then-closed while this deferred file is still loading. The markup
// also ships aria-expanded="false" and data-open="false" as static
// defaults, so this file only needs to wire up the interactive behavior.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.dataset.open = String(open);
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
});
