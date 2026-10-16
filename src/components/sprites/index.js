import CatSprite from "./CatSprite";
import HorseSprite from "./HorseSprite";
import { SPRITE_SIZES } from "../../engine/scene";

// Artwork for each sprite kind. Sizes live in the engine (used for collisions and stage fencing).
export const SPRITE_ART = {
  cat: { Component: CatSprite, ...SPRITE_SIZES.cat },
  horse: { Component: HorseSprite, ...SPRITE_SIZES.horse },
};

export const SPRITE_KINDS = Object.keys(SPRITE_ART);
