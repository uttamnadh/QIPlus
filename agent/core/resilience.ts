/**
 * MuseQA Resilience & Retry Module
 * Provides exponential backoff, retry for flaky network/DNS errors, circuit breakers, and health checks.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryablePatterns?: (string | RegExp)[];
}

const DEFAULT_RETRYABLE_PATTERNS = [
  /ERR_NAME_NOT_RESOLVED/i,
  /ERR_CONNECTION_RESET/i,
  /ERR_CONNECTION_REFUSED/i,
  /Timeout.*exceeded/i,
  /Navigation timeout/i,
  /net::ERR_/i,
  /Execution context was destroyed/i,
  /Target closed/i,
];

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isRetryableError(error: any, patterns: (string | RegExp)[] = DEFAULT_RETRYABLE_PATTERNS): boolean {
  const message = error?.message || String(error);
  return patterns.some(pattern =>
    typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  operationName = 'Operation'
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 15000;
  const multiplier = options.backoffMultiplier ?? 2;
  const patterns = options.retryablePatterns ?? DEFAULT_RETRYABLE_PATTERNS;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt > maxRetries || !isRetryableError(err, patterns)) {
        throw err;
      }
      const delay = Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
      console.warn(`⟳ [Retry ${attempt}/${maxRetries}] ${operationName} failed: "${err.message?.split('\n')[0]}". Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export class CircuitBreaker {
  private failures = new Map<string, number>();
  private readonly threshold: number;

  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  recordFailure(key: string): void {
    const current = (this.failures.get(key) || 0) + 1;
    this.failures.set(key, current);
    if (current >= this.threshold) {
      console.warn(`⚡ [CircuitBreaker] Breaker tripped for "${key}" (${current} consecutive failures). Further attempts will be bypassed.`);
    }
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  isOpen(key: string): boolean {
    return (this.failures.get(key) || 0) >= this.threshold;
  }
}

/**
 * Perform a preliminary health check against the target URL
 */
export async function healthCheck(baseURL: string, timeoutMs = 15000): Promise<{ healthy: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseURL}/login`, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    return {
      healthy: res.status < 500,
      status: res.status,
    };
  } catch (err: any) {
    return {
      healthy: false,
      error: err.message || 'Connection failed',
    };
  }
}
