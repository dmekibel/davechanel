// Heaven OS — boot

import { initDesktop } from "./desktop.js";
import { shouldShowLogin, showLogin } from "./login.js";

function boot() {
  if (shouldShowLogin()) {
    showLogin(initDesktop);
  } else {
    document.getElementById("login-overlay")?.remove();
    initDesktop();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
