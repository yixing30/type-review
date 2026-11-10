export interface BookChapter {
  id: string;
  title: string;
  text: string;
  wordCount: number;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  coverColor?: string;
  chapters: BookChapter[];
  currentChapterIndex: number;
  currentParagraphIndex: number;
  completedChapters: string[];
  createdAt: number;
  lastReadAt: number;
}
