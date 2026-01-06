import type { User } from '$lib/server/db/schema';
import type { Session } from '$lib/server/session';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
    }
  }
}

export {};
