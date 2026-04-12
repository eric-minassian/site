import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../lambda/api/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to 5 requests per IP per hour", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("1.2.3.4")).toBe(true);
    }
    expect(checkRateLimit("1.2.3.4")).toBe(false);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.1");
    }
    expect(checkRateLimit("10.0.0.1")).toBe(false);
    expect(checkRateLimit("10.0.0.2")).toBe(true);
  });

  it("resets after one hour", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("5.5.5.5");
    }
    expect(checkRateLimit("5.5.5.5")).toBe(false);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(checkRateLimit("5.5.5.5")).toBe(true);
  });
});
