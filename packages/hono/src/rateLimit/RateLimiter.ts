type RateLimiterOptions = {
  /** Hits allowed per window and key. */
  maxHits: number;
  windowMs: number;
  /** @default Date.now */
  now?: () => number;
};

/** In-memory sliding window rate limit, keyed by any string such as a client IP. */
export class RateLimiter {
  protected readonly maxHits: number;

  protected readonly windowMs: number;

  protected readonly now: () => number;

  /** Times of the hits inside the window, oldest first. */
  protected readonly hits = new Map<string, number[]>();

  protected lastPrunedAt: number;

  constructor(options: RateLimiterOptions) {
    this.maxHits = options.maxHits;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
    this.lastPrunedAt = this.now();
  }

  /** Records a hit for the key unless it's over the limit, returning the seconds to wait or 0 if it was allowed. */
  public hit(key: string): number {
    const now = this.now();
    this.pruneEvery(now);

    const times = this.recentHits(key, now);
    if (times.length >= this.maxHits) {
      return Math.ceil((times[0]! + this.windowMs - now) / 1000);
    }

    times.push(now);
    this.hits.set(key, times);
    return 0;
  }

  /** Forgets the hits of the key, such as after a successful login. */
  public reset(key: string): void {
    this.hits.delete(key);
  }

  /** Forgets every key whose hits all left the window. */
  public prune(): void {
    const now = this.now();
    this.lastPrunedAt = now;

    for (const [key, times] of this.hits) {
      if (times.at(-1)! <= now - this.windowMs) this.hits.delete(key);
    }
  }

  protected recentHits(key: string, now: number): number[] {
    const times = this.hits.get(key) ?? [];
    const start = times.findIndex((time) => time > now - this.windowMs);

    return start === -1 ? [] : times.slice(start);
  }

  // keeps memory bounded without a timer
  protected pruneEvery(now: number): void {
    if (now - this.lastPrunedAt >= this.windowMs) this.prune();
  }
}
