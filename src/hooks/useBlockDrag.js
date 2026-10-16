import { useEffect, useRef, useState } from "react";
import { blocksFrom, createBlock } from "../engine/blocks";

// Pointer-based block drag and drop (works with mouse and touch).
//
// Drop targets are read from the DOM: blocks expose data-drop / data-block-id attributes (see
// Block.js), the workspace has data-workspace and the palette data-palette. A press that moves less
// than DRAG_THRESHOLD pixels is a click: on a palette block it calls onPaletteClick instead.

const DRAG_THRESHOLD = 4;
const SNAP_RADIUS = 36;

const movedEnough = (drag, e) => Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;

// Scratch-style snapping: when the dragged blocks' top-left corner is close to the bottom-left of a
// block (or of a repeat's mouth), connect there even if the pointer is over empty workspace.
function nearestSnap(workspace, left, top, draggedIds) {
  let best = null;
  workspace.querySelectorAll('[data-drop="block"], [data-drop="after"]').forEach((el) => {
    const blockId = el.dataset.blockId;
    if (draggedIds.has(blockId)) return;
    const rect = el.getBoundingClientRect();
    const isRepeatHeader = el.dataset.drop === "block" && el.dataset.blockType === "repeat";
    const dist = Math.hypot(left - (rect.left + (isRepeatHeader ? 16 : 0)), top - rect.bottom);
    if (dist < SNAP_RADIUS && (!best || dist < best.dist)) {
      best = { dist, target: { kind: isRepeatHeader ? "inside" : "after", blockId } };
    }
  });
  return best && best.target;
}

// Resolves what is under the pointer into a drop target (see engine/blocks insert()).
function resolveTarget(clientX, clientY, drag) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  if (el.closest("[data-palette]")) return drag.source === "workspace" ? { kind: "delete" } : null;

  const dropEl = el.closest("[data-drop]");
  if (dropEl && !drag.draggedIds.has(dropEl.dataset.blockId)) {
    const { blockId, drop: kind, blockType } = dropEl.dataset;
    if (kind !== "block") return { kind, blockId };
    const rect = dropEl.getBoundingClientRect();
    if (clientY <= rect.top + rect.height / 2) return { kind: "before", blockId };
    return { kind: blockType === "repeat" ? "inside" : "after", blockId };
  }

  const workspace = el.closest("[data-workspace]");
  if (!workspace) return null;
  const snap = nearestSnap(workspace, clientX - drag.offsetX, clientY - drag.offsetY, drag.draggedIds);
  if (snap) return snap;
  const rect = workspace.getBoundingClientRect();
  return {
    kind: "newStack",
    x: Math.round(clientX - rect.left + workspace.scrollLeft - drag.offsetX),
    y: Math.round(clientY - rect.top + workspace.scrollTop - drag.offsetY),
  };
}

function collectIds(blocks, ids = new Set()) {
  blocks.forEach((b) => {
    ids.add(b.id);
    if (b.children) collectIds(b.children, ids);
  });
  return ids;
}

// Returns:
//   drag       – the active drag once it has started ({ source, blocks, draggedIds, x, y, offsetX, offsetY })
//   dropTarget – where the blocks would land right now
//   beginDrag  – beginDrag("palette" | "workspace") gives a pointerdown handler for blocks
export default function useBlockDrag({ locked, stacks, onDrop, onPaletteClick }) {
  const [drag, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragRef = useRef(null);
  const callbacks = useRef();
  callbacks.current = { onDrop, onPaletteClick };

  const setDrag = (next) => {
    dragRef.current = next;
    setDragState(next);
  };

  const beginDrag = (source) => (e, block) => {
    if (locked || e.button > 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const base = {
      source,
      started: false,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    if (source === "palette") {
      setDrag({ ...base, blocks: [createBlock(block.type)], draggedIds: new Set() });
    } else {
      const blocks = blocksFrom(stacks, block.id) || [];
      setDrag({ ...base, blockId: block.id, blocks, draggedIds: collectIds(blocks) });
    }
  };

  const active = drag !== null;
  useEffect(() => {
    if (!active) return undefined;
    const onMove = (e) => {
      const current = dragRef.current;
      const next = { ...current, x: e.clientX, y: e.clientY, started: current.started || movedEnough(current, e) };
      setDrag(next);
      setDropTarget(next.started ? resolveTarget(e.clientX, e.clientY, next) : null);
    };
    const onUp = (e) => {
      const current = dragRef.current;
      const moved = current.started || movedEnough(current, e);
      if (!moved && current.source === "palette" && e.type === "pointerup") {
        callbacks.current.onPaletteClick(current.blocks[0]);
      } else if (moved) {
        const target = resolveTarget(e.clientX, e.clientY, current);
        if (target) callbacks.current.onDrop(current, target);
      }
      setDrag(null);
      setDropTarget(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active]);

  return { drag: drag && drag.started ? drag : null, dropTarget, beginDrag };
}
