import React from "react";
import { Block } from "./Block";
import { BLOCK_DEFS, CATEGORIES } from "../engine/blocks";

const paletteBlock = (type) => ({
  id: `palette-${type}`,
  type,
  params: { ...BLOCK_DEFS[type].defaults },
  children: [],
});

// Block palette. Only the blocks required by the assignment are listed (see CATEGORIES).
// Dropping a workspace block back onto the palette deletes it.
export default function Sidebar({ locked, onBlockPointerDown, deleteHover }) {
  return (
    <div
      data-palette
      className={`w-56 md:w-64 flex-none h-full overflow-y-auto flex flex-col items-start p-3 border-r border-gray-200 transition-colors ${
        deleteHover ? "bg-red-50" : ""
      }`}
    >
      {CATEGORIES.map((cat) => (
        <div key={cat.id} className="w-full mb-3">
          <div className="flex items-center font-bold text-gray-700 mb-1">
            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: cat.color }} />
            {cat.label}
          </div>
          {cat.types.map((type) => {
            const block = paletteBlock(type);
            return (
              <div key={type} className="my-2" style={{ opacity: locked ? 0.6 : 1 }}>
                <Block
                  block={block}
                  mode="palette"
                  locked={locked}
                  onPointerDown={locked ? null : onBlockPointerDown}
                />
              </div>
            );
          })}
        </div>
      ))}
      {deleteHover && <div className="text-sm text-red-600 mt-2">Drop here to delete</div>}
    </div>
  );
}
