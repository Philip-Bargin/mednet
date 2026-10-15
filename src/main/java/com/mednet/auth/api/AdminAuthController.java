package com.mednet.auth.api;

import java.util.ArrayList;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AdminAuthController {

    private final ObjectProvider<ClientRegistrationRepository> registrations;
    private final Environment environment;

    public AdminAuthController(
            ObjectProvider<ClientRegistrationRepository> registrations,
            Environment environment) {
        this.registrations = registrations;
        this.environment = environment;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken());
    }

    @GetMapping("/admin/session")
    public AdminSession session(Authentication authentication) {
        return new AdminSession(email(authentication), role(authentication));
    }

    @GetMapping("/session")
    public AdminSession userSession(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign-in required");
        }
        return new AdminSession(email(authentication), role(authentication));
    }

    private static String role(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .filter(authority -> !authority.equals("USER"))
                .findFirst()
                .orElse("USER");
    }

    @GetMapping("/google/status")
    public GoogleStatus googleStatus() {
        if (registrations.getIfAvailable() != null) {
            return new GoogleStatus(true, List.of());
        }

        List<String> missingConfiguration = new ArrayList<>();
        if (!environment.getProperty("mednet.google.enabled", Boolean.class, false)) {
            missingConfiguration.add("GOOGLE_OAUTH_ENABLED");
        }
        if (!StringUtils.hasText(environment.getProperty("GOOGLE_CLIENT_ID"))) {
            missingConfiguration.add("GOOGLE_CLIENT_ID");
        }
        if (!StringUtils.hasText(environment.getProperty("GOOGLE_CLIENT_SECRET"))) {
            missingConfiguration.add("GOOGLE_CLIENT_SECRET");
        }
        if (!StringUtils.hasText(environment.getProperty("spring.datasource.url"))) {
            missingConfiguration.add("SPRING_DATASOURCE_URL");
        }
        if (missingConfiguration.isEmpty()) {
            missingConfiguration.add("OAUTH_REGISTRATION_UNAVAILABLE");
        }
        return new GoogleStatus(false, List.copyOf(missingConfiguration));
    }

    private static String email(Authentication authentication) {
        if (authentication.getPrincipal() instanceof OAuth2User user) {
            String email = user.getAttribute("email");
            if (email != null)
                return email;
        }
        return authentication.getName();
    }

    public record CsrfResponse(String headerName, String token) {
    }

    public record AdminSession(String email, String role) {
    }

    public record GoogleStatus(boolean enabled, List<String> missingConfiguration) {
    }
}