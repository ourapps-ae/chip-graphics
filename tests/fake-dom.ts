// A very small stand-in for the browser page: elements with classes, styles, data attributes and children.
export class FakeElement {
  tagName: string;
  children: (FakeElement | string)[] = [];
  className = "";
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  parent: FakeElement | null = null;
  constructor(tagName: string) { this.tagName = tagName; }
  append(...nodes: (FakeElement | string)[]) { for (const n of nodes) { if (typeof n !== "string") n.parent = this; this.children.push(n); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  get text(): string { return this.children.map((c) => (typeof c === "string" ? c : c.text)).join(""); }
  find(predicate: (e: FakeElement) => boolean): FakeElement[] {
    const out: FakeElement[] = [];
    for (const c of this.children) if (typeof c !== "string") { if (predicate(c)) out.push(c); out.push(...c.find(predicate)); }
    return out;
  }
  byClass(name: string): FakeElement[] { return this.find((e) => e.className.split(/\s+/).includes(name)); }
}
export function installFakeDocument() {
  (globalThis as any).document = { createElement: (tag: string) => new FakeElement(tag) };
}
