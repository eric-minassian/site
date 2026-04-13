function createRateLimiter(maxRequests: number, windowMs: number) {
  const records = new Map<string, number[]>();

  return (ip: string): boolean => {
    const now = Date.now();
    const timestamps = records.get(ip) ?? [];
    const valid = timestamps.filter((t) => now - t < windowMs);

    if (valid.length >= maxRequests) {
      records.set(ip, valid);
      return false;
    }

    valid.push(now);
    records.set(ip, valid);
    return true;
  };
}

// 5 site creations per IP per hour
export const checkRateLimit = createRateLimiter(5, 60 * 60 * 1000);

// 10 abuse reports per IP per hour
export const checkReportRateLimit = createRateLimiter(10, 60 * 60 * 1000);

// 20 failed auth attempts per IP per 15 minutes
export const checkAuthRateLimit = createRateLimiter(20, 15 * 60 * 1000);
