import { info, error } from './logger.js';

let approxChart      = null;
let convergenceChart = null;

export function initApproximation(canvasId, colors = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) { error('Не знайдено canvas', { id: canvasId }); return; }

  if (approxChart) approxChart.destroy();

  const dataColor = colors.dataPoints ?? 'rgba(99, 102, 241, 0.85)';
  const lineColor = colors.polynomial ?? 'rgba(245, 158, 11, 0.95)';

  approxChart = new Chart(canvas.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Вхідні дані',
          data: [],
          backgroundColor: dataColor,
          pointRadius: 5,
          pointHoverRadius: 7,
          order: 2,
        },
        {
          label: 'Апроксимуючий поліном',
          type: 'line',
          data: [],
          borderColor: lineColor,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.1,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { size: 12 } },
        },
        title: {
          display: true,
          text: 'Апроксимація функції',
          color: '#e2e8f0',
          font: { size: 13, weight: '600' },
          padding: { bottom: 8 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const { x, y } = ctx.parsed;
              return ` x = ${x.toFixed(4)},  y = ${y.toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8 },
          grid:  { color: 'rgba(51,65,85,0.6)' },
          title: { display: true, text: 'x', color: '#64748b' },
        },
        y: {
          ticks: { color: '#64748b', maxTicksLimit: 8 },
          grid:  { color: 'rgba(51,65,85,0.6)' },
          title: { display: true, text: 'y', color: '#64748b' },
        },
      },
    },
  });

  info('Графік апроксимації ініціалізовано');
}

export function initConvergence(canvasId, colors = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) { error('Не знайдено canvas', { id: canvasId }); return; }

  if (convergenceChart) convergenceChart.destroy();

  const bestColor = colors.bestFitness ?? 'rgba(52, 211, 153, 0.9)';
  const avgColor  = colors.avgFitness  ?? 'rgba(251, 191, 36, 0.6)';

  convergenceChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Найкраща пристосованість',
          data: [],
          borderColor: bestColor,
          backgroundColor: bestColor.replace('0.9', '0.1'),
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: 'Середня пристосованість',
          data: [],
          borderColor: avgColor,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { size: 12 } },
        },
        title: {
          display: true,
          text: 'Збіжність алгоритму',
          color: '#e2e8f0',
          font: { size: 13, weight: '600' },
          padding: { bottom: 8 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 10 },
          grid:  { color: 'rgba(51,65,85,0.6)' },
          title: { display: true, text: 'Покоління', color: '#64748b' },
        },
        y: {
          min: 0, max: 1,
          ticks: { color: '#64748b', maxTicksLimit: 6 },
          grid:  { color: 'rgba(51,65,85,0.6)' },
          title: { display: true, text: 'Пристосованість', color: '#64748b' },
        },
      },
    },
  });

  info('Графік збіжності ініціалізовано');
}

export function updateApproximation(dataPoints, coefficients) {
  if (!approxChart) return;

  approxChart.data.datasets[0].data = dataPoints.map(([x, y]) => ({ x, y }));

  if (coefficients && coefficients.length > 0) {
    const xs   = dataPoints.map(([x]) => x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    approxChart.data.datasets[1].data = _samplePolynomial(coefficients, xMin, xMax, 300);
  } else {
    approxChart.data.datasets[1].data = [];
  }

  approxChart.update('none');
}

export function updateConvergence(history) {
  if (!convergenceChart) return;

  const n      = history.bestFitness.length;
  const labels = Array.from({ length: n }, (_, i) => i + 1);

  convergenceChart.data.labels            = labels;
  convergenceChart.data.datasets[0].data  = history.bestFitness;
  convergenceChart.data.datasets[1].data  = history.avgFitness;
  convergenceChart.update('none');
}

export function resetCharts() {
  if (approxChart) {
    approxChart.data.datasets[0].data = [];
    approxChart.data.datasets[1].data = [];
    approxChart.update('none');
  }
  if (convergenceChart) {
    convergenceChart.data.labels            = [];
    convergenceChart.data.datasets[0].data  = [];
    convergenceChart.data.datasets[1].data  = [];
    convergenceChart.update('none');
  }
  info('Графіки скинуто');
}

function _samplePolynomial(coefs, xMin, xMax, steps = 300) {
  const points = [];
  const dx = (xMax - xMin) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = _evalHorner(coefs, x);
    if (isFinite(y) && Math.abs(y) < 1e12) {
      points.push({ x, y });
    }
  }
  return points;
}

function _evalHorner(coefs, x) {
  let r = 0;
  for (let i = coefs.length - 1; i >= 0; i--) {
    r = r * x + coefs[i];
  }
  return r;
}
