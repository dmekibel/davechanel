// Heaven OS — minimal i18n
// EN strings are used as keys; RU values translate them. Missing keys fall through.
// Switching language reloads the page (simpler than re-rendering live).

const KEY = "heaven-os.lang";

const RU = {
  // Tray / start
  "Start": "Пуск",
  "Heaven OS": "Heaven OS",
  "Heaven OS (browse all)": "Heaven OS (обзор)",

  // Desktop icon names
  "My Computer": "Мой компьютер",
  "Fine Art": "Изобразительное искусство",
  "Balancē Creative": "Balancē Creative",
  "About Me.txt": "Обо мне.txt",
  "About Me": "Обо мне",
  "Showreel.mpg": "Демо.mpg",
  "Showreel": "Демо",
  "Contact": "Контакты",
  "Recycle Bin": "Корзина",

  // File explorer chrome
  "Address:": "Адрес:",
  "Back": "Назад",
  "Forward": "Вперёд",
  "Up": "Вверх",
  "(this folder is empty)": "(папка пуста)",

  // Menu bar
  "File": "Файл",
  "Edit": "Правка",
  "View": "Вид",
  "Go": "Переход",
  "Favorites": "Избранное",
  "Tools": "Сервис",
  "Help": "Справка",

  // Menu items
  "Close": "Закрыть",
  "Open": "Открыть",
  "Properties": "Свойства",
  "Cut": "Вырезать",
  "Copy": "Копировать",
  "Paste": "Вставить",
  "Undo": "Отменить",
  "Select All": "Выделить всё",
  "Invert Selection": "Инвертировать выделение",
  "Large Icons": "Крупные значки",
  "Small Icons": "Мелкие значки",
  "List": "Список",
  "Details": "Таблица",
  "Refresh": "Обновить",
  "Up One Level": "На уровень выше",
  "Home": "Домой",
  "Add to Favorites": "Добавить в избранное",
  "Folder Options": "Свойства папки",
  "About Heaven OS": "О Heaven OS",

  // Status bar
  "object(s)": "объект(ов)",

  // Folder content placeholders inside Balancē Creative explorer
  "About the studio.txt": "О студии.txt",
  "Brand Work": "Бренды",
  "Music Industry": "Музыкальная индустрия",
};

const EN = {};   // identity (keys === values)

let current = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "en";

export function getLang() { return current; }

export function setLang(lang) {
  if (lang !== "en" && lang !== "ru") return;
  if (lang === current) return;
  try { localStorage.setItem(KEY, lang); } catch (_) {}
  // Reload the page so every string re-renders cleanly.
  window.location.reload();
}

export function t(key) {
  if (current === "ru") return RU[key] ?? key;
  return EN[key] ?? key;
}

// Apply <html lang="..."> on load
if (typeof document !== "undefined") {
  document.documentElement.lang = current;
}
