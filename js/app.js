import { init as loggerInit, info, error, download as downloadLog } from './logger.js';
import { loadConfig, getConfig } from './config.js';
import { validateDataPoints, validateGAParams } from './validator.js';
import { loadFromFile, downloadResults, formatPolynomial } from './fileHandler.js';
import { initApproximation, initConvergence, updateApproximation, updateConvergence, resetCharts } from './chartRenderer.js';
import { runGeneticAlgorithm } from './genetic.js';

let isRunning     = false;
let stopRequested = false;
let results       = null;
let dataPoints    = [];

// ── Ініціалізація ─────────────────────────────────────────────────────────

async function init() {
  await loadConfig();

  loggerInit('#log-container', '#log-count', getConfig('maxLogEntries', 1000));

  applyConfig();

  const colors = getConfig('chartColors', {});
  initApproximation('approx-chart', colors);
  initConvergence('convergence-chart', colors);

  loadDefaults();
  bindEvents();

  info('Додаток ініціалізовано', { version: getConfig('version', '1.0.0') });
}

function applyConfig() {
  const name    = getConfig('appName', 'Апроксимація функцій (ГА)');
  const version = getConfig('version', '1.0.0');
  document.title = name;
  const titleEl   = document.getElementById('app-title');
  const versionEl = document.getElementById('app-version');
  if (titleEl)   titleEl.textContent   = name;
  if (versionEl) versionEl.textContent = `v${version}`;
}

function loadDefaults() {
  const d = getConfig('defaults', {});
  setVal('populationSize', d.populationSize   ?? 100);
  setVal('generations',    d.generations      ?? 300);
  setVal('mutationRate',   d.mutationRate     ?? 0.1);
  setVal('crossoverRate',  d.crossoverRate    ?? 0.8);
  setVal('degree',         d.polynomialDegree ?? 3);
  setVal('eliteCount',     d.eliteCount       ?? 5);
  setVal('coefMin',        d.coefRangeMin     ?? -10);
  setVal('coefMax',        d.coefRangeMax     ?? 10);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ── Обробники подій ───────────────────────────────────────────────────────

function bindEvents() {
  on('btn-run',          run);
  on('btn-stop',         stop);
  on('btn-clear',        clear);
  on('btn-export',       exportResults);
  on('btn-download-log', downloadLog);
  on('btn-load-file',    loadFile);
  on('btn-example',      loadExample);
  on('btn-toggle-log',   toggleLog);

  ['populationSize', 'generations', 'mutationRate', 'crossoverRate',
   'degree', 'eliteCount', 'coefMin', 'coefMax'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => validateField(id));
  });
}

function on(id, handler) {
  document.getElementById(id)?.addEventListener('click', handler);
}

// ── Запуск / Зупинка ──────────────────────────────────────────────────────

async function run() {
  if (isRunning) return;

  clearErrors();

  const raw        = document.getElementById('data-input')?.value ?? '';
  const dataResult = validateDataPoints(raw);
  if (!dataResult.valid) {
    showErrors('Помилки у вхідних даних', dataResult.errors);
    return;
  }

  const params       = collectParams();
  const paramsResult = validateGAParams(params);
  if (!paramsResult.valid) {
    showErrors('Помилки в параметрах', paramsResult.errors);
    return;
  }

  dataPoints    = dataResult.points;
  isRunning     = true;
  stopRequested = false;

  setUIRunning(true);
  resetCharts();
  updateApproximation(dataPoints, []);

  info('Запуск оптимізації', { точок: dataPoints.length, ...params });

  try {
    results = await runGeneticAlgorithm(
      params,
      dataPoints,
      progress => onProgress(progress),
      () => stopRequested,
    );
    displayResults(results);
    showToast('Оптимізацію завершено успішно!', 'success');
  } catch (err) {
    error('Помилка оптимізації', { message: err.message });
    showToast('Помилка: ' + err.message, 'error');
  } finally {
    isRunning = false;
    setUIRunning(false);
  }
}

function stop() {
  if (!isRunning) return;
  stopRequested = true;
  info('Запит зупинки від користувача');
  showToast('Зупинка після поточного покоління…', 'warning');
}

// ── Прогрес ───────────────────────────────────────────────────────────────

