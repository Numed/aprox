/**
 * Unit-тести — Апроксимація функцій (ГА)
 * Запуск: відкрийте tests/unit.html через локальний HTTP-сервер
 */

import { validateDataPoints, validateGAParams } from '../js/validator.js';
import { formatPolynomial } from '../js/fileHandler.js';


let passed = 0;
let failed = 0;
const results = [];

function test(description, fn) {
  try {
    fn();
    passed++;
    results.push({ status: 'PASS', description });
  } catch (e) {
    failed++;
    results.push({ status: 'FAIL', description, error: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      (message ? message + ': ' : '') +
      `очікувалось ${JSON.stringify(expected)}, отримано ${JSON.stringify(actual)}`
    );
  }
}


test('validateDataPoints: порожній рядок → invalid', () => {
  const r = validateDataPoints('');
  assert(!r.valid, 'Має бути invalid');
  assert(r.errors.length > 0, 'Має бути помилка');
});

test('validateDataPoints: тільки пробіли → invalid', () => {
  const r = validateDataPoints('   \n  \t  ');
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('порожнє')));
});

test('validateDataPoints: менше 3 точок → invalid', () => {
  const r = validateDataPoints('1,2\n3,4');
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('мінімум 3')));
});

test('validateDataPoints: рівно 3 коректні точки → valid', () => {
  const r = validateDataPoints('1,2\n3,4\n5,6');
  assert(r.valid, 'Має бути valid');
  assertEquals(r.points.length, 3);
});

test('validateDataPoints: коментарі та порожні рядки ігноруються', () => {
  const raw = '# заголовок\n1,2\n// comment\n\n3,4\n5,6';
  const r = validateDataPoints(raw);
  assert(r.valid);
  assertEquals(r.points.length, 3);
});

test('validateDataPoints: різні роздільники (крапка з комою, пробіл, табуляція)', () => {
  const raw = '1;2\n3 4\n5\t6';
  const r = validateDataPoints(raw);
  assert(r.valid);
  assertEquals(r.points.length, 3);
});

test('validateDataPoints: некоректне значення x → invalid', () => {
  const r = validateDataPoints('abc,1\n2,3\n4,5');
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('некоректне значення x')));
});

test('validateDataPoints: некоректне значення y → invalid', () => {
  const r = validateDataPoints('1,abc\n2,3\n4,5');
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('некоректне значення y')));
});

test('validateDataPoints: значення більше 10^9 → invalid', () => {
  const r = validateDataPoints('1e10,1\n2,3\n4,5');
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('занадто велике')));
});

test('validateDataPoints: більше 5000 точок → invalid', () => {
  const lines = Array.from({ length: 5001 }, (_, i) => `${i},${i}`).join('\n');
  const r = validateDataPoints(lines);
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('5000')));
});

test('validateDataPoints: від\'ємні числа з плаваючою крапкою → valid', () => {
  const r = validateDataPoints('-1.5,2.7\n0,0\n1.5,-2.7');
  assert(r.valid);
  assertEquals(r.points.length, 3);
  assertEquals(r.points[0][0], -1.5);
  assertEquals(r.points[0][1], 2.7);
});

test('validateDataPoints: дублікат x → не блокує виконання (після виправлення BUG-001)', () => {
  const r = validateDataPoints('1,2\n1,5\n3,6');
  assert(r.valid, 'Дублікат x не повинен блокувати виконання');
  assertEquals(r.points.length, 3);
});


const validParams = {
  populationSize: 100,
  generations: 300,
  mutationRate: 0.1,
  crossoverRate: 0.8,
  degree: 3,
  eliteCount: 5,
  coefMin: -10,
  coefMax: 10,
};

test('validateGAParams: коректні параметри → valid', () => {
  const r = validateGAParams(validParams);
  assert(r.valid);
  assertEquals(r.errors.length, 0);
});

test('validateGAParams: populationSize < 10 → invalid', () => {
  const r = validateGAParams({ ...validParams, populationSize: 5 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('популяції')));
});

test('validateGAParams: populationSize > 10000 → invalid', () => {
  const r = validateGAParams({ ...validParams, populationSize: 10001 });
  assert(!r.valid);
});

test('validateGAParams: mutationRate поза [0,1] → invalid', () => {
  const r = validateGAParams({ ...validParams, mutationRate: 1.5 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('мутації')));
});

