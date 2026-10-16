import React from "react";
import Icon from "./Icon";
import { BLOCK_DEFS, categoryOf } from "../engine/blocks";

// Renders a block (and, for repeat, its nested children) in one of three modes:
//   "palette"   – read-only inputs, drag creates a new block
//   "workspace" – editable inputs, drag moves the block and the blocks below it
//   "ghost"     – the copy that follows the pointer while dragging
// Drop targets are exposed through data-drop / data-block-id attributes; App resolves them.

function DropLine({ position }) {
  const pos = position === "top" ? { top: -4 } : { bottom: -4 };
  return <div className="absolute left-0 h-1 w-24 rounded bg-gray-800 z-10 pointer-events-none" style={pos} />;
}

function Input({ value, kind, editable, onChange }) {
  const width = `${Math.max(2, String(value).length) + 1.5}ch`;
  const className =
    "rounded-full bg-white text-gray-800 text-center text-xs px-1 py-0.5 mx-1 " +
    "outline-none border border-transparent focus:border-gray-500";
  if (!editable) {
    return (
      <span className={className} style={{ minWidth: width }}>
        {value}
      </span>
    );
  }
  return (
    <input
      className={className}
      style={{ width }}
      value={value}
      inputMode={kind === "number" ? "decimal" : "text"}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="block input"
    />
  );
}

function Header({ block, mode, locked, onParamChange, onPointerDown, rounded }) {
  const def = BLOCK_DEFS[block.type];
  const cat = categoryOf(block.type);
  const editable = mode === "workspace" && !locked;
  return (
    <div
      data-drop={mode === "workspace" ? "block" : undefined}
      data-block-id={mode === "workspace" ? block.id : undefined}
      data-block-type={block.type}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, block) : undefined}
      className={`relative flex flex-row flex-nowrap items-center whitespace-nowrap text-white text-sm px-2 py-1.5 select-none ${rounded} ${
        locked ? "cursor-default" : "cursor-grab"
      }`}
      style={{ background: cat.color, border: `1px solid ${cat.border}`, touchAction: "none", minHeight: 34 }}
    >
      {def.parts.map((part, i) => {
        if (typeof part === "string") return <span key={i} className="mx-0.5">{part}</span>;
        if (part.icon) return <Icon key={i} name={part.icon} size={14} className="text-white mx-1" />;
        return (
          <Input
            key={i}
            kind={part.kind}
            value={block.params[part.key]}
            editable={editable}
            onChange={(v) => onParamChange(block.id, part.key, v)}
          />
        );
      })}
    </div>
  );
}

export function Block(props) {
  const { block, mode, dropTarget, fadedIds } = props;
  const def = BLOCK_DEFS[block.type];
  const cat = categoryOf(block.type);
  const target = dropTarget && dropTarget.blockId === block.id ? dropTarget.kind : null;
  const faded = fadedIds && fadedIds.has(block.id);

  if (!def.container) {
    return (
      <div className="relative self-start" style={{ opacity: faded ? 0.35 : 1 }}>
        {target === "before" && <DropLine position="top" />}
        <Header {...props} rounded="rounded" />
        {target === "after" && <DropLine position="bottom" />}
      </div>
    );
  }

  const children = block.children || [];
  return (
    <div className="relative self-start" style={{ opacity: faded ? 0.35 : 1 }}>
      {target === "before" && <DropLine position="top" />}
      <Header {...props} rounded="rounded-t" />
      <div className="flex flex-row">
        <div className="w-4 flex-none" style={{ background: cat.color, borderLeft: `1px solid ${cat.border}` }} />
        <div className="relative flex flex-col py-0.5" style={{ minWidth: 60 }}>
          {target === "inside" && <DropLine position="top" />}
          {children.length ? (
            <BlockList {...props} blocks={children} />
          ) : (
            <div
              data-drop={mode === "workspace" ? "inside" : undefined}
              data-block-id={mode === "workspace" ? block.id : undefined}
              className="h-6 w-24"
            />
          )}
        </div>
      </div>
      <div
        data-drop={mode === "workspace" ? "after" : undefined}
        data-block-id={mode === "workspace" ? block.id : undefined}
        className="h-4 w-28 rounded-b"
        style={{ background: cat.color, border: `1px solid ${cat.border}`, borderTop: "none" }}
      />
      {target === "after" && <DropLine position="bottom" />}
    </div>
  );
}

export function BlockList(props) {
  return (
    <div className="flex flex-col">
      {props.blocks.map((b) => (
        <Block {...props} key={b.id} block={b} />
      ))}
    </div>
  );
}
