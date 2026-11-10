import { sanitize } from "../corpus/sanitize";
import type { BookChapter } from "./book-types";
import { readZip, type ZipEntry } from "./zip";

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export function extractHtmlText(html: string): { title?: string; text: string } {
  // Remove script and style tags completely
  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Extract heading/title
  let title: string | undefined;
  const h1Match = cleanHtml.match(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/i);
  if (h1Match?.[1]) {
    title = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, "").trim());
  } else {
    const titleMatch = cleanHtml.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch?.[1]) {
      title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim());
    }
  }

  // Convert paragraph and break tags into newlines
  const textWithBreaks = cleanHtml
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(textWithBreaks);
  const sanitized = sanitize(decoded).text;

  return { title, text: sanitized };
}

export interface ParsedEpub {
  title: string;
  author?: string;
  chapters: BookChapter[];
}

export async function parseEpub(buffer: ArrayBuffer | Uint8Array): Promise<ParsedEpub> {
  const entries = await readZip(buffer);
  const entryMap = new Map<string, ZipEntry>();
  for (const entry of entries) {
    entryMap.set(entry.name, entry);
    // Also store normalized leading slash path
    if (entry.name.startsWith("/")) {
      entryMap.set(entry.name.slice(1), entry);
    }
  }

  // 1. Locate container.xml
  let opfPath = "";
  const containerEntry = entryMap.get("META-INF/container.xml");
  if (containerEntry) {
    const containerXml = await containerEntry.text();
    const fullPathMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (fullPathMatch?.[1]) {
      opfPath = fullPathMatch[1];
    }
  }

  // Fallback: search for any .opf file
  if (!opfPath) {
    const opfEntry = entries.find((e) => e.name.toLowerCase().endsWith(".opf"));
    if (opfEntry) {
      opfPath = opfEntry.name;
    }
  }

  if (!opfPath) {
    throw new Error("Invalid EPUB: content.opf could not be found");
  }

  const opfEntry = entryMap.get(opfPath);
  if (!opfEntry) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfContent = await opfEntry.text();

  // 2. Extract Metadata
  let bookTitle = "Untitled Book";
  const titleMatch = opfContent.match(/<dc:title[^>]*>(.*?)<\/dc:title>/i);
  if (titleMatch?.[1]) {
    bookTitle = decodeHtmlEntities(titleMatch[1].trim());
  }

  let bookAuthor: string | undefined;
  const authorMatch = opfContent.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/i);
  if (authorMatch?.[1]) {
    bookAuthor = decodeHtmlEntities(authorMatch[1].trim());
  }

  // 3. Extract Manifest
  const manifestItems = new Map<string, { href: string; mediaType: string }>();
  const itemRegex =
    /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*media-type=["']([^"']+)["'][^>]*\/?>|<item\s+[^>]*href=["']([^"']+)["'][^>]*id=["']([^"']+)["'][^>]*media-type=["']([^"']+)["'][^>]*\/?>/gi;
  let itemMatch = itemRegex.exec(opfContent);
  while (itemMatch !== null) {
    const id = itemMatch[1] ?? itemMatch[5];
    const href = itemMatch[2] ?? itemMatch[4];
    const mediaType = itemMatch[3] ?? itemMatch[6];
    if (id && href) {
      manifestItems.set(id, { href: decodeURIComponent(href), mediaType: mediaType ?? "" });
    }
    itemMatch = itemRegex.exec(opfContent);
  }

  // 4. Extract Spine Order
  const spineIds: string[] = [];
  const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*\/?>/gi;
  let spineMatch = spineRegex.exec(opfContent);
  while (spineMatch !== null) {
    if (spineMatch[1]) {
      spineIds.push(spineMatch[1]);
    }
    spineMatch = spineRegex.exec(opfContent);
  }

  // Determine chapter file paths in order
  const chapterHrefs: string[] = [];
  for (const id of spineIds) {
    const item = manifestItems.get(id);
    if (
      item &&
      (item.mediaType.includes("html") ||
        item.mediaType.includes("xhtml") ||
        item.href.endsWith(".html") ||
        item.href.endsWith(".xhtml"))
    ) {
      chapterHrefs.push(item.href);
    }
  }

  // Fallback: if spine is empty, take all HTML/XHTML entries from zip
  if (chapterHrefs.length === 0) {
    const htmlEntries = entries
      .filter(
        (e) => e.name.toLowerCase().endsWith(".xhtml") || e.name.toLowerCase().endsWith(".html"),
      )
      .map((e) => e.name);
    htmlEntries.sort();
    for (const name of htmlEntries) {
      chapterHrefs.push(name.startsWith(opfDir) ? name.slice(opfDir.length) : name);
    }
  }

  // 5. Read Chapters
  const chapters: BookChapter[] = [];
  let chapterIndex = 1;

  for (const href of chapterHrefs) {
    // Resolve relative path against opfDir
    const fullHref = href.startsWith("/") ? href.slice(1) : `${opfDir}${href}`;
    // Strip hash anchors like file.xhtml#chap01
    const cleanPath = fullHref.split("#")[0] ?? fullHref;
    const entry = entryMap.get(cleanPath);
    if (!entry) continue;

    const html = await entry.text();
    const { title, text } = extractHtmlText(html);

    if (text.trim().length > 30) {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      chapters.push({
        id: `ch-${chapterIndex}`,
        title: title && title.length < 80 ? title : `Chapter ${chapterIndex}`,
        text: text.trim(),
        wordCount: words,
      });
      chapterIndex++;
    }
  }

  if (chapters.length === 0) {
    throw new Error("No readable chapters found in this EPUB file.");
  }

  return {
    title: bookTitle,
    author: bookAuthor,
    chapters,
  };
}