test('validateGAParams: mutationRate = 0 → valid (гранична умова)', () => {
  const r = validateGAParams({ ...validParams, mutationRate: 0 });
  assert(r.valid, 'mutationRate=0 є допустимим граничним значенням');
});

test('validateGAParams: mutationRate = 1 → valid (гранична умова)', () => {
  const r = validateGAParams({ ...validParams, mutationRate: 1 });
  assert(r.valid, 'mutationRate=1 є допустимим граничним значенням');
});

test('validateGAParams: degree < 1 → invalid', () => {
  const r = validateGAParams({ ...validParams, degree: 0 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('полінома')));
});

test('validateGAParams: degree > 10 → invalid', () => {
  const r = validateGAParams({ ...validParams, degree: 11 });
  assert(!r.valid);
});

test('validateGAParams: coefMin >= coefMax → invalid', () => {
  const r = validateGAParams({ ...validParams, coefMin: 5, coefMax: 5 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('менше макс')));
});

test('validateGAParams: eliteCount >= populationSize → invalid', () => {
  const r = validateGAParams({ ...validParams, eliteCount: 100, populationSize: 100 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('елітних')));
});

test('validateGAParams: дуже широкий діапазон коефіцієнтів → invalid', () => {
  const r = validateGAParams({ ...validParams, coefMin: -1e7, coefMax: 1e7 });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('занадто широкий')));
});


test('formatPolynomial: нульовий поліном → P(x) = 0', () => {
  const r = formatPolynomial([0, 0, 0]);
  assertEquals(r, 'P(x) = 0');
});

test('formatPolynomial: константа → тільки вільний член', () => {
  const r = formatPolynomial([5, 0, 0]);
  assert(r.includes('5.0000'), `Результат: ${r}`);
  assert(!r.includes('x'), `Не повинно містити x: ${r}`);
});

test('formatPolynomial: лінійний → P(x) = b·x + a', () => {
  const r = formatPolynomial([1, 2]);
  assert(r.includes('2.0000·x'), `Результат: ${r}`);
  assert(r.includes('1.0000'), `Результат: ${r}`);
});

test('formatPolynomial: поліном 3-го степеня повертає рядок з P(x) =', () => {
  const coefs = [1, -2, 0.5, 3];
  const r = formatPolynomial(coefs);
  assert(r.startsWith('P(x) ='), `Результат: ${r}`);
  assert(r.includes('x^3'), `Результат: ${r}`);
});

test('formatPolynomial: від\'ємний вільний член', () => {
  const r = formatPolynomial([-3, 1]);
  assert(r.startsWith('P(x) = 1.0000·x'), `Результат: ${r}`);
  assert(r.includes('3.0000'), `Результат: ${r}`);
});


export function renderResults(containerEl) {
  const total = passed + failed;
  const summary = document.createElement('div');
  summary.innerHTML = `
    <h2 style="margin-bottom:0.5rem">
      Результат: ${passed}/${total} тестів пройдено
      ${failed === 0 ? '<span style="color:#10b981">✓ ВСІ ПРОЙДЕНО</span>' : `<span style="color:#ef4444">✗ ${failed} ПРОВАЛЕНО</span>`}
    </h2>`;
  containerEl.appendChild(summary);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.85rem';
  table.innerHTML = `
    <thead>
      <tr style="background:#1e293b">
        <th style="padding:6px 10px;text-align:left;border:1px solid #334155">#</th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #334155">Статус</th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #334155">Тест</th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #334155">Деталі</th>
      </tr>
    </thead>
    <tbody>
      ${results.map((r, i) => `
        <tr style="background:${r.status === 'PASS' ? '#0f2818' : '#2d0f0f'}">
          <td style="padding:5px 10px;border:1px solid #334155">${i + 1}</td>
          <td style="padding:5px 10px;border:1px solid #334155;color:${r.status === 'PASS' ? '#10b981' : '#ef4444'};font-weight:600">${r.status}</td>
          <td style="padding:5px 10px;border:1px solid #334155">${r.description}</td>
          <td style="padding:5px 10px;border:1px solid #334155;color:#94a3b8">${r.error ?? ''}</td>
        </tr>
      `).join('')}
    </tbody>`;
  containerEl.appendChild(table);
}
