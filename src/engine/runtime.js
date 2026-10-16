// Tick-based script interpreter.
//
// Each running stack is a "thread" backed by a generator. Every tick, each thread runs until it
// yields (end of a repeat iteration, or while waiting on a timed say/think) — the same frame model
// Scratch uses. Motion blocks are instantaneous; repeat loops yield once per iteration so motion
// inside a repeat is animated.
//
// Programs are captured (deep-cloned) when Play is pressed and kept per sprite in `programs`, so
// editing scripts can never affect a running thread. `runProgram(spriteId, program, origin)` replaces
// the program a single sprite is running; plugins (see collision.js) use it to swap programs.

import { cloneStacks } from "./blocks.js";

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 360;
export const TICK_MS = 1000 / 30;

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const wrapDirection = (d) => {
  const r = ((d + 180) % 360 + 360) % 360 - 180;
  return r === -180 ? 180 : r;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Keeps the whole sprite on stage when its size is known (otherwise just its centre).
function fence(sprite) {
  const hw = Math.min(STAGE_WIDTH, sprite.width || 0) / 2;
  const hh = Math.min(STAGE_HEIGHT, sprite.height || 0) / 2;
  sprite.x = clamp(sprite.x, -STAGE_WIDTH / 2 + hw, STAGE_WIDTH / 2 - hw);
  sprite.y = clamp(sprite.y, -STAGE_HEIGHT / 2 + hh, STAGE_HEIGHT / 2 - hh);
}

function* runBlocks(blocks, sprite, rt) {
  for (const block of blocks) yield* runBlock(block, sprite, rt);
}

function* runBlock(block, sprite, rt) {
  const p = block.params;
  switch (block.type) {
    case "move": {
      // Scratch direction: 0 = up, 90 = right.
      const rad = (sprite.direction * Math.PI) / 180;
      const steps = toNumber(p.steps);
      sprite.x += steps * Math.sin(rad);
      sprite.y += steps * Math.cos(rad);
      fence(sprite);
      break;
    }
    case "turn":
      sprite.direction = wrapDirection(sprite.direction + toNumber(p.degrees));
      break;
    case "goto":
      sprite.x = toNumber(p.x);
      sprite.y = toNumber(p.y);
      fence(sprite);
      break;
    case "repeat": {
      const times = Math.max(0, Math.round(toNumber(p.times)));
      for (let i = 0; i < times; i++) {
        yield* runBlocks(block.children || [], sprite, rt);
        yield; // one frame per iteration
      }
      break;
    }
    case "say":
    case "think": {
      const bubble = { kind: block.type, text: String(p.text) };
      sprite.bubble = bubble;
      const until = rt.time + Math.max(0, toNumber(p.secs)) * 1000;
      while (rt.time < until) yield;
      if (sprite.bubble === bubble) sprite.bubble = null; // a later say/think may own the bubble now
      break;
    }
    default:
      break;
  }
}

export class Runtime {
  constructor({ onFrame, onStop, plugins = [], now = () => performance.now(), schedule, cancel } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onStop = onStop || (() => {});
    this.now = now;
    this.schedule = schedule || ((fn) => setInterval(fn, TICK_MS));
    this.cancel = cancel || ((h) => clearInterval(h));
    this.running = false; // a Play session is active (clicked blocks do not set this)
    this.sprites = new Map(); // spriteId -> { id, x, y, direction, width, height, bubble }
    this.programs = new Map(); // spriteId -> { stacks, origin } currently assigned to that sprite
    this.threads = [];
    // Play-session plugins: optional onStart(rt), afterTick(rt) (positions current), onHalt(rt).
    this.plugins = plugins;
    this.timer = null;
    this.time = 0;
  }

  // sprites: [{ id, x, y, direction, width?, height?, stacks }]. Ignored if already running.
  start(sprites) {
    if (this.running) return false;
    this.halt(); // like the green flag, Play replaces anything started by clicking blocks
    this.time = this.now();
    this.sprites = new Map();
    this.programs = new Map();
    this.threads = [];
    for (const s of sprites) {
      const size = { width: s.width || 0, height: s.height || 0 };
      this.sprites.set(s.id, { id: s.id, x: s.x, y: s.y, direction: s.direction, ...size, bubble: null });
      this.runProgram(s.id, cloneStacks(s.stacks));
    }
    if (!this.threads.length) {
      this.onStop(this.snapshot());
      return false;
    }
    this.running = true;
    for (const p of this.plugins) if (p.onStart) p.onStart(this);
    this.ensureTimer();
    return true;
  }

  // Runs `blocks` once on a single sprite outside a Play session (clicking a block, as in Scratch).
  // sprite: { id, x, y, direction, width?, height? }. Other sprites are untouched. Ignored during Play.
  runBlocksOnce(sprite, blocks) {
    if (this.running || !blocks.length) return false;
    let state = this.sprites.get(sprite.id);
    const busy = state && this.threads.some((t) => t.spriteId === sprite.id);
    if (!state) {
      state = { id: sprite.id, bubble: null };
      this.sprites.set(sprite.id, state);
    }
    if (!busy) {
      const { x, y, direction, width = 0, height = 0 } = sprite;
      Object.assign(state, { x, y, direction, width, height, bubble: null });
    }
    this.threads.push({ spriteId: sprite.id, gen: runBlocks(cloneStacks([{ blocks }])[0].blocks, state, this) });
    this.tick(); // run the first step right away so the click feels immediate
    if (this.threads.length) this.ensureTimer();
    return true;
  }

  // Keeps the runtime copy of a sprite in sync when it is moved in the editor while idle.
  updateSprite(id, props) {
    const state = this.sprites.get(id);
    if (state && !this.running) Object.assign(state, props);
  }

  ensureTimer() {
    if (this.timer === null) this.timer = this.schedule(() => this.tick());
  }

  // Stops whatever `spriteId` is running and starts `program` from its beginning. Every non-empty
  // stack becomes a concurrent thread.
  // `origin` records whose authored script the program came from (for the UI indicator).
  runProgram(spriteId, program, origin = spriteId) {
    const sprite = this.sprites.get(spriteId);
    if (!sprite) return;
    this.threads = this.threads.filter((t) => t.spriteId !== spriteId);
    sprite.bubble = null;
    this.programs.set(spriteId, { stacks: program, origin });
    for (const stack of program) {
      if (!stack.blocks.length) continue;
      this.threads.push({ spriteId, gen: runBlocks(stack.blocks, sprite, this) });
    }
  }

  tick() {
    if (!this.threads.length) return;
    this.time = this.now();
    for (const thread of this.threads.slice()) {
      if (!this.threads.includes(thread)) continue; // replaced during this tick
      if (thread.gen.next().done) this.threads = this.threads.filter((t) => t !== thread);
    }
    if (this.running) for (const p of this.plugins) if (p.afterTick) p.afterTick(this);
    this.onFrame(this.snapshot());
    if (!this.threads.length) this.finish();
  }

  finish() {
    this.halt();
    this.onStop(this.snapshot());
  }

  halt() {
    if (this.running) for (const p of this.plugins) if (p.onHalt) p.onHalt(this);
    this.running = false;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.threads = [];
  }

  // Stops all threads (Play or clicked) and pending timed actions; clears bubbles. Positions are kept.
  stop() {
    for (const s of this.sprites.values()) s.bubble = null;
    if (this.running || this.threads.length) this.finish();
  }

  // spriteId -> id of the sprite whose authored program it is currently running.
  assignments() {
    const out = {};
    for (const [id, p] of this.programs) out[id] = p.origin;
    return out;
  }

  snapshot() {
    const out = {};
    for (const [id, s] of this.sprites) out[id] = { x: s.x, y: s.y, direction: s.direction, bubble: s.bubble };
    return out;
  }
}
