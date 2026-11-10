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

const LOCAL_STORAGE_KEY = "type-review:books-cache";

export class LocalStorageBookStore implements BookStore {
  private getBooks(): Book[] {
    try {
      if (typeof localStorage === "undefined") return [...SAMPLE_BOOKS];
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [...SAMPLE_BOOKS];
      const parsed = JSON.parse(raw) as Book[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...SAMPLE_BOOKS];
    } catch {
      return [...SAMPLE_BOOKS];
    }
  }

  private saveBooks(books: Book[]): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(books));
      }
    } catch {
      // ignore
    }
  }

  list(): Promise<Book[]> {
    return Promise.resolve(this.getBooks());
  }

  get(id: string): Promise<Book | null> {
    const book = this.getBooks().find((b) => b.id === id);
    return Promise.resolve(book ? { ...book } : null);
  }

  save(book: Book): Promise<void> {
    const books = this.getBooks();
    const idx = books.findIndex((b) => b.id === book.id);
    if (idx !== -1) {
      books[idx] = { ...book };
    } else {
      books.push({ ...book });
    }
    this.saveBooks(books);
    return Promise.resolve();
  }

  updateProgress(
    id: string,
    chapterIndex: number,
    paragraphIndex: number,
    completedChapterId?: string,
  ): Promise<void> {
    const books = this.getBooks();
    const book = books.find((b) => b.id === id);
    if (book) {
      book.currentChapterIndex = chapterIndex;
      book.currentParagraphIndex = paragraphIndex;
      book.lastReadAt = Date.now();
      if (completedChapterId && !book.completedChapters.includes(completedChapterId)) {
        book.completedChapters.push(completedChapterId);
      }
      this.saveBooks(books);
    }
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    const books = this.getBooks().filter((b) => b.id !== id);
    this.saveBooks(books);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.saveBooks([]);
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

export class IndexedDbBookStore implements BookStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;
  private fallbackStore: BookStore | null = null;

  constructor(factory?: IDBFactory) {
    this.factory = factory ?? indexedDB;
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise !== null) return this.dbPromise;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      // 3 second timeout in case IDB upgrade is blocked by another tab
      const timeoutId = setTimeout(() => {
        reject(new Error("IndexedDB open timed out"));
      }, 3000);

      const request = openTypeReviewDb(this.factory);
      request.onsuccess = () => {
        clearTimeout(timeoutId);
        const db = request.result;
        db.onversionchange = (): void => {
          db.close();
          if (this.dbPromise === pending) this.dbPromise = null;
        };
        db.onclose = (): void => {
          if (this.dbPromise === pending) this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        clearTimeout(timeoutId);
        if (this.dbPromise === pending) this.dbPromise = null;
        reject(request.error ?? new Error("IndexedDB open failed"));
      };
      request.onblocked = () => {
        // Another connection is open and blocking upgrade
        clearTimeout(timeoutId);
        if (this.dbPromise === pending) this.dbPromise = null;
        reject(new Error("IndexedDB upgrade blocked by another connection"));
      };
    });
    this.dbPromise = pending;
    pending.catch(() => {
      if (this.dbPromise === pending) this.dbPromise = null;
    });
    return pending;
  }

  private getFallback(): BookStore {
    if (!this.fallbackStore) {
      this.fallbackStore = new LocalStorageBookStore();
    }
    return this.fallbackStore;
  }

  async list(): Promise<Book[]> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().list();
      }
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const store = tx.objectStore(BOOKS_STORE);
      const books = (await promisifyRequest<Book[]>(store.getAll())) ?? [];
      if (books.length === 0) {
        await this.seedSamples();
        return [...SAMPLE_BOOKS];
      }
      return books;
    } catch {
      return this.getFallback().list();
    }
  }

  private async seedSamples(): Promise<void> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) return;
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      for (const b of SAMPLE_BOOKS) {
        store.put(b);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  async get(id: string): Promise<Book | null> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().get(id);
      }
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const store = tx.objectStore(BOOKS_STORE);
      const book = await promisifyRequest<Book | undefined>(store.get(id));
      return book ?? null;
    } catch {
      return this.getFallback().get(id);
    }
  }

  async save(book: Book): Promise<void> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().save(book);
      }
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      store.put(book);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return this.getFallback().save(book);
    }
  }

  async updateProgress(
    id: string,
    chapterIndex: number,
    paragraphIndex: number,
    completedChapterId?: string,
  ): Promise<void> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().updateProgress(
          id,
          chapterIndex,
          paragraphIndex,
          completedChapterId,
        );
      }
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
    } catch {
      return this.getFallback().updateProgress(
        id,
        chapterIndex,
        paragraphIndex,
        completedChapterId,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().delete(id);
      }
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      store.delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return this.getFallback().delete(id);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        return this.getFallback().clear();
      }
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      store.clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return this.getFallback().clear();
    }
  }

  async close(): Promise<void> {
    if (this.dbPromise !== null) {
      try {
        const db = await this.dbPromise;
        db.close();
      } catch {
        // ignore
      }
      this.dbPromise = null;
    }
    if (this.fallbackStore) {
      await this.fallbackStore.close();
    }
  }
}

export function createBookStore(factory?: IDBFactory): BookStore {
  try {
    const f = factory ?? (typeof indexedDB !== "undefined" ? indexedDB : undefined);
    if (!f) return new LocalStorageBookStore();
    return new IndexedDbBookStore(f);
  } catch {
    return new LocalStorageBookStore();
  }
}
