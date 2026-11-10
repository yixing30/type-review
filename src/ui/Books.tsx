import type { JSX } from "solid-js";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { Book, BookChapter, BookStore, KeyEventBus } from "../io";
import { createBookStore, parseBookText, parseEpub } from "../io";
import { BackLink } from "./components/BackLink";
import { logFailure } from "./log";

export interface BooksProps {
  keyBus?: KeyEventBus;
  store?: BookStore;
  onBack: () => void;
  onRunPassage: (text: string) => void;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `b-${crypto.randomUUID()}`;
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Books(props: BooksProps): JSX.Element {
  const store = props.store ?? createBookStore();

  const [books, setBooks] = createSignal<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = createSignal<string | null>(null);
  const [showChaptersFor, setShowChaptersFor] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [info, setInfo] = createSignal<string | null>(null);

  // Typing state for the active chapter
  const [typedChars, setTypedChars] = createSignal("");
  const [errorCount, setErrorCount] = createSignal(0);
  const [startTime, setStartTime] = createSignal<number | null>(null);
  const [liveWpm, setLiveWpm] = createSignal(0);
  const [chapterFinished, setChapterFinished] = createSignal(false);

  let fileInputRef: HTMLInputElement | undefined;

  const loadBooks = async (): Promise<void> => {
    try {
      const list = await store.list();
      setBooks(list);
    } catch (err: unknown) {
      logFailure("books", err);
    }
  };

  onMount(() => {
    void loadBooks();
  });

  const selectedBook = (): Book | undefined => {
    const id = selectedBookId();
    return id ? books().find((b) => b.id === id) : undefined;
  };

  const currentChapter = (): BookChapter | undefined => {
    const book = selectedBook();
    if (!book || book.chapters.length === 0) return undefined;
    return book.chapters[book.currentChapterIndex] ?? book.chapters[0];
  };

  // Split chapter into manageable typing paragraphs
  const chapterParagraphs = (): string[] => {
    const ch = currentChapter();
    if (!ch) return [];
    const rawParagraphs = ch.text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (rawParagraphs.length === 0) return [ch.text.trim()];

    const paragraphs: string[] = [];
    for (const p of rawParagraphs) {
      if (p.length > 500) {
        // Split extra long paragraphs by sentence
        const sentences = p.split(/(?<=[.?!])\s+/);
        let cur = "";
        for (const s of sentences) {
          if (`${cur} ${s}`.trim().length > 350 && cur.length > 0) {
            paragraphs.push(cur.trim());
            cur = s;
          } else {
            cur = cur ? `${cur} ${s}` : s;
          }
        }
        if (cur.trim().length > 0) {
          paragraphs.push(cur.trim());
        }
      } else {
        paragraphs.push(p);
      }
    }
    return paragraphs.length > 0 ? paragraphs : [ch.text.trim()];
  };

  const activeTargetParagraph = (): string => {
    const paragraphs = chapterParagraphs();
    const book = selectedBook();
    if (!book) return "";
    const pIdx = Math.min(book.currentParagraphIndex, paragraphs.length - 1);
    return paragraphs[pIdx] ?? "";
  };

  // Reset typing state when chapter or paragraph changes
  const resetTypingState = (): void => {
    setTypedChars("");
    setErrorCount(0);
    setStartTime(null);
    setLiveWpm(0);
    setChapterFinished(false);
  };

  createEffect(() => {
    const book = selectedBook();
    if (book) {
      // Re-trigger reset
      book.currentChapterIndex;
      book.currentParagraphIndex;
      resetTypingState();
    }
  });

  // Calculate live WPM
  const updateWpm = (): void => {
    const s = startTime();
    if (!s) return;
    const elapsedMinutes = (Date.now() - s) / 60000;
    if (elapsedMinutes > 0.02) {
      const wpm = Math.round(typedChars().length / 5 / elapsedMinutes);
      setLiveWpm(Math.max(0, wpm));
    }
  };

  // Keyboard listener for typing
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!selectedBookId() || chapterFinished()) return;
    // Ignore hotkeys
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const target = activeTargetParagraph();
    if (!target) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      const cur = typedChars();
      if (cur.length > 0) {
        setTypedChars(cur.slice(0, -1));
      }
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      if (startTime() === null) {
        setStartTime(Date.now());
      }

