// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeEach, describe, expect, it } from "vitest";
import { TypingGame } from "./TypingGame";

describe("TypingGame component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders menu view with high score and difficulties", () => {
    const dispose = render(() => <TypingGame onBack={() => {}} />, container);

    expect(container.textContent).toContain("Type Defender");
    expect(container.textContent).toContain("Normal");
    expect(container.textContent).toContain("Speedy");
    expect(container.textContent).toContain("Hardcore");
    expect(container.querySelector(".btn-start-game")).not.toBeNull();

    dispose();
  });

  it("starts game and enforces strict target lock on words", async () => {
    const dispose = render(() => <TypingGame onBack={() => {}} />, container);

    const startBtn = container.querySelector(".btn-start-game") as HTMLButtonElement;
    expect(startBtn).not.toBeNull();
    startBtn.click();

    await new Promise((r) => setTimeout(r, 40));

    expect(container.querySelector(".game-arena")).not.toBeNull();
    const wordEl = container.querySelector(".falling-word") as HTMLElement;
    expect(wordEl).not.toBeNull();

    const wordText = wordEl.textContent?.trim() ?? "";
    expect(wordText.length).toBeGreaterThan(0);

    const firstChar = wordText[0];
    const secondChar = wordText[1];

    // Type the first character to target this word
    window.dispatchEvent(new KeyboardEvent("keydown", { key: firstChar }));
    await new Promise((r) => setTimeout(r, 20));

    const targetedWord = container.querySelector(".falling-word--targeted");
    expect(targetedWord).not.toBeNull();

    const typedPart = targetedWord?.querySelector(".falling-word__typed");
    expect(typedPart?.textContent).toBe(firstChar);

    // Now type a deliberately wrong character (e.g. "!" or "1" or character not equal to secondChar)
    const wrongChar = secondChar === "z" ? "x" : "z";
    window.dispatchEvent(new KeyboardEvent("keydown", { key: wrongChar }));
    await new Promise((r) => setTimeout(r, 20));

    // Must remain locked on the targeted word and NOT switch!
    expect(container.querySelector(".falling-word--targeted")).not.toBeNull();
    expect(container.querySelector(".falling-word--error")).not.toBeNull();

    // The typed portion must still only be the firstChar
    expect(
      container.querySelector(".falling-word--targeted .falling-word__typed")?.textContent,
    ).toBe(firstChar);

    // Test Backspace: untargets when reaching 0
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(container.querySelector(".falling-word--targeted")).toBeNull();
    expect(container.querySelector(".falling-word .falling-word__typed")?.textContent).toBe("");

    dispose();
  });

  it("allows Delete key to immediately cancel target", async () => {
    const dispose = render(() => <TypingGame onBack={() => {}} />, container);

    const startBtn = container.querySelector(".btn-start-game") as HTMLButtonElement;
    startBtn.click();

    await new Promise((r) => setTimeout(r, 40));

    const wordEl = container.querySelector(".falling-word") as HTMLElement;
    expect(wordEl).not.toBeNull();
    const wordText = wordEl.textContent?.trim() ?? "";

    // Type first character
    window.dispatchEvent(new KeyboardEvent("keydown", { key: wordText[0] }));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector(".falling-word--targeted")).not.toBeNull();

    // Press Delete
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(container.querySelector(".falling-word--targeted")).toBeNull();
    expect(container.querySelector(".falling-word .falling-word__typed")?.textContent).toBe("");

    dispose();
  });

  it("never switches to another word when pressing keys matching another word's start", async () => {
    const dispose = render(() => <TypingGame onBack={() => {}} />, container);

    const startBtn = container.querySelector(".btn-start-game") as HTMLButtonElement;
    startBtn.click();

    await new Promise((r) => setTimeout(r, 40));

    const wordEls = container.querySelectorAll(".falling-word");
    expect(wordEls.length).toBeGreaterThan(0);

    const currentWordText = wordEls[0]?.textContent?.trim() ?? "";
    const firstChar = currentWordText[0];

    // Target the first word
    window.dispatchEvent(new KeyboardEvent("keydown", { key: firstChar }));
    await new Promise((r) => setTimeout(r, 20));

    expect(container.querySelector(".falling-word--targeted")).not.toBeNull();

    // Now type a key that doesn't match the second letter
    const wrongKey = currentWordText[1] === "x" ? "y" : "x";
    window.dispatchEvent(new KeyboardEvent("keydown", { key: wrongKey }));
    await new Promise((r) => setTimeout(r, 20));

    // Must still be targeted on the original word
    const targetedWord = container.querySelector(".falling-word--targeted");
    expect(targetedWord).not.toBeNull();
    expect(targetedWord?.querySelector(".falling-word__typed")?.textContent).toBe(firstChar);

    dispose();
  });
});
