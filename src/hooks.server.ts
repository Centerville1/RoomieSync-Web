import { validateSessionToken, SESSION_COOKIE } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(SESSION_COOKIE);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const sessionWithUser = await validateSessionToken(sessionToken);

	if (!sessionWithUser) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	event.locals.session = {
		id: sessionWithUser.id,
		userId: sessionWithUser.userId,
		expiresAt: sessionWithUser.expiresAt
	};
	event.locals.user = sessionWithUser.user;

	return resolve(event);
};
