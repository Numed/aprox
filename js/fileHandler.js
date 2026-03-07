import { info, error } from './logger.js';

export function loadFromFile() {
  return new Promise((resolve, reject) => {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.csv,.txt,.dat,.tsv';

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error('Файл не обрано'));
        return;
      }

      info('Читання файлу', { name: file.name, size: `${file.size} байт` });

      const reader   = new FileReader();
      reader.onload  = (ev) => {
        const { points, errors } = _parseText(ev.target.result);
        info('Файл прочитано', { points: points.length, errors: errors.length });
        resolve({ filename: file.name, points, errors });
      };
      reader.onerror = () => {
        error('Помилка читання файлу', { name: file.name });
        reject(new Error('Не вдалося прочитати файл'));
      };
      reader.readAsText(file, 'utf-8');
    };

    input.oncancel = () => reject(new Error('Файл не обрано'));
    input.click();
  });
}

export function downloadResults(data) {
  const { coefficients, mse, r2, history, dataPoints, params } = data;
  const now    = new Date().toLocaleString('uk-UA');
  const deg    = coefficients.length - 1;
  const gens   = history.bestFitness.length;
  const bestF  = history.bestFitness[gens - 1]?.toFixed(6) ?? '—';

  const sep     = '─'.repeat(60);
  const polyStr = formatPolynomial(coefficients);

  const header = [
    sep,
    '  Апроксимація функцій — Генетичний алгоритм',
    `  Дата: ${now}`,
    sep,
  ];

  const paramsSection = [
    '',
    '[ ПАРАМЕТРИ АЛГОРИТМУ ]',
    `  Степінь полінома       : ${deg}`,
    `  Розмір популяції       : ${params.populationSize}`,
    `  Кількість поколінь     : ${params.generations} (виконано: ${gens})`,
    `  Ймовірність мутації    : ${params.mutationRate}`,
    `  Ймовірність схрещування: ${params.crossoverRate}`,
    `  Кількість елітних      : ${params.eliteCount}`,
    `  Діапазон коефіцієнтів  : [${params.coefMin}, ${params.coefMax}]`,
  ];

  const resultsSection = [
    '',
    '[ РЕЗУЛЬТАТИ ]',
    `  Поліном : ${polyStr}`,
    `  MSE     : ${mse.toExponential(8)}`,
    `  R²      : ${r2.toFixed(8)}`,
    `  Якість  : ${_qualityLabel(r2)}`,
    `  Остання пристосованість: ${bestF}`,
  ];

  const coefSection = [
    '',
    '[ КОЕФІЦІЄНТИ ]',
    ...coefficients.map((c, i) => `  a${i} = ${c.toFixed(10)}  (при x^${i})`),
  ];

  const dataHeader = [
    '',
    '[ ВХІДНІ ДАНІ ТА ПОХИБКИ ]',
    `  ${'x'.padEnd(16)} ${'y'.padEnd(16)} ${'P(x)'.padEnd(16)} ${'Похибка'.padEnd(16)}`,
    '  ' + '─'.repeat(64),
  ];

  const dataRows = dataPoints.map(([x, y]) => {
    const px  = _evalPoly(coefficients, x);
    const err = y - px;
    return `  ${String(x).padEnd(16)} ${String(y).padEnd(16)} ${px.toFixed(6).padEnd(16)} ${err.toFixed(6)}`;
  });

  const footer = ['', sep, '  Сформовано: Апроксимація функцій v1.0.0', sep];

  const content = [
    ...header,
    ...paramsSection,
    ...resultsSection,
    ...coefSection,
    ...dataHeader,
    ...dataRows,
    ...footer,
  ].join('\n');

  _triggerDownload(content, 'results.txt', 'text/plain;charset=utf-8');
  info('Результати завантажено як results.txt');
}

export function formatPolynomial(coefficients) {
  const terms = [];

  for (let i = coefficients.length - 1; i >= 0; i--) {
    const c = coefficients[i];
    if (Math.abs(c) < 1e-12) continue;

    const absC   = Math.abs(c);
    const sign   = c < 0 ? '−' : '+';
    const valStr = absC.toFixed(4);

    let term;
    if (i === 0)      term = valStr;
    else if (i === 1) term = `${valStr}·x`;
    else              term = `${valStr}·x^${i}`;

    if (terms.length === 0) {
      terms.push(c < 0 ? `−${term}` : term);
    } else {
      terms.push(`${sign} ${term}`);
    }
  }

  return terms.length > 0 ? `P(x) = ${terms.join(' ')}` : 'P(x) = 0';
}

function _parseText(content) {
  const points = [];
  const errors = [];

  const lines = content.trim().split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    const parts = trimmed.split(/[,;\s\t]+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Рядок ${idx + 1}: недостатньо значень`);
      return;
    }

    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);

    if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
      points.push([x, y]);
    } else {
      errors.push(`Рядок ${idx + 1}: некоректні числа ("${parts[0]}", "${parts[1]}")`);
    }
  });

  return { points, errors };
}

function _evalPoly(coefficients, x) {
  let result = 0;
  for (let i = 0; i < coefficients.length; i++) {
    result += coefficients[i] * Math.pow(x, i);
  }
  return result;
}

function _qualityLabel(r2) {
  if (r2 >= 0.99) return 'Відмінна (R² ≥ 0.99)';
  if (r2 >= 0.95) return 'Добра    (R² ≥ 0.95)';
  if (r2 >= 0.80) return 'Задовільна (R² ≥ 0.80)';
  return 'Незадовільна (R² < 0.80)';
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
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
