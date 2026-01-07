interface PasswordResetEmailParams {
  userName: string;
  resetLink: string;
}

export function getPasswordResetEmail({ userName, resetLink }: PasswordResetEmailParams) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #FF7A4D; margin: 0 0 16px 0; font-size: 24px;">Reset Your Password</h1>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      Hi ${userName},
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      We received a request to reset your RoomieSync password. Click the button below to create a new password:
    </p>
    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #FF7A4D 0%, #6B7FFF 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
      Reset Password
    </a>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 24px 0 16px 0;">
      This link will expire in 15 minutes.
    </p>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
      If you didn't request this, you can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      RoomieSync - Shared Expense Tracking
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Reset Your Password

Hi ${userName},

We received a request to reset your RoomieSync password. Visit this link to create a new password:

${resetLink}

This link will expire in 15 minutes.

If you didn't request this, you can safely ignore this email.

---
RoomieSync - Shared Expense Tracking
  `.trim();

  return { html, text };
}
