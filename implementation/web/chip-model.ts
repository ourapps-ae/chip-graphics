// Chips as data: an amount becomes stacks of the application's denominations, drawn as discs with a
// dashed edge; bets move between spots on a schedule. Everything here is pure and shared by every
// platform; chips.ts draws it.
export type Point = { x: number; y: number };
export type ChipColour = { fill: string; edge: string; ink: string };
export type ChipSettings = { denominations: string; chipColours: string };
export type Stack = { denom: number; count: number };

// A stack holds at most this many chips; more becomes another stack.
export const MAX_STACK = 12;
export const FLY_MS = 450;
export const ALL_IN_MS = 700;
export const DEFAULT_DENOMINATIONS = "casino 5000 1000 500 100 25 5 1";
export const DEFAULT_COLOURS = "casino";

// Casino colours: 25 green, 100 black, 500 purple, 1000 orange, 5000 cream; small change grey.
const CASINO: Record<number, ChipColour> = {
  5000: { fill: "#f1e6c8", edge: "#b08a3c", ink: "#4a3a14" },
  1000: { fill: "#e07b2a", edge: "#f6f1e4", ink: "#2b1a08" },
  500: { fill: "#6e3fa0", edge: "#f6f1e4", ink: "#f6f1e4" },
  100: { fill: "#1b1a17", edge: "#f6f1e4", ink: "#f6f1e4" },
  25: { fill: "#2e8b57", edge: "#f6f1e4", ink: "#f6f1e4" },
  5: { fill: "#c0262d", edge: "#f6f1e4", ink: "#f6f1e4" },
  1: { fill: "#8a8f98", edge: "#f6f1e4", ink: "#1b1a17" },
};
// Used for denominations the palette has no colour for, in turn from the largest.
const SPARE = ["#2f6fb0", "#b0752f", "#7a3f6e", "#2f9aa0", "#8c8c2f", "#a03f3f"];

// Installer values are one word then space separated entries, because an aepm string setting is
// letters, digits, spaces and hyphens only. denominations: "casino 5000 1000 500 100 25 5 1" (the
// first word names the set and is optional when the first character of the value is a digit, as in
// code). chipColours: "casino" or "mine 1000-e07b2a 25-2e8b57" (denomination, hyphen, rrggbb).
export function parseDenominations(value: string | number[]): number[] {
  const words = typeof value === "string" ? value.trim().split(/[\s,]+/).filter(Boolean) : value.map(String);
  const numbers = words.filter((w, i) => !(i === 0 && /^[A-Za-z]/.test(w)));
  const out = numbers.map((w) => {
    if (!/^[1-9][0-9]*$/.test(w)) throw new Error(`denomination must be a whole number above 0: ${w}`);
    return Number(w);
  });
  if (!out.length) throw new Error("denominations must list at least one value");
  if (new Set(out).size !== out.length) throw new Error("denominations must not repeat");
  if (!out.includes(1)) throw new Error("denominations must include 1 so every amount can be made");
  return out.sort((a, b) => b - a);
}

const HEX6 = /^[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5);
}

// Text that can be read on a disc of this colour.
export const inkFor = (fill: string): string => (luminance(fill) > 0.55 ? "#1b1a17" : "#f6f1e4");

