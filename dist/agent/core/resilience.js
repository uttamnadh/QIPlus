"use strict";
/**
 * MuseQA Resilience & Retry Module
 * Provides exponential backoff, retry for flaky network/DNS errors, circuit breakers, and health checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
exports.sleep = sleep;
exports.isRetryableError = isRetryableError;
exports.withRetry = withRetry;
exports.healthCheck = healthCheck;
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
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function isRetryableError(error, patterns = DEFAULT_RETRYABLE_PATTERNS) {
    const message = error?.message || String(error);
    return patterns.some(pattern => typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message));
}
async function withRetry(fn, options = {}, operationName = 'Operation') {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelay = options.initialDelayMs ?? 1000;
    const maxDelay = options.maxDelayMs ?? 15000;
    const multiplier = options.backoffMultiplier ?? 2;
    const patterns = options.retryablePatterns ?? DEFAULT_RETRYABLE_PATTERNS;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
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
class CircuitBreaker {
    constructor(threshold = 3) {
        this.failures = new Map();
        this.threshold = threshold;
    }
    recordFailure(key) {
        const current = (this.failures.get(key) || 0) + 1;
        this.failures.set(key, current);
        if (current >= this.threshold) {
            console.warn(`⚡ [CircuitBreaker] Breaker tripped for "${key}" (${current} consecutive failures). Further attempts will be bypassed.`);
        }
    }
    recordSuccess(key) {
        this.failures.delete(key);
    }
    isOpen(key) {
        return (this.failures.get(key) || 0) >= this.threshold;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Perform a preliminary health check against the target URL
 */
async function healthCheck(baseURL, timeoutMs = 15000) {
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
    }
    catch (err) {
        return {
            healthy: false,
            error: err.message || 'Connection failed',
        };
    }
}
