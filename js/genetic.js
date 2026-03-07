import { info } from './logger.js';

export async function runGeneticAlgorithm(params, dataPoints, onProgress = null, shouldStop = () => false) {
  const popSize    = params.populationSize;
  const maxGen     = params.generations;
  const mutRate    = params.mutationRate;
  const crossRate  = params.crossoverRate;
  const degree     = params.degree;
  const eliteCount = Math.min(params.eliteCount, Math.max(1, Math.floor(params.populationSize * 0.2)));
  const tourSize   = params.tournamentSize ?? 5;
  const coefMin    = params.coefMin ?? -10;
  const coefMax    = params.coefMax ?? 10;
  const patience   = params.patience ?? 60;
  const chromLen   = degree + 1;

  function initPopulation() {
    const span = coefMax - coefMin;
    return Array.from({ length: popSize }, () =>
      Array.from({ length: chromLen }, () => coefMin + Math.random() * span),
    );
  }

  function evolve(population, fitArr, gen) {
    const sorted = population
      .map((c, i) => ({ c, f: fitArr[i] }))
      .sort((a, b) => b.f - a.f);

    const newPop = sorted.slice(0, eliteCount).map(e => [...e.c]);

    const sigmaStart = (coefMax - coefMin) * 0.25;
    const sigma      = Math.max(0.01, sigmaStart * (1 - gen / maxGen));

    while (newPop.length < popSize) {
      const p1       = tournament(population, fitArr);
      const p2       = tournament(population, fitArr);
      const [c1, c2] = crossover(p1, p2);
      newPop.push(mutate(c1, sigma));
      if (newPop.length < popSize) newPop.push(mutate(c2, sigma));
    }

    return newPop;
  }

  function tournament(population, fitArr) {
    let bestIdx = (Math.random() * population.length) | 0;
    for (let i = 1; i < tourSize; i++) {
      const idx = (Math.random() * population.length) | 0;
      if (fitArr[idx] > fitArr[bestIdx]) bestIdx = idx;
    }
    return population[bestIdx];
  }

  function crossover(p1, p2) {
    if (Math.random() > crossRate) return [[...p1], [...p2]];
    const c1 = new Array(chromLen);
    const c2 = new Array(chromLen);
    for (let i = 0; i < chromLen; i++) {
      const a = Math.random();
      c1[i]   = a * p1[i] + (1 - a) * p2[i];
      c2[i]   = (1 - a) * p1[i] + a * p2[i];
    }
    return [c1, c2];
  }

  function mutate(chromosome, sigma) {
    return chromosome.map(gene => {
      if (Math.random() >= mutRate) return gene;
      const u1 = Math.max(Math.random(), 1e-15);
      const u2 = Math.random();
      const g  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return gene + g * sigma;
    });
  }

  function evalPoly(chromosome, x) {
    let result = 0;
    for (let i = chromosome.length - 1; i >= 0; i--) {
      result = result * x + chromosome[i];
    }
    return result;
  }

  function calcMse(chromosome) {
    let sum = 0;
    for (const [x, y] of dataPoints) {
      const p = evalPoly(chromosome, x);
      if (!isFinite(p)) return Infinity;
      const d = p - y;
      sum += d * d;
    }
    return sum / dataPoints.length;
  }

  function calcFitness(chromosome) {
    const err = calcMse(chromosome);
    return isFinite(err) ? 1 / (1 + err) : 0;
  }

  function calcR2(coefficients) {
    const ys    = dataPoints.map(([, y]) => y);
    const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    if (ssTot < 1e-15) return 1;
    const ssRes = dataPoints.reduce((s, [x, y]) => {
      const d = y - evalPoly(coefficients, x);
      return s + d * d;
    }, 0);
    return Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  }

  function argmax(arr) {
    let idx = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > arr[idx]) idx = i;
    }
    return idx;
  }

  // ── Головний цикл ──────────────────────────────────────────────────────

  info('ГА: запуск', {
    ступінь:     degree,
    популяція:   popSize,
    поколінь:    maxGen,
    мутація:     mutRate,
    схрещування: crossRate,
    точок:       dataPoints.length,
  });

  const history = { bestFitness: [], avgFitness: [], bestMSE: [] };

  let population     = initPopulation();
  let bestChrom      = [...population[0]];
  let bestFitnessAll = -Infinity;
  let noImprovCount  = 0;
  let doneGens       = 0;

  for (let gen = 0; gen < maxGen; gen++) {
    if (shouldStop()) {
      info(`ГА: зупинено на поколінні ${gen}`);
      break;
    }

    const fitArr  = population.map(c => calcFitness(c));
    const bestIdx = argmax(fitArr);
    const bestFit = fitArr[bestIdx];
    const avgFit  = fitArr.reduce((s, v) => s + v, 0) / fitArr.length;
    const bestMSE = calcMse(population[bestIdx]);

    history.bestFitness.push(bestFit);
    history.avgFitness.push(avgFit);
    history.bestMSE.push(bestMSE);
    doneGens = gen + 1;

    if (bestFit > bestFitnessAll) {
      bestFitnessAll = bestFit;
      bestChrom      = [...population[bestIdx]];
      noImprovCount  = 0;
    } else {
      noImprovCount++;
    }

    if (gen % 5 === 0 || gen === maxGen - 1) {
      if (onProgress) {
        onProgress({
          generation:       gen,
          totalGenerations: maxGen,
          bestFitness:      bestFit,
          bestMSE,
          bestCoefficients: [...population[bestIdx]],
          history,
        });
      }
      await new Promise(r => setTimeout(r, 0));
    }

    if (noImprovCount >= patience) {
      info(`ГА: рання зупинка — ${patience} поколінь без покращення (ген. ${gen})`);
      break;
    }

    population = evolve(population, fitArr, gen);
  }

  const finalMSE = calcMse(bestChrom);
  const finalR2  = calcR2(bestChrom);

  info('ГА: завершено', {
    поколінь: doneGens,
    MSE:      finalMSE.toExponential(4),
    R2:       finalR2.toFixed(4),
  });

  return { coefficients: bestChrom, mse: finalMSE, r2: finalR2, history };
}
