package com.mednet.auth.api;

import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AdminAuthController {

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken());
    }

    @GetMapping("/admin/session")
    public AdminSession session(Authentication authentication) {
        return new AdminSession(authentication.getName(), role(authentication));
    }

    @GetMapping("/session")
    public AdminSession userSession(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign-in required");
        }
        return new AdminSession(authentication.getName(), role(authentication));
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

    public record CsrfResponse(String headerName, String token) {
    }

    public record AdminSession(String email, String role) {
    }

}