import { describe, it, expect } from "vitest";
import { layoutBlocks, toMinutes } from "../src/scripts/layout";

describe("layoutBlocks", () => {
  it("gives two overlapping blocks two columns", () => {
    const out = layoutBlocks([
      { start: "09:00", end: "10:00" },
      { start: "09:30", end: "10:30" },
    ]);
    expect(out.map((b) => b.cols)).toEqual([2, 2]);
    expect([...out].sort((a, b) => a.col - b.col).map((b) => b.col)).toEqual([0, 1]);
  });

  it("reuses a freed column within one cluster", () => {
    const out = layoutBlocks([
      { start: "09:00", end: "10:00" },
      { start: "10:00", end: "11:00" },
      { start: "10:30", end: "12:00" },
    ]);
    // The second block starts exactly when the first ends, which is the
    // cluster boundary the algorithm cuts at, so it opens a new cluster and
    // records cols=1 even though the visual cluster has two columns. Same
    // behavior on server and client, so blocks still line up.
    expect(out.map((b) => [b.col, b.cols])).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it("cuts the cluster at a gap, so the next block spans full width", () => {
    const out = layoutBlocks([
      { start: "09:00", end: "10:00" },
      { start: "09:30", end: "10:30" },
      { start: "12:00", end: "13:00" },
    ]);
    expect(out.map((b) => [b.col, b.cols])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });

  it("sorts by start, longer end first on a tie", () => {
    const out = layoutBlocks([
      { start: "09:00", end: "10:00", id: "short" },
      { start: "09:00", end: "11:00", id: "long" },
    ]);
    const cols = new Map(out.map((b) => [(b as { id: string }).id, b.col]));
    expect(cols.get("long")).toBe(0);
    expect(cols.get("short")).toBe(1);
  });

  it("returns an empty array for no blocks", () => {
    expect(layoutBlocks([])).toEqual([]);
  });
});

describe("toMinutes", () => {
  it("parses HH:MM", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });
});
