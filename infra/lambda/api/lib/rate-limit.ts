const records = new Map<string, number[]>();

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = records.get(ip) ?? [];
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);

  if (valid.length >= MAX_REQUESTS) {
    records.set(ip, valid);
    return false;
  }

  valid.push(now);
  records.set(ip, valid);
  return true;
}
