package com.mednet.auth.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.mednet.auth.security.AuthRateLimitProperties.Limit;

/**
 * Fixed-window counters for authentication abuse protection, held in memory with a bounded number of
 * keys. Accounts are keyed by a hash of the normalized email, so no address is kept or logged.
 * Limits expire on their own; nothing here locks an account permanently.
 */
@Component
public class AuthRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(AuthRateLimiter.class);

    private final AuthRateLimitProperties properties;
    private final Clock clock;
    private final Map<String, Window> windows;

    public AuthRateLimiter(AuthRateLimitProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        int maxKeys = Math.max(1, properties.getMaxTrackedKeys());
        this.windows = new LinkedHashMap<>(256, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
                return size() > maxKeys;
            }
        };
    }

    public AuthRateLimitProperties properties() {
        return properties;
    }

    /** Counts this request and rejects it when the window already holds {@code limit} requests. */
    public void consume(String bucket, String scope, String key, Limit limit) {
        if (!properties.isEnabled()) {
            return;
        }
        Instant now = clock.instant();
        synchronized (windows) {
            Window window = current(bucket, scope, key, limit, now);
            if (window.count >= limit.getRequests()) {
                throw exceeded(window, limit, now);
            }
            window.count++;
            if (window.count == limit.getRequests()) {
                log.warn("Authentication rate limit reached for {} per {}", bucket, scope);
            }
        }
    }

    /** Rejects the request when earlier {@link #record} calls have filled the window; counts nothing. */
    public void check(String bucket, String scope, String key, Limit limit) {
        if (!properties.isEnabled()) {
            return;
        }
        Instant now = clock.instant();
        synchronized (windows) {
            Window window = windows.get(bucket + '|' + scope + '|' + key);
            if (window != null && !window.expired(limit, now) && window.count >= limit.getRequests()) {
                throw exceeded(window, limit, now);
            }
        }
    }

    /** Counts an event (for example a failed sign-in) for a later {@link #check}. */
    public void record(String bucket, String scope, String key, Limit limit) {
        if (!properties.isEnabled()) {
            return;
        }
        Instant now = clock.instant();
        synchronized (windows) {
            Window window = current(bucket, scope, key, limit, now);
            window.count++;
            if (window.count == limit.getRequests()) {
                log.warn("Authentication rate limit reached for {} per {}", bucket, scope);
            }
        }
    }

    public void reset(String bucket, String scope, String key) {
        synchronized (windows) {
            windows.remove(bucket + '|' + scope + '|' + key);
        }
    }

    int trackedKeys() {
        synchronized (windows) {
            return windows.size();
        }
    }

    /** A stable, non-reversible key for an email address. */
    public static String accountKey(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private Window current(String bucket, String scope, String key, Limit limit, Instant now) {
        String mapKey = bucket + '|' + scope + '|' + key;
        Window window = windows.get(mapKey);
        if (window == null || window.expired(limit, now)) {
            window = new Window(now);
            windows.put(mapKey, window);
        }
        return window;
    }

    private static RateLimitExceededException exceeded(Window window, Limit limit, Instant now) {
        long seconds = Duration.between(now, window.start.plus(limit.getWindow())).toSeconds() + 1;
        return new RateLimitExceededException(Math.max(1, seconds));
    }

    private static final class Window {

        private final Instant start;
        private int count;

        private Window(Instant start) {
            this.start = start;
        }

        private boolean expired(Limit limit, Instant now) {
            return !now.isBefore(start.plus(limit.getWindow()));
        }
    }
}
