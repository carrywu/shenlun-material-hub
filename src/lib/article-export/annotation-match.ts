export interface AnnotationMatchInput {
  id: string;
  selectedText: string;
}

export interface NormalizedCell<T> {
  owner: T;
  rawStart: number;
  rawEnd: number;
}

export interface AnnotationHit<T extends AnnotationMatchInput> {
  inputIndex: number;
  input: T;
  range: { start: number; end: number };
}

export interface NormalizedStream<T> {
  stream: string;
  cells: Array<NormalizedCell<T>>;
}

const QUOTE_CHARS = new Set([
  '"',
  "'",
  "\u2018",
  "\u2019",
  "\u201c",
  "\u201d",
  "\u300c",
  "\u300d",
  "\u300e",
  "\u300f",
  "\u2032",
  "\u2033",
  "\uff02",
  "\uff07",
]);

function normalizeChar(ch: string): string | null {
  if (/\s/.test(ch)) return null;
  if (QUOTE_CHARS.has(ch)) return '"';
  return ch;
}

export function normalizeAnnotationText(value: string): string {
  let out = "";
  for (const ch of value) {
    const normalized = normalizeChar(ch);
    if (normalized) out += normalized;
  }
  return out;
}

export function buildNormalizedStream<T>(
  parts: Array<{ text: string; owner: T }>
): NormalizedStream<T> {
  let stream = "";
  const cells: Array<NormalizedCell<T>> = [];

  for (const part of parts) {
    for (let i = 0; i < part.text.length; i++) {
      const normalized = normalizeChar(part.text[i]);
      if (!normalized) continue;
      stream += normalized;
      cells.push({ owner: part.owner, rawStart: i, rawEnd: i + 1 });
    }
  }

  return { stream, cells };
}

function isCrossingOverlap(
  start: number,
  end: number,
  range: { start: number; end: number }
): boolean {
  const overlaps = start < range.end && end > range.start;
  if (!overlaps) return false;

  const equal = start === range.start && end === range.end;
  const candidateContainsExisting = start <= range.start && end >= range.end;
  const existingContainsCandidate = range.start <= start && range.end >= end;

  return !equal && !candidateContainsExisting && !existingContainsCandidate;
}

function findFirstAllowedOccurrence(
  stream: string,
  needle: string,
  used: Array<{ start: number; end: number }>
): { start: number; end: number } | null {
  if (!needle) return null;

  let from = 0;
  while (from <= stream.length - needle.length) {
    const found = stream.indexOf(needle, from);
    if (found === -1) break;

    const start = found;
    const end = found + needle.length;
    if (!used.some((range) => isCrossingOverlap(start, end, range))) {
      return { start, end };
    }

    from = found + 1;
  }

  return null;
}

export function locateAnnotationRanges<T extends AnnotationMatchInput>(
  stream: string,
  annotations: T[]
): {
  hits: Array<AnnotationHit<T>>;
  misses: Array<{ inputIndex: number; input: T }>;
} {
  const used: Array<{ start: number; end: number }> = [];
  const hits: Array<AnnotationHit<T>> = [];
  const misses: Array<{ inputIndex: number; input: T }> = [];

  annotations.forEach((input, inputIndex) => {
    const needle = normalizeAnnotationText(input.selectedText);
    const range = findFirstAllowedOccurrence(stream, needle, used);
    if (range) {
      used.push(range);
      hits.push({ inputIndex, input, range });
    } else {
      misses.push({ inputIndex, input });
    }
  });

  return { hits, misses };
}
