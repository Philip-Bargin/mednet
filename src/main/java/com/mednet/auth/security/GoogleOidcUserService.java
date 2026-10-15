package com.mednet.auth.security;

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

public class GoogleOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final GoogleOAuth2UserService accountService;
    private final OAuth2UserService<OidcUserRequest, OidcUser> delegate;

    public GoogleOidcUserService(GoogleOAuth2UserService accountService) {
        this(accountService, new OidcUserService());
    }

    GoogleOidcUserService(
            GoogleOAuth2UserService accountService,
            OAuth2UserService<OidcUserRequest, OidcUser> delegate) {
        this.accountService = accountService;
        this.delegate = delegate;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest request) {
        return accountService.applyMedNetRole(delegate.loadUser(request));
    }
}
