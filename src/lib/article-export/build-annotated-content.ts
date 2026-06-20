// Assemble the annotated export: place [n] numbers in the body and build an
// ordered annotation list. Shares the same whitespace-normalized matching idea
// as ArticleContentRenderer's insertAnnotationsIntoHtml, but operates on the
// ExportBlock structure and orders numbers by first appearance in the body
// (NOT by createdAt). PDF and Word both consume this single output.
// See development-prompt.md §六.

import type {
  ExportAnnotation,
  ExportAnnotationInput,
  ExportBlock,
  ExportTextRun,
} from "./types";

const normalize = (s: string): string => s.replace(/\s+/g, "");

interface CharCell {
  blockIndex: number;
  runIndex: number;
}

/**
 * Flatten body runs into a normalized character stream, recording which
 * block/run each normalized character came from. Whitespace in raw text is
 * dropped from the normalized stream but the raw runs are preserved for output.
 */
function buildNormalizedIndex(body: ExportBlock[]): {
  stream: string;
  cells: CharCell[];
} {
  let stream = "";
  const cells: CharCell[] = [];
  body.forEach((block, blockIndex) => {
    const runs = block.runs ?? [];
    runs.forEach((run, runIndex) => {
      const norm = normalize(run.text);
      for (const _ch of norm) {
        cells.push({ blockIndex, runIndex });
        stream += _ch;
      }
    });
  });
  return { stream, cells };
}

/**
 * Find the first unoccupied normalized occurrence of `needle` in `stream`.
 * Returns the [start, end) normalized index range, or null if not found.
 */
function findFirstFreeOccurrence(
  stream: string,
  needle: string,
  used: Array<{ start: number; end: number }>
): { start: number; end: number } | null {
  if (!needle) return null;
  // Two annotations may legitimately target the exact same text and both
  // appear as [1][2] (development-prompt.md §3.5). So a candidate is blocked
  // only by a PARTIAL overlap with an already-used range; an exact-equal range
  // is allowed (the new annotation stacks onto the same cells).
  const blockedByPartial = (s: number, e: number) =>
    used.some((r) => {
      const equal = s === r.start && e === r.end;
      if (equal) return false; // exact same text: allowed to stack
      return s < r.end && e > r.start; // partial overlap: blocked
    });
  let from = 0;
  while (from <= stream.length - needle.length) {
    const found = stream.indexOf(needle, from);
    if (found === -1) break;
    if (!blockedByPartial(found, found + needle.length)) {
      return { start: found, end: found + needle.length };
    }
    from = found + 1;
  }
  return null;
}

/**
 * Build the annotated body + ordered annotation list.
 *
 * Numbering rules:
 * - Located annotations are numbered by their first-appearance order in the
 *   body (leftmost normalized hit wins). Multiple annotations hitting the same
 *   range share that range and each get their own number ([1][2]).
 * - Unlocated annotations are appended after the located ones, in input order,
 *   continuing the numbering, and flagged `unlocated`.
 * - Identical input always yields identical numbering (deterministic).
 */
export function buildAnnotatedContent(
  body: ExportBlock[],
  annotations: ExportAnnotationInput[]
): { body: ExportBlock[]; annotations: ExportAnnotation[] } {
  if (annotations.length === 0) {
    return { body, annotations: [] };
  }

  const { stream, cells } = buildNormalizedIndex(body);

  // For each input annotation, find its first free occurrence.
  const used: Array<{ start: number; end: number }> = [];
  interface Hit {
    inputIndex: number;
    input: ExportAnnotationInput;
    range: { start: number; end: number };
  }
  const hits: Hit[] = [];
  const misses: Array<{ inputIndex: number; input: ExportAnnotationInput }> = [];

  annotations.forEach((input, inputIndex) => {
    const needle = normalize(input.selectedText);
    const range = findFirstFreeOccurrence(stream, needle, used);
    if (range) {
      used.push(range);
      hits.push({ inputIndex, input, range });
    } else {
      misses.push({ inputIndex, input });
    }
  });

  // Sort located hits by body appearance (start), tiebreak by input order.
  hits.sort((a, b) => a.range.start - b.range.start || a.inputIndex - b.inputIndex);

  // Assign numbers: located first (in body order), then misses (input order).
  const locatedWithNumber = hits.map((h, i) => ({ ...h, number: i + 1 }));
  const missedWithNumber = misses.map((m, i) => ({
    ...m,
    number: locatedWithNumber.length + i + 1,
  }));

  // Map each located number onto the normalized range it owns, so we can attach
  // the set of numbers covering each normalized cell.
  const cellNumbers: number[][] = cells.map(() => []);
  locatedWithNumber.forEach((h) => {
    for (let i = h.range.start; i < h.range.end; i++) {
      cellNumbers[i].push(h.number);
    }
  });

  // Rewrite runs: split each run so that contiguous normalized cells with the
  // same set of numbers form one output run. Highlighted = has >=1 number.
  const outBody = body.map((block) => ({ ...block, runs: [...(block.runs ?? [])] }));

  // Walk each run, slicing its raw text by normalized-cell groups.
  // We need, per run, the slice of the global normalized stream it produced.
  // Re-derive that by walking runs in the same order as buildNormalizedIndex.
  {
    let cellCursor = 0;
    outBody.forEach((block) => {
      if (!block.runs) return;
      const newRuns: ExportTextRun[] = [];
      block.runs.forEach((run) => {
        const norm = normalize(run.text);
        if (norm.length === 0) {
          // keep zero-width text runs as-is (rare)
          newRuns.push({ ...run });
          return;
        }
        // Map normalized chars back to raw chars of this run.
        const raw = run.text;
        const normToRaw: number[] = []; // normIndex -> raw index after char
        let ni = 0;
        for (let ri = 0; ri < raw.length; ri++) {
          if (!/\s/.test(raw[ri])) {
            ni++;
            normToRaw[ni - 1] = ri + 1; // raw end-exclusive offset
          }
        }

        // Group contiguous normalized cells (within this run) by their number set.
        let groupStartNorm = 0; // local norm index within this run
        while (groupStartNorm < norm.length) {
          const globalStart = cellCursor + groupStartNorm;
          const key = cellNumbers[globalStart].join(",");
          let groupEndNorm = groupStartNorm + 1;
          while (
            groupEndNorm < norm.length &&
            cellNumbers[cellCursor + groupEndNorm].join(",") === key
          ) {
            groupEndNorm++;
          }
          // raw char range for norm [groupStartNorm, groupEndNorm)
          const rawStart =
            groupStartNorm === 0 ? 0 : normToRaw[groupStartNorm - 1];
          const rawEnd = normToRaw[groupEndNorm - 1] ?? raw.length;
          const slice = raw.slice(rawStart, rawEnd);
          if (slice) {
            const numbers = cellNumbers[globalStart];
            newRuns.push({
              text: slice,
              highlighted: numbers.length > 0 ? true : run.highlighted,
              annotationNumbers: numbers.length > 0 ? [...numbers] : run.annotationNumbers,
            });
          }
          groupStartNorm = groupEndNorm;
        }
        cellCursor += norm.length;
      });
      block.runs = newRuns;
    });
  }

  const orderedAnnotations: ExportAnnotation[] = [
    ...locatedWithNumber.map((h) => ({
      number: h.number,
      selectedText: h.input.selectedText,
      comment: h.input.comment,
      unlocated: false,
    })),
    ...missedWithNumber.map((m) => ({
      number: m.number,
      selectedText: m.input.selectedText,
      comment: m.input.comment,
      unlocated: true,
    })),
  ];

  return { body: outBody, annotations: orderedAnnotations };
}
