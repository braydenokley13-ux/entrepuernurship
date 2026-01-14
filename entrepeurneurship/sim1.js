

// ==============================
// entrepreneurship/sim1.js  (REPLACE FILE CONTENT)
// Put this at: entrepreneurship/sim1.js
// Requires: Chart.js + state.js loaded first.
// ==============================
"use strict";

/**
 * Sim 1: Unit Economics
 * - Mid-run lever changes are allowed by default.
 * - Optional lock: disables controls while running if checkbox is checked.
 * - Module progress stored via state.js in localStorage.
 */

const sim1Config = {
  initialCash: 5000,
  fixedCost: 1000,
  variableCost: 10,
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
  assertDeps();

  sim1Init();
  updateModuleCompletionUI(loadModuleProgress());

  const moduleResetBtn = document.getElementById("module-reset");
  moduleResetBtn.addEventListener("click", () => {
    localStorage.removeItem(MODULE_ID);
    updateModuleCompletionUI(loadModuleProgress());
  });
});

function assertDeps() {
  if (typeof Chart === "undefined") {
    throw new Error("Chart.js not found. Ensure Chart.js CDN is loaded before sim1.js.");
  }
  if (typeof loadModuleProgress !== "function" || typeof saveModuleProgress !== "function") {
    throw new Error("state.js not loaded. Ensure state.js is loaded before sim1.js.");
  }
}

function sim1Init() {
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

  applyLeverLocking(true);

  sim1IntervalId = window.setInterval(sim1Tick, sim1Config.tickMs);
  sim1Tick();
}

function sim1Reset() {
  stopSim1Interval();
  applyLeverLocking(false);

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

function applyLeverLocking(isRunning) {
  const lock = document.getElementById("sim1-lock-levers").checked;
  const disabled = !!(isRunning && lock);

  const ids = ["sim1-price", "sim1-price-num", "sim1-capacity", "sim1-capacity-num"];
  for (const id of ids) {
    const el = document.getElementById(id);
    el.disabled = disabled;
  }
}

function sim1Tick() {
  if (!sim1State || sim1State.finished) {
    stopSim1Interval();
    applyLeverLocking(false);
    return;
  }

  const price = sim1State.price;
  const capacity = sim1State.capacity;

  const demand = computeSim1Demand(price);

  const sold = Math.min(demand, capacity);
  const revenue = sold * price;
  const variableCost = sold * sim1Config.variableCost;
  const totalCost = sim1Config.fixedCost + variableCost;
  const profit = revenue - totalCost;

  sim1State.cash += profit;

  const burn = totalCost - revenue;
  const runway = burn > 0 ? sim1State.cash / burn : Infinity;
  const marginPerUnit = sold > 0 ? price - sim1Config.variableCost : 0;

  sim1State.history.cash.push(sim1State.cash);
  sim1State.history.runway.push(runway === Infinity ? null : runway);
  sim1State.history.demand.push(demand);
  sim1State.history.sold.push(sold);
  sim1State.history.marginPerUnit.push(marginPerUnit);
  sim1State.history.profit.push(profit);

  sim1State.totalProfit += profit;
  sim1State.lastTick = { demand, sold, revenue, totalCost, profit, runway, marginPerUnit };

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
  applyLeverLocking(false);

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
    return;
  }

  renderSim1Outcome(
    [
      `<h3>Outcome: Run complete ✅</h3>`,
      `<p><strong>Total Profit:</strong> $${score.totalProfit.toFixed(0)}</p>`,
      `<p><strong>Average Capacity Utilization:</strong> ${(score.avgUtilization * 100).toFixed(1)}%</p>`,
      `<p><strong>Average Margin per Unit:</strong> $${score.avgMarginPerUnit.toFixed(2)}</p>`,
      `<p class="hint">Try a different strategy and watch Profit/Period + Runway.</p>`,
    ].join("")
  );

  markSim1Completed(score);
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

function markSim1Completed(score) {
  const progress = loadModuleProgress();
  progress.sim1Completed = true;

  const frontierScore =
    score.totalProfit *
    (0.5 + 0.5 * score.avgUtilization) *
    (1 + score.avgMarginPerUnit / 50);

  const prev = progress.sim1BestScore ?? 0;
  progress.sim1BestScore = Math.max(prev, frontierScore);

  saveModuleProgress(progress);
  updateModuleCompletionUI(progress);
}

/* --------------------------- Module Progress UI --------------------------- */

function updateModuleCompletionUI(progress) {
  const el = document.getElementById("module-progress");
  const codeEl = document.getElementById("completion-code");

  if (!el || !codeEl) return;

  const sim1Best = progress.sim1BestScore == null ? "—" : progress.sim1BestScore.toFixed(0);

  el.innerHTML = [
    `<div class="stat-row"><span>Sim 1</span><strong>${progress.sim1Completed ? "✅ Completed" : "—"}</strong></div>`,
    `<div class="stat-row"><span>Sim 1 Best Score</span><strong>${sim1Best}</strong></div>`,
    `<hr />`,
    `<div class="stat-row"><span>Sim 2</span><strong>${progress.sim2Completed ? "✅ Completed" : "—"}</strong></div>`,
    `<div class="stat-row"><span>Sim 3</span><strong>${progress.sim3Completed ? "✅ Completed" : "—"}</strong></div>`,
  ].join("");

  if (isModuleCompleted(progress)) {
    codeEl.textContent = generateCompletionCode(progress);
  } else {
    codeEl.textContent = "—";
  }
}

/* --------------------------- Charts --------------------------- */

function createSim1Charts() {
  const cashCtx = document.getElementById("sim1-cash-chart");
  const runwayCtx = document.getElementById("sim1-runway-chart");
  const demandCtx = document.getElementById("sim1-demand-chart");
  const profitCtx = document.getElementById("sim1-profit-chart");

  const cashChart = new Chart(cashCtx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Cash ($)", data: [], tension: 0.25, pointRadius: 2 }] },
    options: baseChartOptions({ yTitle: "Cash" }),
  });

  const runwayChart = new Chart(runwayCtx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Runway (periods)", data: [], tension: 0.25, pointRadius: 2, spanGaps: true }] },
    options: baseChartOptions({ yTitle: "Runway", suggestedMax: 20 }),
  });

  const demandChart = new Chart(demandCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Demand (units)", data: [], tension: 0.25, pointRadius: 2 },
        { label: "Sold (units)", data: [], tension: 0.25, pointRadius: 2 },
      ],
    },
    options: baseChartOptions({ yTitle: "Units" }),
  });

  const profitChart = new Chart(profitCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "Profit ($)", data: [] }],
    },
    options: baseChartOptions({ yTitle: "Profit" }),
  });

  return { cashChart, runwayChart, demandChart, profitChart };
}

