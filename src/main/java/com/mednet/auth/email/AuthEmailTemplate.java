package com.mednet.auth.email;

public final class AuthEmailTemplate {

    private AuthEmailTemplate() {
    }

    public static Content codeFirst(String heading, String code, String fallbackUrl) {
        if (code == null || !code.matches("\\d{6}")) {
            throw new IllegalArgumentException("Authentication email requires a six-digit code");
        }
        String safeHeading = escapeHtml(heading);
        String safeCode = escapeHtml(code);
        String safeUrl = escapeHtml(fallbackUrl);
        String html = """
                <!doctype html>
                <html lang="en">
                  <body style="margin:0;padding:32px 12px;background:#f1f5f2;font-family:Arial,Helvetica,sans-serif;color:#183329">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                      <tr><td align="center">
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dce7df;border-radius:16px;overflow:hidden">
                          <tr><td style="padding:24px 32px;background:#123d2b;color:#ffffff">
                            <div style="font-size:20px;font-weight:700;letter-spacing:1px">MEDNET</div>
                            <div style="margin-top:5px;font-size:12px;letter-spacing:1.5px;color:#d4e6da">CARE, CONNECTED</div>
                          </td></tr>
                          <tr><td style="padding:36px 32px 18px">
                            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#e9f4ed;color:#17633f;font-size:11px;font-weight:700;letter-spacing:1px">SECURE ACCOUNT ACCESS</div>
                            <h1 style="margin:18px 0 10px;font-size:26px;line-height:1.25;color:#173c2b">%s</h1>
                            <p style="margin:0;color:#52645a;font-size:15px;line-height:1.65">Use your six-digit code in MedNet to continue. It is valid for a limited time and can only be used once.</p>
                          </td></tr>
                          <tr><td style="padding:8px 32px 24px">
                            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#f5f8f5;border:1px solid #dce7df;border-radius:12px">
                              <tr><td align="center" style="padding:22px 16px">
                                <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;color:#627268">YOUR SIX-DIGIT CODE</div>
                                <div style="margin-top:12px;font-size:34px;line-height:1.25;font-weight:700;letter-spacing:10px;color:#145c3b">%s</div>
                              </td></tr>
                            </table>
                          </td></tr>
                          <tr><td style="padding:0 32px 28px">
                            <p style="margin:0 0 16px;color:#52645a;font-size:14px;line-height:1.6">Having trouble entering the code? Use this secure, single-use link instead:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                              <tr><td align="center" style="border-radius:8px;background:#17633f">
                                <a href="%s" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Continue with secure link</a>
                              </td></tr>
                            </table>
                            <p style="margin:22px 0 0;color:#6b7b71;font-size:13px;line-height:1.6">If you did not request this email, you can safely ignore it. Your account will remain secure.</p>
                          </td></tr>
                          <tr><td style="padding:18px 32px;border-top:1px solid #e7eee9;color:#78877e;font-size:12px;line-height:1.6">
                            MedNet | Secure access to your care
                          </td></tr>
                        </table>
                      </td></tr>
                    </table>
                  </body>
                </html>
                """.formatted(safeHeading, safeCode, safeUrl);
        String text = heading
                + "\n\nYour six-digit MedNet code is: " + code
                + "\nEnter this code on the MedNet screen to continue."
                + "\n\nHaving trouble with the code? Use this secure, single-use link instead:\n" + fallbackUrl
                + "\n\nIf you did not request this email, you can safely ignore it.";
        return new Content(html, text);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    public record Content(String html, String text) {
    }
}
