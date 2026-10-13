/**
 * Global Client Interactions:
 * - Native Smooth Scrolling for In-Page Anchor Links
 * - Scroll Progress Hairline Indicator
 * - Live IST Time & Office Open/Standby Status Ticker
 * - Interactive Cursor Sheen Micro-Interactions on Cards
 */

export function initGlobalInteractions() {
  if (typeof window === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Smooth scroll for anchor links
  if (!prefersReducedMotion) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href && href.length > 1) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
  }

  // 2. Top Scroll Progress Indicator
  const progressBar = document.getElementById('scroll-progress-bar');
  const updateScrollProgress = (currentScroll: number) => {
    if (!progressBar) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const progress = Math.min(100, Math.max(0, (currentScroll / docHeight) * 100));
      progressBar.style.width = `${progress}%`;
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      updateScrollProgress(window.scrollY);
    },
    { passive: true }
  );
  updateScrollProgress(window.scrollY);

  // 3. Live IST Time & Operating Hours Status Ticker
  function updateISTBadges() {
    const badges = document.querySelectorAll('.ist-status-badge');
    if (badges.length === 0) return;

    try {
      const now = new Date();

      // Formatted IST time (e.g., "1:15 PM")
      const timeFormat = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const istTime = timeFormat.format(now);

      // Compute if within operating hours: Mon-Sat, 10:00 to 19:00 IST
      const partFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
        weekday: 'short',
      });
      const parts = partFormatter.formatToParts(now);
      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
      const isSunday = weekday === 'Sun';
      const isOpen = !isSunday && hour >= 10 && hour < 19;

      badges.forEach((badge) => {
        const dot = badge.querySelector('.status-pulse-dot');
        const textSpan = badge.querySelector('.status-text');

        if (dot) {
          dot.className = `status-pulse-dot ${isOpen ? 'status-open' : 'status-standby'}`;
        }
        if (textSpan) {
          textSpan.innerHTML = `${istTime} IST &bull; ${isOpen ? 'Office Open' : 'IST UTC+5:30 &bull; Standby'}`;
        }
      });
    } catch {
      // Graceful fallback to static text if Intl timezone is unsupported
    }
  }

  updateISTBadges();
  setInterval(updateISTBadges, 15000);

  // 4. Interactive Cursor Sheen Micro-Interactions
  if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const cardSelectors =
      '.card, .division-card, .pricing-card, .case-study-card, .filter-card, .offering-card, .process-card, .pillar-card, .capability-card, [data-sheen="true"]';

    const cards = document.querySelectorAll<HTMLElement>(cardSelectors);

    cards.forEach((card) => {
      card.addEventListener('pointermove', (e: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });

      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--mouse-x', `-400px`);
        card.style.setProperty('--mouse-y', `-400px`);
      });
    });
  }

  // Ensure document remains permanently light and purge any legacy theme keys
  try {
    localStorage.removeItem('strova-theme');
    sessionStorage.removeItem('strova-theme');
  } catch (e) {}
  document.documentElement.removeAttribute('data-theme');
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalInteractions);
  } else {
    initGlobalInteractions();
  }
}
