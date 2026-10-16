import { useCallback, useEffect, useRef, useState } from "react";
import { Runtime } from "../engine/runtime";
import { CollisionSwap } from "../engine/collision";
import { toRuntimeSprite } from "../engine/scene";

// Owns the script Runtime (with the collision-swap plugin) and mirrors its state into React.
// Sprite positions are written back through `setSprites` on every frame.
export default function useRuntime(setSprites) {
  const [running, setRunning] = useState(false);
  const [bubbles, setBubbles] = useState({}); // spriteId -> { kind, text }
  const [assignments, setAssignments] = useState({}); // spriteId -> sprite whose program it is running
  const [swapInfo, setSwapInfo] = useState(null); // last collision swap { a, b, count }
  const runtimeRef = useRef(null);

  useEffect(() => {
    const applySnapshot = (snap) => {
      setSprites((prev) =>
        prev.map((s) => (snap[s.id] ? { ...s, x: snap[s.id].x, y: snap[s.id].y, direction: snap[s.id].direction } : s))
      );
      const next = {};
      for (const id of Object.keys(snap)) if (snap[id].bubble) next[id] = snap[id].bubble;
      setBubbles(next);
    };
    const onSwap = ({ a, b, count, assignments: current }) => {
      setAssignments(current);
      setSwapInfo({ a, b, count });
    };
    const rt = new Runtime({
      onFrame: applySnapshot,
      onStop: (snap) => {
        applySnapshot(snap);
        setRunning(false);
      },
      plugins: [new CollisionSwap({ onSwap })],
    });
    runtimeRef.current = rt;
    return () => rt.stop();
  }, [setSprites]);

  // Runs every sprite's scripts. Ignored while already running (no duplicate threads).
  const play = useCallback((sprites) => {
    const rt = runtimeRef.current;
    if (rt.running) return;
    const started = rt.start(sprites.map(toRuntimeSprite));
    setRunning(started);
    setSwapInfo(null);
    setAssignments(started ? rt.assignments() : {});
  }, []);

  const stop = useCallback(() => runtimeRef.current.stop(), []);

  // Stops and clears transient state (bubbles, swap status, program assignments).
  const clear = useCallback(() => {
    runtimeRef.current.stop();
    setBubbles({});
    setSwapInfo(null);
    setAssignments({});
  }, []);

  // Runs blocks once on one sprite (clicking a palette block).
  const runOnce = useCallback(
    (sprite, blocks) => runtimeRef.current.runBlocksOnce(toRuntimeSprite(sprite), blocks),
    []
  );

  // Keeps the runtime's copy of a sprite in sync when it is moved in the editor.
  const updateSprite = useCallback((id, props) => runtimeRef.current.updateSprite(id, props), []);

  return { running, bubbles, assignments, swapInfo, play, stop, clear, runOnce, updateSprite };
}
