// この制限はインスタンス単位。Cloud Run 全体の制限は Cloud Armor 等で設定する。
export function createTranslationLimit(now = Date.now) {
  let windowStart = now();
  let requests = 0;

  return (_req, res, next) => {
    const time = now();
    if (time - windowStart >= 60_000 || time < windowStart) {
      windowStart = time;
      requests = 0;
    }
    if (requests >= 20) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((60_000 - (time - windowStart)) / 1000))));
      return res.status(429).json({ error: 'Translation rate limit exceeded' });
    }
    requests++;
    next();
  };
}
