/**
 * How household members tell each other to pay them.
 *
 * The one rule here: a handle is always shown as copyable text, and a link is
 * only ever an addition to that. In-app browsers (Instagram, Slack, a webview
 * inside another app) will not hand off to a native app at all, and nothing on
 * our side can change that, so the copyable handle is the common path rather
 * than a fallback for edge cases.
 *
 * Link formats were verified against each provider's own servers and their
 * apple-app-site-association files, which are what actually decide whether a
 * URL opens an app. Notably, the `venmo.com/?txn=pay&recipients=...` form that
 * most guides still recommend now returns a zero-byte HTTP 202: it is dead, and
 * anything built on it fails silently. That is the reason this module prefers
 * documented, degradable links over prefilled ones.
 *
 * These work on a desktop browser too, which is why they are worth showing
 * there: venmo.com/u/<user> serves a real profile page with its own Pay or
 * Request button, and paypal.me/<user>/<amount> serves a send-money page with
 * the amount carried through. Same href on every platform; the provider
 * decides whether to hand off to an app.
 */

export type PaymentProviderId = 'venmo' | 'paypal' | 'cashapp' | 'zelle' | 'applecash' | 'other';

export type PaymentProvider = {
  id: PaymentProviderId;
  /** Plain name. Deliberately not "Pay with Venmo", which is a PayPal
   *  commercial product whose terms forbid peer-to-peer use. */
  name: string;
  /** What to ask for, e.g. "Venmo username". */
  handleLabel: string;
  handlePlaceholder: string;
  /** Shown under the field when there is something the user should know. */
  hint?: string;
  /** Leading character the provider's handles conventionally carry. */
  sigil?: string;
  /** Zelle and Apple Cash identify people by email or phone, not a username. */
  handleKind: 'username' | 'emailOrPhone' | 'free';
};

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: 'venmo',
    name: 'Venmo',
    handleLabel: 'Venmo username',
    handlePlaceholder: 'billy-kowalski',
    sigil: '@',
    handleKind: 'username',
    hint: 'Opens your Venmo profile. The amount stays copyable here, since Venmo does not accept a prefilled amount reliably.'
  },
  {
    id: 'paypal',
    name: 'PayPal',
    handleLabel: 'PayPal.Me link or username',
    handlePlaceholder: 'billykowalski',
    handleKind: 'username',
    hint: 'The only one that can open with the amount already filled in.'
  },
  {
    id: 'cashapp',
    name: 'Cash App',
    handleLabel: 'Cashtag',
    handlePlaceholder: 'billyk',
    sigil: '$',
    handleKind: 'username'
  },
  {
    id: 'zelle',
    name: 'Zelle',
    handleLabel: 'Email or phone for Zelle',
    handlePlaceholder: 'billy@example.com',
    handleKind: 'emailOrPhone',
    hint: 'Zelle lives inside your bank app and has no link to open, so this is shown for copying.'
  },
  {
    id: 'applecash',
    name: 'Apple Cash',
    handleLabel: 'Phone or email for Apple Cash',
    handlePlaceholder: '555-0142',
    handleKind: 'emailOrPhone',
    hint: 'Apple Cash is sent through Messages, so this is shown for copying.'
  },
  {
    id: 'other',
    name: 'Something else',
    handleLabel: 'How to pay you',
    handlePlaceholder: 'Bank transfer, cash, …',
    handleKind: 'free',
    hint: 'Free text. Shown to your household exactly as you write it.'
  }
];

export function providerById(id: string): PaymentProvider | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}

/** Strip the decoration people paste in, so a handle stores consistently. */
export function normalizeHandle(providerId: string, raw: string): string {
  let handle = raw.trim();
  if (handle === '') return '';

  // People paste a whole profile URL as often as a username
  handle = handle.replace(
    /^https?:\/\/(www\.)?(venmo\.com\/(u\/)?|cash\.app\/|paypal\.me\/|www\.paypal\.com\/paypalme\/)/i,
    ''
  );
  handle = handle.replace(/\/+$/, '');
  // Leading sigils are re-added for display, so they are not stored
  handle = handle.replace(/^[@$]/, '');
  return handle;
}

/** How the handle reads to a human, sigil included. */
export function formatHandle(providerId: string, handle: string): string {
  const provider = providerById(providerId);
  if (!provider || handle === '') return handle;
  return provider.sigil ? `${provider.sigil}${handle}` : handle;
}

/**
 * A link that opens the provider, or null when none can exist.
 *
 * `amount` is only ever used where the provider documents it. Everywhere else
 * the caller shows the amount separately as copyable text, which is why no
 * undocumented prefill format appears here.
 */
export function paymentLink(
  providerId: string,
  handle: string,
  amount?: number
): { href: string; label: string; opensApp: boolean } | null {
  const clean = normalizeHandle(providerId, handle);
  if (clean === '') return null;

  switch (providerId) {
    case 'venmo':
      // The profile form, not the prefill form. /u/* is registered in Venmo's
      // app-site-association so it opens the app, and it degrades to a real
      // profile page with its own Pay button when the app is absent. The
      // prefill host is undocumented and has broken before.
      return {
        href: `https://venmo.com/u/${encodeURIComponent(clean)}`,
        label: 'Open in Venmo',
        opensApp: true
      };

    case 'paypal': {
      // Officially documented, and /paypalme/* is app-registered. Amount takes
      // the form 10USD; PayPal ignores it rather than erroring if malformed.
      const suffix = amount && amount > 0 ? `/${amount.toFixed(2)}USD` : '';
      return {
        href: `https://paypal.me/${encodeURIComponent(clean)}${suffix}`,
        label: amount && amount > 0 ? `Open PayPal for $${amount.toFixed(2)}` : 'Open in PayPal',
        opensApp: true
      };
    }

    case 'cashapp':
      // /$* is app-registered. The amount path is undocumented, so it is left
      // off rather than risking a link that silently stops working.
      return {
        href: `https://cash.app/$${encodeURIComponent(clean)}`,
        label: 'Open in Cash App',
        opensApp: true
      };

    // No link exists for these. Zelle's standalone app shut down in March 2025
    // and it is reachable only inside individual bank apps; Apple Cash is sent
    // through Messages. Returning null is the honest answer.
    case 'zelle':
    case 'applecash':
    case 'other':
      return null;

    default:
      return null;
  }
}
