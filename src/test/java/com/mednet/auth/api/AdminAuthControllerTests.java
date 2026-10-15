package com.mednet.auth.api;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;

class AdminAuthControllerTests {

    @Test
    void sessionPrefersMedNetRoleOverGenericSpringUserAuthority() {
        AdminAuthController controller = new AdminAuthController();
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                "patient@example.test",
                null,
                "ROLE_USER",
                "ROLE_PATIENT");

        AdminAuthController.AdminSession session = controller.userSession(authentication);

        assertThat(session.role()).isEqualTo("PATIENT");
    }

}
