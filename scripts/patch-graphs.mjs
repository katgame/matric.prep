#!/usr/bin/env node
/**
 * Patches existing paper.import.json files to add [GRAPH] / [FIGURE] blocks
 * to questions that reference diagrams, derived from the LaTeX function expressions
 * already extracted by the vision pipeline.
 *
 * Usage:  node scripts/patch-graphs.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return fs.readFile(filePath).then((buf) => {
    const str = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.slice(3).toString("utf8")
      : buf.toString("utf8");
    return JSON.parse(str);
  });
}

function writeJson(filePath, obj) {
  return fs.writeFile(filePath, JSON.stringify(obj, null, 2), "utf8");
}

/**
 * Inserts a [GRAPH] or [FIGURE] block into a [latex] prompt string.
 * The block is placed after the introductory paragraph (before the first **N.N** sub-question).
 */
function insertBlock(prompt, block) {
  const prefix = "[latex]\n";
  const body = prompt.startsWith(prefix) ? prompt.slice(prefix.length) : prompt;
  // Find the first bold sub-question reference like **4.1** or **1.1**
  const subqIdx = body.search(/\*\*\d+\.\d/);
  if (subqIdx === -1) return prompt; // no sub-questions, append at end
  const intro = body.slice(0, subqIdx).trimEnd();
  const rest = body.slice(subqIdx);
  return prefix + intro + "\n\n" + block + "\n\n" + rest;
}

// ── P1 patches ───────────────────────────────────────────────────────────────

const P1_PATCHES = {
  // Q4 — Hyperbola  f(x) = 4/(x-3) + 4
  // D (y-intercept): f(0) = 4/(0-3)+4 = -4/3+4 = 8/3 ≈ 2.67
  // C (x-intercept): 4/(x-3)+4=0 → x-3=-1 → x=4, but exam says C is x-int... let me verify:
  //   4/(x-3) + 4 = 0  →  4/(x-3) = -4  →  x-3 = -1  →  x = 2, so C(2,0)?
  //   Wait: 4/(2-3)+4 = 4/(-1)+4 = -4+4 = 0. Yes, C(2,0). Not (5,0).
  4: `[GRAPH]
fn: 4/(x-3) + 4
xRange: -5 to 10
yRange: -10 to 14
points: M(3,4), C(2,0), D(0,2.67)
vAsymptote: 3
hAsymptote: 4
[/GRAPH]`,

  // Q5 — Parabola  From 5.1 we know f(x) = -2x^2 - 4x + 2
  // Turning point C(-1, 4), point B(-3, -4)
  5: `[GRAPH]
fn: -2*x**2 - 4*x + 2
xRange: -5 to 3
yRange: -8 to 6
points: C(-1,4), B(-3,-4)
[/GRAPH]`,

  // Q6 — Exponential + Linear
  // f(x) = p^x + q; B(0,-3) → 1+q=-3 → q=-4; A(3,4) → p^3-4=4 → p^3=8 → p=2
  // So f(x) = 2^x - 4, asymptote y=-4
  // g through A(3,4) and B(0,-3): slope=(4+3)/3=7/3, so g(x) = (7/3)x - 3
  6: `[GRAPH]
fn: 2**x - 4
fn: (7/3)*x - 3
xRange: -3 to 5
yRange: -6 to 10
points: A(3,4), B(0,-3)
hAsymptote: -4
[/GRAPH]`,

  // Q9 — Cubic  f(x) = x^3 - 6x^2 + 9x - 4 = (x-4)(x-1)^2
  // Turning points: f'(x) = 3x^2 - 12x + 9 = 3(x^2-4x+3) = 3(x-1)(x-3)
  // f(1)=1-6+9-4=0  →  TP at (1,0)  (local max)
  // f(3)=27-54+27-4=-4  →  TP at (3,-4)  (local min)
  // x-intercepts: x=1 (double), x=4
  // y-intercept: f(0)=-4
  9: `[GRAPH]
fn: x**3 - 6*x**2 + 9*x - 4
xRange: -1 to 5.5
yRange: -6 to 4
points: A(1,0), B(3,-4), C(4,0), D(0,-4)
[/GRAPH]`,
};

