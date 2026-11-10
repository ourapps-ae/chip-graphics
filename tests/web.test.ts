import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { FakeElement, installFakeDocument } from "./fake-dom.ts";
import {
  ALL_IN_MS, FLY_MS, MAX_STACK, allInScale, awardPot, betFlight, breakdown, flightAt, inkFor, lastLanding, normaliseSettings,
  parseChipColours, parseDenominations, pileLayout, shortDenom, stackTotal, sweepToPot,
} from "../implementation/web/chip-model.ts";
import { launchFlights, pileEl } from "../implementation/web/chips.ts";
import { build as buildFixtures, buildKotlin } from "./make-fixtures.ts";
import { stakePile, sweepStakes } from "../examples/consumer.ts";

installFakeDocument();
const el = (x: unknown) => x as unknown as FakeElement;
const CASINO = [5000, 1000, 500, 100, 25, 5, 1];

test("an amount breaks into the largest chips first, and the stacks add back to the amount", () => {
  assert.deepEqual(breakdown(0), []);
  assert.deepEqual(breakdown(1337), [{ denom: 1000, count: 1 }, { denom: 100, count: 3 }, { denom: 25, count: 1 }, { denom: 5, count: 2 }, { denom: 1, count: 2 }]);
  for (const amount of [1, 4, 24, 26, 99, 100, 101, 499, 500, 4999, 5000, 5001, 12345, 99999]) assert.equal(stackTotal(breakdown(amount)), amount, `${amount}`);
  assert.deepEqual(breakdown(-5), []);
  assert.deepEqual(breakdown(7.9), [{ denom: 5, count: 1 }, { denom: 1, count: 2 }], "fractions are dropped");
  assert.deepEqual(breakdown(NaN), []);
});

test("a stack holds twelve chips and more becomes another stack", () => {
  assert.equal(MAX_STACK, 12);
  assert.deepEqual(breakdown(13), [{ denom: 5, count: 2 }, { denom: 1, count: 3 }]);
  assert.deepEqual(breakdown(13, [1]), [{ denom: 1, count: 12 }, { denom: 1, count: 1 }]);
  assert.deepEqual(breakdown(30, [1], 10), [{ denom: 1, count: 10 }, { denom: 1, count: 10 }, { denom: 1, count: 10 }]);
  assert.deepEqual(breakdown(5000 * 25), [{ denom: 5000, count: 12 }, { denom: 5000, count: 12 }, { denom: 5000, count: 1 }]);
});

test("another denomination set gives another breakdown", () => {
  const tokens = parseDenominations("tokens 100 20 5 1");
  assert.deepEqual(tokens, [100, 20, 5, 1]);
  assert.deepEqual(breakdown(247, tokens), [{ denom: 100, count: 2 }, { denom: 20, count: 2 }, { denom: 5, count: 1 }, { denom: 1, count: 2 }]);
  assert.deepEqual(breakdown(247, "tokens 100 20 5 1"), breakdown(247, tokens));
  assert.equal(stackTotal(breakdown(1234, [1000, 1])), 1234);
});

test("denomination settings: names, order, and what is refused", () => {
  assert.deepEqual(parseDenominations("casino 5000 1000 500 100 25 5 1"), CASINO);
  assert.deepEqual(parseDenominations("1 5 25"), [25, 5, 1], "no name is allowed");
  assert.deepEqual(parseDenominations("a, 1, 10"), [10, 1], "commas work in code");
  assert.deepEqual(parseDenominations([1, 10, 100]), [100, 10, 1]);
  assert.throws(() => parseDenominations("casino 5 25"), /include 1/);
  assert.throws(() => parseDenominations("casino 1 1 5"), /repeat/);
  assert.throws(() => parseDenominations("casino 1 0"), /whole number/);
  assert.throws(() => parseDenominations("casino 1 2.5"), /whole number/);
  assert.throws(() => parseDenominations("casino"), /at least one/);
  assert.throws(() => parseDenominations(""), /at least one/);
  assert.throws(() => breakdown(10, "x 5 25"), /include 1/);
});

