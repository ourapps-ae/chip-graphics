// Draws chip piles and moves them across a page. The maths is in chip-model.ts; colours for the
// amount label come from the theme's CSS variables (chips.css).
import { allInScale, breakdown, flightAt, normaliseSettings, pileLayout, shortDenom, stackTotal } from "./chip-model.ts";
import type { ChipColour, ChipSettings, Flight, Point } from "./chip-model.ts";

type Child = Node | string | null | undefined | false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, style: Record<string, string> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  Object.assign(node.style, style);
  for (const c of children) if (c) node.append(c);
  return node;
}

export type PileOptions = {
  settings?: Partial<ChipSettings>;
  /** chip diameter in pixels */
  size?: number;
  /** show the amount under the pile */
  label?: boolean;
  /** how the amount is written; defaults to digits with thousands separators */
  format?: (amount: number) => string;
};

const defaultFormat = (n: number) => n.toLocaleString("en-US");

// A pile of stacks side by side with the amount under it.
export function pileEl(amount: number, o: PileOptions = {}): HTMLElement {
  const { denominations, colours } = normaliseSettings(o.settings);
  const size = o.size ?? 14;
  const stacks = breakdown(amount, denominations);
  const layout = pileLayout(stacks, size);
  const pile = el("div", "pile", { height: `${layout.height}px`, width: `${layout.width}px` });
  for (const c of layout.chips) {
    const colour: ChipColour = colours[c.denom];
    pile.append(el("div", "chip", {
      width: `${size}px`, height: `${size}px`, left: `${c.x}px`, top: `${c.y}px`,
      background: colour.fill, borderColor: colour.edge, color: colour.ink, fontSize: `${Math.round(size * 0.42)}px`,
    }, c.label ? shortDenom(c.denom) : ""));
  }
  const box = el("div", "pilebox", {}, pile, o.label === false ? null : el("span", "amount", {}, (o.format ?? defaultFormat)(amount)));
  box.dataset.total = String(stackTotal(stacks));
  return box;
}

export type Projector = (p: Point) => { x: number; y: number };

// Moves piles along flights over `container` (a positioned element laid over the table). `project`
// turns a flight's spots into pixels. Each pile appears at its start after `delayMs`, travels for
// `durationMs`, and is removed. `onLand` runs as each one arrives. Returns a function that cancels
// everything still pending.
export function launchFlights(container: HTMLElement, flights: Flight[], o: { project: Projector; pile?: PileOptions; onLand?: (f: Flight) => void; steps?: number }): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const nodes: HTMLElement[] = [];
  const steps = o.steps ?? 12;
  for (const f of flights) {
    const node = el("div", `flight${f.allIn ? " allin" : ""}`, { visibility: "hidden" }, pileEl(f.amount, { size: 12, label: false, ...o.pile }));
    node.dataset.key = f.key;
    const place = (p: Point) => { const q = o.project(p); node.style.left = `${q.x}px`; node.style.top = `${q.y}px`; };
    place(f.from);
    container.append(node);
    nodes.push(node);
    timers.push(setTimeout(() => {
      node.style.visibility = "visible";
      for (let i = 1; i <= steps; i++) {
        timers.push(setTimeout(() => {
          const p = i / steps;
          place(flightAt(f, p));
          if (f.allIn) node.style.transform = `translate(-50%, -50%) scale(${allInScale(p)})`;
        }, (f.durationMs * i) / steps));
      }
      timers.push(setTimeout(() => { node.remove(); o.onLand?.(f); }, f.durationMs + 20));
    }, f.delayMs));
  }
  return () => { for (const t of timers) clearTimeout(t); for (const n of nodes) n.remove(); };
}
