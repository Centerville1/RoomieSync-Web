/**
 * Server-side re-export of the shared split helpers.
 *
 * The maths lives in $lib/splits because both sides need it: the split editor
 * previews shares as you type, and the create/edit actions recalculate them
 * before writing. Keeping one implementation means the preview and the stored
 * result cannot disagree.
 */
export {
  toCents,
  fromCents,
  calculateSplits,
  splitsMatchTotal,
  shareFor,
  isUnpaidBy,
  unpaidTotalFor,
  owedByCreator,
  previewEvenShare,
  parseAmount,
  MAX_EXPENSE_AMOUNT
} from '$lib/splits';
export type { SplitInput, SplitResult } from '$lib/splits';
