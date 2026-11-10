import type { JSX } from "solid-js";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { KeyEventBus } from "../io";
import { BackLink } from "./components/BackLink";

export interface TypingGameProps {
  keyBus?: KeyEventBus;
  onBack: () => void;
}

interface FallingWord {
  id: number;
  text: string;
  x: number; // horizontal percentage 5% to 85%
  y: number; // vertical percentage 0% to 100%
  speed: number; // percentage per frame
  typedLength: number;
  isBonus?: boolean;
}

const COMMON_WORDS: readonly string[] = [
  "type",
  "fast",
  "swift",
  "code",
  "focus",
  "clear",
  "build",
  "craft",
  "light",
  "learn",
  "habit",
  "think",
  "space",
  "power",
  "skill",
  "quick",
  "flow",
  "rhythm",
  "steady",
  "motion",
  "action",
  "simple",
  "future",
  "nature",
  "wonder",
  "silver",
  "golden",
  "matrix",
  "vector",
  "engine",
  "logic",
  "syntax",
  "system",
  "script",
  "memory",
  "stream",
  "kernel",
  "buffer",
  "thread",
  "signal",
  "socket",
  "beacon",
  "crypto",
  "quantum",
  "gravity",
  "cosmos",
  "voyage",
  "stellar",
  "horizon",
  "odyssey",
  "pinnacle",
  "summit",
  "zenith",
  "harmony",
  "dynamic",
  "spark",
];

const HARD_WORDS: readonly string[] = [
  "algorithm",
  "asynchronous",
  "architecture",
  "bandwidth",
  "benchmark",
  "blockchain",
  "concurrency",
  "cryptography",
  "declarative",
  "dependency",
  "deterministic",
  "encryption",
  "functional",
  "immutable",
  "infrastructure",
  "inheritance",
  "iteration",
  "microservice",
  "modularization",
  "performance",
  "persistence",
  "polymorphism",
  "probability",
  "synchronous",
  "throughput",
  "transaction",
  "transpiler",
  "virtualization",
  "vulnerability",
];

const STORAGE_HIGH_SCORE = "type-review:game-high-score";

function readHighScore(): number {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(STORAGE_HIGH_SCORE);
      return v ? Number.parseInt(v, 10) || 0 : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

function writeHighScore(score: number): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_HIGH_SCORE, score.toString());
    }
  } catch {
    // ignore
  }
}

