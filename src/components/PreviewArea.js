import React from "react";
import Icon from "./Icon";
import Stage from "./Stage";
import { SpriteInfo, SpriteList } from "./SpritePanel";

function PlaybackControls({ running, onPlay, onStop, onReset }) {
  return (
    <div className="flex-none flex items-center mb-3">
      <button
        onClick={onPlay}
        disabled={running}
        title="Play all sprites"
        aria-label="Play"
        className={`flex items-center px-3 py-1.5 rounded-lg mr-2 text-white font-semibold ${
          running ? "bg-green-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
        }`}
      >
        <Icon name="flag" size={15} className="mr-2" /> Play
      </button>
      <button
        onClick={onStop}
        title="Stop"
        aria-label="Stop"
        className="flex items-center px-3 py-1.5 rounded-lg mr-2 text-white font-semibold bg-red-500 hover:bg-red-600"
      >
        <Icon name="stop" size={13} className="mr-2" /> Stop
      </button>
      <button
        onClick={onReset}
        title="Stop and restore starting positions"
        aria-label="Reset"
        className="flex items-center px-3 py-1.5 rounded-lg text-gray-700 font-semibold bg-gray-200 hover:bg-gray-300"
      >
        <Icon name="undo-alt" size={13} className="mr-2" /> Reset
      </button>
      <div
        data-testid="run-status"
        className={`ml-auto text-xs font-semibold ${running ? "text-green-600" : "text-gray-400"}`}
      >
        {running ? "● Running" : "Idle"}
      </div>
    </div>
  );
}

// Right-hand panel: playback controls, collision status, stage, and sprite controls.
export default function PreviewArea({
  sprites,
  bubbles,
  selectedId,
  running,
  assignments = {},
  swapInfo,
  onPlay,
  onStop,
  onReset,
  onLoadDemo,
  onSelect,
  onAddSprite,
  onDeleteSprite,
  onSpriteProp,
}) {
  const selected = sprites.find((s) => s.id === selectedId);
  const nameOf = (id) => (sprites.find((s) => s.id === id) || { name: "?" }).name;

  return (
    <div className="flex-1 h-full overflow-y-auto p-3 flex flex-col">
      <PlaybackControls running={running} onPlay={onPlay} onStop={onStop} onReset={onReset} />

      <div className="flex-none flex flex-wrap items-center mb-3 text-sm">
        <button
          onClick={onLoadDemo}
          disabled={running}
          aria-label="Load Collision Demo"
          className="px-3 py-1 mr-3 rounded-lg border border-indigo-400 text-indigo-600 font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Load Collision Demo
        </button>
        <div data-testid="swap-status" className={swapInfo ? "text-indigo-700 font-semibold" : "text-gray-400"}>
          {swapInfo
            ? `Collision! ${nameOf(swapInfo.a)} ⇄ ${nameOf(swapInfo.b)} swapped programs (swap #${swapInfo.count})`
            : "Colliding sprites swap the programs they are running."}
        </div>
      </div>

      <Stage
        sprites={sprites}
        bubbles={bubbles}
        selectedId={selectedId}
        locked={running}
        onSelect={onSelect}
        onSpriteDrag={(id, x, y) => onSpriteProp(id, { x, y })}
      />

      {selected && (
        <SpriteInfo sprite={selected} disabled={running} onChange={(props) => onSpriteProp(selected.id, props)} />
      )}

      <SpriteList
        sprites={sprites}
        selectedId={selectedId}
        running={running}
        assignments={assignments}
        nameOf={nameOf}
        onSelect={onSelect}
        onAdd={onAddSprite}
        onDelete={onDeleteSprite}
      />
    </div>
  );
}
