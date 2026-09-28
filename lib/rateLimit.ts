/**
 * Simple in-memory rate limiter.
 *
 * NOTE: This memory-based limiter tracks requests per IP inside the active Node.js / Serverless process.
 * It is suitable for single-instance applications or standard small deployments.
 * In a distributed, multi-region serverless fleet (like Vercel Enterprise with dozens of edge instances),
 * a distributed store such as Redis/Upstash would be recommended for global synchronization.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const ipRequestMap = new Map<string, RateLimitRecord>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute

/**
 * Extract client IP from proxy and forward headers safely.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // First IP in the list represents client
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "127.0.0.1";
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if the incoming request exceeds the rate limit of 20 req/min.
 */
export function checkRateLimit(req: Request): RateLimitResult {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let record = ipRequestMap.get(ip);
  if (!record) {
    record = { timestamps: [] };
    ipRequestMap.set(ip, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = record.timestamps[0] || now;
    const reset = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return {
      success: false,
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: 0,
      reset,
    };
  }

  record.timestamps.push(now);

  // Periodically clean up stale IPs (if map exceeds 10,000 entries)
  if (ipRequestMap.size > 10000) {
    for (const [key, val] of ipRequestMap.entries()) {
      if (val.timestamps.every((t) => t <= windowStart)) {
        ipRequestMap.delete(key);
      }
    }
  }

  return {
    success: true,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: MAX_REQUESTS_PER_WINDOW - record.timestamps.length,
    reset: 60,
  };
}
