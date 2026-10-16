import React, { useEffect, useRef, useState } from "react";
import { SPRITE_ART } from "./sprites";
import { STAGE_WIDTH, STAGE_HEIGHT } from "../engine/runtime";

function Bubble({ bubble }) {
  const think = bubble.kind === "think";
  return (
    <div className="relative">
      <div
        data-testid={`bubble-${bubble.kind}`}
        className="bg-white border-2 border-gray-300 text-gray-800 text-sm px-3 py-1.5 whitespace-pre-wrap break-words"
        style={{ borderRadius: think ? 999 : 14, maxWidth: 170, minWidth: 40 }}
      >
        {bubble.text}
      </div>
      {think ? (
        <>
          <div
            className="absolute bg-white border-2 border-gray-300 rounded-full"
            style={{ width: 10, height: 10, left: 12, bottom: -12 }}
          />
          <div
            className="absolute bg-white border-2 border-gray-300 rounded-full"
            style={{ width: 6, height: 6, left: 6, bottom: -20 }}
          />
        </>
      ) : (
        <div
          className="absolute"
          style={{
            left: 14,
            bottom: -10,
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "10px solid #D1D5DB",
          }}
        />
      )}
    </div>
  );
}

// Scratch-style stage: 480×360 logical units, origin at the centre, y up, direction 90 = right.
export default function Stage({ sprites, bubbles, selectedId, locked, onSelect, onSpriteDrag }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const dragRef = useRef(null);

  // The stage keeps the 4:3 aspect and grows to fill the space available in both dimensions.
  useEffect(() => {
    const el = frameRef.current;
    const update = () =>
      setScale(Math.max(0.3, Math.min((el.clientWidth - 2) / STAGE_WIDTH, (el.clientHeight - 2) / STAGE_HEIGHT)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dragging sprites on the stage while idle sets their (starting) position, like Scratch.
  const onPointerDown = (e, sprite) => {
    onSelect(sprite.id);
    if (locked) return;
    e.preventDefault();
    dragRef.current = { id: sprite.id, px: e.clientX, py: e.clientY, x: sprite.x, y: sprite.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    onSpriteDrag(d.id, Math.round(d.x + (e.clientX - d.px) / scale), Math.round(d.y - (e.clientY - d.py) / scale));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div ref={frameRef} className="flex-1 min-h-0 flex items-center justify-center" style={{ minHeight: 220 }}>
      <div
        data-testid="stage"
        className="relative bg-white border border-gray-300 rounded-lg overflow-hidden select-none flex-none"
        style={{ width: STAGE_WIDTH * scale + 2, height: STAGE_HEIGHT * scale + 2 }}
      >
        {sprites.map((s) => {
          const art = SPRITE_ART[s.kind];
          const width = art.width * scale;
          const height = art.height * scale;
          const left = (s.x + STAGE_WIDTH / 2) * scale;
          const top = (STAGE_HEIGHT / 2 - s.y) * scale;
          const bubble = bubbles[s.id];
          return (
            <React.Fragment key={s.id}>
              <div
                data-testid={`sprite-${s.name}`}
                className={`absolute ${locked ? "" : "cursor-move"}`}
                style={{
                  left,
                  top,
                  width,
                  height,
                  transform: `translate(-50%, -50%) rotate(${s.direction - 90}deg)`,
                  touchAction: "none",
                }}
                onPointerDown={(e) => onPointerDown(e, s)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <art.Component />
                </div>
              </div>
              {bubble && (
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{ left: left + width / 4, top: top - height / 2, transform: "translateY(-100%)" }}
                >
                  <Bubble bubble={bubble} />
                </div>
              )}
              {selectedId === s.id && !locked && sprites.length > 1 && (
                <div
                  className="absolute pointer-events-none border-2 border-dashed border-blue-300 rounded"
                  style={{ left: left - width / 2, top: top - height / 2, width, height }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
