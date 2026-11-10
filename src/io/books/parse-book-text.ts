import { sanitize } from "../corpus/sanitize";
import type { BookChapter } from "./book-types";

const CHAPTER_REGEX =
  /(?:^|\r?\n)\s*((?:Chapter|CHAPTER|Act|ACT|Scene|SCENE|Section|SECTION|Book|BOOK|Part|PART)\s+[0-9IVXLCDMivxlcdm]+[^\r\n]*|(?:第[0-9一二三四五六七八九十百千万]+[章回卷节篇])[^\r\n]*|#{1,3}\s+[^\r\n]+)/gi;

export function parseBookText(
  defaultTitle: string,
  rawText: string,
): {
  title: string;
  chapters: BookChapter[];
} {
  const text = rawText.replace(/\r\n/g, "\n");
  if (text.trim().length === 0) {
    throw new Error("Text is empty");
  }

  const matches: { index: number; title: string; matchLength: number }[] = [];
  CHAPTER_REGEX.lastIndex = 0;
  let m = CHAPTER_REGEX.exec(text);

  while (m !== null) {
    const rawHeading = (m[1] ?? "").replace(/^#+\s*/, "").trim();
    if (rawHeading.length > 0 && rawHeading.length < 100) {
      matches.push({
        index: m.index,
        title: rawHeading,
        matchLength: m[0].length,
      });
    }
    m = CHAPTER_REGEX.exec(text);
  }

  const chapters: BookChapter[] = [];

  if (matches.length >= 2) {
    // If there is introductory text before the first chapter
    const firstMatch = matches[0];
    if (firstMatch && firstMatch.index > 50) {
      const introRaw = text.slice(0, firstMatch.index).trim();
      const introCleaned = sanitize(introRaw).text.trim();
      if (introCleaned.length > 20) {
        chapters.push({
          id: "ch-0",
          title: "Introduction",
          text: introCleaned,
          wordCount: introCleaned.split(/\s+/).filter(Boolean).length,
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      if (!cur) continue;
      const next = matches[i + 1];
      const start = cur.index + cur.matchLength;
      const end = next ? next.index : text.length;
      const rawChunk = text.slice(start, end).trim();
      const cleaned = sanitize(rawChunk).text.trim();

      if (cleaned.length > 10) {
        chapters.push({
          id: `ch-${chapters.length + 1}`,
          title: cur.title,
          text: cleaned,
          wordCount: cleaned.split(/\s+/).filter(Boolean).length,
        });
      }
    }
  }

  // Fallback: chunk long text into ~3000-character segments if no chapters were matched
  if (chapters.length === 0) {
    const CHUNK_SIZE = 3000;
    const sanitizedFull = sanitize(text).text.trim();
    if (sanitizedFull.length <= CHUNK_SIZE * 1.5) {
      chapters.push({
        id: "ch-1",
        title: "Complete Text",
        text: sanitizedFull,
        wordCount: sanitizedFull.split(/\s+/).filter(Boolean).length,
      });
    } else {
      let offset = 0;
      let partIndex = 1;
      while (offset < sanitizedFull.length) {
        let chunkEnd = Math.min(sanitizedFull.length, offset + CHUNK_SIZE);
        if (chunkEnd < sanitizedFull.length) {
          // Look for paragraph break
          const breakPoint = sanitizedFull.lastIndexOf("\n\n", chunkEnd);
          if (breakPoint > offset + CHUNK_SIZE * 0.7) {
            chunkEnd = breakPoint;
          } else {
            // Look for sentence break
            const periodPoint = sanitizedFull.lastIndexOf(". ", chunkEnd);
            if (periodPoint > offset + CHUNK_SIZE * 0.7) {
              chunkEnd = periodPoint + 1;
            }
          }
        }

        const chunk = sanitizedFull.slice(offset, chunkEnd).trim();
        if (chunk.length > 0) {
          chapters.push({
            id: `ch-${partIndex}`,
            title: `Part ${partIndex}`,
            text: chunk,
            wordCount: chunk.split(/\s+/).filter(Boolean).length,
          });
          partIndex++;
        }
        offset = chunkEnd;
      }
    }
  }

  return {
    title: defaultTitle.trim() || "Untitled Book",
    chapters,
  };
}
