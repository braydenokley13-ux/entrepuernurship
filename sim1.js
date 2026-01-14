// entrepreneurship/sim1.js
"use strict";

/**
 * Sim 1: Unit Economics
 * Runs in-browser, no bundler. Requires Chart.js loaded globally as `Chart`.
 */

const sim1Config = {
  initialCash: 5000,
  fixedCost: 1000, // per period
  variableCost: 10, // per unit
  minPrice: 5,
  maxPrice: 50,
  baseDemandAtLowPrice: 200,
  demandSlope: 4,
  periodsPerRun: 10,
  tickMs: 1500,
};

let sim1State = null;
let sim1IntervalId = null;
let sim1Charts = null;

window.addEventListener("DOMContentLoaded", () => {
  sim1Init();
});

function sim1Init() {
  assertChartAvailable();

  const defaultPrice = 20;
  const defaultCapacity = 100;

  setPriceUI(defaultPrice);
  setCapacityUI(defaultCapacity);

  sim1State = createInitialSim1State();

  hookSim1Controls();

  sim1Charts = createSim1Charts();
  renderSim1Charts(sim1State, sim1Charts);
  renderSim1Stats(sim1State);
  renderSim1Outcome("");

  document.getElementById("sim1-start").addEventListener("click", sim1StartRun);
  document.getElementById("sim1-reset").addEventListener("click", sim1Reset);
}

function assertChartAvailable() {
  if (typeof Chart === "undefined") {
    throw new Error("Chart.js not found. Ensure Chart.js CDN is loaded before sim1.js.");
  }
}

function createInitialSim1State() {
  return {
    period: 0,
    cash: sim1Config.initialCash,
    price: getSim1PriceFromUI(),
    capacity: getSim1CapacityFromUI(),
    history: {
      cash: [],
      runway: [],
      demand: [],
      sold: [],
      marginPerUnit: [],
      profit: [],
    },
    finished: false,
    failed: false,
    totalProfit: 0,
    lastTick: null,
  };
}

function hookSim1Controls() {
  const priceSlider = document.getElementById("sim1-price");
  const priceNum = document.getElementById("sim1-price-num");
  const capSlider = document.getElementById("sim1-capacity");
  const capNum = document.getElementById("sim1-capacity-num");

  const syncPriceFromSlider = () => {
    priceNum.value = priceSlider.value;
    if (sim1State) sim1State.price = clampNumber(+priceSlider.value, sim1Config.minPrice, sim1Config.maxPrice);
    renderSim1Stats(sim1State);
  };

  const syncPriceFromNum = () => {
    const v = clampNumber(+priceNum.value, sim1Config.minPrice, sim1Config.maxPrice);
    priceNum.value = String(v);
    priceSlider.value = String(v);
    if (sim1State) sim1State.price = v;
    renderSim1Stats(sim1State);
  };

  const syncCapFromSlider = () => {
    capNum.value = capSlider.value;
    if (sim1State) sim1State.capacity = clampInt(+capSlider.value, 10, 200);
    renderSim1Stats(sim1State);
  };

  const syncCapFromNum = () => {
    const v = clampInt(+capNum.value, 10, 200);
    capNum.value = String(v);
    capSlider.value = String(v);
    if (sim1State) sim1State.capacity = v;
    renderSim1Stats(sim1State);
  };

  priceSlider.addEventListener("input", syncPriceFromSlider);
  priceNum.addEventListener("input", syncPriceFromNum);

  capSlider.addEventListener("input", syncCapFromSlider);
  capNum.addEventListener("input", syncCapFromNum);
}

function sim1StartRun() {
  stopSim1Interval();

  sim1State = createInitialSim1State();
  sim1State.price = getSim1PriceFromUI();
  sim1State.capacity = getSim1CapacityFromUI();

  clearCharts(sim1Charts);
  renderSim1Outcome("");
  renderSim1Stats(sim1State);

  sim1IntervalId = window.setInterval(sim1Tick, sim1Config.tickMs);
  // Run first tick immediately so it feels responsive.
  sim1Tick();
}

function sim1Reset() {
  stopSim1Interval();
  sim1State = createInitialSim1State();

  setPriceUI(20);
  setCapacityUI(100);

  sim1State.price = getSim1PriceFromUI();
  sim1State.capacity = getSim1CapacityFromUI();

  clearCharts(sim1Charts);
  renderSim1Charts(sim1State, sim1Charts);
  renderSim1Stats(sim1State);
  renderSim1Outcome("");
}

