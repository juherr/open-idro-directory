/**
 * Quotes `value` as one literal POSIX shell word. Single quotes stop every
 * expansion (`$`, backticks, globs), which double quotes would not; an
 * embedded single quote closes the quoting, is escaped, and reopens it.
 */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