// Colours for each denomination: the casino colours where the denomination has one, a spare colour
// otherwise, and the caller's own on top. A fill given alone gets the paper edge and a readable ink.
export function parseChipColours(value: string | Record<number, string | Partial<ChipColour>>, denominations: number[]): Record<number, ChipColour> {
  const given: Record<number, Partial<ChipColour>> = {};
  if (typeof value === "string") {
    const words = value.trim().split(/\s+/).filter(Boolean);
    for (const [i, w] of words.entries()) {
      if (i === 0 && /^[A-Za-z]+$/.test(w)) continue; // the set's name
      const m = /^([1-9][0-9]*)-([0-9a-fA-F]{6})$/.exec(w);
      if (!m) throw new Error(`chip colour must be denomination-rrggbb: ${w}`);
      given[Number(m[1])] = { fill: "#" + m[2].toLowerCase() };
    }
  } else {
    for (const [d, c] of Object.entries(value)) {
      const part = typeof c === "string" ? { fill: c.startsWith("#") ? c : "#" + c } : c;
      for (const colour of [part.fill, part.edge, part.ink]) if (colour !== undefined && !/^#[0-9a-fA-F]{6}$/.test(colour)) throw new Error(`colour for ${d} must be #rrggbb`);
      given[Number(d)] = part;
    }
  }
  const out: Record<number, ChipColour> = {};
  let spare = 0;
  for (const d of [...denominations].sort((a, b) => b - a)) {
    const own = given[d];
    const base = CASINO[d] ?? (own?.fill ? undefined : { fill: SPARE[spare++ % SPARE.length], edge: "#f6f1e4", ink: "" });
    const fill = (own?.fill ?? base!.fill).toLowerCase();
    out[d] = {
      fill,
      edge: own?.edge ?? (own?.fill ? "#f6f1e4" : base!.edge),
      ink: own?.ink ?? (own?.fill || !base?.ink ? inkFor(fill) : base.ink),
    };
  }
  return out;
}

// Greedy breakdown, largest first; a stack holds at most `maxStack` chips, more becomes another stack.
export function breakdown(amount: number, denominations: number[] | string = DEFAULT_DENOMINATIONS, maxStack = MAX_STACK): Stack[] {
  const denoms = typeof denominations === "string" ? parseDenominations(denominations) : [...denominations].sort((a, b) => b - a);
  const out: Stack[] = [];
  let left = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  for (const d of denoms) {
    let n = Math.floor(left / d);
    left -= n * d;
    while (n > 0) {
      const c = Math.min(n, maxStack);
      out.push({ denom: d, count: c });
      n -= c;
    }
  }
  return out;
}

export const stackTotal = (stacks: Stack[]): number => stacks.reduce((sum, s) => sum + s.denom * s.count, 0);

// 5000 is 5k, 1500 would be 1.5k, small values are plain.
export function shortDenom(d: number): string {
  if (d < 1000) return String(d);
  const k = d / 1000;
  return `${Number.isInteger(k) ? k : Math.round(k * 10) / 10}k`;
}

export type PlacedChip = { stack: number; index: number; denom: number; x: number; y: number; label: boolean };
export type PileLayout = { width: number; height: number; lift: number; chips: PlacedChip[] };

// Where each chip of a pile sits, top left origin, for chips of diameter `size`: stacks side by side
// two units apart, each chip lifted a fifth of its size above the one below; only the top chip of a
// stack carries its value, and only when the chip is large enough to read.
export function pileLayout(stacks: Stack[], size = 14): PileLayout {
  const lift = Math.max(2, Math.round(size * 0.22));
  const maxCount = Math.max(1, ...stacks.map((s) => s.count));
  const height = size + (maxCount - 1) * lift;
  const chips: PlacedChip[] = [];
  stacks.forEach((s, i) => {
    for (let k = 0; k < s.count; k++) chips.push({ stack: i, index: k, denom: s.denom, x: i * (size + 2), y: height - size - k * lift, label: k === s.count - 1 && size >= 14 });
  });
  return { width: Math.max(size, stacks.length * (size + 2)), height, lift, chips };
}

export function normaliseSettings(input: Partial<ChipSettings> = {}): { denominations: number[]; colours: Record<number, ChipColour> } {
  const denominations = parseDenominations(input.denominations ?? DEFAULT_DENOMINATIONS);
  return { denominations, colours: parseChipColours(input.chipColours ?? DEFAULT_COLOURS, denominations) };
}

// ---- Movement -------------------------------------------------------------------------------

export type Flight = { key: string; from: Point; to: Point; amount: number; delayMs: number; durationMs: number; endMs: number; allIn: boolean };
export type FlightOptions = { startMs?: number; flyMs?: number; allInMs?: number };

const flight = (key: string, from: Point, to: Point, amount: number, startMs: number, durationMs: number, allIn = false): Flight =>
  ({ key, from, to, amount, delayMs: startMs, durationMs, endMs: startMs + durationMs, allIn });

// Each person's bet moves from in front of them to the pot at the same moment.
export function sweepToPot(bets: { id: string; amount: number; from: Point }[], pot: Point, o: FlightOptions = {}): Flight[] {
  const start = o.startMs ?? 0, ms = o.flyMs ?? FLY_MS;
  return bets.filter((b) => b.amount > 0).map((b) => flight(`pot:${b.id}`, b.from, pot, b.amount, start, ms));
}

// Winnings move from the pot to each winner's stack at the same moment.
export function awardPot(awards: { id: string; amount: number; to: Point }[], pot: Point, o: FlightOptions = {}): Flight[] {
  const start = o.startMs ?? 0, ms = o.flyMs ?? FLY_MS;
  return awards.filter((a) => a.amount > 0).map((a) => flight(`stack:${a.id}`, pot, a.to, a.amount, start, ms));
}

// What someone just put in: the rise from their previous bet to this one (all of it after a sweep),
// moving from their seat to where bets sit. An all in is slower and drawn larger.
export function betFlight(id: string, previous: number, bet: number, sweptSince: boolean, seat: Point, spot: Point, allIn = false, o: FlightOptions = {}): Flight | null {
  const before = sweptSince ? 0 : previous;
  if (!(bet > before)) return null;
  return flight(`bet:${id}`, seat, spot, bet - before, o.startMs ?? 0, allIn ? o.allInMs ?? ALL_IN_MS : o.flyMs ?? FLY_MS, allIn);
}

// The scale of the pulse of an all in as it flies: 1 at the ends, 1.5 half way.
export const allInScale = (progress: number): number => 1 + 0.5 * Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);

// Position of a flying pile at progress 0 to 1 (eased in and out).
export function flightAt(f: Pick<Flight, "from" | "to">, progress: number): Point {
  const p = Math.min(1, Math.max(0, progress));
  const e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
  return { x: f.from.x + (f.to.x - f.from.x) * e, y: f.from.y + (f.to.y - f.from.y) * e };
}

export const lastLanding = (flights: Flight[]): number => flights.reduce((m, f) => Math.max(m, f.endMs), 0);
