// The package's example images: chip piles drawn by pileEl, placed along a sweep by flightAt, rendered by
// classes/render_images.py in headless Chrome.
import { flightAt, sweepToPot } from "../implementation/web/chip-model.ts";
import { pileEl } from "../implementation/web/chips.ts";

type Scene = { name: string; caption: string; width: number; height: number; look?: string; render: (root: HTMLElement) => void | Promise<void> };

function piles(amounts: number[], size: number, settings = {}) {
  return (root: HTMLElement) => {
    Object.assign(root.style, { display: "flex", gap: "48px", alignItems: "flex-end", justifyContent: "center", padding: "60px 24px", flexWrap: "wrap", alignContent: "center" });
    for (const amount of amounts) root.append(pileEl(amount, { size, settings }));
  };
}

export const scenes: Scene[] = [
  { name: "piles-night", caption: "Piles for 25, 380, 2,450, 12,800 and 47,615 chips in casino denominations, night look", width: 960, height: 420, look: "night", render: piles([25, 380, 2450, 12800, 47615], 34) },
  { name: "piles-lounge", caption: "The same piles in the lounge look", width: 960, height: 420, look: "lounge", render: piles([25, 380, 2450, 12800, 47615], 34) },
  {
    name: "token-set", caption: "A token set of 100, 20, 5 and 1 with a blue 100, as a non-casino game would set it", width: 960, height: 420, look: "night",
    render: piles([7, 64, 233, 1180], 34, { denominations: "tokens 100 20 5 1", chipColours: "tokens 100-2f6fb0" }),
  },
  {
    name: "sweep-to-pot", caption: "Four bets half way into the pot, at the positions the flight model gives", width: 960, height: 540, look: "night",
    render: (root) => {
      const pot = { x: 0.5, y: 0.5 };
      const stakes = [{ id: "a", amount: 400, from: { x: 0.12, y: 0.18 } }, { id: "b", amount: 1200, from: { x: 0.88, y: 0.18 } },
        { id: "c", amount: 400, from: { x: 0.12, y: 0.82 } }, { id: "d", amount: 2500, from: { x: 0.88, y: 0.82 } }];
      const place = (node: HTMLElement, p: { x: number; y: number }) => Object.assign(node.style, { position: "absolute", left: `${p.x * 960}px`, top: `${p.y * 540}px`, transform: "translate(-50%, -50%)" });
      const total = pileEl(3100, { size: 26 });
      place(total, pot);
      root.append(total);
      for (const flight of sweepToPot(stakes, pot)) {
        for (const [progress, opacity] of [[0, "0.35"], [0.55, "1"]] as const) {
          const pile = pileEl(flight.amount, { size: 22, label: progress > 0 });
          place(pile, flightAt(flight, progress));
          pile.style.opacity = opacity;
          root.append(pile);
        }
      }
    },
  },
];
