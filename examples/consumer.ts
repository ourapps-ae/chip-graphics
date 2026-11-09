// A consumer that needs no game: a pile for an amount with a unit-based denomination set, then it sweeps to a pot.
import { sweepToPot } from "../implementation/web/chip-model.ts";
import { launchFlights, pileEl } from "../implementation/web/chips.ts";

const SETTINGS = { denominations: "tokens 100 20 5 1", chipColours: "tokens 100-2f6fb0" };

export function stakePile(amount: number): HTMLElement {
  return pileEl(amount, { settings: SETTINGS, size: 16 });
}

export function sweepStakes(container: HTMLElement, stakes: { id: string; amount: number; x: number; y: number }[], onLand: () => void) {
  const flights = sweepToPot(stakes.map((s) => ({ id: s.id, amount: s.amount, from: { x: s.x, y: s.y } })), { x: 0.5, y: 0.5 }, { flyMs: 30 });
  return launchFlights(container, flights, { project: (p) => ({ x: p.x * 400, y: p.y * 300 }), pile: { settings: SETTINGS }, onLand, steps: 3 });
}
