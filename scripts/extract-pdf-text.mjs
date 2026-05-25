#!/usr/bin/env node
/**
 * Extract plain text from a PDF (text-based PDFs work best; scanned pages need OCR — not included).
 *
 * Usage:
 *   node scripts/extract-pdf-text.mjs "C:\path\to\Mathematics-P1.pdf"
 *   node scripts/extract-pdf-text.mjs ./exam-papers/2025-may-june/non-languages/mathematics/foo.pdf --pages 1-3
 *   node scripts/extract-pdf-text.mjs ./paper.pdf --out ./paper.txt
 *
 * Use this to see whether DBE PDFs expose enough text for semi-automatic question splitting.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

function parsePageRange(spec, total) {
  if (!spec) return null;
  const parts = spec.split("-").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 1 && !Number.isNaN(parts[0])) {
    return { first: parts[0], last: parts[0] };
  }
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { first: parts[0], last: parts[1] };
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  let pdfPath = "";
  let outPath = "";
  let pagesSpec = "";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") outPath = argv[++i];
    else if (a === "--pages") pagesSpec = argv[++i];
    else if (!a.startsWith("-")) pdfPath = a;
  }

  if (!pdfPath) {
    console.error("Usage: node scripts/extract-pdf-text.mjs <file.pdf> [--pages 1-5] [--out out.txt]");
    process.exit(1);
  }

  const resolved = path.resolve(pdfPath);
  const buf = await fs.readFile(resolved);
  const parser = new PDFParse({ data: new Uint8Array(buf) });

  const info = await parser.getInfo();
  const total = info.total ?? 0;
  const range = parsePageRange(pagesSpec, total);

  const params = {};
  if (range) {
    params.first = range.first;
    params.last = Math.min(range.last, total);
  }

  const result = await parser.getText(params);
  await parser.destroy();

  const header = `# ${path.basename(resolved)}\n# pages: ${total}\n\n`;
  const body = result.text ?? "";

  if (outPath) {
    await fs.writeFile(path.resolve(outPath), header + body, "utf8");
    console.log(`Wrote ${outPath} (${(header + body).length} chars)`);
  } else {
    process.stdout.write(header + body);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
