/**
 * Global Client Interactions:
 * - Lenis Buttery Smooth Scrolling
 * - Smooth Anchor Link Interceptor
 * - Scroll Progress Hairline Indicator
 * - Live IST Time & Office Open/Standby Status Ticker
 * - Interactive Cursor Sheen Micro-Interactions on Cards
 * - Universal Scroll-Triggered Reveal Animations
 */
import Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
    __lenisDrivenByGsap?: boolean;
  }
}

export function initGlobalInteractions() {
  if (typeof window === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Lenis Smooth Scrolling
  let lenis: Lenis | null = null;
  if (!prefersReducedMotion) {
    try {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
      });

      window.__lenis = lenis;

      // Centralized RAF loop: suppressed when GSAP ticker takes control on index page
      let rafId: number;
      const raf = (time: number) => {
        if (!window.__lenisDrivenByGsap) {
          lenis?.raf(time);
        }
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);

      // Smooth scroll for anchor links
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
          const href = anchor.getAttribute('href');
          if (href && href.length > 1) {
            const target = document.querySelector(href);
            if (target && lenis) {
              e.preventDefault();
              lenis.scrollTo(target as HTMLElement, { offset: -80, duration: 1.2 });
            }
          }
        });
      });

      window.addEventListener('pagehide', () => {
        cancelAnimationFrame(rafId);
        lenis?.destroy();
      });
    } catch (err) {
      console.warn('Lenis smooth scrolling fallback to native:', err);
    }
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

  if (lenis) {
    lenis.on('scroll', (e: { scroll: number }) => {
      updateScrollProgress(e.scroll);
    });
  } else {
    window.addEventListener(
      'scroll',
      () => {
        updateScrollProgress(window.scrollY);
      },
      { passive: true }
    );
  }

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

  // 5. Interactive Light & Dark Theme Controller
  function setupThemeToggle() {
    const toggleButtons = document.querySelectorAll<HTMLButtonElement>('#theme-toggle, #mobile-theme-toggle, .btn--theme-toggle');
    if (toggleButtons.length === 0) return;

    const getCurrentTheme = (): 'light' | 'dark' => {
      const activeAttr = document.documentElement.getAttribute('data-theme');
      if (activeAttr === 'light' || activeAttr === 'dark') return activeAttr;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    };

    const updateButtonsAria = (currentTheme: 'light' | 'dark') => {
      toggleButtons.forEach((btn) => {
        btn.setAttribute('aria-pressed', currentTheme === 'light' ? 'true' : 'false');
        btn.setAttribute('title', `Current theme: ${currentTheme}. Click to switch to ${currentTheme === 'light' ? 'dark' : 'light'} theme.`);
      });
    };

    updateButtonsAria(getCurrentTheme());

    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const currentTheme = getCurrentTheme();
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nextTheme);
        try {
          localStorage.setItem('strova-theme', nextTheme);
        } catch (e) {}
        updateButtonsAria(nextTheme);
      });
    });
  }

  setupThemeToggle();
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalInteractions);
  } else {
    initGlobalInteractions();
  }
}
