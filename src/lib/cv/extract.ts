"use client";

import type { Layout } from "./ats";

const WORKER_URL = "https://unpkg.com/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs";

type Item = { str: string; x: number; y: number; w: number };

// Reads the PDF in the browser as an ATS would: the text in the order the file stores it, line by line,
// plus what the layout says (columns side by side, titles in spaced letters).
export async function readCv(file: File): Promise<{ text: string; layout: Layout }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  const pageTexts: string[] = [];
  let lines = 0;
  let sideBySide = 0;
  let spacedTitles = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const width = page.getViewport({ scale: 1 }).width;
    const content = await page.getTextContent();
    const items: Item[] = content.items
      .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => "str" in i && Boolean((i as { str: string }).str.trim()))
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));

    // Reading order as stored: a new line whenever the vertical position changes.
    let text = "";
    let lastY: number | null = null;
    for (const it of items) {
      text += lastY !== null && Math.abs(it.y - lastY) > 2 ? `\n${it.str}` : `${text && !text.endsWith("\n") ? " " : ""}${it.str}`;
      lastY = it.y;
    }
    pageTexts.push(text);

    // Two blocks on the same line, far apart: a column layout.
    const rows = new Map<number, Item[]>();
    for (const it of items) rows.set(Math.round(it.y / 3), [...(rows.get(Math.round(it.y / 3)) ?? []), it]);
    for (const row of rows.values()) {
      lines++;
      const sorted = row.sort((a, b) => a.x - b.x);
      if (sorted.some((it, k) => k > 0 && it.x - (sorted[k - 1].x + sorted[k - 1].w) > width * 0.18)) sideBySide++;
      const joined = sorted.map((it) => it.str).join(" ");
      if (/(^|\s)([A-ZÀ-Ü]\s){4,}[A-ZÀ-Ü](\s|$)/.test(joined)) spacedTitles++;
    }
  }
  return {
    text: pageTexts.join("\n\n").replace(/[ \t]+/g, " ").trim(),
    layout: { pages: doc.numPages, columnRatio: lines ? sideBySide / lines : 0, spacedTitles },
  };
}
