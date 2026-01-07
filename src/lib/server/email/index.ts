import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getResendClient() {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  return new Resend(apiKey);
}

/**
 * Send an email using Resend
 * @param options - Email options (to, subject, html, text)
 * @returns true if sent successfully, false otherwise
 */
export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  try {
    const resend = getResendClient();

    const { error } = await resend.emails.send({
      from: 'RoomieSync <noreply@roomiesync.net>',
      to,
      subject,
      html,
      text
    });

    if (error) {
      console.error('Email send failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}
