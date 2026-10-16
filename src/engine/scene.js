// Scene helpers: sprite creation, the collision demo, and conversion to runtime sprites.

import { createBlock, newId } from "./blocks.js";

// Artwork size of each sprite kind, in stage units.
export const SPRITE_SIZES = {
  cat: { width: 95, height: 100 },
  horse: { width: 110, height: 100 },
};

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

// New sprite with a unique name ("Cat", "Cat2", ...) placed so it does not cover existing sprites.
export function makeSprite(kind, existing) {
  let name = capitalize(kind);
  for (let n = 2; existing.some((s) => s.name === name); n++) name = `${capitalize(kind)}${n}`;
  const x = existing.length ? Math.max(-180, Math.min(180, -150 + 100 * (existing.length % 4))) : 0;
  const y = existing.length ? 60 - 60 * (Math.floor(existing.length / 4) % 3) : 0;
  return { id: newId("sp"), name, kind, x, y, direction: 90, start: { x, y, direction: 90 }, stacks: [] };
}

// Collision demo: both sprites face right; opposite step signs make them approach each other.
export function makeCollisionDemo() {
  const loop = (steps) => {
    const repeat = createBlock("repeat", { times: "20" });
    repeat.children = [createBlock("move", { steps: String(steps) })];
    return [{ id: newId("s"), x: 32, y: 32, blocks: [repeat] }];
  };
  const place = (sprite, x, stacks) => {
    const pose = { x, y: 0, direction: 90 };
    return { ...sprite, ...pose, start: pose, stacks };
  };
  const cat = place(makeSprite("cat", []), -120, loop(10));
  const horse = place(makeSprite("horse", [cat]), 120, loop(-10));
  return [cat, horse];
}

// Editor sprite -> the shape Runtime.start / runBlocksOnce expect.
export const toRuntimeSprite = ({ id, kind, x, y, direction, stacks }) => ({
  id,
  x,
  y,
  direction,
  stacks,
  ...SPRITE_SIZES[kind],
});
