package com.mednet.auth.email;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import com.mednet.auth.security.SupabaseAdminClient;
import com.mednet.auth.security.SupabaseAdminClient.GeneratedEmailLink;

@Service
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseAuthEmailService {

    private static final String GENERIC_REGISTRATION_MESSAGE =
            "If a new account can be created for this email, we will send a verification link.";
    private static final String GENERIC_RESEND_MESSAGE =
            "If an account with this email needs verification, we will send a new verification link shortly.";
    private static final String GENERIC_RECOVERY_MESSAGE =
            "If the account exists, password recovery instructions have been sent.";

    private final SupabaseAdminClient supabase;
    private final EkdSendEmailService ekdSend;
    private final String siteUrl;

    public SupabaseAuthEmailService(
            SupabaseAdminClient supabase,
            EkdSendEmailService ekdSend,
            @Value("${NEXTAUTH_URL:http://localhost:3000}") String siteUrl) {
        this.supabase = supabase;
        this.ekdSend = ekdSend;
        this.siteUrl = siteUrl.replaceAll("/+$", "");
    }

    public String register(String email, String password, String displayName) {
        if (supabase.findExistingUserId(email).isPresent()) {
            return GENERIC_REGISTRATION_MESSAGE;
        }
        GeneratedEmailLink link = supabase.generateEmailLink(
                "signup", email, password, siteUrl + "/auth/callback", displayName);
        send(email, "Confirm your MedNet account", "Confirm your email address",
                confirmationUrl(link, "/verify?verified=1"), link.emailOtp());
        return GENERIC_REGISTRATION_MESSAGE;
    }

    public String resendVerification(String email) {
        Optional<String> userId = supabase.findExistingUserId(email);
        if (userId.isPresent() && !supabase.isEmailConfirmed(userId.get(), email)) {
            GeneratedEmailLink link = supabase.generateEmailLink(
                    "magiclink", email, null, siteUrl + "/auth/callback", null);
            send(email, "Confirm your MedNet account", "Confirm your email address",
                    confirmationUrl(link, "/verify?verified=1"), link.emailOtp());
        }
        return GENERIC_RESEND_MESSAGE;
    }

    public String sendRecovery(String email) {
        Optional<String> userId = supabase.findExistingUserId(email);
        if (userId.isPresent() && supabase.isEmailConfirmed(userId.get(), email)) {
            GeneratedEmailLink link = supabase.generateEmailLink(
                    "recovery", email, null, siteUrl + "/auth/callback", null);
            send(email, "Reset your MedNet password", "Reset your password",
                    confirmationUrl(link, "/reset?recovery=1"), link.emailOtp());
        }
        return GENERIC_RECOVERY_MESSAGE;
    }

    private String confirmationUrl(GeneratedEmailLink link, String next) {
        return UriComponentsBuilder.fromUriString(siteUrl)
                .path("/auth/callback")
                .queryParam("token_hash", link.hashedToken())
                .queryParam("type", link.verificationType())
                .queryParam("next", next)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUriString();
    }

    private void send(String recipient, String subject, String heading, String url, String otp) {
        String safeHeading = escapeHtml(heading);
        String safeUrl = escapeHtml(url);
        String codeHtml = StringUtils.hasText(otp)
                ? "<p>Your one-time code is <strong>" + escapeHtml(otp) + "</strong>.</p>"
                : "";
        String codeText = StringUtils.hasText(otp) ? "\n\nOne-time code: " + otp : "";
        String html = """
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#17231c">
                  <h1>%s</h1>
                  <p>Use this secure, single-use link to continue:</p>
                  <p><a href="%s" style="display:inline-block;padding:12px 20px;background:#166534;color:#fff;text-decoration:none;border-radius:6px">Continue to MedNet</a></p>
                  %s
                  <p>If you did not request this, you can ignore this message.</p>
                </div>
                """.formatted(safeHeading, safeUrl, codeHtml);
        String text = heading + "\n\nContinue to MedNet: " + url
                + codeText + "\n\nIf you did not request this, you can ignore this message.";
        if (!ekdSend.send(recipient, subject, html, text)) {
            throw new EmailDeliveryException("Authentication email could not be queued");
        }
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    public static final class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message) {
            super(message);
        }
    }
}
