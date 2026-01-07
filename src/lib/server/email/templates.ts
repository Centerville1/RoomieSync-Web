// Logo URL - host this image on Cloudflare R2 or your CDN
const LOGO_URL = 'https://assets.roomiesync.net/icon-nobg.png';

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
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="RoomieSync" style="height: 40px; width: auto;" />
    </div>
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

interface EmailVerificationParams {
  userName: string;
  verificationLink: string;
}

export function getEmailVerificationEmail({ userName, verificationLink }: EmailVerificationParams) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="RoomieSync" style="height: 40px; width: auto;" />
    </div>
    <h1 style="color: #FF7A4D; margin: 0 0 16px 0; font-size: 24px;">Verify Your Email</h1>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      Hi ${userName},
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      Thanks for signing up for RoomieSync! Please verify your email address by clicking the button below:
    </p>
    <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #FF7A4D 0%, #6B7FFF 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
      Verify Email
    </a>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 24px 0 16px 0;">
      This link will expire in 24 hours.
    </p>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
      If you didn't create a RoomieSync account, you can safely ignore this email.
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
Verify Your Email

Hi ${userName},

Thanks for signing up for RoomieSync! Please verify your email address by visiting this link:

${verificationLink}

This link will expire in 24 hours.

If you didn't create a RoomieSync account, you can safely ignore this email.

---
RoomieSync - Shared Expense Tracking
  `.trim();

  return { html, text };
}

interface HouseholdInviteEmailParams {
  householdName: string;
  inviterName: string;
  signupLink: string;
  loginLink: string;
}

export function getHouseholdInviteEmail({
  householdName,
  inviterName,
  signupLink,
  loginLink
}: HouseholdInviteEmailParams) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="RoomieSync" style="height: 40px; width: auto;" />
    </div>
    <h1 style="color: #FF7A4D; margin: 0 0 16px 0; font-size: 24px;">You're Invited!</h1>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      <strong>${inviterName}</strong> has invited you to join <strong>${householdName}</strong> on RoomieSync.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 24px 0;">
      RoomieSync makes it easy to track shared expenses and coordinate payments with your roommates.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>Already have an account?</strong>
    </p>
    <a href="${loginLink}" style="display: inline-block; background: linear-gradient(135deg, #FF7A4D 0%, #6B7FFF 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
      Log In to Accept
    </a>
    <p style="color: #333; line-height: 1.6; margin: 24px 0 16px 0;">
      <strong>New to RoomieSync?</strong>
    </p>
    <a href="${signupLink}" style="display: inline-block; background: #6B7FFF; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
      Sign Up Now
    </a>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
      Once you log in or sign up with this email address, you'll see the invite waiting for you.
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
You're Invited to ${householdName}!

${inviterName} has invited you to join ${householdName} on RoomieSync.

RoomieSync makes it easy to track shared expenses and coordinate payments with your roommates.

Already have an account? Log in here:
${loginLink}

New to RoomieSync? Sign up here:
${signupLink}

Once you log in or sign up with this email address, you'll see the invite waiting for you.

---
RoomieSync - Shared Expense Tracking
  `.trim();

  return { html, text };
}
