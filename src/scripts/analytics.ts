/**
 * Cookieless privacy-friendly event dispatcher for Strova Group.
 * Respects Do Not Track (DNT) and collects zero personally identifiable information (PII).
 * Integrates cleanly with Umami, Cloudflare Web Analytics, or custom event beacons.
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // Respect Do Not Track
  if (navigator.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1') {
    return;
  }

  // 1. Dispatch custom DOM event
  try {
    const customEvent = new CustomEvent('strova:analytics', {
      detail: { event: eventName, data: eventData, timestamp: Date.now() },
    });
    window.dispatchEvent(customEvent);
  } catch {}

  // 2. Dispatch to Umami if configured
  if (window.umami && typeof window.umami.track === 'function') {
    window.umami.track(eventName, eventData);
  }

  // 3. Fallback console logging in development
  if (import.meta.env?.DEV) {
    console.debug(`[Analytics Event] ${eventName}`, eventData);
  }
}

export function initAnalyticsListeners() {
  if (typeof document === 'undefined') return;

  // Email click listener
  document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
    el.addEventListener('click', () => {
      trackEvent('email_click', { href: el.getAttribute('href') });
    });
  });

  // WhatsApp click listener
  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"]').forEach((el) => {
    el.addEventListener('click', () => {
      trackEvent('whatsapp_click', { href: el.getAttribute('href') });
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyticsListeners);
  } else {
    initAnalyticsListeners();
  }
}
