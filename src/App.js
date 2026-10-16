import React, { useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import MidArea from "./components/MidArea";
import PreviewArea from "./components/PreviewArea";
import { BlockList } from "./components/Block";
import useBlockDrag from "./hooks/useBlockDrag";
import useRuntime from "./hooks/useRuntime";
import { applyDrop, updateParam } from "./engine/blocks";
import { makeCollisionDemo, makeSprite } from "./engine/scene";

export default function App() {
  const [sprites, setSprites] = useState(() => [makeSprite("cat", [])]);
  const [selectedId, setSelectedId] = useState(null);
  const spritesRef = useRef(sprites);
  spritesRef.current = sprites;

  const runtime = useRuntime(setSprites);
  const { running } = runtime;
  const selected = sprites.find((s) => s.id === selectedId) || sprites[0];

  // ---- playback ------------------------------------------------------------------------------
  const play = () => runtime.play(spritesRef.current);
  const reset = () => {
    runtime.clear();
    setSprites((prev) => prev.map((s) => ({ ...s, ...s.start })));
  };
  const loadCollisionDemo = () => {
    const hasScripts = spritesRef.current.some((s) => s.stacks.length);
    if (hasScripts && !window.confirm("Replace the current sprites and scripts with the collision demo?")) return;
    runtime.clear();
    const demo = makeCollisionDemo();
    setSprites(demo);
    setSelectedId(demo[0].id);
  };

  // ---- sprites -------------------------------------------------------------------------------
  const addSprite = (kind) => {
    const sprite = makeSprite(kind, spritesRef.current);
    setSprites((prev) => [...prev, sprite]);
    setSelectedId(sprite.id);
  };
  const deleteSprite = (id) => {
    runtime.stop();
    setSprites((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
    setSelectedId(null);
  };
  // Editing a position while idle also moves the starting position that Reset restores.
  const setSpriteProp = (id, props) => {
    runtime.updateSprite(id, props);
    setSprites((prev) => prev.map((s) => (s.id === id ? { ...s, ...props, start: { ...s.start, ...props } } : s)));
  };

  // ---- scripts -------------------------------------------------------------------------------
  const updateStacks = (fn) =>
    setSprites((prev) => prev.map((s) => (s.id === selected.id ? { ...s, stacks: fn(s.stacks) } : s)));
  const onParamChange = (blockId, key, value) => updateStacks((stacks) => updateParam(stacks, blockId, key, value));

  const { drag, dropTarget, beginDrag } = useBlockDrag({
    locked: running,
    stacks: selected.stacks,
    onDrop: (finished, target) => updateStacks((stacks) => applyDrop(stacks, finished, target)),
    // Clicking a palette block runs it once on the selected sprite, as in Scratch.
    // An empty repeat has no visible effect, so clicking it does nothing.
    onPaletteClick: (block) => {
      if (block.type === "repeat" && !block.children.length) return;
      runtime.runOnce(selected, [block]);
    },
  });

  return (
    <div className="bg-blue-100 font-sans h-screen flex flex-col" style={{ cursor: drag ? "grabbing" : undefined }}>
      <header className="flex-none flex items-center px-4 h-10 bg-indigo-500 text-white">
        <span className="font-bold tracking-wide">Scratch Playground</span>
        <span className="ml-3 text-sm text-indigo-100">Build a script for each sprite, then press Play.</span>
      </header>
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row pt-2">
        <div className="lg:flex-1 h-1/2 lg:h-full overflow-hidden flex flex-row bg-white border-t border-r border-gray-200 rounded-tr-xl lg:mr-2">
          <Sidebar
            locked={running}
            onBlockPointerDown={beginDrag("palette")}
            deleteHover={dropTarget && dropTarget.kind === "delete"}
          />
          <MidArea
            sprite={selected}
            locked={running}
            dropTarget={dropTarget}
            fadedIds={drag && drag.source === "workspace" ? drag.draggedIds : null}
            onBlockPointerDown={beginDrag("workspace")}
            onParamChange={onParamChange}
          />
        </div>
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-hidden flex flex-row bg-white border-t border-l border-gray-200 rounded-tl-xl mt-2 lg:mt-0 lg:ml-2">
          <PreviewArea
            sprites={sprites}
            bubbles={runtime.bubbles}
            selectedId={selected.id}
            running={running}
            assignments={runtime.assignments}
            swapInfo={runtime.swapInfo}
            onPlay={play}
            onStop={runtime.stop}
            onReset={reset}
            onLoadDemo={loadCollisionDemo}
            onSelect={setSelectedId}
            onAddSprite={addSprite}
            onDeleteSprite={deleteSprite}
            onSpriteProp={setSpriteProp}
          />
        </div>
      </div>
      {drag && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
          }}
        >
          <BlockList blocks={drag.blocks} mode="ghost" />
        </div>
      )}
    </div>
  );
}
