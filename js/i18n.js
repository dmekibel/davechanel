// Minimal i18n. EN strings are keys; RU has the translations.
// Pixel-font wordmarks (logo, etc.) are intentionally NOT translated to
// keep them readable — Cyrillic in VT323 looked bad. Body text is Tahoma
// which has full Cyrillic and renders cleanly.

const KEY = "site.lang";

const RU = {
  // Start button + tray
  "Start": "Пуск",

  // Login screen
  "portfolio website.": "сайт-портфолио.",
  "Commercial and fine art work.": "Коммерческие и художественные работы.",
  "To begin, click your user": "Чтобы войти, нажмите на пользователя",
  "No password required. Click your name to enter the desktop.":
    "Пароль не требуется. Нажмите имя, чтобы войти.",
  "Shut Down": "Выключить",
  "Sleep": "Сон",

  // Start menu items
  "My Computer": "Мой компьютер",
  "Programs": "Программы",
  "Documents": "Документы",
  "Settings": "Настройки",
  "Find...": "Найти...",
  "Help": "Справка",
  "Run...": "Выполнить...",
  "Log Out": "Выйти",
  "Restart": "Перезагрузка",
  "Accessories": "Стандартные",
  "Welcome": "Добро пожаловать",
  "Screensaver": "Заставка",
  "About Me": "Обо мне",
  "About Me.txt": "Обо мне.txt",
  "Showreel": "Демо",
  "Contact": "Контакты",
  "Fine Art": "Изобразительное искусство",
  "Balancē Creative": "Balancē Creative",
  "Display Properties...": "Свойства экрана...",
  "Control Panel": "Панель управления",
  "Recycle Bin": "Корзина",

  // File explorer
  "Address:": "Адрес:",
  "Back": "Назад",
  "Forward": "Вперёд",
  "Up": "Вверх",
  "Up One Level": "На уровень выше",
  "File": "Файл",
  "Edit": "Правка",
  "View": "Вид",
  "Go": "Переход",
  "Favorites": "Избранное",
  "Tools": "Сервис",
  "Open": "Открыть",
  "Close": "Закрыть",
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
  "Home": "Домой",
  "Add to Favorites": "Добавить в избранное",
  "Folder Options": "Свойства папки",
  "About this portfolio": "О сайте",
  "(this folder is empty)": "(папка пуста)",
  "object(s)": "объект(ов)",

  // Welcome window
  "Discover My Work": "Мои работы",
  "Get In Touch": "Контакты",
  "Tips": "Советы",
  "CONTENTS": "СОДЕРЖАНИЕ",
  "< Back": "< Назад",
  "Next >": "Далее >",
  "Show this screen each time the site loads.":
    "Показывать этот экран при каждой загрузке.",

  // Context menu
  "Arrange Icons by name": "Упорядочить значки по имени",
  "View — Large Icons": "Вид — Крупные значки",
  "View — Small Icons": "Вид — Мелкие значки",
  "View — List": "Вид — Список",

  // Settings
  "Background": "Фон",
  "Screen Saver": "Заставка",
  "Appearance": "Оформление",
  "Effects": "Эффекты",
  "OK": "ОК",
  "Cancel": "Отмена",
  "Apply": "Применить",
  "Wallpaper": "Обои",
  "Display": "Экран",
  "Colors": "Цвета",
  "Screen area": "Размер экрана",
  "Default Monitor": "Стандартный монитор",

  // Misc
  "David Mekibel 2026": "David Mekibel 2026",
};

let current = (() => {
  try { return localStorage.getItem(KEY) || "en"; }
  catch (_) { return "en"; }
})();

export function getLang() { return current; }

export function setLang(lang) {
  if (lang !== "en" && lang !== "ru") return;
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch (_) {}
  // Update DOM + class flag
  document.documentElement.lang = current;
  if (document.body) {
    document.body.classList.toggle("lang-ru", current === "ru");
  }
  // Walk all data-i18n elements and re-translate
  applyDomTranslations();
  // Update the tray globe + any login globe code
  document.querySelectorAll(".lang-code").forEach(el => {
    el.textContent = current.toUpperCase();
  });
  // Let the app's modules re-render their own pieces
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: current } }));
}

export function t(key) {
  if (current === "ru") return RU[key] ?? key;
  return key;
}

// Walk a root and translate any [data-i18n] elements.
export function applyDomTranslations(root = document) {
  root.documentElement && (root.documentElement.lang = current);
  if (current === "ru") document.body && document.body.classList.add("lang-ru");
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
}
