import type { Options } from "canvas-confetti";

type ConfettiFn = (options?: Options) => Promise<unknown> | null;

let loader: Promise<ConfettiFn> | null = null;

function loadConfetti() {
  loader ??= import("canvas-confetti").then(
    (mod) => (mod as unknown as { default: ConfettiFn }).default,
  );
  return loader;
}

// Sepete ekleme sonrası, tıklanan elemanın merkezinden konfeti patlatır.
export async function burstCartConfetti(origin?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  const confetti = await loadConfetti();
  const rect = origin?.getBoundingClientRect();
  const point = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.6 };

  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 38,
    scalar: 0.9,
    ticks: 140,
    gravity: 0.9,
    disableForReducedMotion: true,
    origin: point,
    colors: ["#111111", "#e11d48", "#f59e0b", "#9ca3af", "#4b5563"],
  });
}
