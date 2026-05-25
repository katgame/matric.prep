#!/usr/bin/env node
/**
 * Creates the exam-papers folder skeleton (session + languages / non-languages) without downloading files.
 *
 * Usage:
 *   node scripts/scaffold-exam-papers.mjs
 *   node scripts/scaffold-exam-papers.mjs --session 2025-may-june --root ./exam-papers
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function parseArgs(argv) {
  let session = "2025-may-june";
  let base = path.join(ROOT, "exam-papers");
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--session") session = argv[++i];
    else if (a === "--root") base = path.resolve(argv[++i]);
  }
  return { session, base };
}

async function main() {
  const { session, base } = parseArgs(process.argv);
  const sessionDir = path.join(base, session);
  const dirs = [
    path.join(sessionDir, "languages"),
    path.join(sessionDir, "non-languages"),
  ];
  for (const d of dirs) {
    await fs.mkdir(d, { recursive: true });
    await fs.writeFile(path.join(d, ".gitkeep"), "", "utf8");
  }
  console.log(`Scaffolded:\n  ${sessionDir}/languages/\n  ${sessionDir}/non-languages/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
