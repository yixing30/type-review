import type { JSX } from "solid-js";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
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

/**
 * Normalises characters so standard keyboard keys match book typography.
 * E.g., typing straight quotes ' or " matches curly ‘ ’ “ ” in books.
 */
function isCharMatch(inputKey: string, targetChar: string): boolean {
  if (inputKey === targetChar) return true;
  // Curly double quotes
  if (inputKey === '"' && (targetChar === "“" || targetChar === "”" || targetChar === "„")) {
    return true;
  }
  // Curly single quotes / apostrophes
  if (inputKey === "'" && (targetChar === "‘" || targetChar === "’" || targetChar === "`")) {
    return true;
  }
  // Dashes
  if (inputKey === "-" && (targetChar === "—" || targetChar === "–")) {
    return true;
  }
  return false;
}

export function Books(props: BooksProps): JSX.Element {
  const store = props.store ?? createBookStore();

  const [books, setBooks] = createSignal<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = createSignal<string | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = createSignal(0);
  const [currentParagraphIndex, setCurrentParagraphIndex] = createSignal(0);

  const [showChaptersModal, setShowChaptersModal] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [info, setInfo] = createSignal<string | null>(null);

  // Typing state for active paragraph
  const [typedChars, setTypedChars] = createSignal("");
  const [mistakeCount, setMistakeCount] = createSignal(0);
  const [isErrorKey, setIsErrorKey] = createSignal(false);
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

  const selectedBook = createMemo<Book | null>(() => {
    const id = selectedBookId();
    if (!id) return null;
    return books().find((b) => b.id === id) ?? null;
  });

  const currentChapter = createMemo<BookChapter | null>(() => {
    const b = selectedBook();
    if (!b || b.chapters.length === 0) return null;
    const cIdx = Math.min(Math.max(0, currentChapterIndex()), b.chapters.length - 1);
    return b.chapters[cIdx] ?? null;
  });

  // Split chapter text into clean paragraphs
  const chapterParagraphs = createMemo<string[]>(() => {
    const ch = currentChapter();
    if (!ch) return [];
    const rawParagraphs = ch.text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (rawParagraphs.length === 0) return [ch.text.trim()];

    const paragraphs: string[] = [];
    for (const p of rawParagraphs) {
      if (p.length > 400) {
        // Split long paragraph into sentence groups
        const sentences = p.split(/(?<=[.?!])\s+/);
        let cur = "";
        for (const s of sentences) {
          if (`${cur} ${s}`.trim().length > 300 && cur.length > 0) {
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
  });

  const activeTargetParagraph = createMemo<string>(() => {
    const list = chapterParagraphs();
    if (list.length === 0) return "";
    const pIdx = Math.min(Math.max(0, currentParagraphIndex()), list.length - 1);
    return list[pIdx] ?? "";
  });

  // Reset typing states on chapter or paragraph change
  const resetTypingState = (): void => {
    setTypedChars("");
    setMistakeCount(0);
    setIsErrorKey(false);
    setStartTime(null);
    setLiveWpm(0);
    setChapterFinished(false);
  };

  createEffect(() => {
    // Track dependencies to reset state
    selectedBookId();
    currentChapterIndex();
    currentParagraphIndex();
    resetTypingState();
  });

  // Open book from bookshelf
  const openBook = (book: Book): void => {
    setSelectedBookId(book.id);
    setCurrentChapterIndex(book.currentChapterIndex || 0);
    setCurrentParagraphIndex(book.currentParagraphIndex || 0);
    resetTypingState();
  };

  const updateWpm = (): void => {
    const s = startTime();
    if (!s) return;
    const elapsedMinutes = (Date.now() - s) / 60000;
    if (elapsedMinutes > 0.01) {
      const wpm = Math.round(typedChars().length / 5 / elapsedMinutes);
      setLiveWpm(Math.max(0, wpm));
    }
  };

  const advanceParagraph = (): void => {
    const b = selectedBook();
    if (!b) return;
    const totalP = chapterParagraphs().length;
    const nextP = currentParagraphIndex() + 1;

    if (nextP < totalP) {
      setCurrentParagraphIndex(nextP);
      void store.updateProgress(b.id, currentChapterIndex(), nextP);
    } else {
      // Completed all paragraphs in this chapter
      setChapterFinished(true);
      const ch = currentChapter();
      void store.updateProgress(b.id, currentChapterIndex(), nextP, ch?.id);
      if (ch && !b.completedChapters.includes(ch.id)) {
        b.completedChapters.push(ch.id);
        setBooks([...books()]);
      }
    }
  };

  const nextChapter = (): void => {
    const b = selectedBook();
    if (!b) return;
    if (currentChapterIndex() < b.chapters.length - 1) {
      const nextC = currentChapterIndex() + 1;
      setCurrentChapterIndex(nextC);
      setCurrentParagraphIndex(0);
      void store.updateProgress(b.id, nextC, 0);
    }
  };

  const prevChapter = (): void => {
    const b = selectedBook();
    if (!b) return;
    if (currentChapterIndex() > 0) {
      const prevC = currentChapterIndex() - 1;
      setCurrentChapterIndex(prevC);
      setCurrentParagraphIndex(0);
      void store.updateProgress(b.id, prevC, 0);
    }
  };

  const jumpToChapter = (cIdx: number): void => {
    const b = selectedBook();
    if (!b) return;
    setCurrentChapterIndex(cIdx);
    setCurrentParagraphIndex(0);
    void store.updateProgress(b.id, cIdx, 0);
    setShowChaptersModal(false);
  };

  // Keyboard handler
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!selectedBookId() || chapterFinished()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const target = activeTargetParagraph();
    if (!target) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      setIsErrorKey(false);
      setTypedChars((prev) => prev.slice(0, -1));
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      if (startTime() === null) {
        setStartTime(Date.now());
      }

      const curTyped = typedChars();
      const expectedChar = target[curTyped.length];

      if (expectedChar !== undefined && isCharMatch(event.key, expectedChar)) {
        setIsErrorKey(false);
        const nextTyped = curTyped + expectedChar;
        setTypedChars(nextTyped);
        updateWpm();

        if (nextTyped.length === target.length) {
          advanceParagraph();
        }
      } else {
        // Error key pressed
        setIsErrorKey(true);
        setMistakeCount((m) => m + 1);
        setTimeout(() => setIsErrorKey(false), 200);
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

  // File import handler
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
      openBook(newBook);
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
      <Show when={selectedBook() === null}>
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
                          onClick={() => openBook(b)}
                        >
                          Continue Typing
                        </button>
                        <button
                          type="button"
                          class="book-card__btn-sub"
                          onClick={() => {
                            setSelectedBookId(b.id);
                            setShowChaptersModal(true);
                          }}
                        >
                          Chapters
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

      {/* Book Reader & Typing View */}
      <Show when={selectedBook()}>
        <div class="book-reader">
          {/* Reader Topbar */}
          <div class="book-reader__nav">
            <button
              type="button"
              class="book-reader__back-btn"
              onClick={() => setSelectedBookId(null)}
            >
              ← Bookshelf
            </button>
            <div class="book-reader__title-cluster">
              <span class="book-reader__book-title">{selectedBook()?.title}</span>
              <span class="book-reader__sep">·</span>
              <button
                type="button"
                class="book-reader__chapter-badge"
                onClick={() => setShowChaptersModal(true)}
              >
                Chapter {currentChapterIndex() + 1}: {currentChapter()?.title} ▾
              </button>
            </div>
            <div class="book-reader__chapter-btns">
              <button
                type="button"
                class="book-reader__nav-btn"
                disabled={currentChapterIndex() <= 0}
                onClick={prevChapter}
              >
                ← Prev
              </button>
              <button
                type="button"
                class="book-reader__nav-btn"
                disabled={currentChapterIndex() >= (selectedBook()?.chapters.length ?? 1) - 1}
                onClick={nextChapter}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Stats & Progress HUD */}
          <div class="book-reader__stats-bar">
            <span class="stat-badge">
              Ch {currentChapterIndex() + 1}/{selectedBook()?.chapters.length}
            </span>
            <span class="stat-badge">
              Paragraph {currentParagraphIndex() + 1}/{chapterParagraphs().length}
            </span>
            <span class="stat-badge stat-badge--accent">{liveWpm()} WPM</span>
            <span class="stat-badge">Mistakes: {mistakeCount()}</span>
            <button
              type="button"
              class="stat-badge stat-badge--link"
              onClick={() => {
                const ch = currentChapter();
                if (ch) props.onRunPassage(ch.text);
              }}
              title="Run this chapter in TYPE's full screen practice engine"
            >
              Practice in TYPE ↗
            </button>
          </div>

          {/* Reading & Typing Surface */}
          <div class="book-reader__surface">
            <h3 class="book-reader__heading">{currentChapter()?.title}</h3>

            {/* Previously typed paragraphs */}
            <For each={chapterParagraphs().slice(0, currentParagraphIndex())}>
              {(p) => <p class="book-reader__paragraph book-reader__paragraph--done">{p}</p>}
            </For>

            {/* Active Typing Paragraph */}
            <Show when={!chapterFinished()}>
              <div
                class="book-reader__active-box"
                classList={{ "book-reader__active-box--error": isErrorKey() }}
              >
                <p class="book-reader__paragraph book-reader__paragraph--active">
                  <For each={activeTargetParagraph().split("")}>
                    {(char, i) => {
                      const isTyped = () => i() < typedChars().length;
                      const isCurrent = () => i() === typedChars().length;
                      return (
                        <span
                          class="book-char"
                          classList={{
                            "book-char--typed": isTyped(),
                            "book-char--current": isCurrent(),
                          }}
                        >
                          {char}
                        </span>
                      );
                    }}
                  </For>
                </p>
                <div class="book-reader__hint">
                  Type the text above. Space advances words. Backspace corrects errors.
                </div>
              </div>
            </Show>

            {/* Chapter Finished Celebration */}
            <Show when={chapterFinished()}>
              <div class="chapter-completed-card">
                <h4>🎉 Chapter Completed!</h4>
                <p>
                  Speed: <b>{liveWpm()} WPM</b> · Mistakes: <b>{mistakeCount()}</b>
                </p>
                <div class="chapter-completed-card__actions">
                  <Show
                    when={currentChapterIndex() < (selectedBook()?.chapters.length ?? 1) - 1}
                    fallback={
                      <div class="all-completed-banner">
                        ✨ You have completed every chapter of this book!
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
            <For each={chapterParagraphs().slice(currentParagraphIndex() + 1)}>
              {(p) => <p class="book-reader__paragraph book-reader__paragraph--preview">{p}</p>}
            </For>
          </div>

          {/* Chapters Drawer / Modal */}
          <Show when={showChaptersModal()}>
            <div class="book-modal-backdrop">
              <div class="book-modal" role="dialog" aria-modal="true">
                <div class="book-modal__head">
                  <h4>Chapters: {selectedBook()?.title}</h4>
                  <button
                    type="button"
                    class="book-modal__close"
                    onClick={() => setShowChaptersModal(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div class="book-modal__list">
                  <For each={selectedBook()?.chapters}>
                    {(ch, idx) => (
                      <button
                        type="button"
                        class="chapter-modal-item"
                        classList={{
                          "chapter-modal-item--active": currentChapterIndex() === idx(),
                          "chapter-modal-item--done": selectedBook()?.completedChapters.includes(
                            ch.id,
                          ),
                        }}
                        onClick={() => jumpToChapter(idx())}
                      >
                        <span class="chapter-modal-item__title">
                          {idx() + 1}. {ch.title}
                        </span>
                        <span class="chapter-modal-item__words">{ch.wordCount} words</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </main>
  );
}