function onProgress({ generation, totalGenerations, bestFitness, bestMSE, bestCoefficients, history }) {
  const pct  = ((generation + 1) / totalGenerations * 100).toFixed(1);
  const bar  = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (bar)  bar.style.width  = `${pct}%`;
  if (text) text.textContent =
    `Покоління ${generation + 1} / ${totalGenerations}  •  MSE: ${bestMSE.toExponential(3)}  •  f: ${bestFitness.toFixed(4)}`;

  const eqEl  = document.getElementById('live-equation');
  const mseEl = document.getElementById('live-mse');
  if (eqEl)  eqEl.textContent  = formatPolynomial(bestCoefficients);
  if (mseEl) mseEl.textContent = bestMSE.toExponential(6);

  if (generation % 10 === 0) {
    updateApproximation(dataPoints, bestCoefficients);
    updateConvergence(history);
  }
}

// ── Відображення результатів ──────────────────────────────────────────────

function displayResults({ coefficients, mse, r2, history }) {
  updateApproximation(dataPoints, coefficients);
  updateConvergence(history);

  setText('result-mse',     mse.toExponential(6));
  setText('result-r2',      r2.toFixed(6));
  setText('result-quality', qualityLabel(r2));
  setText('result-gens',    String(history.bestFitness.length));

  const eq   = formatPolynomial(coefficients);
  const eqEl = document.getElementById('result-equation');
  if (eqEl) eqEl.textContent = eq;
  setText('live-equation', eq);
  setText('live-mse',      mse.toExponential(6));

  const tbody = document.getElementById('coef-table-body');
  if (tbody) {
    tbody.innerHTML = coefficients.map((c, i) => `
      <tr>
        <td class="index-col">a<sub>${i}</sub></td>
        <td class="mono">${c.toFixed(10)}</td>
        <td class="label-col">${coefLabel(i)}</td>
      </tr>
    `).join('');
  }

  const panel = document.getElementById('results-panel');
  if (panel) {
    panel.classList.remove('hidden');
    panel.classList.add('fade-in');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const bar  = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (bar)  bar.style.width  = '100%';
  if (text) text.textContent = `Завершено  •  MSE: ${mse.toExponential(3)}  •  R²: ${r2.toFixed(4)}`;
}

// ── Дії кнопок ────────────────────────────────────────────────────────────

function clear() {
  const inp = document.getElementById('data-input');
  if (inp) inp.value = '';
  dataPoints = [];
  results    = null;
  resetCharts();
  const panel = document.getElementById('results-panel');
  if (panel) panel.classList.add('hidden');
  const bar  = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (bar)  bar.style.width  = '0%';
  if (text) text.textContent = 'Готово до запуску';
  setText('live-equation', '—');
  setText('live-mse',      '—');
  clearErrors();
  info('Дані очищено');
}

function exportResults() {
  if (!results) {
    showToast('Спочатку виконайте оптимізацію', 'warning');
    return;
  }
  const params = collectParams();
  downloadResults({ ...results, dataPoints, params });
}

async function loadFile() {
  try {
    const { filename, points, errors } = await loadFromFile();
    if (errors.length > 0) {
      showErrors(`Попередження при завантаженні "${filename}"`, errors);
    }
    if (points.length > 0) {
      const inp = document.getElementById('data-input');
      if (inp) inp.value = points.map(([x, y]) => `${x},${y}`).join('\n');
      showToast(`Завантажено ${points.length} точок з "${filename}"`, 'success');
      info('Дані з файлу завантажено', { файл: filename, точок: points.length });
    } else {
      showToast('Файл не містить коректних даних', 'error');
    }
  } catch (err) {
    if (err.message !== 'Файл не обрано') {
      error('Помилка завантаження файлу', { error: err.message });
      showToast('Помилка: ' + err.message, 'error');
    }
  }
}

function loadExample() {
  const examples = [
    {
      label: 'y = 0.5x³ − 2x² + x + 3 + шум',
      degree: 3,
      fn: x => 0.5 * x ** 3 - 2 * x ** 2 + x + 3,
      xMin: -3, xMax: 5, step: 0.5, noise: 0.3,
    },
  ];
  const ex     = examples[0];
  const points = [];
  for (let x = ex.xMin; x <= ex.xMax + 1e-9; x += ex.step) {
    const noise = (Math.random() - 0.5) * 2 * ex.noise;
    points.push([+x.toFixed(2), +(ex.fn(x) + noise).toFixed(4)]);
  }
  const inp = document.getElementById('data-input');
  if (inp) inp.value = points.map(([x, y]) => `${x},${y}`).join('\n');
  setVal('degree', ex.degree);
  showToast(`Приклад: ${ex.label}`, 'info');
  info('Завантажено демо-дані', { точок: points.length, функція: ex.label });
}

function toggleLog() {
  const panel = document.getElementById('log-panel');
  const icon  = document.getElementById('log-toggle-icon');
  if (!panel) return;
  const hidden = panel.classList.toggle('hidden');
  if (icon) icon.textContent = hidden ? '▶' : '▼';
}

// ── Валідація полів ───────────────────────────────────────────────────────

function validateField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = parseFloat(el.value);
  let valid = true;

  switch (id) {
    case 'populationSize': valid = Number.isInteger(v) && v >= 10 && v <= 10000; break;
    case 'generations':    valid = Number.isInteger(v) && v >= 10 && v <= 10000; break;
    case 'mutationRate':   valid = !isNaN(v) && v >= 0 && v <= 1;               break;
    case 'crossoverRate':  valid = !isNaN(v) && v >= 0 && v <= 1;               break;
    case 'degree':         valid = Number.isInteger(v) && v >= 1  && v <= 10;   break;
    case 'eliteCount':     valid = Number.isInteger(v) && v >= 1  && v <= 50;   break;
    case 'coefMin':        valid = !isNaN(v);                                    break;
    case 'coefMax':        valid = !isNaN(v);                                    break;
  }

  el.classList.toggle('is-invalid', !valid);
  el.classList.toggle('is-valid',    valid);
}

