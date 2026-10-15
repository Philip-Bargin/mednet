package com.mednet.auth.security;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import com.mednet.auth.security.AuthRateLimitProperties.Limit;

import jakarta.servlet.http.HttpServletRequestWrapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthRateLimiterTests {

    @Test
    void trackedCountersStayWithinTheConfiguredBound() {
        AuthRateLimitProperties properties = new AuthRateLimitProperties();
        properties.setMaxTrackedKeys(100);
        AuthRateLimiter limiter = new AuthRateLimiter(properties, Clock.systemUTC());
        Limit limit = new Limit(5, Duration.ofHours(1));

        for (int client = 0; client < 10_000; client++) {
            limiter.consume("email-delivery", "client", "client-" + client, limit);
        }

        assertThat(limiter.trackedKeys()).isEqualTo(100);
    }

    @Test
    void theLimitHoldsWithinAWindowAndRejectionsAreNotCounted() {
        AuthRateLimiter limiter = new AuthRateLimiter(new AuthRateLimitProperties(), Clock.systemUTC());
        Limit limit = new Limit(2, Duration.ofMinutes(10));
        limiter.consume("reset-code", "account", "a", limit);
        limiter.consume("reset-code", "account", "a", limit);

        assertThatThrownBy(() -> limiter.consume("reset-code", "account", "a", limit))
                .isInstanceOf(RateLimitExceededException.class)
                .satisfies(error -> assertThat(((RateLimitExceededException) error).getRetryAfterSeconds())
                        .isBetween(1L, 601L));
        limiter.consume("reset-code", "account", "b", limit);
    }

    @Test
    void disabledLimitsCountNothing() {
        AuthRateLimitProperties properties = new AuthRateLimitProperties();
        properties.setEnabled(false);
        AuthRateLimiter limiter = new AuthRateLimiter(properties, Clock.systemUTC());
        Limit limit = new Limit(1, Duration.ofHours(1));
        for (int attempt = 0; attempt < 5; attempt++) {
            limiter.consume("email-delivery", "client", "same", limit);
        }
        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void accountKeysAreNormalizedAndDoNotContainTheAddress() {
        String key = AuthRateLimiter.accountKey(" Person@Example.TEST ");
        assertThat(key).isEqualTo(AuthRateLimiter.accountKey("person@example.test"));
        assertThat(key).doesNotContain("person").hasSize(32);
    }

    @Test
    void forwardingHeadersCountOnlyFromTrustedProxies() {
        AuthRateLimitProperties properties = new AuthRateLimitProperties();
        properties.setTrustedProxies(List.of("10.0.0.0/8", "::1"));
        ClientAddressResolver resolver = new ClientAddressResolver(properties);

        MockHttpServletRequest direct = request("203.0.113.9", "192.0.2.1");
        assertThat(resolver.resolve(direct)).isEqualTo("203.0.113.9");

        MockHttpServletRequest proxied = request("10.1.2.3", "198.18.0.1, 192.0.2.44, 10.9.9.9");
        assertThat(resolver.resolve(proxied)).isEqualTo("192.0.2.44");

        // Host names are never resolved; an unparseable hop falls back to the proxy itself.
        MockHttpServletRequest named = request("10.1.2.3", "attacker.example");
        assertThat(resolver.resolve(named)).isEqualTo("10.1.2.3");

        // Request wrappers (such as the framework's forwarded-header filter) cannot change the peer.
        HttpServletRequestWrapper wrapped = new HttpServletRequestWrapper(direct) {
            @Override
            public String getRemoteAddr() {
                return "192.0.2.1";
            }
        };
        assertThat(resolver.resolve(wrapped)).isEqualTo("203.0.113.9");
    }

    private static MockHttpServletRequest request(String peer, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }
}
