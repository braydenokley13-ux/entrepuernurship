// ==============================
// entrepreneurship/state.js  (NEW FILE)
// Put this at: entrepreneurship/state.js
// ==============================
"use strict";

const MODULE_ID = "entrepreneurship_m1";

function loadModuleProgress() {
  const raw = localStorage.getItem(MODULE_ID);
  if (!raw) {
    return {
      sim1Completed: false,
      sim2Completed: false,
      sim3Completed: false,
      sim1BestScore: null,
      sim2BestScore: null,
      sim3BestScore: null,
    };
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Corrupt module state, resetting");
    localStorage.removeItem(MODULE_ID);
    return loadModuleProgress();
  }
}

function saveModuleProgress(progress) {
  localStorage.setItem(MODULE_ID, JSON.stringify(progress));
}

function isModuleCompleted(progress) {
  return !!(progress.sim1Completed && progress.sim2Completed && progress.sim3Completed);
}

function generateCompletionCode(progress) {
  const base = `${MODULE_ID}-${progress.sim1BestScore}-${progress.sim2BestScore}-${progress.sim3BestScore}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `ENT-M1-${hash.toString(16).toUpperCase()}`;
}


// ==============================
// entrepreneurship/index.html  (REPLACE FILE CONTENT)
// Put this at: entrepreneurship/index.html
// NOTE: state.js MUST be loaded before sim1.js
// ==============================
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BOW — Step 3 — Entrepreneurship Lab (Sim 1)</title>
    <link rel="stylesheet" href="./styles.css" />

    <!-- Chart.js (CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

    <!-- Shared state helpers -->
    <script defer src="./state.js"></script>

    <!-- Sim -->
    <script defer src="./sim1.js"></script>
  </head>
  <body>
    <header class="app-header">
      <div class="app-title">BOW — Step 3 — Entrepreneurship Lab</div>
      <div class="app-subtitle">Sim 1: Unit Economics</div>
    </header>

    <main class="app-main">
      <div class="layout">
        <!-- LEFT: SIM -->
        <div class="sim-column">
          <div id="sim-root">
            <div id="sim1">
              <div class="controls">
                <label>
                  <span class="label-title">Price</span>
                  <div class="control-row">
                    <input type="range" id="sim1-price" min="5" max="50" step="1" />
                    <input
                      type="number"
                      id="sim1-price-num"
                      min="5"
                      max="50"
                      step="1"
                    />
                  </div>
                </label>

                <label>
                  <span class="label-title">Capacity (units per period)</span>
                  <div class="control-row">
                    <input
                      type="range"
                      id="sim1-capacity"
                      min="10"
                      max="200"
                      step="5"
                    />
                    <input
                      type="number"
                      id="sim1-capacity-num"
                      min="10"
                      max="200"
                      step="5"
                    />
                  </div>
                </label>

                <label class="checkbox-row">
                  <input type="checkbox" id="sim1-lock-levers" />
                  <span>Lock levers during run</span>
                </label>

                <div class="button-row">
                  <button id="sim1-start">Start Run</button>
                  <button id="sim1-reset" class="secondary">Reset</button>
                </div>
              </div>

              <div class="dashboard">
                <section class="card">
                  <h3>Cash</h3>
                  <canvas id="sim1-cash-chart"></canvas>
                </section>

                <section class="card">
                  <h3>Runway (periods)</h3>
                  <canvas id="sim1-runway-chart"></canvas>
                </section>

                <section class="card">
                  <h3>Demand vs Sold</h3>
                  <canvas id="sim1-demand-chart"></canvas>
                </section>

                <section class="card">
                  <h3>Profit / Period</h3>
                  <canvas id="sim1-profit-chart"></canvas>
                </section>

                <section class="card">
                  <h3>Stats</h3>
                  <div id="sim1-stats" class="stats"></div>
                </section>
              </div>

              <div id="sim1-outcome" class="outcome"></div>
            </div>
          </div>
        </div>

        <!-- RIGHT: PROGRESS -->
        <aside class="progress-column">
          <section class="card progress-card">
            <h3>Module Progress</h3>
            <div id="module-progress" class="stats"></div>
            <div class="progress-actions">
              <button id="module-reset" class="secondary">Clear Module Progress</button>
            </div>
          </section>

          <section class="card progress-card">
            <h3>Completion Code</h3>
            <div id="completion-code" class="completion-code">—</div>
            <div class="completion-hint">
              Unlocks when Sim 1–3 are all completed.
            </div>
          </section>
        </aside>
      </div>
    </main>

    <footer class="app-footer">
      Tip: Try high price / low capacity vs low price / high capacity. Watch profit and runway.
    </footer>
  </body>
</html>
