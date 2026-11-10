import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createBookStore, InMemoryBookStore } from "./book-store";
import { parseBookText } from "./parse-book-text";
import { extractHtmlText } from "./parse-epub";
import { SAMPLE_BOOKS } from "./sample-books";

describe("parseBookText", () => {
  it("splits text with Chapter headings", () => {
    const raw = `
Introduction text here that is interesting.

Chapter 1: The Beginning
It was a dark and stormy night. The wind was howling through the trees.

Chapter 2: The Next Day
Morning arrived with a bright sun shining over the horizon.
`;
    const result = parseBookText("My Novel", raw);
    expect(result.title).toBe("My Novel");
    expect(result.chapters.length).toBeGreaterThanOrEqual(2);
    expect(result.chapters[0]?.title).toContain("Chapter 1");
    expect(result.chapters[0]?.text).toContain("dark and stormy night");
    expect(result.chapters[1]?.title).toContain("Chapter 2");
  });

  it("splits text with markdown headings", () => {
    const raw = `
# Prologue
First chapter of the story.

# Act One
Second chapter of the story.
`;
    const result = parseBookText("Markdown Book", raw);
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0]?.title).toBe("Prologue");
    expect(result.chapters[1]?.title).toBe("Act One");
  });

  it("falls back to chunking for plain long text without chapters", () => {
    const paragraph = "The quick brown fox jumps over the lazy dog. ".repeat(80);
    const result = parseBookText("Plain Text", paragraph);
    expect(result.chapters.length).toBeGreaterThanOrEqual(1);
    expect(result.chapters[0]?.text.length).toBeGreaterThan(0);
  });
});

describe("extractHtmlText", () => {
  it("extracts title and cleans html tags", () => {
    const html = `
      <html>
        <head><title>Chapter Title</title></head>
        <body>
          <h1>Chapter Title</h1>
          <p>This is <strong>paragraph 1</strong> with &ldquo;quotes&rdquo; and &amp; ampersands.</p>
          <p>This is paragraph 2.</p>
        </body>
      </html>
    `;
    const { title, text } = extractHtmlText(html);
    expect(title).toBe("Chapter Title");
    expect(text).toContain('paragraph 1 with "quotes" and & ampersands.');
    expect(text).toContain("paragraph 2.");
    expect(text).not.toContain("<p>");
  });
});

describe("BookStore", () => {
  it("InMemoryBookStore lists sample books by default", async () => {
    const store = new InMemoryBookStore();
    const books = await store.list();
    expect(books.length).toBe(SAMPLE_BOOKS.length);
  });

  it("can add, update progress, and delete a book", async () => {
    const store = new InMemoryBookStore([]);
    const testBook = {
      id: "b-1",
      title: "Test Book",
      chapters: [{ id: "c-1", title: "C1", text: "Hello", wordCount: 1 }],
      currentChapterIndex: 0,
      currentParagraphIndex: 0,
      completedChapters: [],
      createdAt: Date.now(),
      lastReadAt: Date.now(),
    };

    await store.save(testBook);
    let list = await store.list();
    expect(list.length).toBe(1);

    await store.updateProgress("b-1", 1, 3, "c-1");
    const updated = await store.get("b-1");
    expect(updated?.currentChapterIndex).toBe(1);
    expect(updated?.currentParagraphIndex).toBe(3);
    expect(updated?.completedChapters).toContain("c-1");

    await store.delete("b-1");
    list = await store.list();
    expect(list.length).toBe(0);
  });

  it("IndexedDbBookStore persists books using fake-indexeddb", async () => {
    const store = createBookStore(indexedDB);
    const books = await store.list();
    expect(books.length).toBeGreaterThanOrEqual(1);
    await store.close();
  });
});