test("colours: the casino set, spare colours, overrides, readable ink", () => {
  const casino = parseChipColours("casino", CASINO);
  assert.deepEqual(casino[1000], { fill: "#e07b2a", edge: "#f6f1e4", ink: "#2b1a08" });
  assert.deepEqual(casino[5000], { fill: "#f1e6c8", edge: "#b08a3c", ink: "#4a3a14" });
  assert.equal(Object.keys(casino).length, 7);
  const custom = parseChipColours("mine 25-112233 7-ffffff", [100, 25, 7, 1]);
  assert.equal(custom[25].fill, "#112233");
  assert.equal(custom[25].ink, "#f6f1e4", "light ink on a dark disc");
  assert.equal(custom[7].ink, "#1b1a17", "dark ink on a light disc");
  assert.equal(custom[100].fill, "#1b1a17", "other denominations keep the casino colour");
  const spare = parseChipColours("casino", [50, 10, 1]);
  assert.ok(spare[50].fill !== spare[10].fill && spare[50].ink !== "" && spare[10].ink !== "", "denominations without a casino colour get their own");
  assert.equal(parseChipColours({ 25: "00ff00", 1: { fill: "#010101", ink: "#ffffff" } }, [25, 1])[1].ink, "#ffffff");
  assert.throws(() => parseChipColours("mine 25-zz", [25, 1]), /denomination-rrggbb/);
  assert.throws(() => parseChipColours({ 1: "#12" }, [1]), /#rrggbb/);
  assert.equal(inkFor("#ffffff"), "#1b1a17");
  assert.equal(inkFor("#000000"), "#f6f1e4");
});

test("settings default to the casino chips", () => {
  const s = normaliseSettings();
  assert.deepEqual(s.denominations, CASINO);
  assert.deepEqual(Object.keys(s.colours).map(Number).sort((a, b) => b - a), CASINO);
  assert.deepEqual(normaliseSettings({ denominations: "units 10 1", chipColours: "units 10-ff8800" }).colours[10].fill, "#ff8800");
});

test("pile layout: stacks side by side, chips lifted, one label per stack when big enough", () => {
  const layout = pileLayout(breakdown(1337), 14);
  assert.equal(layout.lift, 3);
  assert.equal(layout.height, 14 + 2 * 3, "tallest stack is three chips");
  assert.equal(layout.width, 5 * 16);
  assert.equal(layout.chips.length, 1 + 3 + 1 + 2 + 2);
  const first = layout.chips[0];
  assert.deepEqual([first.stack, first.index, first.x, first.y, first.label], [0, 0, 0, 6, true]);
  const hundreds = layout.chips.filter((c) => c.denom === 100);
  assert.deepEqual(hundreds.map((c) => c.y), [6, 3, 0], "each chip sits higher than the one under it");
  assert.deepEqual(hundreds.map((c) => c.label), [false, false, true]);
  assert.ok(pileLayout(breakdown(1337), 12).chips.every((c) => !c.label), "small chips carry no value");
  assert.deepEqual(pileLayout([], 12), { width: 12, height: 12, lift: 3, chips: [] });
  assert.equal(pileLayout(breakdown(1), 40).lift, 9);
  assert.equal(pileLayout(breakdown(1), 4).lift, 2, "a lift is at least 2");
});

test("short value text", () => {
  assert.deepEqual([1, 25, 500, 999, 1000, 1500, 5000, 12000].map(shortDenom), ["1", "25", "500", "999", "1k", "1.5k", "5k", "12k"]);
});

test("a pile on the page: one disc per chip, their colours, the amount underneath", () => {
  const box = el(pileEl(1337, { size: 14 }));
  assert.equal(box.dataset.total, "1337");
  const chips = box.byClass("chip");
  assert.equal(chips.length, 9);
  assert.equal(chips[0].style.background, "#e07b2a");
  assert.equal(chips[0].text, "1k");
  assert.equal(chips[0].style.width, "14px");
  assert.equal(chips[0].style.fontSize, "6px");
  assert.equal(box.byClass("amount")[0].text, "1,337");
  assert.equal(el(pileEl(1337, { label: false })).byClass("amount").length, 0);
  assert.equal(el(pileEl(5, { format: (n) => `$${n}` })).byClass("amount")[0].text, "$5");
  assert.equal(el(pileEl(0)).byClass("chip").length, 0);
  const tokens = el(stakePile(247));
  assert.equal(tokens.byClass("chip").length, 7);
  assert.equal(tokens.byClass("chip")[0].style.background, "#2f6fb0");
  assert.throws(() => pileEl(5, { settings: { denominations: "x 5" } }), /include 1/);
});

test("bets sweep to the pot together, winnings come back, and an all in is slower", () => {
  const pot = { x: 0.5, y: 0.63 };
  const sweep = sweepToPot([{ id: "a", amount: 50, from: { x: 0.2, y: 0.4 } }, { id: "b", amount: 0, from: { x: 0.8, y: 0.4 } }, { id: "c", amount: 25, from: { x: 0.5, y: 0.7 } }], pot, { startMs: 100 });
  assert.deepEqual(sweep.map((f) => [f.key, f.amount, f.delayMs, f.durationMs, f.endMs]), [["pot:a", 50, 100, FLY_MS, 100 + FLY_MS], ["pot:c", 25, 100, FLY_MS, 100 + FLY_MS]]);
  assert.deepEqual(sweep[0].to, pot);
  const award = awardPot([{ id: "a", amount: 75, to: { x: 0.2, y: 0.4 } }, { id: "z", amount: 0, to: pot }], pot);
  assert.deepEqual(award.map((f) => [f.key, f.amount]), [["stack:a", 75]]);
  assert.deepEqual(award[0].from, pot);
  assert.equal(betFlight("a", 10, 30, false, pot, pot)?.amount, 20, "the rise only");
  assert.equal(betFlight("a", 10, 30, true, pot, pot)?.amount, 30, "all of it after a sweep");
  assert.equal(betFlight("a", 30, 30, false, pot, pot), null);
  assert.equal(betFlight("a", 30, 10, false, pot, pot), null);
  const allIn = betFlight("a", 0, 900, false, pot, pot, true)!;
  assert.deepEqual([allIn.allIn, allIn.durationMs], [true, ALL_IN_MS]);
  assert.equal(betFlight("a", 0, 900, false, pot, pot, false, { flyMs: 10 })?.durationMs, 10);
  assert.equal(lastLanding([...sweep, ...award]), 100 + FLY_MS);
  assert.equal(lastLanding([]), 0);
});

test("flights ease from start to end, and an all in pulses", () => {
  const f = { from: { x: 0, y: 0 }, to: { x: 10, y: 20 } };
  assert.deepEqual(flightAt(f, 0), { x: 0, y: 0 });
  assert.deepEqual(flightAt(f, 1), { x: 10, y: 20 });
  assert.deepEqual(flightAt(f, 0.5), { x: 5, y: 10 });
  assert.ok(flightAt(f, 0.25).x < 2.5, "slow to start");
  assert.deepEqual(flightAt(f, 2), flightAt(f, 1));
  assert.deepEqual(flightAt(f, -1), flightAt(f, 0));
  assert.equal(allInScale(0), 1);
  assert.equal(allInScale(0.5), 1.5);
  assert.ok(Math.abs(allInScale(1) - 1) < 1e-12);
});

test("launched flights appear after their delay, travel, land and are removed", async () => {
  const container = new FakeElement("div");
  const landed: string[] = [];
  const flights = sweepToPot([{ id: "a", amount: 30, from: { x: 0, y: 0 } }, { id: "b", amount: 5, from: { x: 1, y: 1 } }], { x: 0.5, y: 0.5 }, { flyMs: 40, startMs: 20 });
  flights.push({ ...flights[0], key: "late", delayMs: 200, endMs: 240 });
  const cancel = launchFlights(el(container) as unknown as HTMLElement, flights, { project: (p) => ({ x: p.x * 100, y: p.y * 100 }), steps: 4, onLand: (f) => landed.push(f.key) });
  const nodes = container.byClass("flight");
  assert.equal(nodes.length, 3);
  assert.equal(nodes[0].style.visibility, "hidden");
  assert.equal(nodes[0].style.left, "0px");
  assert.equal(nodes[1].style.left, "100px");
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(nodes[0].style.visibility, "visible");
  await new Promise((r) => setTimeout(r, 90));
  assert.deepEqual(landed.sort(), ["pot:a", "pot:b"]);
  assert.equal(container.byClass("flight").length, 1, "landed piles are removed");
  cancel();
  assert.equal(container.byClass("flight").length, 0, "cancel removes what is left");
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(landed.sort(), ["pot:a", "pot:b"], "a cancelled flight never lands");
});

test("an all in grows as it flies", async () => {
  const container = new FakeElement("div");
  const f = betFlight("a", 0, 500, false, { x: 0, y: 0 }, { x: 1, y: 0 }, true, { allInMs: 40 })!;
  launchFlights(container as unknown as HTMLElement, [f], { project: (p) => ({ x: p.x * 10, y: 0 }), steps: 2 });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(container.byClass("flight")[0].style.transform, "translate(-50%, -50%) scale(1.5)");
  await new Promise((r) => setTimeout(r, 40));
});

test("the stylesheet reads only theme variables", () => {
  const css = readFileSync(new URL("../implementation/web/chips.css", import.meta.url), "utf8");
  assert.deepEqual([...new Set([...css.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))], ["--primary"]);
});

test("the native fixtures are the TypeScript model", () => {
  assert.equal(readFileSync(new URL("fixtures/chips.json", import.meta.url), "utf8"), buildFixtures());
  assert.equal(readFileSync(new URL("android/Expected.kt", import.meta.url), "utf8"), buildKotlin());
});

test("a consumer sweeps stakes to the pot with another chip set", async () => {
  const container = new FakeElement("div");
  let landed = 0;
  sweepStakes(container as unknown as HTMLElement, [{ id: "a", amount: 40, x: 10, y: 10 }, { id: "b", amount: 0, x: 20, y: 20 }], () => landed++);
  assert.equal(container.byClass("flight").length, 1);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(landed, 1);
});

test("the OpenRPC interface describes the settings grammar, limits and the exported functions", async () => {
  const doc = JSON.parse(readFileSync(new URL("../interfaces/chip-graphics.json", import.meta.url), "utf8"));
  assert.equal(doc.openrpc, "1.3.2");
  assert.deepEqual([doc.info.title, doc.info.version], ["ae/chip-graphics", "1.0.0"]);
  const { DenominationsSetting, ChipColoursSetting, Limits, Flight } = doc.components.schemas;
  const denominations = new RegExp(DenominationsSetting.pattern);
  for (const good of ["casino 5000 1000 500 100 25 5 1", "tokens 100 20 5 1", "10 1"]) {
    assert.match(good, denominations);
    assert.ok(parseDenominations(good).length > 0);
  }
  for (const bad of ["casino", "casino 0 1", "casino 2.5 1"]) {
    assert.doesNotMatch(bad, denominations);
    assert.throws(() => parseDenominations(bad), bad);
  }
  const colours = new RegExp(ChipColoursSetting.pattern);
  for (const good of ["casino", "mine 1000-e07b2a 25-2e8b57", ""]) assert.match(good, colours);
  for (const bad of ["mine 1000-e07b2", "mine red"]) {
    assert.doesNotMatch(bad, colours);
    assert.throws(() => parseChipColours(bad, CASINO), bad);
  }
  assert.deepEqual(Limits.const, { maxStack: MAX_STACK, flyMs: FLY_MS, allInMs: ALL_IN_MS });
  const flight = betFlight("a", 0, 10, false, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.deepEqual(Object.keys(flight!).sort(), [...Flight.required].sort());
  const web: Record<string, unknown> = { ...(await import("../implementation/web/chip-model.ts")), ...(await import("../implementation/web/chips.ts")) };
  for (const method of doc.methods) assert.equal(typeof web[method.name], "function", method.name);
});
