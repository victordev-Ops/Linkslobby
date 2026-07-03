// lib/graphemes.ts
//
// Shared grapheme-cluster counting for anywhere we cap user-entered text
// (anonymous confessions, AMA questions, etc). Counting by grapheme cluster
// — what a person perceives as "one character" — instead of raw Unicode
// code point matters for compound emoji: flags, family emoji, skin-tone
// modifiers, anything joined with a ZWJ (👨‍👩‍👧‍👦, 👍🏽, 🏳️‍🌈) are made of
// multiple code points but read as a single character. Array.from(str)
// counts each piece separately and can slice a compound emoji in half when
// trimming to a limit.
//
// Using this SAME function on the client (for the live counter) and the
// server (for validation) guarantees they can never disagree — the server
// can never reject a message the client already accepted, or vice versa.

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null

export function toGraphemes(value: string): string[] {
  if (segmenter) {
    return Array.from(segmenter.segment(value), (s) => s.segment)
  }
  // Fallback for environments without Intl.Segmenter (very old browsers /
  // older Node) — still better than raw UTF-16 .length, though it can't
  // group ZWJ sequences.
  return Array.from(value)
}

export function graphemeLength(value: string): number {
  return toGraphemes(value).length
}

/**
 * Trims `value` to at most `max` graphemes without ever splitting a
 * compound emoji or other multi-code-point cluster in half.
 * Returns the trimmed string plus whether trimming actually occurred.
 */
export function trimToGraphemes(value: string, max: number): { text: string; wasTrimmed: boolean } {
  const graphemes = toGraphemes(value)
  if (graphemes.length <= max) {
    return { text: value, wasTrimmed: false }
  }
  return { text: graphemes.slice(0, max).join(''), wasTrimmed: true }
}
