// Scroll-driven perspective, scoped to the home page and idle between scroll events.
let homeDepthCleanup = null;
const homeDepthMotion = matchMedia('(prefers-reduced-motion: reduce)');
function setupHomeDepth() {
  homeDepthCleanup?.();
  homeDepthCleanup = null;
  const root = document.querySelector('#site-shell');
  if ((location.hash.slice(1).split('?')[0] || 'home') !== 'home' || homeDepthMotion.matches || !('IntersectionObserver' in window)) return;
  const hero = root.querySelector('.animated-home-hero');
  if (!hero) return;
  const image = hero.querySelector('.hero-car');
  const surfaces = [...root.querySelectorAll('#app .brand-card,#app .vehicle-type-card,#app .trade-promo-link,#app .appointment-invite')];
  const active = new Set();
  let frame = null;
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  root.classList.add('home-depth-enabled');
  surfaces.forEach(element => element.classList.add('home-depth-surface'));
  function update() {
    frame = null;
    if (document.hidden) return;
    const height = window.innerHeight;
    const heroBox = hero.getBoundingClientRect();
    const progress = clamp(-heroBox.top / Math.max(heroBox.height,1),0,1);
    image.style.setProperty('--hero-depth-y',`${(progress*18).toFixed(2)}px`);
    image.style.setProperty('--hero-depth-tilt',`${(progress*4).toFixed(2)}deg`);
    image.style.setProperty('--hero-depth-scale',(1.06+progress*.035).toFixed(3));
    for (const element of active) {
      const rect = element.getBoundingClientRect();
      const position = clamp((height*.52-(rect.top+rect.height/2))/(height*.75+rect.height),-1,1);
      element.style.setProperty('--home-depth-tilt',`${(-position*8).toFixed(2)}deg`);
      element.style.setProperty('--home-depth-lift',`${(-position*13).toFixed(2)}px`);
      element.style.setProperty('--home-depth-scale',(1-Math.abs(position)*.018).toFixed(4));
    }
  }
  function schedule() { if (frame === null && !document.hidden) frame=requestAnimationFrame(update); }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if(entry.isIntersecting)active.add(entry.target);else active.delete(entry.target); });
    schedule();
  },{rootMargin:'180px 0px',threshold:0});
  surfaces.forEach(element => observer.observe(element));
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',schedule);
  schedule();
  homeDepthCleanup = () => {
    observer.disconnect();
    if(frame!==null)cancelAnimationFrame(frame);
    window.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
    document.removeEventListener('visibilitychange',schedule);
    root.classList.remove('home-depth-enabled');
    surfaces.forEach(element => {
      element.classList.remove('home-depth-surface');
      ['--home-depth-tilt','--home-depth-lift','--home-depth-scale'].forEach(property=>element.style.removeProperty(property));
    });
    ['--hero-depth-y','--hero-depth-tilt','--hero-depth-scale'].forEach(property=>image.style.removeProperty(property));
  };
}
if(homeDepthMotion.addEventListener)homeDepthMotion.addEventListener('change',setupHomeDepth);
else homeDepthMotion.addListener(setupHomeDepth);
