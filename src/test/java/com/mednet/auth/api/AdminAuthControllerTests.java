package com.mednet.auth.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AdminAuthControllerTests {

    @Test
    @SuppressWarnings("unchecked")
    void sessionPrefersMedNetRoleOverGenericSpringUserAuthority() {
        AdminAuthController controller =
                new AdminAuthController(mock(ObjectProvider.class), new MockEnvironment());
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                "patient@example.test",
                null,
                "ROLE_USER",
                "ROLE_PATIENT");

        AdminAuthController.AdminSession session = controller.userSession(authentication);

        assertThat(session.role()).isEqualTo("PATIENT");
    }

    @Test
    @SuppressWarnings("unchecked")
    void googleStatusNamesMissingRuntimeConfigurationWithoutExposingValues() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("mednet.google.enabled", "true")
                .withProperty("GOOGLE_CLIENT_ID", "configured-client-id");
        AdminAuthController controller =
                new AdminAuthController(mock(ObjectProvider.class), environment);

        AdminAuthController.GoogleStatus status = controller.googleStatus();

        assertThat(status.enabled()).isFalse();
        assertThat(status.missingConfiguration())
                .containsExactly("GOOGLE_CLIENT_SECRET", "SPRING_DATASOURCE_URL");
    }
}