function stopSim1Interval() {
  if (sim1IntervalId) {
    clearInterval(sim1IntervalId);
    sim1IntervalId = null;
  }
}

function sim1Tick() {
  if (!sim1State || sim1State.finished) {
    stopSim1Interval();
    return;
  }

  const price = sim1State.price;
  const capacity = sim1State.capacity;

  // 1) Demand curve
  const demand = computeSim1Demand(price);

  // 2) Sales + financials
  const sold = Math.min(demand, capacity);
  const revenue = sold * price;
  const variableCost = sold * sim1Config.variableCost;
  const totalCost = sim1Config.fixedCost + variableCost;
  const profit = revenue - totalCost;

  // 3) Cash + runway
  sim1State.cash += profit;
  const burn = totalCost - revenue; // positive means burning
  const runway = burn > 0 ? sim1State.cash / burn : Infinity;
  const marginPerUnit = sold > 0 ? price - sim1Config.variableCost : 0;

  // 4) History
  sim1State.history.cash.push(sim1State.cash);
  sim1State.history.runway.push(runway === Infinity ? null : runway);
  sim1State.history.demand.push(demand);
  sim1State.history.sold.push(sold);
  sim1State.history.marginPerUnit.push(marginPerUnit);
  sim1State.history.profit.push(profit);

  // 5) Aggregates
  sim1State.totalProfit += profit;
  sim1State.lastTick = { demand, sold, revenue, totalCost, profit, runway, marginPerUnit };

  // 6) Period + finish checks
  sim1State.period += 1;

  if (sim1State.cash <= 0) {
    sim1State.failed = true;
    sim1State.finished = true;
    handleSim1End();
    return;
  }

  if (sim1State.period >= sim1Config.periodsPerRun) {
    sim1State.finished = true;
    handleSim1End();
    return;
  }

  // 7) Render
  renderSim1Charts(sim1State, sim1Charts);
  renderSim1Stats(sim1State);
}

function computeSim1Demand(price) {
  const { baseDemandAtLowPrice, demandSlope, minPrice } = sim1Config;
  const delta = price - minPrice;
  const demand = baseDemandAtLowPrice - demandSlope * delta;
  return Math.max(0, Math.round(demand));
}

function handleSim1End() {
  stopSim1Interval();
  renderSim1Charts(sim1State, sim1Charts);
  renderSim1Stats(sim1State);

  const score = computeSim1FrontierScore(sim1State);

  if (sim1State.failed) {
    renderSim1Outcome(
      [
        `<h3>Outcome: You ran out of cash.</h3>`,
        `<p>Your cash hit $0 (or below) before the end of the run.</p>`,
        `<ul>`,
        `<li>Try raising price to improve margin.</li>`,
        `<li>Or reduce capacity so you don’t overbuild against demand.</li>`,
        `</ul>`,
      ].join("")
    );
  } else {
    renderSim1Outcome(
      [
        `<h3>Outcome: Run complete ✅</h3>`,
        `<p><strong>Total Profit:</strong> $${score.totalProfit.toFixed(0)}</p>`,
        `<p><strong>Average Capacity Utilization:</strong> ${(score.avgUtilization * 100).toFixed(1)}%</p>`,
        `<p><strong>Average Margin per Unit:</strong> $${score.avgMarginPerUnit.toFixed(2)}</p>`,
        `<p class="hint">Try a different strategy: high price / low capacity vs low price / higher capacity.</p>`,
      ].join("")
    );
  }
}

function computeSim1FrontierScore(state) {
  const n = state.history.sold.length || 1;
  const totalSold = state.history.sold.reduce((a, b) => a + b, 0);
  const avgUtilization = totalSold / ((state.capacity || 1) * n);
  const avgMarginPerUnit = state.history.marginPerUnit.reduce((a, b) => a + b, 0) / n;

  return {
    totalProfit: state.totalProfit,
    avgUtilization,
    avgMarginPerUnit,
  };
}

/* --------------------------- Charts --------------------------- */

function createSim1Charts() {
  const cashCtx = document.getElementById("sim1-cash-chart");
  const runwayCtx = document.getElementById("sim1-runway-chart");
  const demandCtx = document.getElementById("sim1-demand-chart");

  const cashChart = new Chart(cashCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Cash ($)",
          data: [],
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: baseChartOptions({
      yTitle: "Cash",
    }),
  });

  const runwayChart = new Chart(runwayCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Runway (periods)",
          data: [],
          tension: 0.25,
          pointRadius: 2,
          spanGaps: true,
        },
      ],
    },
    options: baseChartOptions({
      yTitle: "Runway",
      suggestedMax: 20,
    }),
  });

  const demandChart = new Chart(demandCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Demand (units)",
          data: [],
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Sold (units)",
          data: [],
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: baseChartOptions({
      yTitle: "Units",
    }),
  });

  return { cashChart, runwayChart, demandChart };
}

