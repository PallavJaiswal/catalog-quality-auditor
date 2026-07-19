// A mechanical safety net on top of the AI's "don't copy verbatim"
// instruction — checks for long runs of words that match the source
// text exactly. Catches cases where the model leans on the source's
// phrasing more than intended, without relying solely on it following
// instructions.
const NGRAM_SIZE = 8; // 8+ consecutive matching words = flagged

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function findVerbatimOverlap(
  generated: string,
  source: string
): string[] {
  const genWords = normalizeWords(generated);
  const srcWords = normalizeWords(source);
  if (genWords.length < NGRAM_SIZE || srcWords.length < NGRAM_SIZE) {
    return [];
  }

  const srcNgrams = new Set<string>();
  for (let i = 0; i <= srcWords.length - NGRAM_SIZE; i++) {
    srcNgrams.add(srcWords.slice(i, i + NGRAM_SIZE).join(" "));
  }

  const found = new Set<string>();
  for (let i = 0; i <= genWords.length - NGRAM_SIZE; i++) {
    const ngram = genWords.slice(i, i + NGRAM_SIZE).join(" ");
    if (srcNgrams.has(ngram)) found.add(ngram);
  }

  return [...found];
}