// ── Збір параметрів ───────────────────────────────────────────────────────

function collectParams() {
  const gi = (id) => parseInt(document.getElementById(id)?.value, 10);
  const gf = (id) => parseFloat(document.getElementById(id)?.value);
  const d  = getConfig('defaults', {});
  return {
    populationSize: gi('populationSize'),
    generations:    gi('generations'),
    mutationRate:   gf('mutationRate'),
    crossoverRate:  gf('crossoverRate'),
    degree:         gi('degree'),
    eliteCount:     gi('eliteCount'),
    tournamentSize: d.tournamentSize ?? 5,
    coefMin:        gf('coefMin'),
    coefMax:        gf('coefMax'),
    patience:       d.patience ?? 60,
  };
}

// ── UI-утиліти ────────────────────────────────────────────────────────────

function setUIRunning(running) {
  const btnRun  = document.getElementById('btn-run');
  const btnStop = document.getElementById('btn-stop');
  const spinner = document.getElementById('spinner');
  if (btnRun)  btnRun.disabled  =  running;
  if (btnStop) btnStop.disabled = !running;
  if (spinner) spinner.classList.toggle('hidden', !running);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showErrors(title, errors) {
  const container = document.getElementById('error-container');
  if (!container) return;
  container.innerHTML = `
    <div class="error-box">
      <p class="error-title">⚠ ${title}</p>
      <ul class="error-list">
        ${errors.map(e => `<li>${e}</li>`).join('')}
      </ul>
    </div>
  `;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearErrors() {
  const container = document.getElementById('error-container');
  if (container) container.innerHTML = '';
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  const hide = () => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(hide, 3500);
  toast.addEventListener('click', () => { clearTimeout(timer); hide(); });
}

function qualityLabel(r2) {
  if (r2 >= 0.99) return '★★★ Відмінна';
  if (r2 >= 0.95) return '★★☆ Добра';
  if (r2 >= 0.80) return '★☆☆ Задовільна';
  return '☆☆☆ Незадовільна';
}

function coefLabel(i) {
  if (i === 0) return 'вільний член';
  if (i === 1) return 'при x';
  return `при x^${i}`;
}

// ── Запуск ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('Критична помилка ініціалізації:', err);
    alert('Не вдалося запустити додаток. Відкрийте консоль браузера для деталей.');
  });
});