function baseChartOptions({ yTitle, suggestedMax } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        title: { display: true, text: "Period" },
      },
      y: {
        title: { display: true, text: yTitle || "" },
        suggestedMax: suggestedMax,
      },
    },
  };
}

function renderSim1Charts(state, charts) {
  if (!charts || !state) return;

  const labels = state.history.cash.map((_, i) => String(i + 1));

  charts.cashChart.data.labels = labels;
  charts.cashChart.data.datasets[0].data = state.history.cash;
  charts.cashChart.update();

  charts.runwayChart.data.labels = labels;
  charts.runwayChart.data.datasets[0].data = state.history.runway;
  charts.runwayChart.update();

  charts.demandChart.data.labels = labels;
  charts.demandChart.data.datasets[0].data = state.history.demand;
  charts.demandChart.data.datasets[1].data = state.history.sold;
  charts.demandChart.update();
}

function clearCharts(charts) {
  if (!charts) return;
  for (const key of Object.keys(charts)) {
    const chart = charts[key];
    chart.data.labels = [];
    for (const ds of chart.data.datasets) ds.data = [];
    chart.update();
  }
}

/* --------------------------- UI helpers --------------------------- */

function renderSim1Stats(state) {
  const el = document.getElementById("sim1-stats");
  if (!el || !state) return;

  const last = state.lastTick;

  const cash = formatMoney(state.cash);
  const price = formatMoney(state.price);
  const cap = state.capacity;

  const periodLine = `${state.period}/${sim1Config.periodsPerRun}`;
  const lastProfit = last ? formatMoney(last.profit) : "—";
  const lastDemand = last ? String(last.demand) : "—";
  const lastSold = last ? String(last.sold) : "—";
  const lastMargin = last ? formatMoney(last.marginPerUnit) : "—";
  const lastRunway = last ? (last.runway === Infinity ? "∞" : last.runway.toFixed(1)) : "—";

  el.innerHTML = [
    `<div class="stat-row"><span>Period</span><strong>${periodLine}</strong></div>`,
    `<div class="stat-row"><span>Cash</span><strong>${cash}</strong></div>`,
    `<div class="stat-row"><span>Price</span><strong>${price}</strong></div>`,
    `<div class="stat-row"><span>Capacity</span><strong>${cap}</strong></div>`,
    `<hr />`,
    `<div class="stat-row"><span>Last Profit</span><strong>${lastProfit}</strong></div>`,
    `<div class="stat-row"><span>Last Demand</span><strong>${lastDemand}</strong></div>`,
    `<div class="stat-row"><span>Last Sold</span><strong>${lastSold}</strong></div>`,
    `<div class="stat-row"><span>Last Margin/unit</span><strong>${lastMargin}</strong></div>`,
    `<div class="stat-row"><span>Runway</span><strong>${lastRunway}</strong></div>`,
  ].join("");
}

function renderSim1Outcome(html) {
  const el = document.getElementById("sim1-outcome");
  if (!el) return;
  el.innerHTML = html || "";
}

function getSim1PriceFromUI() {
  return clampNumber(+document.getElementById("sim1-price").value, sim1Config.minPrice, sim1Config.maxPrice);
}

function getSim1CapacityFromUI() {
  return clampInt(+document.getElementById("sim1-capacity").value, 10, 200);
}

function setPriceUI(value) {
  const v = clampNumber(+value, sim1Config.minPrice, sim1Config.maxPrice);
  document.getElementById("sim1-price").value = String(v);
  document.getElementById("sim1-price-num").value = String(v);
}

function setCapacityUI(value) {
  const v = clampInt(+value, 10, 200);
  document.getElementById("sim1-capacity").value = String(v);
  document.getElementById("sim1-capacity-num").value = String(v);
}

/* --------------------------- Utils --------------------------- */

function clampNumber(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function clampInt(v, min, max) {
  const n = Number.isFinite(v) ? Math.round(v) : min;
  return Math.min(max, Math.max(min, n));
}

function formatMoney(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(0)}`;
}
