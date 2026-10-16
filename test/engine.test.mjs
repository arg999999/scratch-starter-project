import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlock, insert, moveBlocks, deleteBlocks, updateParam, cloneStacks, blocksFrom, applyDrop } from "../src/engine/blocks.js";
import { makeSprite, makeCollisionDemo, toRuntimeSprite } from "../src/engine/scene.js";
import { Runtime } from "../src/engine/runtime.js";

const shape = (blocks) => blocks.map((b) => (b.children ? { [b.type]: shape(b.children) } : b.type));

function sampleStacks() {
  const rep = createBlock("repeat", { times: "3" });
  const move = createBlock("move");
  const say = createBlock("say");
  let stacks = insert([], { kind: "newStack", x: 10, y: 10 }, [rep]);
  stacks = insert(stacks, { kind: "inside", blockId: rep.id }, [move]);
  stacks = insert(stacks, { kind: "after", blockId: rep.id }, [say]);
  return { stacks, rep, move, say };
}

test("insert builds nested repeat structure", () => {
  const { stacks } = sampleStacks();
  assert.deepEqual(shape(stacks[0].blocks), [{ repeat: ["move"] }, "say"]);
});

test("moving a block carries the blocks below it", () => {
  const { stacks, rep } = sampleStacks();
  const next = moveBlocks(stacks, rep.id, { kind: "newStack", x: 200, y: 50 });
  assert.equal(next.length, 1);
  assert.deepEqual(shape(next[0].blocks), [{ repeat: ["move"] }, "say"]);
  assert.equal(next[0].x, 200);
});

test("reorder and drop into own descendant is a no-op", () => {
  const { stacks, rep, move, say } = sampleStacks();
  const reordered = moveBlocks(stacks, say.id, { kind: "before", blockId: rep.id });
  assert.deepEqual(shape(reordered[0].blocks), ["say", { repeat: ["move"] }]);
  assert.equal(moveBlocks(stacks, rep.id, { kind: "after", blockId: move.id }), stacks);
});

test("delete removes block and followers; empty stacks disappear", () => {
  const { stacks, rep, move } = sampleStacks();
  assert.deepEqual(shape(deleteBlocks(stacks, move.id)[0].blocks), [{ repeat: [] }, "say"]);
  assert.deepEqual(deleteBlocks(stacks, rep.id), []);
});

test("updateParam and cloneStacks produce independent copies with fresh ids", () => {
  const { stacks, move } = sampleStacks();
  const edited = updateParam(stacks, move.id, "steps", "-10");
  assert.equal(blocksFrom(edited, move.id)[0].params.steps, "-10");
  assert.equal(blocksFrom(stacks, move.id)[0].params.steps, "10");
  const copy = cloneStacks(edited);
  assert.equal(blocksFrom(copy, move.id), null);
  assert.deepEqual(shape(copy[0].blocks), shape(edited[0].blocks));
});

function manualRuntime() {
  let time = 0;
  const rt = new Runtime({ now: () => time, schedule: () => 1, cancel: () => {} });
  rt.advance = (ms = 1000 / 30) => {
    time += ms;
    rt.tick();
  };
  return rt;
}

const sprite = (id, stacks, x = 0) => ({ id, x, y: 0, direction: 90, stacks });

test("repeat yields one frame per iteration and runs sprites concurrently", () => {
  const rt = manualRuntime();
  const a = createBlock("repeat", { times: "3" });
  a.children = [createBlock("move", { steps: "10" })];
  const b = createBlock("repeat", { times: "3" });
  b.children = [createBlock("move", { steps: "-10" })];
  assert.equal(rt.start([sprite("cat", [{ id: "s1", x: 0, y: 0, blocks: [a] }]), sprite("horse", [{ id: "s2", x: 0, y: 0, blocks: [b] }], 100)]), true);
  rt.advance();
  assert.equal(rt.sprites.get("cat").x, 10);
  assert.equal(rt.sprites.get("horse").x, 90);
  rt.advance();
  rt.advance();
  rt.advance();
  assert.equal(rt.sprites.get("cat").x, 30);
  assert.equal(rt.sprites.get("horse").x, 70);
  assert.equal(rt.running, false);
});

test("start while running is ignored (no duplicate threads)", () => {
  const rt = manualRuntime();
  const rep = createBlock("repeat", { times: "5" });
  rep.children = [createBlock("move", { steps: "10" })];
  const sprites = [sprite("cat", [{ id: "s", x: 0, y: 0, blocks: [rep] }])];
  rt.start(sprites);
  assert.equal(rt.start(sprites), false);
  assert.equal(rt.threads.length, 1);
  rt.advance();
  assert.equal(rt.sprites.get("cat").x, 10);
});

test("turn, goto and timed say/think bubbles", () => {
  const rt = manualRuntime();
  const blocks = [createBlock("turn", { degrees: "90" }), createBlock("move", { steps: "10" }), createBlock("goto", { x: "5", y: "7" }), createBlock("think", { text: "Hmm", secs: "0.1" })];
  rt.start([sprite("cat", [{ id: "s", x: 0, y: 0, blocks }])]);
  rt.advance(1);
  const s = rt.sprites.get("cat");
  assert.equal(s.direction, 180);
  assert.deepEqual([s.x, s.y], [5, 7]);
  assert.deepEqual(s.bubble, { kind: "think", text: "Hmm" });
  rt.advance(50);
  assert.ok(s.bubble);
  rt.advance(60);
  assert.equal(s.bubble, null);
  assert.equal(rt.running, false);
});

