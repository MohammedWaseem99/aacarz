// One-time viewport reveals. Navigation and interactive photo surfaces stay stable.
(() => {
  const selectors = [
    '.car-finder','.home-brands > .flex','.brand-card','.home-section-heading',
    '.range-heading','.range-tabs','.range-card','.range-navigation',
    '.vehicle-type-card','.home-guide > .eyebrow','.home-guide > .home-kicker',
    '.home-guide > h2','.home-guide-steps > div','.home-inline-link',
    '.trade-promo','.home-faq > h2','.home-faq > details','.appointment-invite',
    '.dealership-statistics > div > div','.brands-page > h1','.brands-page > .subtitle','.all-brands',
    '.browse-page > h1','.browse-page > .search-box','.browse-page > .category-tabs',
    '.browse-result-count','.car-card','.car-row','.brand-banner','.availability',
    '.product-heading','.product-visit-card','.product-section > h2',
    '.product-description > p','.product-downloads > button','.detail-section-heading',
    '.detail-info-card','.detail-spec-highlights > div','.condition-overview-card',
    '.condition-visit-note','.product-bottom-cta','.product-key-values > div',
    '.booking-page > h1','.booking-page > .subtitle','.booking-progress','#booking-form',
    '.booking-success > *','.purchase-page > h1','.purchase-page > .subtitle','.purchase-step',
    '.purchase-page > .button','.more-hub-intro','.more-quick-actions > a',
    '.more-group-heading','.more-hub-card','.more-explore-link',
    '.support-back','.support-intro','.faq-search','.faq-categories','.faq-result-count',
    '.support-question','.support-help','.faq-empty','.contact-visit','.contact-details > h2',
    '.contact-method','.contact-form-section','.contact-faq-link',
    '.trade-page-back','.trade-hero','.trade-introduction','.trade-process > h2',
    '.trade-process-step','.trade-prepare','.trade-faq','.trade-final',
    '.information-page > *','.compare-page > h1','.compare-grid > article',
    '.footer-main > *','.footer-bottom'
  ].join(',');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set();
  const initialized = new WeakSet();
  const roots = new Set();
  let observer = null, frame = null;

  function reveal(element, immediate = false) {
    if (immediate) element.classList.add('scroll-reveal-immediate');
    element.classList.add('scroll-reveal-visible');
    observer?.unobserve(element);
    pending.delete(element);
  }
  function prepare(element) {
    if (initialized.has(element) || motion.matches || !observer) return;
    // Avoid stacking a parent reveal with its own nested card/row reveals.
    if (element.parentElement?.closest('.scroll-reveal-target')) return;
    if (element.closest('#site-header,#bottom-nav,dialog,.gallery-stage,.gallery-thumbnails')) return;
    initialized.add(element);
    const index = [...(element.parentElement?.children || [])].indexOf(element);
    element.style.setProperty('--scroll-reveal-delay', `${Math.max(0, Math.min(index, 3)) * 45}ms`);
    element.classList.add('scroll-reveal-target');
    pending.add(element);
    observer.observe(element);
    if (document.activeElement !== document.body && element.contains(document.activeElement)) reveal(element, true);
  }
  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected) return;
    if (root.matches(selectors)) prepare(root);
    root.querySelectorAll(selectors).forEach(prepare);
  }
  function flush() {
    frame = null;
    try {
      for (const element of pending) if (!element.isConnected) { observer?.unobserve(element); pending.delete(element); }
      roots.forEach(scan);
    } catch { pending.forEach(element => reveal(element, true)); observer?.disconnect(); observer = null; }
    roots.clear();
  }
  function schedule(root) { roots.add(root); if (frame === null) frame = requestAnimationFrame(flush); }
  function configure() {
    observer?.disconnect();
    if (motion.matches || !('IntersectionObserver' in window)) {
      pending.forEach(element => reveal(element, true));
      observer = null;
      return;
    }
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) reveal(entry.target);
    }), { rootMargin: '0px 0px -16px 0px', threshold: .03 });
    pending.forEach(element => observer.observe(element));
    schedule(document.querySelector('#app'));
    schedule(document.querySelector('#site-footer'));
  }
  const changes = new MutationObserver(records => {
    if (motion.matches || !observer) return;
    for (const record of records) for (const node of record.addedNodes) {
      // Ignore counter/text updates: they should not trigger rescanning or motion.
      if (node instanceof Element) schedule(node);
    }
  });
  ['#app','#site-footer'].forEach(selector => {
    const root = document.querySelector(selector);
    if (root) changes.observe(root, { childList: true, subtree: true });
  });
  document.addEventListener('focusin', event => {
    let element = event.target instanceof Element ? event.target : null;
    while (element) { if (element.classList.contains('scroll-reveal-target')) reveal(element, true); element = element.parentElement; }
  });
  if (motion.addEventListener) motion.addEventListener('change', configure);
  else motion.addListener(configure);
  configure();
})();