// ── P2 patches ───────────────────────────────────────────────────────────────

const P2_PATCHES = {
  // Q3 — Analytical Geometry: triangle SRT
  3: `[FIGURE]
Triangle SRT where R lies on the x-axis, S is to the left of R at coordinates (m, 1), and T lies on the y-axis. The line RT has equation 2x − y + 10 = 0. The triangle is drawn in the Cartesian plane with all three vertices labeled.
[/FIGURE]`,

  // Q4 — Circle: centre M, equation (x-3)^2 + y^2 = 25
  // Centre M(3,0), radius 5. Points E(-1,3) and T on circle. Tangent at E meets x-axis at D.
  4: `[FIGURE]
Circle with centre M(3, 0) and radius 5, equation (x−3)² + y² = 25. Points E(−1, 3) and T lie on the circle. A tangent to the circle at E meets the x-axis at D and is produced to C(−7, p). The line MT is produced to meet the tangent at C.
[/FIGURE]`,

  // Q7 — Trig graphs over [-180°, 180°]
  // f(x) = 2cos(x)+1, g(x) = sin(2x) — x in degrees so convert for function-plot
  7: `[GRAPH]
fn: 2*Math.cos(x * Math.PI/180) + 1
fn: Math.sin(2 * x * Math.PI/180)
xRange: -180 to 180
yRange: -2 to 4
[/GRAPH]`,

  // Q8 — 3D geometry problem (no Cartesian graph)
  8: `[FIGURE]
Three-dimensional diagram with points A, B and C lying in a horizontal plane where AB = AC. Point D is directly above A. The diagram shows angles: ABC̃ = x (angle at B in the horizontal plane) and DBA̋ = y (angle of elevation from B to D). The height AD = p and BC = 2AD = 2p.
[/FIGURE]`,

  // Q9 — Euclidean Geometry
  9: `[FIGURE]
Diagram 9.1: Triangle DEF with line GH intersecting DF at G and EF at H such that GH is parallel to DE. Given GF/DG = 2/5.
Diagram 9.2: Circle with chord and tangent-chord angle relationships as described in the sub-questions.
[/FIGURE]`,

  // Q10 — Similar triangles and circle theorems
  10: `[FIGURE]
Two diagrams: (10.1) Triangles ABC and PKL that are equiangular (Â=P̂, B̂=K̂, Ĉ=L̂). (10.2) Circle geometry diagram for the proof involving a tangent and chord as described in the sub-questions.
[/FIGURE]`,
};

async function patchFile(filePath, patches) {
  const dto = await readJson(filePath);
  let patched = 0;

  for (const q of dto.questions) {
    if (q.questionType === "mcq" || q.questionType === "group") continue;
    const block = patches[q.sortOrder];
    if (!block) continue;
    if (q.prompt.includes("[GRAPH]") || q.prompt.includes("[FIGURE]")) {
      console.log(`  Q${q.sortOrder} — already has block, skipping`);
      continue;
    }
    q.prompt = insertBlock(q.prompt, block);
    console.log(`  Q${q.sortOrder} — inserted ${block.startsWith("[GRAPH]") ? "[GRAPH]" : "[FIGURE]"}`);
    patched++;
  }

  if (patched > 0) {
    await writeJson(filePath, dto);
    console.log(`  Saved → ${path.basename(filePath)} (${patched} question(s) patched)\n`);
  } else {
    console.log(`  No changes needed for ${path.basename(filePath)}\n`);
  }
}

async function main() {
  console.log("Patching P1...");
  await patchFile(path.join(ROOT, "paper.import.maths-p1.json"), P1_PATCHES);

  console.log("Patching P2...");
  await patchFile(path.join(ROOT, "paper.import.maths-p2.json"), P2_PATCHES);

  console.log("Done. Now re-run mcq + import for both papers.");
}

main().catch((e) => { console.error(e); process.exit(1); });
