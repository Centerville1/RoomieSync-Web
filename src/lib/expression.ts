/**
 * Evaluating the small arithmetic expressions people type into amount fields,
 * so "10 + 0.2*10" can be entered instead of working out 12 by hand.
 *
 * Hand-written recursive descent rather than `eval` or `new Function`: this
 * parses text a user typed, and the only characters it will ever accept are
 * digits, a decimal point, the four operators, and parentheses.
 */

type Token = { type: 'num'; value: number } | { type: 'op'; value: string };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        num += input[i++];
      }
      // Reject "1.2.3"
      if ((num.match(/\./g) ?? []).length > 1) return null;
      const parsed = Number(num);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ type: 'num', value: parsed });
      continue;
    }

    // A decimal point can start a number: ".5"
    if (ch === '.') {
      let num = '.';
      i++;
      while (i < input.length && input[i] >= '0' && input[i] <= '9') num += input[i++];
      const parsed = Number(num);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ type: 'num', value: parsed });
      continue;
    }

    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Anything else is not something we are willing to interpret
    return null;
  }

  return tokens;
}

/**
 * expr   := term (('+' | '-') term)*
 * term   := unary (('*' | '/') unary)*
 * unary  := '-' unary | factor
 * factor := number | '(' expr ')'
 */
function parse(tokens: Token[]): number | null {
  let pos = 0;

  const peek = () => tokens[pos];

  function expr(): number | null {
    let left = term();
    if (left === null) return null;
    while (pos < tokens.length) {
      const t = peek();
      if (t?.type !== 'op' || (t.value !== '+' && t.value !== '-')) break;
      pos++;
      const right = term();
      if (right === null) return null;
      left = t.value === '+' ? left + right : left - right;
    }
    return left;
  }

  function term(): number | null {
    let left = unary();
    if (left === null) return null;
    while (pos < tokens.length) {
      const t = peek();
      if (t?.type !== 'op' || (t.value !== '*' && t.value !== '/')) break;
      pos++;
      const right = unary();
      if (right === null) return null;
      // Division by zero yields no answer rather than Infinity
      if (t.value === '/' && right === 0) return null;
      left = t.value === '*' ? left * right : left / right;
    }
    return left;
  }

  function unary(): number | null {
    const t = peek();
    if (t?.type === 'op' && t.value === '-') {
      pos++;
      const v = unary();
      return v === null ? null : -v;
    }
    return factor();
  }

  function factor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.type === 'num') {
      pos++;
      return t.value;
    }
    if (t.type === 'op' && t.value === '(') {
      pos++;
      const v = expr();
      if (v === null) return null;
      const close = peek();
      if (close?.type !== 'op' || close.value !== ')') return null;
      pos++;
      return v;
    }
    return null;
  }

  const result = expr();
  // Trailing junk means the whole thing is not a valid expression
  if (result === null || pos !== tokens.length) return null;
  return result;
}

/**
 * Evaluate an amount entry. Returns null when the input is not a number or a
 * sum we can work out, or when the result is not a usable amount.
 *
 * Results are rounded to whole cents, since that is what gets stored.
 */
export function evaluateExpression(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Strip thousands separators and currency symbols before tokenizing: leaving
  // them to be skipped mid-number turned "1,200" into two adjacent numbers.
  const cleaned = trimmed.replace(/[,$]/g, '');

  const tokens = tokenize(cleaned);
  if (tokens === null || tokens.length === 0) return null;

  const value = parse(tokens);
  if (value === null || !Number.isFinite(value)) return null;

  // Negative amounts are never meaningful for an expense
  if (value < 0) return null;

  return Math.round(value * 100) / 100;
}

/** Two decimal places, without a currency symbol. */
export function formatAmount(value: number): string {
  return value.toFixed(2);
}
