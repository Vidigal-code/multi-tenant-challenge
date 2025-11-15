export type WebVitalMetric = { id: string; name: string; value: number; label?: string };

export function reportWebVitals(metric: WebVitalMetric) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production') {
    try {
      const payload = JSON.stringify({ ...metric, ts: Date.now() });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/metrics', payload);
      else {
        fetch('/api/metrics', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
      }
    } catch {}
  }
}
