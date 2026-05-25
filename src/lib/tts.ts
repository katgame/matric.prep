"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── LaTeX → readable text ────────────────────────────────────────────────────

function resolveLatex(s: string): string {
  // Multiple passes to handle nesting (e.g. \frac{\sqrt{x}}{y})
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, n, d) => `${n} over ${d}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => `square root of ${x}`)
      .replace(/\\(?:text|mathrm|mathbf|textbf|mbox)\{([^{}]*)\}/g, (_, x) => x)
      .replace(/\{([^{}]*)\}/g, "$1");
  }

  s = s
    // Powers
    .replace(/\^2(?!\d)/g, " squared")
    .replace(/\^3(?!\d)/g, " cubed")
    .replace(/\^(\d+)/g, " to the power of $1")
    .replace(/\^([a-zA-Z])/g, " to the power of $1")
    // Subscripts
    .replace(/_(\d+)/g, " sub $1")
    .replace(/_([a-zA-Z])/g, " sub $1")
    // Operators & relations
    .replace(/\\pm/g, "plus or minus")
    .replace(/\\times/g, "times")
    .replace(/\\cdot/g, "times")
    .replace(/\\div/g, "divided by")
    .replace(/\\leq|\\le(?![a-z])/g, "less than or equal to")
    .replace(/\\geq|\\ge(?![a-z])/g, "greater than or equal to")
    .replace(/\\neq|\\ne(?![a-z])/g, "not equal to")
    .replace(/\\approx/g, "approximately")
    .replace(/\\Rightarrow/g, "therefore")
    .replace(/\\rightarrow/g, "gives")
    .replace(/\\Leftrightarrow/g, "if and only if")
    .replace(/\\leftrightarrow/g, "if and only if")
    // Sets & logic
    .replace(/\\in(?![a-z])/g, "in")
    .replace(/\\notin/g, "not in")
    .replace(/\\subset/g, "subset of")
    .replace(/\\cup/g, "union")
    .replace(/\\cap/g, "intersection")
    // Trig & calculus
    .replace(/\\sin/g, "sine")
    .replace(/\\cos/g, "cosine")
    .replace(/\\tan/g, "tangent")
    .replace(/\\log/g, "log")
    .replace(/\\ln/g, "natural log")
    .replace(/\\lim/g, "limit")
    .replace(/\\sum/g, "sum")
    .replace(/\\int/g, "integral")
    // Greek
    .replace(/\\[Pp]i/g, "pi")
    .replace(/\\theta/g, "theta")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\\gamma/g, "gamma")
    .replace(/\\[Dd]elta/g, "delta")
    .replace(/\\lambda/g, "lambda")
    .replace(/\\mu/g, "mu")
    .replace(/\\[Ss]igma/g, "sigma")
    .replace(/\\omega/g, "omega")
    // Misc
    .replace(/\\infty/g, "infinity")
    .replace(/\\ldots|\\cdots/g, "dot dot dot")
    .replace(/\\quad|\\qquad/g, " ")
    // Strip remaining commands and braces
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "");

  return s.replace(/\s{2,}/g, " ").trim();
}

export function stripForSpeech(markdown: string): string {
  let s = markdown;

  // Math blocks → readable text
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => ` ${resolveLatex(m.trim())} `);
  s = s.replace(/\$([\s\S]*?)\$/g, (_, m) => ` ${resolveLatex(m.trim())} `);

  // Strip markdown structure
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");
  s = s.replace(/\*(.*?)\*/g, "$1");
  s = s.replace(/_(.*?)_/g, "$1");
  s = s.replace(/^[-*+]\s+/gm, "");
  s = s.replace(/^\d+\.\s+/gm, "");
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/`([^`]*)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/^---+$/gm, "");

  // Collapse whitespace
  s = s.replace(/\n{2,}/g, ". ");
  s = s.replace(/\n/g, " ");
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

// ── useSpeech hook ───────────────────────────────────────────────────────────

export function useSpeech() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const supported = useRef(typeof window !== "undefined" && "speechSynthesis" in window);

  const stop = useCallback(() => {
    if (!supported.current) return;
    window.speechSynthesis.cancel();
    setActiveKey(null);
  }, []);

  const toggle = useCallback(
    (content: string, key: string) => {
      if (!supported.current) return;

      // Already speaking this key — stop
      if (activeKey === key) {
        window.speechSynthesis.cancel();
        setActiveKey(null);
        return;
      }

      // Start new utterance
      window.speechSynthesis.cancel();
      const text = stripForSpeech(content);
      if (!text) return;

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.88;
      utter.lang = "en-ZA";
      utter.onend = () => setActiveKey(null);
      utter.onerror = () => setActiveKey(null);

      setActiveKey(key);
      window.speechSynthesis.speak(utter);
    },
    [activeKey],
  );

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (supported.current) window.speechSynthesis.cancel();
    };
  }, []);

  return { activeKey, stop, toggle, supported: supported.current };
}
