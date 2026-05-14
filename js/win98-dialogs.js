// Tiny shared Win98-styled dialogs. Use instead of native prompt/confirm/
// alert — those render as iOS popups on mobile, which breaks the illusion.

export function win98Prompt(message, defaultValue, opts = {}) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "win98-confirm-backdrop";
    const dlg = document.createElement("div");
    dlg.className = "win98-confirm w98-prompt";
    dlg.innerHTML = `
      <div class="win98-confirm-title">${opts.title || "Input"}</div>
      <div class="win98-confirm-body">
        <div class="win98-confirm-icon">?</div>
        <div class="win98-confirm-msg"></div>
      </div>
      <div class="w98-prompt-row">
        <input type="text" class="w98-prompt-input">
      </div>
      <div class="win98-confirm-buttons">
        <button class="win98-confirm-btn win98-confirm-ok">OK</button>
        <button class="win98-confirm-btn win98-confirm-cancel">Cancel</button>
      </div>
    `;
    dlg.querySelector(".win98-confirm-msg").textContent = message;
    const input = dlg.querySelector(".w98-prompt-input");
    input.value = defaultValue || "";
    back.appendChild(dlg);
    document.body.appendChild(back);
    const cleanup = () => back.remove();
    setTimeout(() => { input.focus(); input.select(); }, 30);
    const ok = () => { const v = input.value; cleanup(); resolve(v); };
    const cancel = () => { cleanup(); resolve(null); };
    dlg.querySelector(".win98-confirm-ok").addEventListener("click", ok);
    dlg.querySelector(".win98-confirm-cancel").addEventListener("click", cancel);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); ok(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    back.addEventListener("click", (e) => { if (e.target === back) cancel(); });
  });
}

// Win98 folder picker — pick from a flat list of paths.
// items: [{ label, value, depth }]. Returns the selected `value` or null.
export function win98PickFolder(items, opts = {}) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "win98-confirm-backdrop";
    const dlg = document.createElement("div");
    dlg.className = "win98-confirm w98-folder-picker";
    dlg.innerHTML = `
      <div class="win98-confirm-title">${opts.title || "Save to folder"}</div>
      <div class="w98-fp-body">
        <ul class="w98-fp-list"></ul>
        <label class="w98-fp-filename">File name:
          <input type="text" class="w98-fp-name">
        </label>
      </div>
      <div class="win98-confirm-buttons">
        <button class="win98-confirm-btn win98-confirm-ok">Save</button>
        <button class="win98-confirm-btn win98-confirm-cancel">Cancel</button>
      </div>
    `;
    const listEl = dlg.querySelector(".w98-fp-list");
    let selected = opts.initialPath || (items[0] && items[0].value) || "/";
    for (const it of items) {
      const li = document.createElement("li");
      li.className = "w98-fp-item";
      li.style.paddingLeft = (8 + (it.depth || 0) * 14) + "px";
      li.textContent = it.label;
      li.dataset.value = it.value;
      if (it.value === selected) li.classList.add("selected");
      li.addEventListener("click", () => {
        listEl.querySelectorAll(".selected").forEach(n => n.classList.remove("selected"));
        li.classList.add("selected");
        selected = it.value;
      });
      listEl.appendChild(li);
    }
    const nameInput = dlg.querySelector(".w98-fp-name");
    nameInput.value = opts.defaultName || "";
    back.appendChild(dlg);
    document.body.appendChild(back);
    const cleanup = () => back.remove();
    const ok = () => {
      cleanup();
      resolve({ path: selected, name: nameInput.value.trim() || opts.defaultName });
    };
    const cancel = () => { cleanup(); resolve(null); };
    dlg.querySelector(".win98-confirm-ok").addEventListener("click", ok);
    dlg.querySelector(".win98-confirm-cancel").addEventListener("click", cancel);
    back.addEventListener("click", (e) => { if (e.target === back) cancel(); });
  });
}
