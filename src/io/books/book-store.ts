import { BOOKS_STORE, openTypeReviewDb, promisifyRequest } from "../persistence/db";
import type { Book } from "./book-types";
import { SAMPLE_BOOKS } from "./sample-books";

export interface BookStore {
  list(): Promise<Book[]>;
  get(id: string): Promise<Book | null>;
  save(book: Book): Promise<void>;
  updateProgress(
    id: string,
    chapterIndex: number,
    paragraphIndex: number,
    completedChapterId?: string,
  ): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export class InMemoryBookStore implements BookStore {
  private readonly books: Book[] = [];

  constructor(initialBooks?: Book[]) {
    this.books = initialBooks ? [...initialBooks] : [...SAMPLE_BOOKS];
  }

  list(): Promise<Book[]> {
    return Promise.resolve(this.books.slice());
  }

  get(id: string): Promise<Book | null> {
    const book = this.books.find((b) => b.id === id);
    return Promise.resolve(book ? { ...book } : null);
  }

  save(book: Book): Promise<void> {
    const idx = this.books.findIndex((b) => b.id === book.id);
    if (idx !== -1) {
      this.books[idx] = { ...book };
    } else {
      this.books.push({ ...book });
    }
    return Promise.resolve();
  }

  updateProgress(
    id: string,
    chapterIndex: number,
    paragraphIndex: number,
    completedChapterId?: string,
  ): Promise<void> {
    const book = this.books.find((b) => b.id === id);
    if (book) {
      book.currentChapterIndex = chapterIndex;
      book.currentParagraphIndex = paragraphIndex;
      book.lastReadAt = Date.now();
      if (completedChapterId && !book.completedChapters.includes(completedChapterId)) {
        book.completedChapters.push(completedChapterId);
      }
    }
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    const idx = this.books.findIndex((b) => b.id === id);
    if (idx !== -1) {
      this.books.splice(idx, 1);
    }
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.books.length = 0;
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

export class IndexedDbBookStore implements BookStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;

  constructor(factory?: IDBFactory) {
    this.factory = factory ?? indexedDB;
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise !== null) return this.dbPromise;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = openTypeReviewDb(this.factory);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = (): void => {
          db.close();
          if (this.dbPromise === pending) this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        if (this.dbPromise === pending) this.dbPromise = null;
        reject(request.error ?? new Error("IndexedDB open failed"));
      };
    });
    this.dbPromise = pending;
    return pending;
  }

  async list(): Promise<Book[]> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readonly");
    const store = tx.objectStore(BOOKS_STORE);
    const books = (await promisifyRequest<Book[]>(store.getAll())) ?? [];
    if (books.length === 0) {
      // Seed with initial sample books
      await this.seedSamples();
      return [...SAMPLE_BOOKS];
    }
    return books;
  }

  private async seedSamples(): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    for (const b of SAMPLE_BOOKS) {
      store.put(b);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id: string): Promise<Book | null> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readonly");
    const store = tx.objectStore(BOOKS_STORE);
    const book = await promisifyRequest<Book | undefined>(store.get(id));
    return book ?? null;
  }

  async save(book: Book): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    store.put(book);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateProgress(
    id: string,
    chapterIndex: number,
    paragraphIndex: number,
    completedChapterId?: string,
  ): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    const book = await promisifyRequest<Book | undefined>(store.get(id));
    if (book) {
      book.currentChapterIndex = chapterIndex;
      book.currentParagraphIndex = paragraphIndex;
      book.lastReadAt = Date.now();
      if (completedChapterId && !book.completedChapters.includes(completedChapterId)) {
        book.completedChapters.push(completedChapterId);
      }
      store.put(book);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async close(): Promise<void> {
    if (this.dbPromise !== null) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }
}

export function createBookStore(factory?: IDBFactory): BookStore {
  try {
    const f = factory ?? (typeof indexedDB !== "undefined" ? indexedDB : undefined);
    if (!f) return new InMemoryBookStore();
    return new IndexedDbBookStore(f);
  } catch {
    return new InMemoryBookStore();
  }
}
