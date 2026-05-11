/**
 * Format memorandum text from imports: often one long line with 1.1 / 1.2 blocks and [truncated].
 */

export type MemoBlock = {
  /** Short label, e.g. "1.1 · Statement of Comprehensive Income…" */
  label: string;
  /** Remaining memo body for that sub-part */
  body: string;
};

export type ParsedMemo = {
  questionLead?: string;
  blocks: MemoBlock[];
  hadTruncationMarker: boolean;
  strippedFooter: boolean;
};

/** Remove DBE boilerplate / page instructions at the end of memo extracts */
export function stripMemoFooter(text: string): { text: string; stripped: boolean } {
  const patterns = [
    /\bCopyright\s+reserved\b/i,
    /\bPlease\s+turn\s+over\b/i,
    /\bAccounting\/P\d\b/i,
    /\bDBE\/May\/June\b/i,
    /\bSC\/NSC\b/i,
    /\bMarking\s+Guidelines\b/i,
  ];

  let t = text;
  let stripped = false;
  for (const re of patterns) {
    const idx = t.search(re);
    if (idx >= 20) {
      t = t.slice(0, idx).trim();
      stripped = true;
      break;
    }
  }
  return { text: t, stripped };
}

/**
 * Split memo into blocks starting at 1.1, 1.2, 2.3, etc.
 * Leading "QUESTION 1" (without a 1.x on the same segment) becomes a small intro line.
 */
export function parseMemoAnswer(raw: string | null | undefined): ParsedMemo | null {
  if (raw == null || !raw.trim()) return null;

  const hadTruncationMarker = /\[[^\]]*truncated[^\]]*\]/i.test(raw);
  let text = raw.replace(/\[[^\]]*truncated[^\]]*\]/gi, "").trim();
  const footer = stripMemoFooter(text);
  text = footer.text;

  // Split before sub-question refs (1.1, 1.1.1, 2.3.4 etc.) that are NOT in the middle
  // of a decimal number. Negative lookbehind ensures we don't split 1.1.1 at its inner 1.1.
  const parts = text
    .split(/(?<![.\d])(?=[1-9]\d?\.[1-9]\d?(?:\.[1-9]\d?)?\s)/)
    .map((p) => p.trim())
    .filter(Boolean);

  let questionLead: string | undefined;
  let blocksRaw = parts;

  if (parts.length > 0) {
    const first = parts[0].replace(/\s+/g, " ").trim();
    // Detect bilingual headings: "QUESTION 1", "QUESTION 1/VRAAG 1", "QUESTION/VRAAG 2"
    const qOnly = first.match(/^(QUESTION(?:\/VRAAG)?\s+\d+(?:\/VRAAG\s+\d+)?)$/i);
    if (qOnly) {
      questionLead = qOnly[1];
      blocksRaw = parts.slice(1);
    }
  }

  const blocks: MemoBlock[] = [];
  for (const segment of blocksRaw) {
    const block = splitMemoSubPart(segment);
    if (block) blocks.push(block);
  }

  if (blocks.length === 0 && text.length > 0) {
    return {
      questionLead,
      blocks: [{ label: "Memorandum", body: text }],
      hadTruncationMarker,
      strippedFooter: footer.stripped,
    };
  }

  return {
    questionLead,
    blocks,
    hadTruncationMarker,
    strippedFooter: footer.stripped,
  };
}

/**
 * First segment is like "1.1 Statement of Comprehensive Income for the year ended ... Sales ..."
 */
function splitMemoSubPart(segment: string): MemoBlock | null {
  const t = segment.trim();
  // Handle both 2-level (1.1) and 3-level (1.1.1) sub-question refs
  const m = t.match(/^(\d+\.\d+(?:\.\d+)?)\s+([\s\S]+)$/);
  if (!m) return { label: "Memo excerpt", body: t };

  const ref = m[1];
  const rest = m[2].trim();
  const { heading, body } = splitMemoTitleAndBody(rest);
  const label = heading ? `${ref} · ${heading}` : ref;
  return { label, body: body.trim() };
}

/**
 * Split instructional title (report name + period) from the marking grid / figures.
 * Avoids titles that swallow "Sales …" and other first line items.
 */
function splitMemoTitleAndBody(rest: string): { heading: string; body: string } {
  const s = rest.trim();
  if (!s) return { heading: "", body: "" };

  // Statement of Comprehensive Income … for the year ended 28 February 2025 [then Sales…]
  const soci = s.match(/^(.*?for the year ended \d{1,2} \w+ \d{4})\s+(.+)$/i);
  if (soci && soci[1].trim().length >= 20 && soci[2]) {
    return { heading: soci[1].trim(), body: soci[2].trim() };
  }

  // Statement of Financial Position on 28 February 2025 [then EQUITY…]
  const sfp = s.match(
    /^(.*?Statement of Financial Position (?:on|as at) \d{1,2} \w+ \d{4})\s+(.+)$/i,
  );
  if (sfp && sfp[1].trim().length >= 20 && sfp[2]) {
    return { heading: sfp[1].trim(), body: sfp[2].trim() };
  }

  // Body often starts with EQUITY AND LIABILITIES (SFP memo layout)
  const equity = s.search(/\s+(?=EQUITY\s+AND\s+LIABILITIES\b)/i);
  if (equity > 40) {
    return { heading: s.slice(0, equity).trim(), body: s.slice(equity).trim() };
  }

  // First income-statement line item (after title) — don't grab "Sales" into the heading
  const sales = s.search(/\s(?=Sales\s)/i);
  if (sales > 45) {
    return { heading: s.slice(0, sales).trim(), body: s.slice(sales + 1).trim() };
  }

  return takeMemoHeadingFallback(s);
}

/** Last resort: short title, rest in body (no "Sales" in title when possible). */
function takeMemoHeadingFallback(rest: string): { heading: string; body: string } {
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { heading: "", body: "" };

  const titleMax = 10;
  if (words.length <= titleMax) {
    return { heading: words.join(" "), body: "" };
  }

  return {
    heading: `${words.slice(0, titleMax).join(" ")}…`,
    body: words.slice(titleMax).join(" "),
  };
}
