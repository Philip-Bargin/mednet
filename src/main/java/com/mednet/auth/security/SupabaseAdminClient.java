package com.mednet.auth.security;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseAdminClient {

    private final RestClient client;
    private final String secretKey;

    public SupabaseAdminClient(
            @Value("${mednet.supabase.url:}") String supabaseUrl,
            @Value("${mednet.supabase.secret-key:}") String secretKey) {
        if (!StringUtils.hasText(supabaseUrl)) {
            throw new IllegalStateException("SUPABASE_URL is required when Supabase Auth is enabled");
        }
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        if (this.secretKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SECRET_KEY is required when Supabase Auth is enabled");
        }
        this.client = RestClient.builder()
                .baseUrl(supabaseUrl.replaceAll("/+$", ""))
                .build();
    }

    public boolean isEmailConfirmed(String userId, String email) {
        Map<?, ?> user = getUser(userId);
        return user.get("email") instanceof String confirmedEmail
                && confirmedEmail.equalsIgnoreCase(email)
                && (user.get("email_confirmed_at") instanceof String
                        || user.get("confirmed_at") instanceof String);
    }

    public String migrateLegacyUser(
            String email, String passwordHash, String currentPassword, String displayName) {
        requireConfigured();
        String existingUserId = findUserIdByEmail(email);
        if (existingUserId != null) {
            updateUser(existingUserId, email, currentPassword, displayName);
            return existingUserId;
        }
        return createUserWithPasswordHash(email, passwordHash, displayName);
    }

    public Optional<String> findExistingUserId(String email) {
        requireConfigured();
        return Optional.ofNullable(findUserIdByEmail(email));
    }

    public GeneratedEmailLink generateEmailLink(
            String type, String email, String password, String redirectTo, String displayName) {
        requireConfigured();
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("type", type);
        body.put("email", email);
        if (StringUtils.hasText(password)) {
            body.put("password", password);
        }
        if (StringUtils.hasText(displayName)) {
            body.put("data", Map.of("display_name", displayName.trim()));
        }
        Map<?, ?> result = request(() -> client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/auth/v1/admin/generate_link")
                        .queryParam("redirect_to", redirectTo)
                        .build())
                .headers(this::setHeaders)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class));
        return parseGeneratedEmailLink(result);
    }

    static GeneratedEmailLink parseGeneratedEmailLink(Map<?, ?> result) {
        if (result == null) {
            throw new SupabaseAdminException("Supabase returned an empty authentication link response");
        }
        Map<?, ?> properties = result.get("properties") instanceof Map<?, ?> nested
                ? nested
                : Map.of();
        String hashedToken = responseString(result, properties, "hashed_token");
        String verificationType = responseString(result, properties, "verification_type");
        String emailOtp = responseString(result, properties, "email_otp");
        if (!StringUtils.hasText(hashedToken) || !StringUtils.hasText(verificationType)) {
            throw new SupabaseAdminException("Supabase did not return the required authentication link");
        }
        if (emailOtp == null || !emailOtp.matches("\\d{6}")) {
            throw new SupabaseAdminException("Supabase did not return a six-digit email verification code");
        }
        return new GeneratedEmailLink(hashedToken, verificationType, emailOtp);
    }

    private static String responseString(Map<?, ?> response, Map<?, ?> properties, String key) {
        Object value = response.get(key);
        if (!(value instanceof String)) {
            value = properties.get(key);
        }
        return value instanceof String string ? string : null;
    }

    public String createUserWithPasswordHash(String email, String passwordHash, String displayName) {
        requireConfigured();
        Map<String, Object> metadata = StringUtils.hasText(displayName)
                ? Map.of("display_name", displayName.trim())
                : Map.of();
        Map<?, ?> result = request(() -> client.post()
                .uri("/auth/v1/admin/users")
                .headers(this::setHeaders)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "email", email,
                        "password_hash", passwordHash,
                        "email_confirm", true,
                        "user_metadata", metadata))
                .retrieve()
                .body(Map.class));
        Object id = result == null ? null : result.get("id");
        if (!(id instanceof String userId)) {
            throw new SupabaseAdminException("Supabase did not return a user ID");
        }
        return parseUserId(userId);
    }

    static String parseUserId(String userId) {
        try {
            return UUID.fromString(userId).toString();
        } catch (IllegalArgumentException exception) {
            throw new SupabaseAdminException("Supabase returned an invalid user ID", exception);
        }
    }

    public String createUserWithPassword(String email, String password, String displayName) {
        requireConfigured();
        String existingUserId = findUserIdByEmail(email);
        if (existingUserId != null) {
            updateUser(existingUserId, email, password, displayName);
            return existingUserId;
        }
        Map<String, Object> metadata = StringUtils.hasText(displayName)
                ? Map.of("display_name", displayName.trim())
                : Map.of();
        Map<?, ?> result = request(() -> client.post()
                .uri("/auth/v1/admin/users")
                .headers(this::setHeaders)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "email", email,
                        "password", password,
                        "email_confirm", true,
                        "user_metadata", metadata))
                .retrieve()
                .body(Map.class));
        Object id = result == null ? null : result.get("id");
        if (!(id instanceof String userId)) {
            throw new SupabaseAdminException("Supabase did not return a user ID");
        }
        return parseUserId(userId);
    }

    private String findUserIdByEmail(String email) {
        Map<?, ?> result = request(() -> client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/auth/v1/admin/users")
                        .queryParam("filter", email)
                        .queryParam("page", 1)
                        .queryParam("per_page", 100)
                        .build())
                .headers(this::setHeaders)
                .retrieve()
                .body(Map.class));
        Object usersValue = result.get("users");
        if (!(usersValue instanceof List<?> users)) {
            throw new SupabaseAdminException("Supabase did not return its user list");
        }
        for (Object value : users) {
            if (value instanceof Map<?, ?> user
                    && user.get("email") instanceof String existingEmail
                    && existingEmail.equalsIgnoreCase(email)
                    && user.get("id") instanceof String userId) {
                return parseUserId(userId);
            }
        }
        return null;
    }

    private void updateUser(String userId, String email, String password, String displayName) {
        Map<String, Object> update = new java.util.HashMap<>();
        update.put("email", email);
        update.put("email_confirm", true);
        if (StringUtils.hasText(password)) {
            update.put("password", password);
        }
        if (StringUtils.hasText(displayName)) {
            update.put("user_metadata", Map.of("display_name", displayName.trim()));
        }
        request(() -> client.put()
                .uri("/auth/v1/admin/users/{id}", userId)
                .headers(this::setHeaders)
                .contentType(MediaType.APPLICATION_JSON)
                .body(update)
                .retrieve()
                .body(Map.class));
    }

    private Map<?, ?> getUser(String userId) {
        requireConfigured();
        return request(() -> client.get()
                .uri("/auth/v1/admin/users/{id}", userId)
                .headers(this::setHeaders)
                .retrieve()
                .body(Map.class));
    }

    private void setHeaders(HttpHeaders headers) {
        headers.set("apikey", secretKey);
        headers.setBearerAuth(secretKey);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
    }

    private void requireConfigured() {
        if (!StringUtils.hasText(secretKey)) {
            throw new SupabaseAdminException("SUPABASE_SECRET_KEY is not configured");
        }
    }

    private static <T> T request(java.util.function.Supplier<T> request) {
        try {
            T result = request.get();
            if (result == null) {
                throw new SupabaseAdminException("Supabase returned an empty response");
            }
            return result;
        } catch (RestClientResponseException exception) {
            throw new SupabaseAdminException(
                    "Supabase Auth admin API returned HTTP " + exception.getStatusCode().value(), exception);
        } catch (org.springframework.web.client.RestClientException exception) {
            throw new SupabaseAdminException("Supabase Auth admin API request failed", exception);
        }
    }

    public record GeneratedEmailLink(String hashedToken, String verificationType, String emailOtp) {
    }

    public static class SupabaseAdminException extends RuntimeException {
        public SupabaseAdminException(String message) {
            super(message);
        }

        public SupabaseAdminException(String message, Throwable cause) {
            super(message, cause);
        }

    }
}
