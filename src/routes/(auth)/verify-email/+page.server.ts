import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { verifyEmail } from '$lib/server/email-verification';

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token');

  if (!token) {
    return {
      success: false,
      error: 'No verification token provided'
    };
  }

  const success = await verifyEmail(token);

  if (!success) {
    return {
      success: false,
      error: 'Invalid or expired verification link. Please try signing up again.'
    };
  }

  return {
    success: true
  };
};