      const curTyped = typedChars();
      const expectedChar = target[curTyped.length];

      if (event.key === expectedChar) {
        const nextTyped = curTyped + event.key;
        setTypedChars(nextTyped);
        updateWpm();

        // Check if paragraph finished
        if (nextTyped.length === target.length) {
          advanceParagraph();
        }
      } else {
        // Error
        setErrorCount((e) => e + 1);
      }
    }
  };

  if (props.keyBus) {
    const unsub = props.keyBus.onKeyDown(handleKeyDown);
    onCleanup(unsub);
  } else if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  }

  const advanceParagraph = (): void => {
    const book = selectedBook();
    if (!book) return;
    const paragraphs = chapterParagraphs();
    const nextP = book.currentParagraphIndex + 1;

    if (nextP < paragraphs.length) {
      // Move to next paragraph
      book.currentParagraphIndex = nextP;
      void store.updateProgress(book.id, book.currentChapterIndex, nextP);
      resetTypingState();
      setBooks([...books()]);
    } else {
      // Chapter completed!
      setChapterFinished(true);
      const ch = currentChapter();
      void store.updateProgress(book.id, book.currentChapterIndex, nextP, ch?.id);
      if (ch && !book.completedChapters.includes(ch.id)) {
        book.completedChapters.push(ch.id);
      }
      setBooks([...books()]);
    }
  };

  const nextChapter = (): void => {
    const book = selectedBook();
    if (!book) return;
    if (book.currentChapterIndex < book.chapters.length - 1) {
      const nextC = book.currentChapterIndex + 1;
      book.currentChapterIndex = nextC;
      book.currentParagraphIndex = 0;
      void store.updateProgress(book.id, nextC, 0);
      resetTypingState();
      setBooks([...books()]);
    }
  };

  const prevChapter = (): void => {
    const book = selectedBook();
    if (!book) return;
    if (book.currentChapterIndex > 0) {
      const prevC = book.currentChapterIndex - 1;
      book.currentChapterIndex = prevC;
      book.currentParagraphIndex = 0;
      void store.updateProgress(book.id, prevC, 0);
      resetTypingState();
      setBooks([...books()]);
    }
  };

  const jumpToChapter = (idx: number): void => {
    const book = selectedBook();
    if (!book) return;
    book.currentChapterIndex = idx;
    book.currentParagraphIndex = 0;
    void store.updateProgress(book.id, idx, 0);
    resetTypingState();
    setBooks([...books()]);
    setShowChaptersFor(null);
  };

  // Import book handler
  const handleFileUpload = async (e: Event): Promise<void> => {
    setError(null);
    setInfo(null);
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      let bookTitle = file.name.replace(/\.[^.]+$/, "");
      let chapters: BookChapter[] = [];
      let bookAuthor: string | undefined;

      if (file.name.toLowerCase().endsWith(".epub")) {
        const buffer = await file.arrayBuffer();
        const parsed = await parseEpub(buffer);
        bookTitle = parsed.title;
        bookAuthor = parsed.author;
        chapters = parsed.chapters;
      } else {
        const rawText = await file.text();
        const parsed = parseBookText(bookTitle, rawText);
        bookTitle = parsed.title;
        chapters = parsed.chapters;
      }

      if (chapters.length === 0) {
        throw new Error("No readable chapters found in this book.");
      }

      const newBook: Book = {
        id: randomId(),
        title: bookTitle,
        author: bookAuthor,
        chapters,
        currentChapterIndex: 0,
        currentParagraphIndex: 0,
        completedChapters: [],
        createdAt: Date.now(),
        lastReadAt: Date.now(),
      };

      await store.save(newBook);
      await loadBooks();
      setInfo(`Added "${newBook.title}" with ${chapters.length} chapters.`);
      setSelectedBookId(newBook.id);
    } catch (err: unknown) {
      logFailure("books", err);
      setError(err instanceof Error ? err.message : "Failed to import book.");
    } finally {
      setBusy(false);
      if (fileInputRef) fileInputRef.value = "";
    }
  };

  const deleteBook = async (id: string, title: string): Promise<void> => {
    if (confirm(`Remove "${title}" from your bookshelf?`)) {
      await store.delete(id);
      if (selectedBookId() === id) {
        setSelectedBookId(null);
      }
      await loadBooks();
    }
  };

  return (
    <main class="stage page page--narrow books-page">
      <Show when={selectedBookId() === null}>
        {/* Bookshelf View */}
        <header class="page__head">
          <div class="label">books</div>
          <h2 class="page__title">Read & Type books.</h2>
          <p class="books-lead">
            Practice typing with full books chapter by chapter. Import your own EPUB, TXT, or
            Markdown files. Reading progress is bookmarked automatically.
          </p>
        </header>

        <section class="page__body">
          <div class="books-toolbar">
            <label class="btn-import-book" classList={{ "btn-import-book--busy": busy() }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,.txt,.md,.markdown"
                style={{ display: "none" }}
                onChange={handleFileUpload}
                disabled={busy()}
              />
              {busy() ? "Importing…" : "+ Import Book (EPUB / TXT / MD)"}
            </label>
          </div>

          <Show when={error()}>
            <div class="alert alert--danger" role="alert">
              {error()}
            </div>
          </Show>
          <Show when={info()}>
            <div class="alert alert--info" role="status">
              {info()}
            </div>
          </Show>

          <div class="books-grid">
            <For each={books()}>
              {(b) => {
                const totalChapters = b.chapters.length;
                const progressPct = Math.round(
                  (b.completedChapters.length / Math.max(1, totalChapters)) * 100,
                );
                return (
                  <div class="book-card">
                    <div
                      class="book-card__spine"
                      style={{ background: b.coverColor ?? "var(--color-accent)" }}
                    />
                    <div class="book-card__content">
                      <div class="book-card__title" title={b.title}>
                        {b.title}
                      </div>
                      <Show when={b.author}>
                        <div class="book-card__author">{b.author}</div>
                      </Show>
                      <div class="book-card__meta">
                        {totalChapters} chapters · {b.completedChapters.length} finished (
                        {progressPct}%)
                      </div>

                      <div class="book-card__progress-bar">
                        <div
                          class="book-card__progress-fill"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div class="book-card__actions">
                        <button
                          type="button"
                          class="book-card__btn-primary"
                          onClick={() => setSelectedBookId(b.id)}
                        >
                          Continue Typing
                        </button>
                        <button
                          type="button"
                          class="book-card__btn-sub"
                          onClick={() =>
                            setShowChaptersFor(showChaptersFor() === b.id ? null : b.id)
                          }
                        >
                          {showChaptersFor() === b.id ? "Hide Chapters" : "Chapters"}
                        </button>
                        <button
                          type="button"
                          class="book-card__btn-del"
                          title="Delete book"
                          onClick={() => deleteBook(b.id, b.title)}
                        >
                          ×
                        </button>
                      </div>

                      <Show when={showChaptersFor() === b.id}>
                        <div class="book-card__chapter-list">
                          <For each={b.chapters}>
                            {(ch, idx) => (
                              <button
                                type="button"
                                class="chapter-item"
                                classList={{
                                  "chapter-item--active": b.currentChapterIndex === idx(),
                                  "chapter-item--done": b.completedChapters.includes(ch.id),
                                }}
                                onClick={() => {
                                  setSelectedBookId(b.id);
                                  jumpToChapter(idx());
                                }}
                              >
                                <span class="chapter-item__title">{ch.title}</span>
                                <span class="chapter-item__words">{ch.wordCount} words</span>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </section>

        <div class="actions">
          <BackLink from="books" onNavigate={props.onBack} />
        </div>
      </Show>

      <Show when={selectedBook()}>
        {(book) => {
          const ch = currentChapter();
          const paragraphs = chapterParagraphs();
          const pIdx = Math.min(book().currentParagraphIndex, paragraphs.length - 1);
          const target = activeTargetParagraph();
          const typed = typedChars();

          return (
            <div class="book-reader">
              {/* Reader Header */}
              <div class="book-reader__nav">
                <button
                  type="button"
                  class="book-reader__back-btn"
                  onClick={() => setSelectedBookId(null)}
                >
                  ← Bookshelf
                </button>
                <div class="book-reader__title-cluster">
                  <span class="book-reader__book-title">{book().title}</span>
                  <span class="book-reader__sep">·</span>
                  <select
                    class="book-reader__chapter-select"
                    value={book().currentChapterIndex}
                    onChange={(e) => jumpToChapter(Number(e.currentTarget.value))}
                  >
                    <For each={book().chapters}>
                      {(c, i) => (
                        <option value={i()}>
                          {i() + 1}. {c.title}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
                <div class="book-reader__chapter-btns">
                  <button
                    type="button"
                    class="book-reader__nav-btn"
                    disabled={book().currentChapterIndex <= 0}
                    onClick={prevChapter}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    class="book-reader__nav-btn"
                    disabled={book().currentChapterIndex >= book().chapters.length - 1}
                    onClick={nextChapter}
                  >
                    Next →
                  </button>
                </div>
              </div>

              {/* Progress & Live Stats Bar */}
              <div class="book-reader__stats-bar">
                <span class="stat-badge">
                  Chapter {book().currentChapterIndex + 1}/{book().chapters.length}
                </span>
                <span class="stat-badge">
                  Paragraph {pIdx + 1}/{paragraphs.length}
                </span>
                <span class="stat-badge stat-badge--accent">{liveWpm()} WPM</span>
                <span class="stat-badge">Mistakes: {errorCount()}</span>
                <button
                  type="button"
                  class="stat-badge stat-badge--link"
                  onClick={() => ch && props.onRunPassage(ch.text)}
                  title="Run this chapter in TYPE's full screen practice engine"
                >
                  Practice in TYPE ↗
                </button>
              </div>

              {/* Reading & Typing Surface */}
              <div class="book-reader__surface">
                <h3 class="book-reader__heading">{ch?.title}</h3>

                {/* Previously typed paragraphs in this chapter */}
                <For each={paragraphs.slice(0, pIdx)}>
                  {(p) => <p class="book-reader__paragraph book-reader__paragraph--done">{p}</p>}
                </For>

                {/* Active Typing Paragraph */}
                <Show when={!chapterFinished()}>
                  <div class="book-reader__active-box">
                    <p class="book-reader__paragraph book-reader__paragraph--active">
                      <For each={target.split("")}>
                        {(char, i) => {
                          const isTyped = i() < typed.length;
                          const isCurrent = i() === typed.length;
                          return (
                            <span
                              class="book-char"
                              classList={{
                                "book-char--typed": isTyped,
                                "book-char--current": isCurrent,
                              }}
                            >
                              {char}
                            </span>
                          );
                        }}
                      </For>
                    </p>
                    <div class="book-reader__hint">
                      Type the text above. Space advances words. Backspace corrects.
                    </div>
                  </div>
                </Show>

                {/* Chapter Finished Celebration */}
                <Show when={chapterFinished()}>
                  <div class="chapter-completed-card">
                    <h4>🎉 Chapter Completed!</h4>
                    <p>
                      Speed: <b>{liveWpm()} WPM</b> · Accuracy:{" "}
                      <b>
                        {Math.max(
                          0,
                          Math.round(
                            ((target.length - errorCount()) / Math.max(1, target.length)) * 100,
                          ),
                        )}
                        %
                      </b>
                    </p>
                    <div class="chapter-completed-card__actions">
                      <Show
                        when={book().currentChapterIndex < book().chapters.length - 1}
                        fallback={
                          <div class="all-completed-banner">
                            ✨ You have finished all chapters of this book!
                          </div>
                        }
                      >
                        <button type="button" class="btn-primary" onClick={nextChapter}>
                          Next Chapter →
                        </button>
                      </Show>
                      <button
                        type="button"
                        class="btn-secondary"
                        onClick={() => setSelectedBookId(null)}
                      >
                        Back to Bookshelf
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Upcoming paragraphs preview */}
                <For each={paragraphs.slice(pIdx + 1)}>
                  {(p) => <p class="book-reader__paragraph book-reader__paragraph--preview">{p}</p>}
                </For>
              </div>
            </div>
          );
        }}
      </Show>
    </main>
  );
}
