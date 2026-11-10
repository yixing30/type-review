// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookStore } from "../io/books/book-store";
import { SAMPLE_BOOKS } from "../io/books/sample-books";
import { Books } from "./Books";

describe("Books component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders bookshelf with sample books", async () => {
    const store = new InMemoryBookStore([...SAMPLE_BOOKS]);
    const dispose = render(
      () => <Books store={store} onBack={() => {}} onRunPassage={() => {}} />,
      container,
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(container.textContent).toContain("Read & Type books");
    expect(container.textContent).toContain("The Little Prince");
    expect(container.textContent).toContain("The Art of War");
    dispose();
  });

  it("opens a book when clicking Continue Typing and types with backspace", async () => {
    const store = new InMemoryBookStore([...SAMPLE_BOOKS]);
    const dispose = render(
      () => <Books store={store} onBack={() => {}} onRunPassage={() => {}} />,
      container,
    );

    await new Promise((r) => setTimeout(r, 50));

    const continueBtn = container.querySelector(".book-card__btn-primary") as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();
    continueBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(container.textContent).toContain("The Little Prince");
    expect(container.querySelector(".book-reader")).not.toBeNull();

    // Type "Once "
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "O" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

    await new Promise((r) => setTimeout(r, 30));

    let typedSpans = container.querySelectorAll(".book-char--typed");
    expect(typedSpans.length).toBe(5);

    // Test Backspace
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    await new Promise((r) => setTimeout(r, 30));

    typedSpans = container.querySelectorAll(".book-char--typed");
    expect(typedSpans.length).toBe(4);

    dispose();
  });

  it("allows switching chapters via chapter buttons", async () => {
    const store = new InMemoryBookStore([...SAMPLE_BOOKS]);
    const dispose = render(
      () => <Books store={store} onBack={() => {}} onRunPassage={() => {}} />,
      container,
    );

    await new Promise((r) => setTimeout(r, 50));

    const continueBtn = container.querySelector(".book-card__btn-primary") as HTMLButtonElement;
    continueBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    const nextBtn = container.querySelectorAll(".book-reader__nav-btn")[1] as HTMLButtonElement;
    expect(nextBtn.textContent).toContain("Next");
    nextBtn.click();

    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain("Chapter II");

    dispose();
  });
});
