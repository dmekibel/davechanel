// Heaven OS — boot

import { initDesktop } from "./desktop.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDesktop);
} else {
  initDesktop();
}
