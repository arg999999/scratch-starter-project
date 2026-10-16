import React from "react";
import { BlockList } from "./Block";

// Script workspace for the selected sprite. Stacks are absolutely positioned; the scroll container
// carries data-workspace so App can convert pointer positions into workspace coordinates.
export default function MidArea({ sprite, locked, dropTarget, fadedIds, onBlockPointerDown, onParamChange }) {
  const stacks = sprite ? sprite.stacks : [];
  const width = Math.max(1200, ...stacks.map((s) => s.x + 500));
  const height = Math.max(900, ...stacks.map((s) => s.y + 600));

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-200 text-sm">
        <div>
          <span className="text-gray-500">Scripts for </span>
          <span className="font-bold text-gray-800" data-testid="workspace-sprite">{sprite ? sprite.name : "—"}</span>
        </div>
        {locked && <div className="text-yellow-700 bg-yellow-100 rounded px-2 py-0.5">Running — editing is locked</div>}
      </div>
      <div
        data-workspace
        className="flex-1 overflow-auto relative"
        style={{
          backgroundColor: "#F9F9F9",
          backgroundImage: "radial-gradient(#D9D9D9 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="relative" style={{ width, height }}>
          {!stacks.length && (
            <div className="absolute top-8 left-8 text-gray-400 pointer-events-none select-none">
              Drag blocks here to build {sprite ? `${sprite.name}'s` : "a"} script.
              Every script runs when Play is pressed.
            </div>
          )}
          {stacks.map((stack) => (
            <div key={stack.id} className="absolute" style={{ left: stack.x, top: stack.y }} data-stack-id={stack.id}>
              <BlockList
                blocks={stack.blocks}
                mode="workspace"
                locked={locked}
                dropTarget={dropTarget}
                fadedIds={fadedIds}
                onPointerDown={locked ? null : onBlockPointerDown}
                onParamChange={onParamChange}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
