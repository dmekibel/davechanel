// DEPRECATED — use os-mode.js directly.
// Icons follow the OS mode now. New code should import from ./os-mode.js.

import { apply, getMode, setMode, MODE_LIST } from "./os-mode.js";

export const ICON_THEMES = MODE_LIST.map(m => ({ id: m.id, label: m.label }));
export const getIconTheme = getMode;
export const setIconTheme = setMode;
export const applyIconTheme = apply;
