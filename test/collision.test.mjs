import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlock } from "../src/engine/blocks.js";
import { Runtime } from "../src/engine/runtime.js";
import { CollisionSwap, overlaps } from "../src/engine/collision.js";

function setup() {
  let time = 0;
  const swaps = [];
  const plugin = new CollisionSwap({ onSwap: (e) => swaps.push(e) });
  const rt = new Runtime({ now: () => time, schedule: () => 1, cancel: () => {}, plugins: [plugin] });
  rt.advance = (ms = 1000 / 30) => {
    time += ms;
    rt.tick();
  };
  return { rt, swaps, plugin };
}

const loop = (times, ...blocks) => {
  const r = createBlock("repeat", { times: String(times) });
  r.children = blocks;
  return r;
};
const sprite = (id, x, blocks, extra = {}) => ({ id, x, y: 0, direction: 90, width: 100, height: 100, stacks: [{ id: "s" + id, x: 0, y: 0, blocks }], ...extra });
const shape = (blocks) => blocks.map((b) => (b.children ? { [b.type]: shape(b.children) } : `${b.type}:${Object.values(b.params).join("/")}`));
const runningShape = (rt, id) => shape(rt.programs.get(id).stacks[0].blocks);

test("overlaps uses centred bounding boxes", () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(overlaps(a, { x: 99, y: 0, width: 100, height: 100 }), true);
  assert.equal(overlaps(a, { x: 100, y: 0, width: 100, height: 100 }), false);
  assert.equal(overlaps(a, { x: 101, y: 0, width: 100, height: 100 }, 2), true);
});

test("collision swaps the current programs once and the sprites move apart", () => {
  const { rt, swaps } = setup();
  rt.start([sprite("cat", -120, [loop(20, createBlock("move", { steps: "10" }))]), sprite("horse", 120, [loop(20, createBlock("move", { steps: "-10" }))])]);
  let ticks = 0;
  while (!swaps.length && ticks++ < 20) rt.advance();
  assert.equal(swaps.length, 1);
  assert.deepEqual(swaps[0].assignments, { cat: "horse", horse: "cat" });
  assert.deepEqual(runningShape(rt, "cat"), [{ repeat: ["move:-10"] }]);
  assert.deepEqual(runningShape(rt, "horse"), [{ repeat: ["move:10"] }]);
  const catX = rt.sprites.get("cat").x;
  const horseX = rt.sprites.get("horse").x;
  for (let i = 0; i < 5; i++) rt.advance();
  assert.ok(rt.sprites.get("cat").x < catX, "cat moves back left");
  assert.ok(rt.sprites.get("horse").x > horseX, "horse moves back right");
  assert.equal(swaps.length, 1, "continuous contact does not re-trigger");
  assert.equal(rt.sprites.get("cat").direction, 90, "direction preserved");
});

test("swap exchanges complete programs including nested repeat, turn, goto, say and think", () => {
  const { rt } = setup();
  const catProgram = [createBlock("say", { text: "hi", secs: "5" }), loop(2, createBlock("turn", { degrees: "30" }), loop(3, createBlock("think", { text: "t", secs: "1" })))];
  const horseProgram = [createBlock("goto", { x: "-50", y: "0" }), loop(4, createBlock("move", { steps: "7" }))];
  rt.start([sprite("cat", 0, catProgram), sprite("horse", 300, horseProgram)]);
  const catBefore = runningShape(rt, "cat");
  const horseBefore = runningShape(rt, "horse");
  rt.advance(); // horse jumps to x=-50 -> overlaps cat -> swap
  assert.deepEqual(runningShape(rt, "cat"), horseBefore);
  assert.deepEqual(runningShape(rt, "horse"), catBefore);
  // received programs restart from the top: horse now shows cat's say bubble (bubble cleared then re-said next tick)
  rt.advance();
  assert.deepEqual(rt.sprites.get("horse").bubble, { kind: "say", text: "hi" });
  // no shared block objects between sprites
  const idsCat = JSON.stringify(rt.programs.get("cat").stacks).match(/"id":"[^"]+"/g);
  const idsHorse = JSON.stringify(rt.programs.get("horse").stacks).match(/"id":"[^"]+"/g);
  assert.equal(idsCat.filter((id) => idsHorse.includes(id)).length, 0);
});

test("a later collision swaps the current assignments again (not the originals)", () => {
  const { rt, swaps, plugin } = setup();
  rt.start([sprite("cat", -120, [loop(20, createBlock("move", { steps: "10" }))]), sprite("horse", 120, [loop(20, createBlock("move", { steps: "-10" }))])]);
  while (!swaps.length) rt.advance();
  // force separation, then contact again
  rt.sprites.get("cat").x = -300;
  rt.advance();
  rt.sprites.get("cat").x = rt.sprites.get("horse").x - 50;
  rt.advance();
  assert.equal(swaps.length, 2);
  assert.equal(plugin.swaps, 2);
  assert.deepEqual(swaps[1].assignments, { cat: "cat", horse: "horse" });
});

test("pairs overlapping at Play do not swap until they separate; a sprite swaps once per tick", () => {
  const { rt, swaps } = setup();
  const idle = [loop(30, createBlock("turn", { degrees: "1" }))];
  rt.start([sprite("a", 0, idle), sprite("b", 50, idle), sprite("c", 300, [createBlock("goto", { x: "20", y: "0" })])]);
  rt.advance(); // c jumps onto a and b in the same tick
  assert.equal(swaps.length, 1, "only one swap involving the same sprite per tick");
});

test("Stop and Reset clear collision state; authored programs are untouched", () => {
  const { rt, swaps, plugin } = setup();
  const catBlocks = [loop(20, createBlock("move", { steps: "10" }))];
  const sprites = [sprite("cat", -120, catBlocks), sprite("horse", 120, [loop(20, createBlock("move", { steps: "-10" }))])];
  rt.start(sprites);
  while (!swaps.length) rt.advance();
  rt.stop();
  assert.equal(plugin.active.size, 0);
  assert.equal(rt.threads.length, 0);
  assert.equal(catBlocks[0].children[0].params.steps, "10");
  // replay from the start positions: swaps again
  rt.start(sprites);
  assert.deepEqual(rt.assignments(), { cat: "cat", horse: "horse" });
  while (swaps.length < 2) rt.advance();
  assert.equal(plugin.swaps, 1, "swap counter restarts per run");
});
