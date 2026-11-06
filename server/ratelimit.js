/** Simple in-memory sliding-window rate limiter. */
export function createLimiter({ windowMs, max, key = (req) => req.ip }) {
  const buckets = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, times] of buckets) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length) buckets.set(k, fresh);
      else buckets.delete(k);
    }
  }, Math.max(windowMs, 60_000));
  timer.unref?.();

  return function limit(req, res, next) {
    const now = Date.now();
    const k = key(req);
    const times = (buckets.get(k) || []).filter((t) => now - t < windowMs);
    if (times.length >= max) {
      const retry = Math.ceil((windowMs - (now - times[0])) / 1000);
      res.status(429).json({
        ok: false,
        error: `Bạn thao tác quá nhanh, vui lòng thử lại sau ${retry} giây.`,
      });
      return;
    }
    times.push(now);
    buckets.set(k, times);
    next();
  };
}