// Simple Web Audio synthesizer for arcade sound effects
class SoundFx {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (!this.ctx && typeof AudioContext !== "undefined") {
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playPop(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playHit(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playLevelUp(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }
}

export function TypingGame(props: TypingGameProps): JSX.Element {
  const [gameState, setGameState] = createSignal<"menu" | "playing" | "paused" | "gameover">(
    "menu",
  );
  const [difficulty, setDifficulty] = createSignal<"normal" | "speedy" | "hardcore">("normal");
  const [score, setScore] = createSignal(0);
  const [highScore, setHighScore] = createSignal(readHighScore());
  const [lives, setLives] = createSignal(3);
  const [wave, setWave] = createSignal(1);
  const [combo, setCombo] = createSignal(1);
  const [maxCombo, setMaxCombo] = createSignal(1);
  const [wordsCleared, setWordsCleared] = createSignal(0);
  const [fallingWords, setFallingWords] = createSignal<FallingWord[]>([]);
  const [targetedWordId, setTargetedWordId] = createSignal<number | null>(null);
  const [screenFlash, setScreenFlash] = createSignal(false);
  const [popups, setPopups] = createSignal<{ id: number; text: string; x: number; y: number }[]>(
    [],
  );

  const sfx = new SoundFx();
  let wordIdCounter = 0;
  let animFrameId: number | null = null;
  let lastSpawnTime = 0;
  let wordsSpawnedInWave = 0;

  const getWordPool = (): readonly string[] => {
    return difficulty() === "hardcore" ? HARD_WORDS : COMMON_WORDS;
  };

  const getSpawnInterval = (): number => {
    const base = difficulty() === "speedy" ? 1800 : difficulty() === "hardcore" ? 1500 : 2200;
    return Math.max(800, base - (wave() - 1) * 150);
  };

  const getBaseSpeed = (): number => {
    const base = difficulty() === "speedy" ? 0.07 : difficulty() === "hardcore" ? 0.09 : 0.05;
    return base + (wave() - 1) * 0.008;
  };

  const startGame = (): void => {
    setScore(0);
    setLives(3);
    setWave(1);
    setCombo(1);
    setMaxCombo(1);
    setWordsCleared(0);
    setFallingWords([]);
    setTargetedWordId(null);
    setPopups([]);
    wordIdCounter = 0;
    wordsSpawnedInWave = 0;
    lastSpawnTime = Date.now();
    setGameState("playing");
  };

  const LANES = [14, 30, 46, 62, 78];
  let lastLaneIndex = -1;

  const spawnWord = (): void => {
    const pool = getWordPool();
    const wordText = pool[Math.floor(Math.random() * pool.length)] ?? "code";

    // Pick a lane different from the previous one to avoid overlap
    let laneIdx = Math.floor(Math.random() * LANES.length);
    if (laneIdx === lastLaneIndex) {
      laneIdx = (laneIdx + 1) % LANES.length;
    }
    lastLaneIndex = laneIdx;
    const x = LANES[laneIdx] ?? 45;
    const isBonus = Math.random() < 0.15; // 15% chance bonus word

    const newWord: FallingWord = {
      id: ++wordIdCounter,
      text: wordText,
      x,
      y: 0,
      speed: getBaseSpeed() * (0.85 + Math.random() * 0.3),
      typedLength: 0,
      isBonus,
    };

    setFallingWords((prev) => [...prev, newWord]);
    wordsSpawnedInWave++;

    // Wave progression: every 15 words, level up!
    if (wordsSpawnedInWave >= 15) {
      wordsSpawnedInWave = 0;
      setWave((w) => {
        const nextWave = w + 1;
        sfx.playLevelUp();
        return nextWave;
      });
    }
  };

  const triggerHit = (): void => {
    sfx.playHit();
    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 200);
    setCombo(1);
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        // Game Over
        setGameState("gameover");
        if (score() > highScore()) {
          setHighScore(score());
          writeHighScore(score());
        }
      }
      return Math.max(0, next);
    });
  };

  // Main game loop (RAF)
  const gameLoop = (): void => {
    if (gameState() === "playing") {
      const now = Date.now();

      // Check spawn
      if (now - lastSpawnTime > getSpawnInterval()) {
        spawnWord();
        lastSpawnTime = now;
      }

      // Move falling words
      setFallingWords((prev) => {
        const remaining: FallingWord[] = [];
        let hitBottom = false;

        for (const w of prev) {
          const nextY = w.y + w.speed;
          if (nextY >= 92) {
            // Word reached bottom line!
            hitBottom = true;
            if (targetedWordId() === w.id) {
              setTargetedWordId(null);
            }
          } else {
            remaining.push({ ...w, y: nextY });
          }
        }

        if (hitBottom) {
          triggerHit();
        }

        return remaining;
      });
    }

    animFrameId = requestAnimationFrame(gameLoop);
  };

  onMount(() => {
    animFrameId = requestAnimationFrame(gameLoop);
  });

  onCleanup(() => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
    }
  });

  // Handle typing key events
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (gameState() === "menu" || gameState() === "gameover") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startGame();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setGameState((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
      return;
    }

    if (gameState() !== "playing") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      const targetedId = targetedWordId();
      if (targetedId !== null) {
        const curWord = fallingWords().find((w) => w.id === targetedId);
        if (curWord) {
          const nextLen = Math.max(0, curWord.typedLength - 1);
          setFallingWords((prev) =>
            prev.map((w) => (w.id === targetedId ? { ...w, typedLength: nextLen } : w)),
          );
          if (nextLen === 0) {
            setTargetedWordId(null);
          }
        }
      }
      return;
    }

    if (event.key.length !== 1) return;

    const char = event.key.toLowerCase();
    const words = fallingWords();
    const targetedId = targetedWordId();

    if (targetedId !== null) {
      // We already have a targeted word
      const target = words.find((w) => w.id === targetedId);
      if (target) {
        const expectedChar = target.text[target.typedLength]?.toLowerCase();
        if (char === expectedChar) {
          const nextTyped = target.typedLength + 1;
          if (nextTyped >= target.text.length) {
            // Word fully typed! Destroy it!
            destroyWord(target);
          } else {
            // Advance typed letters
            setFallingWords((prev) =>
              prev.map((w) => (w.id === targetedId ? { ...w, typedLength: nextTyped } : w)),
            );
          }
          return;
        }
      }
    }

    // No target or wrong key: check if any approaching word starts with this char
    // Pick the word closest to bottom (highest Y) that matches
    const matchingWords = words
      .filter((w) => w.text.startsWith(char) && w.typedLength === 0)
      .sort((a, b) => b.y - a.y);

    const firstMatch = matchingWords[0];
    if (firstMatch) {
      setTargetedWordId(firstMatch.id);
      const nextTyped = 1;
      if (nextTyped >= firstMatch.text.length) {
        destroyWord(firstMatch);
      } else {
        setFallingWords((prev) =>
          prev.map((w) => (w.id === firstMatch.id ? { ...w, typedLength: nextTyped } : w)),
        );
      }
    }
  };

  const destroyWord = (word: FallingWord): void => {
    sfx.playPop();
    const currentCombo = combo();
    const points = word.text.length * 10 * currentCombo * (word.isBonus ? 2 : 1);
    setScore((s) => {
      const next = s + points;
      if (next > highScore()) {
        setHighScore(next);
        writeHighScore(next);
      }
      return next;
    });

    const nextCombo = currentCombo + 1;
    setCombo(nextCombo);
    if (nextCombo > maxCombo()) {
      setMaxCombo(nextCombo);
    }
    setWordsCleared((w) => w + 1);

    // Floating score popup
    const popupId = ++wordIdCounter;
    setPopups((prev) => [
      ...prev,
      {
        id: popupId,
        text: `+${points}${nextCombo > 2 ? ` (x${nextCombo})` : ""}`,
        x: word.x,
        y: word.y,
      },
    ]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== popupId));
    }, 800);

    // Remove word
    setFallingWords((prev) => prev.filter((w) => w.id !== word.id));
    setTargetedWordId(null);
  };

  if (props.keyBus) {
    const unsub = props.keyBus.onKeyDown(handleKeyDown);
    onCleanup(unsub);
  } else if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  }

  return (
    <main class="stage page page--narrow typing-game-page">
      <Show when={gameState() === "menu"}>
        <header class="page__head">
          <div class="label">arcade</div>
          <h2 class="page__title">Type Defender.</h2>
          <p class="game-lead">
            Falling words typing game. Destroy falling words before they hit the defense line!
            Maintain combos for high scores.
          </p>
        </header>

        <section class="page__body game-menu">
          <div class="game-high-score-card">
            <span class="label">high score</span>
            <span class="game-high-score-num">{highScore()}</span>
          </div>

          <div class="game-difficulty-picker">
            <span class="label">difficulty</span>
            <div class="segmented-control">
              <button
                type="button"
                class="segmented-control__item"
                classList={{ "segmented-control__item--active": difficulty() === "normal" }}
                onClick={() => setDifficulty("normal")}
              >
                Normal
              </button>
              <button
                type="button"
                class="segmented-control__item"
                classList={{ "segmented-control__item--active": difficulty() === "speedy" }}
                onClick={() => setDifficulty("speedy")}
              >
                Speedy
              </button>
              <button
                type="button"
                class="segmented-control__item"
                classList={{ "segmented-control__item--active": difficulty() === "hardcore" }}
                onClick={() => setDifficulty("hardcore")}
              >
                Hardcore
              </button>
            </div>
          </div>

          <div class="game-start-actions">
            <button type="button" class="btn-primary btn-start-game" onClick={startGame}>
              Start Game <kbd>↵</kbd>
            </button>
          </div>
        </section>

        <div class="actions">
          <BackLink from="game" onNavigate={props.onBack} />
        </div>
      </Show>

      <Show when={gameState() === "playing" || gameState() === "paused"}>
        <div class="game-arena" classList={{ "game-arena--flash": screenFlash() }}>
          {/* Top HUD */}
          <div class="game-hud">
            <div class="game-hud__item">
              <span class="hud-label">SCORE</span>
              <span class="hud-value">{score()}</span>
            </div>
            <div class="game-hud__item">
              <span class="hud-label">WAVE</span>
              <span class="hud-value">{wave()}</span>
            </div>
            <div class="game-hud__item">
              <span class="hud-label">COMBO</span>
              <span
                class="hud-value hud-value--combo"
                classList={{
                  "hud-value--combo-warm": combo() >= 3 && combo() < 5,
                  "hud-value--combo-hot": combo() >= 5 && combo() < 10,
                  "hud-value--combo-fire": combo() >= 10,
                }}
              >
                x{combo()}
              </span>
            </div>
            <div class="game-hud__item">
              <span class="hud-label">LIVES</span>
              <span class="hud-value hud-value--lives">{"❤️".repeat(lives())}</span>
            </div>
            <button
              type="button"
              class="game-hud__pause-btn"
              onClick={() => setGameState((s) => (s === "playing" ? "paused" : "playing"))}
            >
              {gameState() === "paused" ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>

          {/* Falling Canvas Surface */}
          <div class="game-sky">
            <For each={fallingWords()}>
              {(w) => {
                const isTargeted = targetedWordId() === w.id;
                const typedPart = w.text.slice(0, w.typedLength);
                const remainingPart = w.text.slice(w.typedLength);

                return (
                  <div
                    class="falling-word"
                    classList={{
                      "falling-word--targeted": isTargeted,
                      "falling-word--bonus": !!w.isBonus,
                    }}
                    style={{
                      left: `${w.x}%`,
                      top: `${w.y}%`,
                    }}
                  >
                    <span class="falling-word__typed">{typedPart}</span>
                    <span class="falling-word__remain">{remainingPart}</span>
                  </div>
                );
              }}
            </For>

            {/* Floating popups */}
            <For each={popups()}>
              {(p) => (
                <div
                  class="floating-popup"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                  }}
                >
                  {p.text}
                </div>
              )}
            </For>

            {/* Bottom defense line */}
            <div class="defense-line">
              <div class="defense-line__glow" />
            </div>
          </div>

          {/* Paused Overlay */}
          <Show when={gameState() === "paused"}>
            <div class="game-overlay">
              <div class="game-overlay__card">
                <h3>Game Paused</h3>
                <p>
                  Press <kbd>Esc</kbd> or click below to resume.
                </p>
                <div class="game-overlay__actions">
                  <button type="button" class="btn-primary" onClick={() => setGameState("playing")}>
                    Resume
                  </button>
                  <button type="button" class="btn-secondary" onClick={() => setGameState("menu")}>
                    Quit to Menu
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={gameState() === "gameover"}>
        <section class="page__body game-over-view">
          <header class="page__head">
            <div class="label">game over</div>
            <h2 class="page__title">Defenses Breached!</h2>
          </header>

          <div class="game-over-stats">
            <div class="stat-card">
              <div class="stat-card__label">Final Score</div>
              <div class="stat-card__val stat-card__val--accent">{score()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">High Score</div>
              <div class="stat-card__val">{highScore()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Words Cleared</div>
              <div class="stat-card__val">{wordsCleared()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Max Combo</div>
              <div class="stat-card__val">x{maxCombo()}</div>
            </div>
          </div>

          <div class="game-start-actions">
            <button type="button" class="btn-primary" onClick={startGame}>
              Play Again <kbd>↵</kbd>
            </button>
            <button type="button" class="btn-secondary" onClick={() => setGameState("menu")}>
              Back to Menu
            </button>
          </div>
        </section>
      </Show>
    </main>
  );
}
