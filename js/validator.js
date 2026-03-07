import { info, warn } from './logger.js';

export function validateDataPoints(raw) {
  const errors = [];
  const points = [];
  const seenX  = new Set();

  if (!raw || raw.trim() === '') {
    return { valid: false, errors: ['Поле даних порожнє. Введіть пари x,y.'], points };
  }

  const lines = raw.trim().split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    const parts = trimmed.split(/[,;\s\t]+/).filter(Boolean);

    if (parts.length < 2) {
      errors.push(`Рядок ${idx + 1}: очікується 2 значення (x та y), отримано "${trimmed}"`);
      return;
    }

    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);

    if (isNaN(x)) {
      errors.push(`Рядок ${idx + 1}: некоректне значення x = "${parts[0]}"`);
      return;
    }
    if (isNaN(y)) {
      errors.push(`Рядок ${idx + 1}: некоректне значення y = "${parts[1]}"`);
      return;
    }
    if (!isFinite(x) || !isFinite(y)) {
      errors.push(`Рядок ${idx + 1}: значення не може бути нескінченним`);
      return;
    }
    if (Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
      errors.push(`Рядок ${idx + 1}: значення занадто велике (максимум ±10⁹)`);
      return;
    }

    const xKey = x.toFixed(10);
    if (seenX.has(xKey)) {
      errors.push(`Рядок ${idx + 1}: повторюване значення x = ${x} (рекомендується унікальний x)`);
    }
    seenX.add(xKey);

    points.push([x, y]);
  });

  if (points.length < 3) {
    errors.push(`Необхідно мінімум 3 точки даних (знайдено: ${points.length})`);
  }
  if (points.length > 5000) {
    errors.push('Занадто багато точок (максимум 5000)');
  }

  if (errors.length > 0) {
    warn('Валідація даних: знайдено помилки', { count: errors.length });
  } else {
    info('Валідація даних: OK', { points: points.length });
  }

  return { valid: errors.length === 0, errors, points };
}

export function validateGAParams(params) {
  const errors = [];
  const int = (v) => Number.isInteger(v);
  const rng = (v, lo, hi) => v >= lo && v <= hi;

  if (!int(params.populationSize) || !rng(params.populationSize, 10, 10000)) {
    errors.push('Розмір популяції: ціле число від 10 до 10 000');
  }
  if (!int(params.generations) || !rng(params.generations, 10, 10000)) {
    errors.push('Кількість поколінь: ціле число від 10 до 10 000');
  }
  if (isNaN(params.mutationRate) || !rng(params.mutationRate, 0, 1)) {
    errors.push('Ймовірність мутації: число від 0.0 до 1.0');
  }
  if (isNaN(params.crossoverRate) || !rng(params.crossoverRate, 0, 1)) {
    errors.push('Ймовірність схрещування: число від 0.0 до 1.0');
  }
  if (!int(params.degree) || !rng(params.degree, 1, 10)) {
    errors.push('Степінь полінома: ціле число від 1 до 10');
  }
  if (!int(params.eliteCount) || !rng(params.eliteCount, 1, 50)) {
    errors.push('Кількість елітних: ціле число від 1 до 50');
  }
  if (params.eliteCount >= params.populationSize) {
    errors.push('Кількість елітних повинна бути менша за розмір популяції');
  }
  if (isNaN(params.coefMin) || isNaN(params.coefMax) || params.coefMin >= params.coefMax) {
    errors.push('Мін. значення коефіцієнтів повинно бути менше макс. значення');
  }
  if (params.coefMax - params.coefMin > 1e6) {
    errors.push('Діапазон коефіцієнтів занадто широкий (максимум 10⁶)');
  }

  if (errors.length > 0) {
    warn('Валідація параметрів ГА: знайдено помилки', { count: errors.length });
  }

  return { valid: errors.length === 0, errors };
}
