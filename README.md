# Scratch starter project

A small Scratch-style visual coding environment built on the provided React starter
(React 17, webpack 5, Tailwind CSS 2).

To get started:

- Run `npm i` to install dependencies
- Run `npm start` and open http://localhost:3000 to see the app
- Run `npm test` to run the engine unit tests (Node's built-in test runner)
- Run `npm run build` for a production build (output: `public/app.js`, `public/app.css`; serve the `public/` folder)

Tested with Node v24.15.0.

## Features

- **Blocks** (only those required by the assignment):
  - Motion: `move [10] steps`, `turn [15] degrees`, `go to x: [0] y: [0]`
  - Looks: `say [Hello!] for [2] seconds`, `think [Hmm...] for [2] seconds`
  - Control: `repeat [10] { … }` with any number of nested blocks, including nested repeats
- **Drag and drop**: drag blocks from the palette into the workspace. Blocks snap below other blocks or into a
  repeat's mouth. Dragging a block moves it together with the blocks below it, as in Scratch.
  Drop a block on the palette to delete it. Inputs are editable inline.
- **Click to run**: clicking a palette block without dragging it runs it once on the selected sprite, as in
  Scratch. Clicking an empty repeat does nothing. Clicking is disabled while Play is running.
- **Multiple sprites**: add Cat or Horse sprites. Each sprite keeps its own scripts; select a sprite to edit them.
  Drag sprites on the stage (or edit x / y / direction) to set their starting position.
- **Play / Stop / Reset**:
  - **Play** runs every script of every sprite at once. No "when green flag clicked" block is needed.
    Disconnected stacks run concurrently. Pressing Play again while running is ignored.
  - **Stop** halts all scripts, including pending say/think timers, and clears bubbles.
  - **Reset** stops and moves sprites back to their starting positions. Scripts are kept.
  - Editing is locked while scripts run.

## Hero feature: collision-based program swap

When two sprites touch during Play, they **exchange the programs they are currently running**.
This swaps whole programs (repeat structure, parameters, turn, go to, say, think, every stack), not just
move values.

- Programs are captured when Play is pressed. Each sprite has a *current runtime assignment*.
- When a pair enters contact, their current assignments are swapped atomically. Both sprites' threads stop and
  their bubbles clear. Each sprite then restarts the received program from the beginning, keeping its own
  position, direction and costume.
- A later collision swaps the *current* assignments again; it does not restore the originals.
- Each touching pair triggers one swap. The pair re-arms only after the sprites separate by more than 2 units.
  A sprite takes part in at most one swap per frame. Sprites already overlapping when Play starts don't swap
  until they separate.
- Authored scripts in the editor are never modified, so Reset and the next Play use them unchanged.
- The UI shows a status line ("Cat ⇄ Horse swapped programs (swap #n)"). Each sprite tile shows which sprite's
  program it is running ("▶ own script" or "▶ Horse's").

**Load Collision Demo** replaces the scene (after a confirmation if scripts exist) with:
Cat at (-120, 0) running `repeat 20 { move 10 }` and Horse at (120, 0) running `repeat 20 { move -10 }`.
Both face right. Press Play: they approach, touch, swap once, then move apart running each other's program.

Limitations:
- Collision uses axis-aligned boxes the size of each sprite's artwork, centred on the sprite. Rotation and
  transparent pixels are ignored.
- Collision is checked once per frame (30 fps) after all scripts have stepped. A sprite moving more than its own
  width in one frame (for example a `go to` jump across another sprite) could pass through without a hit.
- Sprites are kept fully inside the 480×360 stage: their bounding box is clamped to the stage edges.
- Motion is instant per block, as in Scratch. Visible animation comes from `repeat`, which advances one step per
  frame, so short repeats finish quickly (the demo collides after about 0.25 s).

## Architecture

```
src/
  App.js                 wiring: editor state, sprite actions, layout
  engine/                plain JS, no React; unit tested in test/
    blocks.js            block definitions, palette restriction, script-tree operations
    runtime.js           tick-based interpreter
    collision.js         collision-swap plugin
    scene.js             sprite creation, collision demo, sprite sizes
  hooks/
    useRuntime.js        owns the Runtime and mirrors its state into React
    useBlockDrag.js      pointer drag and drop: hit-testing, snapping, click-to-run
  components/
    Sidebar.js           block palette
    MidArea.js           script workspace
    Block.js             block renderer shared by palette, workspace and drag ghost
    PreviewArea.js       playback controls, collision status, stage, sprite panel
    Stage.js             stage with sprites and speech/thought bubbles
    SpritePanel.js       selected-sprite position fields and sprite list
    Icon.js              icon sprite sheet (from the starter)
    sprites/             Cat and Horse artwork
```

- `src/engine/blocks.js`: block definitions, the palette restriction (`CATEGORIES`), and pure script-tree
  operations (insert / move / delete / clone / `applyDrop`).
- `src/engine/runtime.js`: a tick-based interpreter at 30 ticks/s. Each stack runs as a generator "thread".
  Motion blocks are instant, a repeat yields one frame per iteration, and say/think wait for their duration.
  Programs are deep-cloned at Play, so edits never affect a running thread.
  `runProgram(spriteId, program, origin)` replaces the program of a single sprite. Plugins get
  `onStart` / `afterTick` / `onHalt` callbacks, and `afterTick` runs with positions up to date.
- `src/engine/collision.js`: the `CollisionSwap` plugin (bounding-box overlap, contact tracking, atomic swap).

Stage coordinates follow Scratch: 480×360, origin at the centre, y up, direction 90 = right.
