let logs = [];
let maxEntries = 1000;
let _containerEl = null;
let _logCountEl = null;

export function init(containerSelector = '#log-container', countSelector = '#log-count', max = 1000) {
  _containerEl = document.querySelector(containerSelector);
  _logCountEl  = document.querySelector(countSelector);
  maxEntries   = max;
}

export function info(message, data = null) {
  _write('INFO', message, data);
}

export function warn(message, data = null) {
  _write('WARN', message, data);
}

export function error(message, data = null) {
  _write('ERROR', message, data);
}

export function download() {
  const lines = logs.map(e => {
    const dataStr = e.data !== null
      ? ' | ' + (typeof e.data === 'string' ? e.data : JSON.stringify(e.data))
      : '';
    return `[${e.timestamp}] [${e.level.padEnd(5)}] ${e.message}${dataStr}`;
  });

  const header = [
    '='.repeat(70),
    'Журнал подій — Апроксимація функцій (Генетичний алгоритм)',
    `Дата генерації: ${new Date().toLocaleString('uk-UA')}`,
    `Кількість записів: ${lines.length}`,
    '='.repeat(70),
    '',
  ];

  const content = [...header, ...lines].join('\n');
  _triggerDownload(content, 'app.log', 'text/plain;charset=utf-8');
  info('Журнал завантажено');
}

export function clear() {
  logs = [];
  if (_containerEl) _containerEl.innerHTML = '';
  _updateCount();
}

function _write(level, message, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, data };

  logs.push(entry);
  if (logs.length > maxEntries) logs.shift();

  const prefix = `[${timestamp.slice(11, 23)}] [${level}]`;
  if (level === 'ERROR')     console.error(prefix, message, data ?? '');
  else if (level === 'WARN') console.warn(prefix, message, data ?? '');
  else                       console.log(prefix, message, data ?? '');

  _appendToUI(entry);
  _updateCount();
}

function _appendToUI(entry) {
  if (!_containerEl) return;

  const time  = entry.timestamp.slice(11, 19);
  const level = entry.level.toLowerCase();

  const row = document.createElement('div');
  row.className = `log-entry log-${level}`;

  const badge = document.createElement('span');
  badge.className = `log-badge log-badge-${level}`;
  badge.textContent = entry.level;

  const timeSpan = document.createElement('span');
  timeSpan.style.color = '#475569';
  timeSpan.style.marginRight = '0.4rem';
  timeSpan.textContent = time;

  const msgSpan = document.createElement('span');
  msgSpan.textContent = entry.message;

  row.appendChild(badge);
  row.appendChild(timeSpan);
  row.appendChild(msgSpan);

  if (entry.data !== null) {
    const dataSpan = document.createElement('span');
    dataSpan.style.color = '#475569';
    dataSpan.style.marginLeft = '0.4rem';
    dataSpan.textContent = typeof entry.data === 'string'
      ? entry.data
      : JSON.stringify(entry.data);
    row.appendChild(dataSpan);
  }

  _containerEl.appendChild(row);
  _containerEl.parentElement?.scrollTo?.({
    top: _containerEl.parentElement.scrollHeight,
    behavior: 'smooth',
  });
}

function _updateCount() {
  if (!_logCountEl) return;
  _logCountEl.textContent = `${logs.length} записів`;
}

function _triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
