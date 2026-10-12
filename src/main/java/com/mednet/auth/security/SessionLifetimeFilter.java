package com.mednet.auth.security;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Ends a session once it is older than the absolute lifetime, however active it is; the container's
 * idle timeout still applies. Sign-in starts a new session (session-fixation protection), so the
 * session's creation time is the sign-in time. The request then continues signed out.
 */
class SessionLifetimeFilter extends OncePerRequestFilter {

    private final Duration absoluteTimeout;
    private final Clock clock;

    SessionLifetimeFilter(Duration absoluteTimeout, Clock clock) {
        this.absoluteTimeout = absoluteTimeout;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null && !absoluteTimeout.isZero() && !absoluteTimeout.isNegative()) {
            long ageMillis;
            try {
                ageMillis = clock.millis() - session.getCreationTime();
            } catch (IllegalStateException alreadyInvalidated) {
                ageMillis = -1;
            }
            if (ageMillis > absoluteTimeout.toMillis()) {
                session.invalidate();
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
