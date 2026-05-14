// User-FS: persistent overlay on top of the hard-coded file system.
// Stores user-created folders + saved items (Paint drawings, etc.) in
// localStorage. Anything in here is layered onto FS at render time.
//
// Shape:
//   {
//     "items": {
//       "<path>": [
//         { id, name, kind, type, data?, dataURL?, src?, preview?, thumb?, createdAt }
//       ]
//     }
//   }
//
// Path examples:
//   "desktop"
//   "/"                 (My Computer root)
//   "/Fine Art"
//   "/Documents/My Stuff"
//
// `kind` values: "image", "notepad", "folder" — match the main FS schema.

const KEY = "site.userfs";

function blank() { return { items: {} }; }

export function loadUserFS() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank();
    if (!parsed.items) parsed.items = {};
    return parsed;
  } catch (_) { return blank(); }
}

export function saveUserFS(fs) {
  try { localStorage.setItem(KEY, JSON.stringify(fs)); } catch (e) {
    // localStorage quota exceeded — Paint saves can hit this fast.
    try { window.dispatchEvent(new CustomEvent("userfs-error", { detail: e })); } catch (_) {}
  }
  try { window.dispatchEvent(new CustomEvent("userfs-update")); } catch (_) {}
}

// ---- High-level helpers -----------------------------------------------

export function listItems(path) {
  const fs = loadUserFS();
  return (fs.items[path] || []).slice();
}

export function addItem(path, item) {
  const fs = loadUserFS();
  if (!fs.items[path]) fs.items[path] = [];
  if (!item.id) item.id = "u_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  if (!item.createdAt) item.createdAt = Date.now();
  fs.items[path].push(item);
  saveUserFS(fs);
  return item;
}

export function removeItem(path, id) {
  const fs = loadUserFS();
  if (!fs.items[path]) return;
  fs.items[path] = fs.items[path].filter(it => it.id !== id);
  saveUserFS(fs);
}

export function renameItem(path, id, newName) {
  const fs = loadUserFS();
  const list = fs.items[path];
  if (!list) return;
  const it = list.find(x => x.id === id);
  if (!it) return;
  // If renaming a folder, also rename its path key so children come along.
  if (it.kind === "folder" || it.type === "folder") {
    const oldChildPath = (path === "/" ? "/" : path + "/") + it.name;
    const newChildPath = (path === "/" ? "/" : path + "/") + newName;
    if (fs.items[oldChildPath]) {
      fs.items[newChildPath] = fs.items[oldChildPath];
      delete fs.items[oldChildPath];
    }
  }
  it.name = newName;
  saveUserFS(fs);
}

// Convenience: save a PNG dataURL somewhere with a sensible default name.
export function saveImage(path, dataURL, name) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return addItem(path, {
    name: name || `paint-${stamp}.png`,
    kind: "image",
    type: "file",
    dataURL,
    src: dataURL,
    preview: dataURL,
    thumb: dataURL,
  });
}

export function createFolder(parentPath, name) {
  return addItem(parentPath, {
    name,
    kind: "folder",
    type: "folder",
  });
}
