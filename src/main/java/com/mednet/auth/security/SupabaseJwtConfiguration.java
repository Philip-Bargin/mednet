package com.mednet.auth.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.util.StringUtils;

@Configuration
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseJwtConfiguration {

    @Bean
    JwtDecoder supabaseJwtDecoder(
            @Value("${mednet.supabase.url:}") String supabaseUrl,
            @Value("${mednet.supabase.issuer-uri:}") String issuerUri,
            @Value("${mednet.supabase.jwk-set-uri:}") String jwkSetUri) {
        String effectiveIssuer = StringUtils.hasText(issuerUri)
                ? issuerUri
                : supabaseUrl.replaceAll("/+$", "") + "/auth/v1";
        String effectiveJwkSetUri = StringUtils.hasText(jwkSetUri)
                ? jwkSetUri
                : supabaseUrl.replaceAll("/+$", "") + "/auth/v1/.well-known/jwks.json";
        if (!StringUtils.hasText(supabaseUrl)
                || !StringUtils.hasText(effectiveIssuer)
                || !StringUtils.hasText(effectiveJwkSetUri)) {
            throw new IllegalStateException(
                    "SUPABASE_URL is required when SUPABASE_AUTH_ENABLED=true");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(effectiveJwkSetUri).build();
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(effectiveIssuer);
        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> jwt.getAudience().contains("authenticated")
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Supabase authenticated audience is required", null));
        decoder.setJwtValidator(jwt -> {
            OAuth2TokenValidatorResult issuerResult = issuerValidator.validate(jwt);
            return issuerResult.hasErrors() ? issuerResult : audienceValidator.validate(jwt);
        });
        return decoder;
    }
}
