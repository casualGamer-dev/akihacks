import { pieces, transfers } from "./worldgen";

// Generates the valley off the main thread and streams it back as transferable typed arrays (zero-copy).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ hi: boolean }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = (e) => {
  for (const p of pieces(e.data.hi)) ctx.postMessage(p, transfers(p));
  ctx.postMessage({ k: "done" });
};
