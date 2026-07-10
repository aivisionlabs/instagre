/**
 * Google Analytics (GA4) wrapper for product event tracking.
 *
 * The app is client-only (no backend), so GA4 is the source of truth for
 * product analytics. `window.gtag` is only installed by index.html when
 * VITE_GA_MEASUREMENT_ID is set at build time — every call here is a no-op
 * (logged locally via `logger`) when it isn't, so this is safe to call from
 * local dev without a measurement ID configured.
 */

import { logger } from './logger';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type EventParams = Record<string, string | number | boolean | undefined>;

function hasGtag(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Load GA4's gtag.js and initialize `window.gtag`, if VITE_GA_MEASUREMENT_ID
 * is configured. No-op otherwise (local dev without the env var set). Call
 * once, on app startup, before any trackEvent/trackPageView calls.
 */
export function initAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) {
    logger.debug('analytics:init', 'VITE_GA_MEASUREMENT_ID not set, skipping GA4');
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  // SPA route changes are tracked manually via trackPageView, so disable
  // GA4's automatic page_view on load.
  window.gtag('config', measurementId, { send_page_view: false });
  logger.info('analytics:init', 'GA4 initialized', { measurementId });
}

/** Fire a GA4 custom event. Always mirrored to the local logger for debugging. */
export function trackEvent(name: string, params?: EventParams): void {
  logger.info('analytics:event', name, params);
  if (hasGtag()) window.gtag!('event', name, params);
}

/** Track a virtual page view for SPA tab navigation (GA's auto page_view is disabled in index.html). */
export function trackPageView(path: string, title?: string): void {
  logger.debug('analytics:pageview', path, { title });
  if (hasGtag()) {
    window.gtag!('event', 'page_view', {
      page_path: path,
      page_title: title,
      page_location: window.location.origin + path,
    });
  }
}

/** Associate subsequent events with a signed-in user (GA4 user_id for cross-session/device stitching). */
export function setAnalyticsUser(userId: string | null): void {
  if (!hasGtag()) return;
  window.gtag!('set', 'user_id', userId ?? undefined);
}
