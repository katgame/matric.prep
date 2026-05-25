#!/usr/bin/env node
/**
 * Downloads NSC exam paper files linked from a DBE education.gov.za listing page.
 *
 * Mirrors the page structure:
 *   exam-papers/{session}/languages/{subject-slug}/
 *   exam-papers/{session}/non-languages/{subject-slug}/
 *
 * Usage:
 *   node scripts/download-nsc-papers.mjs
 *   node scripts/download-nsc-papers.mjs --session 2025-may-june
 *   node scripts/download-nsc-papers.mjs --out ./exam-papers
 *   node scripts/download-nsc-papers.mjs --dry-run --limit 5
 *   node scripts/download-nsc-papers.mjs --flat   # all files directly in --out (no session/subject tree)
 *
 * Respect DBE copyright and terms; use for personal / licensed project use only.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DEFAULT_PAGE =
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/2025MayJuneExamPapers.aspx";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SECTION_MARKERS = new Set(["LANGUAGES", "NON LANGUAGES"]);

function defaultSessionFromUrl(pageUrl) {
  try {
    const p = new URL(pageUrl).pathname.toLowerCase();
    if (p.includes("2025mayjune")) return "2025-may-june";
    if (p.includes("2024november")) return "2024-november";
    if (p.includes("2024mayjune")) return "2024-may-june";
    if (p.includes("2023")) return "2023-nsc";
  } catch {
    /* ignore */
  }
  return "nsc-papers";
}

function parseArgs(argv) {
  let url = DEFAULT_PAGE;
  let outBase = path.join(ROOT, "exam-papers");
  let session = null;
  let dryRun = false;
  let limit = Infinity;
  let delayMs = 500;
  let flat = false;
  let writeManifest = true;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--url") url = argv[++i];
    else if (a === "--out") outBase = path.resolve(argv[++i]);
    else if (a === "--session") session = argv[++i];
    else if (a === "--limit") limit = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--delay-ms") delayMs = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--flat") flat = true;
    else if (a === "--no-manifest") writeManifest = false;
    else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: node scripts/download-nsc-papers.mjs [--url URL] [--out DIR] [--session SLUG] [--flat] [--dry-run] [--limit N] [--delay-ms MS] [--no-manifest]`
      );
      process.exit(0);
    }
  }
  const resolvedSession = session || defaultSessionFromUrl(url);
  const outDir = flat ? outBase : path.join(outBase, resolvedSession);
  return { url, outBase, outDir, session: resolvedSession, dryRun, limit, delayMs, flat, writeManifest };
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function sanitizeFileBase(name) {
  const decoded = decodeHtmlEntities(name).trim();
  const cleaned = decoded.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ");
  return cleaned.slice(0, 180) || "download";
}

function slugify(title) {
  const t = decodeHtmlEntities(title).trim().toLowerCase();
  const s = t
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return s || "subject";
}

function toAbsolute(href, base) {
  if (href.startsWith("http")) return href;
  const u = new URL(base);
  return `${u.origin}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * @param {string} html
 * @returns {{ title: string, index: number }[]}
 */
function extractH2Sections(html) {
  const h2s = [];
  const re = /<h2[^>]*>\s*<span[^>]*class="eds_containerTitle"[^>]*>([^<]+)<\/span>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    h2s.push({
      title: decodeHtmlEntities(m[1]).trim(),
      index: m.index,
    });
  }
  return h2s;
}

/**
 * @param {string} html
 * @returns {{ title: string, downloadUrl: string, index: number }[]}
 */
function extractDownloadRows(html) {
  const rows = [];
  const re =
    /<td class="TitleCell"><a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a><\/td><td class="DownloadCell"><a[^>]*href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = decodeHtmlEntities(m[2].trim());
    const downloadHref = m[3];
    if (!downloadHref.includes("LinkClick.aspx")) continue;
    if (!downloadHref.includes("forcedownload=true")) continue;
    rows.push({
      title,
      downloadUrl: downloadHref,
      index: m.index,
    });
  }
  return rows;
}

/**
 * @param {number} rowIndex
 * @param {{ title: string, index: number }[]} h2s
 * @returns {string} relative path e.g. "languages/afrikaans" or "non-languages/accounting"
 */
