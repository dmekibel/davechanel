// DEPRECATED — use os-mode.js directly.
// This file is a backward-compat shim from when wallpaper was a flat
// 5-option list independent of icon theme. The unified os-mode model
// scopes wallpapers under each mode (win98 / xp). New code should import
// from ./os-mode.js.

import {
  apply,
  getMode,
  getWallpaper as osGetWallpaper,
  setWallpaper as osSetWallpaper,
  MODES,
} from "./os-mode.js";

// Legacy flat list — union of all modes' wallpapers, keeps id+label shape.
export const WALLPAPERS = [
  ...MODES.win98.wallpapers,
  ...MODES.xp.wallpapers,
];

export const getWallpaper = () => osGetWallpaper(getMode());
export const setWallpaper = (id) => osSetWallpaper(id, getMode());
export const applyWallpaper = apply;
