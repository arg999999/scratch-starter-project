// Block definitions and pure script-tree operations.
//
// A sprite's script area is a list of stacks:
//   Stack = { id, x, y, blocks: Block[] }
//   Block = { id, type, params: {...}, children?: Block[] }   (children only for "repeat")
// Every operation here is pure: it returns new arrays and never mutates its input.

export const BLOCK_DEFS = {
  move: {
    category: "motion",
    parts: ["move", { key: "steps", kind: "number" }, "steps"],
    defaults: { steps: "10" },
  },
  turn: {
    category: "motion",
    parts: ["turn", { icon: "redo" }, { key: "degrees", kind: "number" }, "degrees"],
    defaults: { degrees: "15" },
  },
  goto: {
    category: "motion",
    parts: ["go to x:", { key: "x", kind: "number" }, "y:", { key: "y", kind: "number" }],
    defaults: { x: "0", y: "0" },
  },
  repeat: {
    category: "control",
    parts: ["repeat", { key: "times", kind: "number" }],
    defaults: { times: "10" },
    container: true,
  },
  say: {
    category: "looks",
    parts: ["say", { key: "text", kind: "text" }, "for", { key: "secs", kind: "number" }, "seconds"],
    defaults: { text: "Hello!", secs: "2" },
  },
  think: {
    category: "looks",
    parts: ["think", { key: "text", kind: "text" }, "for", { key: "secs", kind: "number" }, "seconds"],
    defaults: { text: "Hmm...", secs: "2" },
  },
};

export const CATEGORIES = [
  { id: "motion", label: "Motion", color: "#4C97FF", border: "#3373CC", types: ["move", "turn", "goto"] },
  { id: "looks", label: "Looks", color: "#9966FF", border: "#774DCB", types: ["say", "think"] },
  { id: "control", label: "Control", color: "#FFAB19", border: "#CF8B17", types: ["repeat"] },
];

export const categoryOf = (type) => CATEGORIES.find((c) => c.id === BLOCK_DEFS[type].category);

let counter = 0;
export const newId = (prefix = "b") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createBlock(type, params) {
  const def = BLOCK_DEFS[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  const block = { id: newId(), type, params: { ...def.defaults, ...params } };
  if (def.container) block.children = [];
  return block;
}

// Deep copy with fresh ids, so a copied program never shares objects or ids with its source.
export function cloneBlocks(blocks) {
  return blocks.map((b) => {
    const copy = { ...b, id: newId(), params: { ...b.params } };
    if (b.children) copy.children = cloneBlocks(b.children);
    return copy;
  });
}

export function cloneStacks(stacks) {
  return stacks.map((s) => ({ ...s, id: newId("s"), blocks: cloneBlocks(s.blocks) }));
}

export function containsBlock(blocks, id) {
  return blocks.some((b) => b.id === id || (b.children && containsBlock(b.children, id)));
}

export function findBlock(blocks, id) {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Blocks dragged when grabbing `id`: the block plus everything below it in the same list (Scratch semantics).
export function blocksFrom(stacks, id) {
  const fromList = (list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) return list.slice(i);
    for (const b of list) {
      if (b.children) {
        const found = fromList(b.children);
        if (found) return found;
      }
    }
    return null;
  };
  for (const s of stacks) {
    const found = fromList(s.blocks);
    if (found) return found;
  }
  return null;
}

// Removes block `id` and its followers. Returns { stacks, detached, stack } where `stack` is the
// stack it came from (useful when a whole stack is moved), or null when not found.
export function detach(stacks, id) {
  let detached = null;
  const cut = (list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) {
      detached = list.slice(i);
      return list.slice(0, i);
    }
    let changed = false;
    const next = list.map((b) => {
      if (detached || !b.children) return b;
      const children = cut(b.children);
      if (children !== b.children) {
        changed = true;
        return { ...b, children };
      }
      return b;
    });
    return changed ? next : list;
  };
  let source = null;
  const result = [];
  for (const s of stacks) {
    if (detached) {
      result.push(s);
      continue;
    }
    const blocks = cut(s.blocks);
    if (detached) {
      source = s;
      if (blocks.length) result.push({ ...s, blocks });
    } else {
      result.push(s);
    }
  }
  if (!detached) return null;
  return { stacks: result, detached, stack: source };
}

// Target shapes:
//   { kind: "before" | "after", blockId }
//   { kind: "inside", blockId }            first position inside a repeat
//   { kind: "newStack", x, y }
// Returns null when the target no longer exists.
export function insert(stacks, target, blocks) {
  if (target.kind === "newStack") {
    return [...stacks, { id: newId("s"), x: Math.max(0, target.x), y: Math.max(0, target.y), blocks }];
  }
  let done = false;
  const place = (list) => {
    const i = list.findIndex((b) => b.id === target.blockId);
    if (i >= 0) {
      done = true;
      if (target.kind === "before") return [...list.slice(0, i), ...blocks, ...list.slice(i)];
      if (target.kind === "after") return [...list.slice(0, i + 1), ...blocks, ...list.slice(i + 1)];
      const host = list[i];
      if (!host.children) return list;
      const copy = list.slice();
      copy[i] = { ...host, children: [...blocks, ...host.children] };
      return copy;
    }
    return list.map((b) => (done || !b.children ? b : { ...b, children: place(b.children) }));
  };
  const result = stacks.map((s) => (done ? s : { ...s, blocks: place(s.blocks) }));
  return done ? result : null;
}

// Moves block `id` (with its followers) to `target`. Dropping onto itself just moves the stack.
export function moveBlocks(stacks, id, target) {
  const cut = detach(stacks, id);
  if (!cut) return stacks;
  if (target.kind !== "newStack") {
    const inserted = insert(cut.stacks, target, cut.detached);
    if (inserted) return inserted;
    return stacks; // target was part of the dragged blocks: no-op
  }
  return insert(cut.stacks, target, cut.detached);
}

export function deleteBlocks(stacks, id) {
  const cut = detach(stacks, id);
  return cut ? cut.stacks : stacks;
}

export function updateParam(stacks, id, key, value) {
  const update = (list) =>
    list.map((b) => {
      if (b.id === id) return { ...b, params: { ...b.params, [key]: value } };
      return b.children ? { ...b, children: update(b.children) } : b;
    });
  return stacks.map((s) => ({ ...s, blocks: update(s.blocks) }));
}

// Applies a finished drag. `drag` is { source: "palette" | "workspace", blocks, blockId } and
// `target` is an insert() target or { kind: "delete" } (dropped on the palette).
export function applyDrop(stacks, drag, target) {
  if (drag.source === "palette") {
    return target.kind === "delete" ? stacks : insert(stacks, target, drag.blocks) || stacks;
  }
  return target.kind === "delete" ? deleteBlocks(stacks, drag.blockId) : moveBlocks(stacks, drag.blockId, target);
}

export function moveStack(stacks, stackId, x, y) {
  return stacks.map((s) => (s.id === stackId ? { ...s, x: Math.max(0, x), y: Math.max(0, y) } : s));
}
