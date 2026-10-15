package com.mednet.auth.security;

import java.io.IOException;

import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Refuses a sign-in before the password is checked once the client or the account has used up its
 * failed-attempt allowance, so guessing stops even when a guess would be right. Failures are counted
 * by {@link SecurityConfig}'s failure handler; a successful sign-in clears the account's count.
 */
class SignInRateLimitFilter extends OncePerRequestFilter {

    static final String BUCKET = "sign-in-failures";
    static final String LOGIN_PATH = "/api/v1/auth/login";

    private final AuthRateLimiter limiter;
    private final ClientAddressResolver clients;
    private final RateLimitResponseWriter rejected;

    SignInRateLimitFilter(AuthRateLimiter limiter, ClientAddressResolver clients, RateLimitResponseWriter rejected) {
        this.limiter = limiter;
        this.clients = clients;
        this.rejected = rejected;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !"POST".equals(request.getMethod()) || !LOGIN_PATH.equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        AuthRateLimitProperties limits = limiter.properties();
        try {
            limiter.check(BUCKET, "client", clients.resolve(request), limits.getSignInFailuresPerClient());
            String email = request.getParameter("email");
            if (email != null && !email.isBlank()) {
                limiter.check(BUCKET, "account", AuthRateLimiter.accountKey(email),
                        limits.getSignInFailuresPerAccount());
            }
        } catch (RateLimitExceededException exception) {
            rejected.write(request, response, exception);
            return;
        }
        chain.doFilter(request, response);
    }

    /** Called by the failure handler for wrong credentials (not for an unavailable account store). */
    static void recordFailure(AuthRateLimiter limiter, ClientAddressResolver clients, HttpServletRequest request) {
        AuthRateLimitProperties limits = limiter.properties();
        limiter.record(BUCKET, "client", clients.resolve(request), limits.getSignInFailuresPerClient());
        String email = request.getParameter("email");
        if (email != null && !email.isBlank()) {
            limiter.record(BUCKET, "account", AuthRateLimiter.accountKey(email), limits.getSignInFailuresPerAccount());
        }
    }

    static void clearAccount(AuthRateLimiter limiter, HttpServletRequest request) {
        String email = request.getParameter("email");
        if (email != null && !email.isBlank()) {
            limiter.reset(BUCKET, "account", AuthRateLimiter.accountKey(email));
        }
    }

    @FunctionalInterface
    interface RateLimitResponseWriter {
        void write(HttpServletRequest request, HttpServletResponse response, RateLimitExceededException exception)
                throws IOException;
    }
}
