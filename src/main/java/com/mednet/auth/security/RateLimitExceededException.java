package com.mednet.auth.security;

/** A rate limit was reached; maps to HTTP 429 with {@code Retry-After}. */
public class RateLimitExceededException extends RuntimeException {

    public static final String MESSAGE = "Too many attempts. Please wait and try again later.";

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds) {
        super(MESSAGE);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