test("stop halts threads and clears pending bubbles", () => {
  const rt = manualRuntime();
  rt.start([sprite("cat", [{ id: "s", x: 0, y: 0, blocks: [createBlock("say", { secs: "10" })] }])]);
  rt.advance();
  assert.ok(rt.sprites.get("cat").bubble);
  rt.stop();
  assert.equal(rt.running, false);
  assert.equal(rt.sprites.get("cat").bubble, null);
});

test("runProgram replaces only that sprite's running program (Phase 2 hook)", () => {
  const rt = manualRuntime();
  const loop = (steps) => {
    const r = createBlock("repeat", { times: "10" });
    r.children = [createBlock("move", { steps })];
    return [{ id: "s" + steps, x: 0, y: 0, blocks: [r] }];
  };
  rt.start([sprite("cat", loop("10")), sprite("horse", loop("-10"), 100)]);
  rt.advance();
  rt.runProgram("cat", cloneStacks(loop("-10")));
  rt.advance();
  assert.equal(rt.sprites.get("cat").x, 0);
  assert.equal(rt.sprites.get("horse").x, 80);
});

test("runBlocksOnce runs a clicked block on one sprite only", () => {
  const rt = manualRuntime();
  rt.runBlocksOnce({ id: "cat", x: 0, y: 0, direction: 90 }, [createBlock("move", { steps: "10" })]);
  assert.equal(rt.sprites.get("cat").x, 10); // executed immediately
  assert.equal(rt.sprites.has("horse"), false);
  assert.equal(rt.running, false); // not a Play session
  assert.equal(rt.threads.length, 0);
});

test("clicked say clears after its duration; Play and Stop replace clicked threads", () => {
  const rt = manualRuntime();
  rt.runBlocksOnce({ id: "cat", x: 0, y: 0, direction: 90 }, [createBlock("say", { text: "Hi", secs: "0.1" })]);
  const cat = rt.sprites.get("cat");
  assert.deepEqual(cat.bubble, { kind: "say", text: "Hi" });
  rt.advance(120);
  assert.equal(cat.bubble, null);

  rt.runBlocksOnce({ id: "cat", x: 0, y: 0, direction: 90 }, [createBlock("think", { secs: "5" })]);
  rt.stop();
  assert.equal(rt.threads.length, 0);
  assert.equal(rt.sprites.get("cat").bubble, null);

  rt.runBlocksOnce({ id: "cat", x: 0, y: 0, direction: 90 }, [createBlock("say", { secs: "5" })]);
  rt.start([sprite("cat", [{ id: "s", x: 0, y: 0, blocks: [createBlock("turn")] }])]);
  assert.equal(rt.threads.length, 1); // only the Play thread
  assert.equal(rt.runBlocksOnce({ id: "cat", x: 0, y: 0, direction: 90 }, [createBlock("move")]), false); // ignored during Play
});

test("sprites with a known size stay fully on stage", () => {
  const rt = manualRuntime();
  const r = createBlock("repeat", { times: "40" });
  r.children = [createBlock("move", { steps: "10" })];
  rt.start([{ id: "cat", x: 0, y: 0, direction: 90, width: 100, height: 100, stacks: [{ id: "s", x: 0, y: 0, blocks: [r] }] }]);
  for (let i = 0; i < 45; i++) rt.advance();
  assert.equal(rt.sprites.get("cat").x, 190); // 240 - 100 / 2
});

test("applyDrop handles palette inserts, moves and deletes", () => {
  const { stacks, rep, say } = sampleStacks();
  const turn = createBlock("turn");
  const added = applyDrop(stacks, { source: "palette", blocks: [turn] }, { kind: "inside", blockId: rep.id });
  assert.deepEqual(shape(added[0].blocks), [{ repeat: ["turn", "move"] }, "say"]);
  assert.equal(applyDrop(stacks, { source: "palette", blocks: [turn] }, { kind: "delete" }), stacks);
  const moved = applyDrop(stacks, { source: "workspace", blockId: say.id }, { kind: "before", blockId: rep.id });
  assert.deepEqual(shape(moved[0].blocks), ["say", { repeat: ["move"] }]);
  assert.deepEqual(shape(applyDrop(stacks, { source: "workspace", blockId: say.id }, { kind: "delete" })[0].blocks), [{ repeat: ["move"] }]);
});

test("scene: unique sprite names, collision demo, runtime conversion", () => {
  const cat = makeSprite("cat", []);
  const cat2 = makeSprite("cat", [cat]);
  assert.deepEqual([cat.name, cat2.name], ["Cat", "Cat2"]);
  const [demoCat, demoHorse] = makeCollisionDemo();
  assert.deepEqual([demoCat.x, demoHorse.x, demoCat.direction, demoHorse.direction], [-120, 120, 90, 90]);
  assert.deepEqual(shape(demoHorse.stacks[0].blocks), [{ repeat: ["move"] }]);
  assert.equal(demoHorse.stacks[0].blocks[0].children[0].params.steps, "-10");
  assert.deepEqual(toRuntimeSprite(demoCat).width, 95);
});
