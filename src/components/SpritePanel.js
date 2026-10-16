import React, { useState } from "react";
import Icon from "./Icon";
import { SPRITE_ART, SPRITE_KINDS } from "./sprites";

const round = (v) => Math.round(v * 100) / 100;

// Edits a number as free text and commits on blur/Enter, so intermediate values like "-" are allowed.
function NumberField({ label, value, disabled, onChange }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) onChange(n);
    setDraft(null);
  };
  return (
    <label className="flex items-center text-xs text-gray-600 mr-3">
      {label}
      <input
        className="ml-1 w-14 border border-gray-300 rounded-full px-2 py-0.5 text-center text-gray-800 disabled:bg-gray-100"
        value={draft === null ? value : draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        aria-label={`sprite ${label}`}
      />
    </label>
  );
}

// Position and direction of the selected sprite.
export function SpriteInfo({ sprite, disabled, onChange }) {
  return (
    <div className="flex-none flex flex-wrap items-center mt-3 p-2 border border-gray-200 rounded-lg">
      <div className="font-semibold text-sm text-gray-800 mr-3">{sprite.name}</div>
      <NumberField label="x" value={round(sprite.x)} disabled={disabled} onChange={(x) => onChange({ x })} />
      <NumberField label="y" value={round(sprite.y)} disabled={disabled} onChange={(y) => onChange({ y })} />
      <NumberField
        label="direction"
        value={round(sprite.direction)}
        disabled={disabled}
        onChange={(direction) => onChange({ direction })}
      />
    </div>
  );
}

function SpriteTile({ sprite, active, running, canDelete, assignedTo, onSelect, onDelete }) {
  const art = SPRITE_ART[sprite.kind];
  const count = sprite.stacks.reduce((n, st) => n + st.blocks.length, 0);
  return (
    <div
      role="button"
      aria-label={`Select ${sprite.name}`}
      onClick={onSelect}
      className={`relative w-20 m-1 p-1 rounded-lg bg-white cursor-pointer flex flex-col items-center border-2 ${
        active ? "border-blue-500" : "border-transparent hover:border-blue-200"
      }`}
    >
      <div style={{ width: 48, height: 44, overflow: "hidden" }}>
        <div style={{ transform: `scale(${44 / art.height})`, transformOrigin: "top left" }}>
          <art.Component />
        </div>
      </div>
      <div className={`text-xs truncate w-full text-center ${active ? "text-blue-600 font-semibold" : "text-gray-700"}`}>
        {sprite.name}
      </div>
      <div className="text-xs text-gray-400">
        {count} block{count === 1 ? "" : "s"}
      </div>
      {assignedTo && (
        <div
          data-testid={`assignment-${sprite.name}`}
          title="Program this sprite is currently running"
          className={`text-xs mt-0.5 px-1 rounded truncate w-full text-center ${
            assignedTo.own ? "bg-gray-100 text-gray-500" : "bg-indigo-100 text-indigo-700 font-semibold"
          }`}
        >
          ▶ {assignedTo.own ? "own script" : `${assignedTo.name}'s`}
        </div>
      )}
      {active && canDelete && !running && (
        <button
          aria-label={`Delete ${sprite.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-red-500"
        >
          <Icon name="times" size={10} />
        </button>
      )}
    </div>
  );
}

// Sprite list with add / select / delete, and which program each sprite is running.
export function SpriteList({ sprites, selectedId, running, assignments, nameOf, onSelect, onAdd, onDelete }) {
  return (
    <div className="mt-3 p-2 border border-gray-200 rounded-lg bg-blue-50 flex-none">
      <div className="flex items-center mb-2">
        <div className="font-semibold text-sm text-gray-700">Sprites</div>
        <div className="ml-auto flex">
          {SPRITE_KINDS.map((kind) => (
            <button
              key={kind}
              disabled={running}
              onClick={() => onAdd(kind)}
              aria-label={`Add ${kind}`}
              className="flex items-center text-xs px-2 py-1 ml-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              <Icon name="plus" size={10} className="mr-1" /> {kind[0].toUpperCase() + kind.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap">
        {sprites.map((s) => (
          <SpriteTile
            key={s.id}
            sprite={s}
            active={s.id === selectedId}
            running={running}
            canDelete={sprites.length > 1}
            assignedTo={assignments[s.id] && { own: assignments[s.id] === s.id, name: nameOf(assignments[s.id]) }}
            onSelect={() => onSelect(s.id)}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
