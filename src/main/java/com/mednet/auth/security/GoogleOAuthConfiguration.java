package com.mednet.auth.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.provider.data.ProviderApplicationRepository;

@Configuration
@ConditionalOnExpression(
        "'${spring.datasource.url:}' != '' && '${GOOGLE_CLIENT_ID:}' != '' && '${GOOGLE_CLIENT_SECRET:}' != ''")
public class GoogleOAuthConfiguration {

    @Bean
    ClientRegistrationRepository googleClientRegistrationRepository(
            @Value("${GOOGLE_CLIENT_ID}") String clientId,
            @Value("${GOOGLE_CLIENT_SECRET}") String clientSecret,
            @Value("${GOOGLE_REDIRECT_URI:}") String redirectUri) {
        String resolvedRedirectUri = redirectUri.isBlank()
                ? "{baseUrl}/login/oauth2/code/{registrationId}"
                : redirectUri;
        ClientRegistration google = ClientRegistration.withRegistrationId("google")
                .clientId(clientId)
                .clientSecret(clientSecret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(resolvedRedirectUri)
                .scope("openid", "email", "profile")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .userNameAttributeName("sub")
                .clientName("Google")
                .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    @Bean
    GoogleOAuth2UserService googleOAuth2UserService(
            PlatformAccountRepository accounts,
            ProviderApplicationRepository providers,
            @Value("${mednet.admin.email:}") String adminEmail) {
        return new GoogleOAuth2UserService(accounts, providers, adminEmail);
    }

    @Bean
    GoogleOidcUserService googleOidcUserService(GoogleOAuth2UserService accountService) {
        return new GoogleOidcUserService(accountService);
    }
}
