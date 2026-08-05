//Single source of truth for "exactly 3 words" validation, used by both
// ThreeWordForm's live client-side check and submitThreeWordResponse's
// server-side check — same role graphemeLength()/toGraphemes() play for
// confessions, so the two can never disagree about what's valid.

export type ThreeWordValidation =
  | { valid: true; words: [string, string, string] }
  | { valid: false; error: string }

/**
 * Collapses excess whitespace and splits on spaces. Punctuation inside a
 * word ("Kind-hearted", "wow!") is left alone and still counts as one word —
 * only whitespace separates words.
 */
export function parseThreeWords(raw: string): ThreeWordValidation {
  const collapsed = (raw ?? '').trim().replace(/\s+/g, ' ')

  if (!collapsed) {
    return { valid: false, error: 'Write three words before sending.' }
  }

  const words = collapsed.split(' ').filter(Boolean)

  if (words.length !== 3) {
    return {
      valid: false,
      error: words.length < 3
        ? `Enter exactly 3 words — you have ${words.length}.`
        : `Enter exactly 3 words — you have ${words.length}, that's too many.`,
    }
  }

  return { valid: true, words: words as [string, string, string] }
}

export function countWords(raw: string): number {
  const collapsed = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!collapsed) return 0
  return collapsed.split(' ').filter(Boolean).length
  }