function folderForRow(rowIndex, h2s) {
  let group = null;
  let lastSubject = null;

  for (const h of h2s) {
    if (h.index >= rowIndex) break;
    const t = h.title.trim();
    if (t === "LANGUAGES") {
      group = "languages";
      lastSubject = null;
      continue;
    }
    if (t === "NON LANGUAGES") {
      group = "non-languages";
      lastSubject = null;
      continue;
    }
    if (SECTION_MARKERS.has(t)) continue;
    if (group) {
      lastSubject = { group, slug: slugify(t) };
    }
  }

  if (!lastSubject) return "uncategorized";
  return path.join(lastSubject.group, lastSubject.slug);
}

function pickExtension(contentType) {
  if (!contentType) return ".pdf";
  const lower = contentType.split(";")[0].trim().toLowerCase();
  if (lower.includes("pdf")) return ".pdf";
  if (lower.includes("zip")) return ".zip";
  if (lower.includes("msword")) return ".doc";
  if (lower.includes("wordprocessingml")) return ".docx";
  return ".pdf";
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadOne(absoluteUrl, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(absoluteUrl, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type");
      return { bytes: buf.length, contentType, buffer: buf };
    } catch (e) {
      lastErr = e;
      await sleep(400 * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  const { url, outDir, session, dryRun, limit, delayMs, flat, writeManifest } = parseArgs(process.argv);

  console.log(`Page:    ${url}`);
  console.log(`Session: ${session}`);
  console.log(`Out:     ${outDir}${flat ? " (flat)" : ""}`);
  if (dryRun) console.log("(dry-run — no files written)\n");

  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`);
  const html = await res.text();

  const h2s = extractH2Sections(html);
  let items = extractDownloadRows(html).map((row) => ({
    ...row,
    relativeDir: flat ? "" : folderForRow(row.index, h2s),
  }));

  if (items.length === 0) {
    console.warn(
      "No TitleCell/DownloadCell rows found. The page layout may have changed; update the parser regex in this script."
    );
    process.exit(1);
  }

  console.log(`Found ${items.length} file link(s) in ${h2s.length} section heading(s).\n`);

  await fs.mkdir(outDir, { recursive: true });

  /** @type {{ title: string, relativePath: string, bytes?: number }[]} */
  const manifestEntries = [];
  const usedNames = new Set();
  let done = 0;

  for (const item of items) {
    if (done >= limit) break;
    const abs = toAbsolute(item.downloadUrl, url);
    const base = sanitizeFileBase(item.title);
    let stem = base;
    let n = 2;
    const relDir = item.relativeDir;
    const uniqueKey = `${relDir}/${stem}`;
    let key = uniqueKey;
    while (usedNames.has(key)) {
      stem = `${base}_${n}`;
      n++;
      key = `${relDir}/${stem}`;
    }
    usedNames.add(key);

    const extPlaceholder = ".pdf";
    const relPath = flat ? `${stem}${extPlaceholder}` : path.join(relDir, `${stem}${extPlaceholder}`);

    console.log(`[${done + 1}] ${item.title}`);
    console.log(`    ${flat ? "" : `→ ${relDir.replace(/\\/g, "/")}/`}${stem}.*`);

    if (!dryRun) {
      const r = await downloadOne(abs);
      const ext = pickExtension(r.contentType);
      const fileName = `${stem}${ext}`;
      const destDir = flat ? outDir : path.join(outDir, relDir);
      await fs.mkdir(destDir, { recursive: true });
      const dest = path.join(destDir, fileName);
      await fs.writeFile(dest, r.buffer);
      const writtenRel = flat ? fileName : path.join(relDir, fileName);
      console.log(`    ✓ ${writtenRel.replace(/\\/g, "/")} (${r.bytes} bytes)`);
      manifestEntries.push({
        title: item.title,
        relativePath: writtenRel.replace(/\\/g, "/"),
        bytes: r.bytes,
      });
      if (delayMs) await sleep(delayMs);
    }
    done++;
  }

  if (!dryRun && writeManifest && manifestEntries.length > 0 && !flat) {
    const manifest = {
      session,
      sourceUrl: url,
      downloadedAt: new Date().toISOString(),
      fileCount: manifestEntries.length,
      files: manifestEntries,
    };
    await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`\nWrote manifest.json (${manifestEntries.length} file(s)).`);
  }

  console.log(`\nDone. ${dryRun ? "Listed" : "Downloaded"} ${done} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
