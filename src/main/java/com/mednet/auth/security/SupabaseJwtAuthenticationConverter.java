package com.mednet.auth.security;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final SupabaseAccountIdentityService identities;

    public SupabaseJwtAuthenticationConverter(SupabaseAccountIdentityService identities) {
        this.identities = identities;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (Boolean.TRUE.equals(jwt.getClaimAsBoolean("is_anonymous"))
                || !"authenticated".equals(jwt.getClaimAsString("role"))) {
            throw new org.springframework.security.authentication.BadCredentialsException(
                    "An authenticated Supabase user is required");
        }
        SupabaseAccountIdentityService.Identity identity =
                identities.resolve(jwt.getSubject(), jwt.getClaimAsString("email"));
        return new UsernamePasswordAuthenticationToken(
                identity.email(),
                jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + identity.role())));
    }
}
