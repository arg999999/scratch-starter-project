// Collision-triggered program swapping (the assignment's "hero feature").
//
// Semantics:
//   - Programs are captured when Play is pressed; each sprite has a *current* runtime assignment
//     (runtime.programs). Authored scripts in the editor are never touched.
//   - After every tick (positions current), sprite pairs are tested with axis-aligned bounding boxes
//     centred on each sprite (art size; rotation ignored).
//   - When a pair *enters* contact, the two current assignments are exchanged atomically: both
//     sprites' threads stop, bubbles clear, and each restarts the received program from the top.
//     Position, direction and costume are kept. A later collision swaps the current assignments
//     again (it does not restore the originals).
//   - A pair in contact stays "active" and cannot swap again until it separates by more than
//     SEPARATION_TOLERANCE. A sprite takes part in at most one swap per tick.
//   - Pairs already overlapping when Play starts count as in contact (no swap until they separate).

import { cloneStacks } from "./blocks.js";

export const SEPARATION_TOLERANCE = 2;

export function bounds(sprite, pad = 0) {
  const hw = sprite.width / 2 + pad;
  const hh = sprite.height / 2 + pad;
  return { left: sprite.x - hw, right: sprite.x + hw, bottom: sprite.y - hh, top: sprite.y + hh };
}

export function overlaps(a, b, pad = 0) {
  const A = bounds(a, pad);
  const B = bounds(b, pad);
  return A.left < B.right && B.left < A.right && A.bottom < B.top && B.bottom < A.top;
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class CollisionSwap {
  constructor({ onSwap } = {}) {
    this.onSwap = onSwap || (() => {});
    this.active = new Set();
    this.swaps = 0;
  }

  onStart(rt) {
    this.active = new Set();
    this.swaps = 0;
    this.forEachPair(rt, (a, b) => {
      if (overlaps(a, b)) this.active.add(pairKey(a.id, b.id));
    });
  }

  afterTick(rt) {
    // Re-arm pairs that have clearly separated.
    for (const key of [...this.active]) {
      const [a, b] = key.split("|").map((id) => rt.sprites.get(id));
      if (!a || !b || !overlaps(a, b, SEPARATION_TOLERANCE)) this.active.delete(key);
    }
    const swappedThisTick = new Set();
    this.forEachPair(rt, (a, b) => {
      const key = pairKey(a.id, b.id);
      if (this.active.has(key) || !overlaps(a, b)) return;
      this.active.add(key);
      if (swappedThisTick.has(a.id) || swappedThisTick.has(b.id)) return;
      swappedThisTick.add(a.id).add(b.id);
      this.swap(rt, a.id, b.id);
    });
  }

  swap(rt, idA, idB) {
    const progA = rt.programs.get(idA);
    const progB = rt.programs.get(idB);
    if (!progA || !progB) return;
    // Fresh copies so no block objects or ids are ever shared between sprites.
    rt.runProgram(idA, cloneStacks(progB.stacks), progB.origin);
    rt.runProgram(idB, cloneStacks(progA.stacks), progA.origin);
    this.swaps += 1;
    this.onSwap({ a: idA, b: idB, count: this.swaps, assignments: rt.assignments() });
  }

  onHalt() {
    this.active = new Set();
  }

  forEachPair(rt, fn) {
    const list = [...rt.sprites.values()].filter((s) => s.width > 0 && s.height > 0);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) fn(list[i], list[j]);
  }
}
