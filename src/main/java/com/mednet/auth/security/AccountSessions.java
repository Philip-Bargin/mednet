package com.mednet.auth.security;

import java.util.Locale;

import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

/**
 * Ends every signed-in session of an account after a change that must
 * take effect immediately: password reset or change, suspension, role or email change, deletion.
 * The registry is per API process, like the session store itself.
 */
@Component
public class AccountSessions {

    private final SessionRegistry registry;

    public AccountSessions(SessionRegistry registry) {
        this.registry = registry;
    }

    public void endAll(String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        for (Object principal : registry.getAllPrincipals()) {
            if (normalized.equals(emailOf(principal))) {
                registry.getAllSessions(principal, false).forEach(SessionInformation::expireNow);
            }
        }
    }

    private static String emailOf(Object principal) {
        String email = null;
        if (principal instanceof UserDetails user) {
            email = user.getUsername();
        }
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