function baseChartOptions({ yTitle, suggestedMax } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: {
      x: { title: { display: true, text: "Period" } },
      y: { title: { display: true, text: yTitle || "" }, suggestedMax },
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

  charts.profitChart.data.labels = labels;
  charts.profitChart.data.datasets[0].data = state.history.profit;
  charts.profitChart.update();
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


// ==============================
// entrepreneurship/styles.css  (REPLACE FILE CONTENT)
// Put this at: entrepreneurship/styles.css
// ==============================
:root {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
    "Segoe UI Emoji";
  line-height: 1.35;
}

body {
  margin: 0;
  background: #0b0c10;
  color: #e8e8e8;
}

.app-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.app-title {
  font-size: 18px;
  font-weight: 700;
}

.app-subtitle {
  margin-top: 4px;
  opacity: 0.85;
  font-size: 13px;
}

.app-main {
  padding: 18px 20px 30px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.controls {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

label {
  display: grid;
  gap: 8px;
}

.label-title {
  font-size: 13px;
  opacity: 0.9;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 10px;
  align-items: center;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
  opacity: 0.95;
}

input[type="range"] {
  width: 100%;
}

input[type="number"] {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.35);
  color: #e8e8e8;
}

input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.button-row {
  display: flex;
  gap: 10px;
}

button {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

button.secondary {
  background: rgba(255, 255, 255, 0.03);
}

button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.dashboard {
  margin-top: 14px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 980px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
}

.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  min-height: 240px;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 10px;
}

.card h3 {
  margin: 0;
  font-size: 14px;
  opacity: 0.95;
}

canvas {
  width: 100% !important;
  height: 180px !important;
}

.stats {
  display: grid;
  gap: 8px;
  font-size: 13px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.stats hr {
  width: 100%;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  margin: 6px 0;
}

.outcome {
  margin-top: 14px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.outcome h3 {
  margin: 0 0 8px 0;
}

.outcome .hint {
  opacity: 0.85;
  margin-top: 10px;
}

.progress-card {
  min-height: unset;
}

.progress-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.completion-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.35);
}

.completion-hint {
  margin-top: 8px;
  opacity: 0.75;
  font-size: 12px;
}

.app-footer {
  padding: 16px 20px;
  opacity: 0.7;
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}



ChatGPT is AI and can make mistakes. Check important info.
