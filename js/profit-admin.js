
// ── State ───────────────────────────────────────────────────────────────────
let profitPeriod = "month";
let profitDays = 30;
let profitMonths = 12;
let profitProductPage = 1;
let profitProductPages = 1;
let profitCostFilter = "";
let profitCostPage = 1;
let profitActiveTab = "summary"; // summary | daily | monthly | products | costs

// ── Entry point ─────────────────────────────────────────────────────────────
async function loadProfitPage() {
  const c = document.getElementById("content");

  c.innerHTML = `
  <div class="fade-up">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="section-header" style="margin-bottom:24px">
      <div>
        <h2>📊 Profit & Cost Tracking</h2>
        <div class="card-sub" style="margin-top:4px">
          Real-time margin analysis — revenue, cost, and gross profit per order
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <!-- Period selector -->
        <div style="display:flex;gap:2px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:3px">
          ${["today", "week", "month", "year"]
            .map(
              (p) => `
            <button class="tab ${p === profitPeriod ? "active" : ""}"
              id="period-${p}"
              onclick="switchProfitPeriod('${p}')"
              style="padding:5px 14px;font-size:12px;border-radius:7px;font-weight:600">
              ${p.charAt(0).toUpperCase() + p.slice(1)}
            </button>`,
            )
            .join("")}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="syncAllProfit()" title="Sync all snapshots">
          <i class="fas fa-sync-alt"></i> Sync
        </button>
        <button class="btn btn-ghost btn-sm" onclick="loadProfitPage()">
          <i class="fas fa-rotate-right"></i>
        </button>
      </div>
    </div>

    <!-- ── Summary KPI Cards ─────────────────────────────────────── -->
    <div id="profitKpiGrid" class="stat-grid fade-up stagger-1" style="margin-bottom:20px">
      ${[1, 2, 3, 4]
        .map(
          (i) => `
        <div class="stat-card">
          <div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div>
          <div class="skel" style="height:28px;width:75%;margin-bottom:8px"></div>
          <div class="skel" style="height:13px;width:50%"></div>
        </div>`,
        )
        .join("")}
    </div>

    <!-- ── Cost breakdown strip ──────────────────────────────────── -->
    <div id="profitCostStrip" class="fade-up stagger-2" style="
      display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${[1, 2, 3]
        .map(
          () => `
        <div class="card" style="padding:16px">
          <div class="skel" style="height:14px;width:60%;margin-bottom:10px"></div>
          <div class="skel" style="height:24px;width:80%"></div>
        </div>`,
        )
        .join("")}
    </div>

    <!-- ── Tab Nav ────────────────────────────────────────────────── -->
    <div class="tabs fade-up stagger-3" style="margin-bottom:16px" id="profitTabNav">
      <div class="tab active" onclick="switchProfitTab('summary')" id="ptab-summary">Overview</div>
      <div class="tab" onclick="switchProfitTab('daily')" id="ptab-daily">Daily Trend</div>
      <div class="tab" onclick="switchProfitTab('monthly')" id="ptab-monthly">Monthly</div>
      <div class="tab" onclick="switchProfitTab('products')" id="ptab-products">By Product</div>
      <div class="tab" onclick="switchProfitTab('costs')" id="ptab-costs">Cost Manager</div>
    </div>

    <!-- ── Tab Content ────────────────────────────────────────────── -->
    <div id="profitTabContent" class="fade-up stagger-4">
      <div style="display:flex;justify-content:center;padding:60px">
        <div class="spinner"></div>
      </div>
    </div>

  </div>`;

  // Load KPIs then tab content in parallel
  await Promise.all([loadProfitKpis(), renderProfitTab("summary")]);
}

// ── Period switcher ──────────────────────────────────────────────────────────
async function switchProfitPeriod(period) {
  console.log(`[PROFIT] Switching period to: ${period}`);
  profitPeriod = period;

  // Update UI buttons
  document.querySelectorAll("[id^='period-']").forEach((b) => {
    b.classList.remove("active");
  });
  document.getElementById("period-" + period)?.classList.add("active");

  // Reload data
  await Promise.all([loadProfitKpis(), renderProfitTab(profitActiveTab)]);
}

async function checkOrdersForPeriod() {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);

  const todayStr = today.toISOString().split("T")[0];
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  console.log(`Checking orders from ${weekAgoStr} to ${todayStr}`);

  try {
    const res = await apiCall(
      `/orders?dateFrom=${weekAgoStr}&dateTo=${todayStr}&limit=10`,
    );
    console.log(`Found ${res.data?.length || 0} orders in last 7 days`);

    if (res.data?.length) {
      console.log(
        "Sample orders:",
        res.data.slice(0, 3).map((o) => ({
          number: o.orderNumber,
          status: o.orderStatus,
          date: o.createdAt,
          total: o.total,
        })),
      );
    } else {
      console.warn("⚠️ No orders found in the last 7 days!");
    }
  } catch (err) {
    console.error("Failed to check orders:", err);
  }
}

// ── Tab switcher ─────────────────────────────────────────────────────────────
async function switchProfitTab(tab) {
  profitActiveTab = tab;
  document
    .querySelectorAll("[id^='ptab-']")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("ptab-" + tab)?.classList.add("active");
  await renderProfitTab(tab);
}

async function renderProfitTab(tab) {
  const container = document.getElementById("profitTabContent");
  if (!container) return;

  container.innerHTML = `<div style="display:flex;justify-content:center;padding:60px">
    <div class="spinner"></div></div>`;

  if (tab === "summary") await renderProfitSummaryTab(container);
  if (tab === "daily") await renderProfitDailyTab(container);
  if (tab === "monthly") await renderProfitMonthlyTab(container);
  if (tab === "products") await renderProfitProductsTab(container);
  if (tab === "costs") await renderProfitCostsTab(container);
}

// ── KPI Cards ────────────────────────────────────────────────────────────────
async function loadProfitKpis() {
  try {
    const res = await apiCall(`/profit/summary?period=${profitPeriod}`);
    const d = res.data;
    const r = d.realized;
    const p = d.projected;

    const marginColor =
      r.profitMargin > 40
        ? "var(--lime)"
        : r.profitMargin > 20
          ? "var(--amber)"
          : "var(--rose)";

    document.getElementById("profitKpiGrid").innerHTML = `
      ${profitStatCard("Gross Profit", formatCurrency(r.grossProfit), "fa-sack-dollar", "var(--lime)", "rgba(198,241,53,.15)", `${r.profitMargin}% margin`, r.grossProfit >= 0 ? "up" : "down")}
      ${profitStatCard("Total Revenue", formatCurrency(r.totalRevenue), "fa-bangladeshi-taka-sign", "var(--sky)", "rgba(56,189,248,.15)", `${r.orderCount} orders`, "up")}
      ${profitStatCard("Total Cost", formatCurrency(r.totalCost), "fa-boxes-stacking", "var(--amber)", "rgba(245,166,35,.15)", "Products + pkg + delivery", r.totalCost > 0 ? "down" : "up")}
      ${profitStatCard("Avg Profit/Order", formatCurrency(r.avgProfitPerOrder), "fa-chart-bar", "var(--teal)", "rgba(45,212,191,.15)", `${p.orderCount} active orders`, "up")}`;

    // Cost breakdown strip
    document.getElementById("profitCostStrip").innerHTML = `
      <div class="card" style="padding:18px;border-left:3px solid var(--amber)">
        <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">
          <i class="fas fa-box" style="margin-right:5px;color:var(--amber)"></i>Product Cost
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)">
          ${formatCurrency(r.totalProductCost)}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">
          ${r.totalRevenue > 0 ? ((r.totalProductCost / r.totalRevenue) * 100).toFixed(1) : 0}% of revenue
        </div>
        <div class="progress-bar-wrap" style="margin-top:8px">
          <div class="progress-bar-fill" style="width:${r.totalRevenue > 0 ? Math.min(100, (r.totalProductCost / r.totalRevenue) * 100).toFixed(1) : 0}%;background:var(--amber)"></div>
        </div>
      </div>
      <div class="card" style="padding:18px;border-left:3px solid var(--sky)">
        <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">
          <i class="fas fa-box-open" style="margin-right:5px;color:var(--sky)"></i>Packaging Cost
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)">
          ${formatCurrency(r.totalPackagingCost)}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">
          ${r.totalRevenue > 0 ? ((r.totalPackagingCost / r.totalRevenue) * 100).toFixed(1) : 0}% of revenue
        </div>
        <div class="progress-bar-wrap" style="margin-top:8px">
          <div class="progress-bar-fill" style="width:${r.totalRevenue > 0 ? Math.min(100, (r.totalPackagingCost / r.totalRevenue) * 100).toFixed(1) : 0}%;background:var(--sky)"></div>
        </div>
      </div>
      <div class="card" style="padding:18px;border-left:3px solid var(--teal)">
        <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">
          <i class="fas fa-truck" style="margin-right:5px;color:var(--teal)"></i>Delivery Cost
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)">
          ${formatCurrency(r.totalDeliveryCost)}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">
          ${r.totalRevenue > 0 ? ((r.totalDeliveryCost / r.totalRevenue) * 100).toFixed(1) : 0}% of revenue
        </div>
        <div class="progress-bar-wrap" style="margin-top:8px">
          <div class="progress-bar-fill" style="width:${r.totalRevenue > 0 ? Math.min(100, (r.totalDeliveryCost / r.totalRevenue) * 100).toFixed(1) : 0}%;background:var(--teal)"></div>
        </div>
      </div>`;
  } catch (e) {
    console.error("Profit KPI error:", e.message);
    document.getElementById("profitKpiGrid").innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--rose)">
        <i class="fas fa-exclamation-triangle" style="font-size:32px;margin-bottom:10px;display:block"></i>
        ${e.message} — <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="loadProfitPage()">Retry</button>
      </div>`;
  }
}

function profitStatCard(label, value, icon, color, bg, sub, dir) {
  return `<div class="stat-card fade-up" style="--accent:${color}">
    <div class="stat-icon" style="background:${bg};color:${color}"><i class="fas ${icon}"></i></div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-sub ${dir}">
      <i class="fas fa-arrow-${dir === "up" ? "up-right" : "down-right"}"></i>${sub}
    </div>
  </div>`;
}

// ── SUMMARY TAB ──────────────────────────────────────────────────────────────
async function renderProfitSummaryTab(container) {
  try {
    const [summaryRes, topRes] = await Promise.all([
      apiCall(`/profit/summary?period=${profitPeriod}`),
      apiCall(`/profit/products?period=${profitPeriod}&limit=5`),
    ]);

    const r = summaryRes.data.realized;
    const p = summaryRes.data.projected;
    const top = topRes.data || [];

    const marginColor =
      r.profitMargin >= 40
        ? "var(--lime)"
        : r.profitMargin >= 20
          ? "var(--amber)"
          : "var(--rose)";

    container.innerHTML = `
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">

      <!-- Left: Margin gauge + realized vs projected -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- Margin gauge card -->
        <div class="card" style="padding:28px">
          <div class="card-title" style="margin-bottom:4px">Profit Margin</div>
          <div class="card-sub" style="margin-bottom:24px">Realized (delivered orders) · ${profitPeriod}</div>
          
          <div style="position:relative;margin:0 auto 20px;width:200px;height:100px;overflow:hidden">
            <svg viewBox="0 0 200 100" style="width:100%;height:auto">
              <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="var(--surface2)" stroke-width="16" stroke-linecap="round"/>
              <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none"
                stroke="${marginColor}" stroke-width="16" stroke-linecap="round"
                stroke-dasharray="${(Math.PI * 90 * Math.min(r.profitMargin, 100)) / 100} ${Math.PI * 90}"
                stroke-dashoffset="0"
                style="transition:stroke-dasharray .8s ease"/>
            </svg>
            <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);text-align:center">
              <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:${marginColor};line-height:1">
                ${r.profitMargin}%
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">margin</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:var(--bg);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Revenue</div>
              <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--sky)">
                ${formatCurrency(r.totalRevenue)}
              </div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Total Cost</div>
              <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--amber)">
                ${formatCurrency(r.totalCost)}
              </div>
            </div>
          </div>
        </div>

        <!-- Realized vs Projected comparison -->
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:4px">Realized vs Projected</div>
          <div class="card-sub" style="margin-bottom:16px">Delivered orders vs all active orders</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${renderCompareRow("Profit", r.grossProfit, p.projectedProfit, "var(--lime)")}
            ${renderCompareRow("Revenue", r.totalRevenue, p.projectedRevenue, "var(--sky)")}
            ${renderCompareRow("Cost", r.totalCost, p.projectedCost, "var(--amber)")}
          </div>
          <div style="margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:8px;
                      font-size:11px;color:var(--text3);display:flex;align-items:center;gap:8px">
            <i class="fas fa-circle-info" style="color:var(--lime)"></i>
            Projected includes all non-cancelled orders (pending, confirmed, shipped)
          </div>
        </div>
      </div>

      <!-- Right: Top products -->
      <div class="card" style="padding:22px">
        <div class="card-title" style="margin-bottom:4px">🏆 Most Profitable Products</div>
        <div class="card-sub" style="margin-bottom:16px">By gross profit · ${profitPeriod}</div>

        ${
          top.length
            ? top
                .map(
                  (p, i) => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 0;
                      border-bottom:1px solid var(--border)">
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;
                        color:var(--text3);width:22px;text-align:center;flex-shrink:0">
              ${i + 1}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;
                          overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.name || "—")}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">
                ${p.unitsSold || 0} units · ${(p.profitMargin || 0).toFixed(1)}% margin
              </div>
              <div class="progress-bar-wrap" style="margin-top:5px">
                <div class="progress-bar-fill" style="width:${Math.min(100, ((p.totalProfit || 0) / (top[0]?.totalProfit || 1)) * 100).toFixed(0)}%"></div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;
                          color:var(--lime)">${formatCurrency(p.totalProfit)}</div>
              <div style="font-size:10px;color:var(--text3)">profit</div>
            </div>
          </div>`,
                )
                .join("")
            : `
          <div style="text-align:center;padding:40px 0;color:var(--text3)">
            <i class="fas fa-chart-bar" style="font-size:32px;margin-bottom:12px;display:block"></i>
            No delivered orders yet for this period
          </div>`
        }

        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:14px"
          onclick="switchProfitTab('products')">
          <i class="fas fa-arrow-right"></i> View all products
        </button>
      </div>
    </div>`;
  } catch (e) {
    container.innerHTML = profitError(e.message);
  }
}

function renderCompareRow(label, realized, projected, color) {
  const pct = projected > 0 ? ((realized / projected) * 100).toFixed(0) : 0;
  return `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
      <span style="font-size:12px;color:var(--text3)">${label}</span>
      <div style="display:flex;gap:12px;font-size:12px;font-weight:600">
        <span style="color:${color}">${formatCurrency(realized)} realized</span>
        <span style="color:var(--text3)">${formatCurrency(projected)} projected</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:${pct}% 1fr;gap:3px">
      <div style="height:6px;background:${color};border-radius:3px;min-width:4px"></div>
      <div style="height:6px;background:var(--surface2);border-radius:3px"></div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px">${pct}% realized</div>
  </div>`;
}

// ── DAILY TAB ────────────────────────────────────────────────────────────────
async function renderProfitDailyTab(container) {
  try {
    const daysMap = { today: 1, week: 7, month: 30, year: 365 };
    const days = daysMap[profitPeriod] || 30;
    const res = await apiCall(`/profit/daily?days=${days}`);
    const data = res.data || [];

    container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <div class="card-title">Daily Profit Trend</div>
            <div class="card-sub">Last ${days} days — delivered orders only</div>
          </div>
          <div style="display:flex;gap:8px">
            <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--lime)">
              <span style="width:12px;height:3px;border-radius:2px;background:var(--lime);display:inline-block"></span>Profit
            </span>
            <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sky)">
              <span style="width:12px;height:3px;border-radius:2px;background:var(--sky);display:inline-block"></span>Revenue
            </span>
            <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--amber)">
              <span style="width:12px;height:3px;border-radius:2px;background:var(--amber);display:inline-block"></span>Cost
            </span>
          </div>
        </div>
        <div style="position:relative;height:280px">
          <canvas id="profitDailyChart"></canvas>
        </div>
      </div>

      <!-- Daily table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div class="card-title">Daily Breakdown</div>
          <div class="card-sub">${data.length} days with data</div>
        </div>
        <table class="data-table">
          <thead><tr>
            <th>Date</th><th>Revenue</th><th>Cost</th>
            <th>Profit</th><th>Margin</th><th>Orders</th>
          </tr></thead>
          <tbody>
            ${
              data.length
                ? [...data]
                    .reverse()
                    .slice(0, 14)
                    .map((d) => {
                      const marginColor =
                        d.margin >= 40
                          ? "var(--lime)"
                          : d.margin >= 20
                            ? "var(--amber)"
                            : "var(--rose)";
                      return `<tr>
                <td style="font-weight:600;font-size:12px">
                  ${new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </td>
                <td style="color:var(--sky);font-weight:600">${formatCurrency(d.revenue)}</td>
                <td style="color:var(--amber)">${formatCurrency(d.cost)}</td>
                <td><span style="font-family:'Syne',sans-serif;font-weight:800;color:${d.profit >= 0 ? "var(--lime)" : "var(--rose)"}">
                  ${formatCurrency(d.profit)}
                </span></td>
                <td><span class="badge" style="background:${marginColor}22;color:${marginColor}">
                  ${(d.margin || 0).toFixed(1)}%
                </span></td>
                <td style="color:var(--text2)">${d.orders}</td>
              </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">
              No delivered orders in this period</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;

    // Render chart
    if (data.length) {
      const ctx = document.getElementById("profitDailyChart");
      if (!ctx) return;
      Chart.getChart(ctx)?.destroy();

      const labels = data.map((d) =>
        new Date(d.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
      );
      const revenues = data.map((d) => d.revenue || 0);
      const costs = data.map((d) => d.cost || 0);
      const profits = data.map((d) => d.profit || 0);

      const gradProfit = ctx
        .getContext("2d")
        .createLinearGradient(0, 0, 0, 260);
      gradProfit.addColorStop(0, "rgba(198,241,53,.2)");
      gradProfit.addColorStop(1, "rgba(198,241,53,0)");

      const ch = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Revenue",
              data: revenues,
              borderColor: "#38bdf8",
              backgroundColor: "transparent",
              borderWidth: 2,
              pointRadius: 3,
              pointBackgroundColor: "#38bdf8",
              tension: 0.3,
            },
            {
              label: "Cost",
              data: costs,
              borderColor: "#f5a623",
              backgroundColor: "transparent",
              borderWidth: 2,
              pointRadius: 2,
              pointBackgroundColor: "#f5a623",
              tension: 0.3,
            },
            {
              label: "Profit",
              data: profits,
              borderColor: "#c6f135",
              backgroundColor: gradProfit,
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: "#c6f135",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1e2328",
              borderColor: "#252b31",
              borderWidth: 1,
              callbacks: {
                label: (ctx) =>
                  ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: {
                color: "#5a6472",
                font: { size: 10 },
                maxTicksLimit: 10,
              },
            },
            y: {
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: {
                color: "#5a6472",
                font: { size: 10 },
                callback: (v) => "৳" + v.toLocaleString(),
              },
              beginAtZero: true,
            },
          },
        },
      });
      activeCharts.push(ch);
    }
  } catch (e) {
    container.innerHTML = profitError(e.message);
  }
}

// ── MONTHLY TAB ──────────────────────────────────────────────────────────────
async function renderProfitMonthlyTab(container) {
  try {
    const res = await apiCall(`/profit/monthly?months=${profitMonths}`);
    const data = res.data || [];

    const monthNames = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <div class="card-title">Monthly Profit Trend</div>
            <div class="card-sub">Last ${profitMonths} months — stacked cost breakdown</div>
          </div>
          <select class="inp" style="width:auto;font-size:12px;padding:6px 10px"
            onchange="profitMonths=parseInt(this.value);renderProfitTab('monthly')">
            <option value="6" ${profitMonths === 6 ? "selected" : ""}>6 months</option>
            <option value="12" ${profitMonths === 12 ? "selected" : ""}>12 months</option>
            <option value="24" ${profitMonths === 24 ? "selected" : ""}>24 months</option>
          </select>
        </div>
        <div style="position:relative;height:280px">
          <canvas id="profitMonthlyChart"></canvas>
        </div>
      </div>

      <!-- Monthly table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <div class="card-title">Monthly Summary</div>
        </div>
        <table class="data-table">
          <thead><tr>
            <th>Month</th><th>Revenue</th><th>Product Cost</th>
            <th>Pkg Cost</th><th>Delivery Cost</th>
            <th>Gross Profit</th><th>Margin</th><th>Orders</th>
          </tr></thead>
          <tbody>
            ${
              data.length
                ? [...data]
                    .reverse()
                    .map((d) => {
                      const marginColor =
                        d.margin >= 40
                          ? "var(--lime)"
                          : d.margin >= 20
                            ? "var(--amber)"
                            : "var(--rose)";
                      return `<tr>
                <td style="font-weight:700">${monthNames[d.month]} ${d.year}</td>
                <td style="color:var(--sky);font-weight:600">${formatCurrency(d.revenue)}</td>
                <td style="color:var(--amber)">${formatCurrency(d.productCost)}</td>
                <td style="color:var(--sky)">${formatCurrency(d.packagingCost)}</td>
                <td style="color:var(--teal)">${formatCurrency(d.deliveryCost)}</td>
                <td><span style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:${d.profit >= 0 ? "var(--lime)" : "var(--rose)"}">
                  ${formatCurrency(d.profit)}
                </span></td>
                <td><span class="badge" style="background:${marginColor}22;color:${marginColor}">
                  ${(d.margin || 0).toFixed(1)}%
                </span></td>
                <td>${d.orders}</td>
              </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">
              No data yet</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;

    // Render stacked bar chart
    if (data.length) {
      const ctx = document.getElementById("profitMonthlyChart");
      if (!ctx) return;
      Chart.getChart(ctx)?.destroy();
      const labels = data.map((d) => `${monthNames[d.month]} ${d.year}`);
      const ch = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Product Cost",
              data: data.map((d) => d.productCost || 0),
              backgroundColor: "rgba(245,166,35,.75)",
              stack: "cost",
            },
            {
              label: "Packaging",
              data: data.map((d) => d.packagingCost || 0),
              backgroundColor: "rgba(56,189,248,.65)",
              stack: "cost",
            },
            {
              label: "Delivery",
              data: data.map((d) => d.deliveryCost || 0),
              backgroundColor: "rgba(45,212,191,.6)",
              stack: "cost",
            },
            {
              label: "Profit",
              data: data.map((d) => d.profit || 0),
              backgroundColor: "rgba(198,241,53,.85)",
              stack: "cost",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700 },
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#8f9baa", font: { size: 11 }, padding: 14 },
            },
            tooltip: {
              backgroundColor: "#1e2328",
              borderColor: "#252b31",
              borderWidth: 1,
              callbacks: {
                label: (ctx) =>
                  ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: { color: "#5a6472", font: { size: 10 } },
            },
            y: {
              stacked: true,
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: {
                color: "#5a6472",
                font: { size: 10 },
                callback: (v) => "৳" + v.toLocaleString(),
              },
              beginAtZero: true,
            },
          },
        },
      });
      activeCharts.push(ch);
    }
  } catch (e) {
    container.innerHTML = profitError(e.message);
  }
}

// ── PRODUCTS TAB ─────────────────────────────────────────────────────────────
async function renderProfitProductsTab(container) {
  try {
    const res = await apiCall(
      `/profit/products?period=${profitPeriod}&page=${profitProductPage}&limit=15`,
    );
    const products = res.data || [];
    profitProductPages = res.pagination?.pages || 1;

    container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="card-title">Profit by Product</div>
          <div class="card-sub" style="margin-top:2px">Delivered orders · ${profitPeriod} period</div>
        </div>
        <div class="card-sub">${products.length} products with data</div>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>#</th>
          <th>Product</th>
          <th>Units Sold</th>
          <th>Revenue</th>
          <th>Cost</th>
          <th>Gross Profit</th>
          <th>Margin</th>
          <th>Action</th>
        </tr></thead>
        <tbody>
          ${
            products.length
              ? products
                  .map((p, i) => {
                    const marginColor =
                      p.profitMargin >= 40
                        ? "var(--lime)"
                        : p.profitMargin >= 20
                          ? "var(--amber)"
                          : "var(--rose)";
                    const rank = (profitProductPage - 1) * 15 + i + 1;
                    return `<tr>
              <td style="color:var(--text3);font-weight:700">${rank}</td>
              <td>
                <div style="font-weight:600;font-size:13px">${escapeHtml(p.name || "—")}</div>
                <div style="font-size:10px;color:var(--text3);font-family:monospace">${p.sku || ""}</div>
              </td>
              <td style="font-weight:600">${p.unitsSold || 0}</td>
              <td style="color:var(--sky);font-weight:600">${formatCurrency(p.totalRevenue)}</td>
              <td style="color:var(--amber)">${formatCurrency(p.totalCost)}</td>
              <td>
                <span style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;
                             color:${p.totalProfit >= 0 ? "var(--lime)" : "var(--rose)"}">
                  ${formatCurrency(p.totalProfit)}
                </span>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:7px">
                  <div style="width:48px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${Math.min(100, p.profitMargin || 0).toFixed(0)}%;
                                background:${marginColor};border-radius:3px"></div>
                  </div>
                  <span style="font-size:11px;font-weight:700;color:${marginColor}">
                    ${(p.profitMargin || 0).toFixed(1)}%
                  </span>
                </div>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm btn-icon"
                  onclick="openProfitProductCostModal('${p._id}','${escapeHtml(p.name || "")}')"
                  title="Set costs">
                  <i class="fas fa-edit"></i>
                </button>
              </td>
            </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text3)">
            <i class="fas fa-chart-bar" style="font-size:32px;margin-bottom:12px;display:block"></i>
            No data yet — sync orders first or deliver some orders
          </td></tr>`
          }
        </tbody>
      </table>
      <div style="padding:16px 20px;border-top:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;color:var(--text3)">Page ${profitProductPage} of ${profitProductPages}</div>
        <div class="pagination" id="profitProductPagination"></div>
      </div>
    </div>`;

    renderPagination(
      "profitProductPagination",
      profitProductPage,
      profitProductPages,
      (p) => {
        profitProductPage = p;
        renderProfitProductsTab(container);
      },
    );
  } catch (e) {
    container.innerHTML = profitError(e.message);
  }
}

// ── COSTS MANAGER TAB ─────────────────────────────────────────────────────────
async function renderProfitCostsTab(container) {
  try {
    const res = await apiCall("/profit/products/costs");
    let products = res.data || [];

    // Client-side filter
    if (profitCostFilter) {
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(profitCostFilter.toLowerCase()) ||
          p.sku?.toLowerCase().includes(profitCostFilter.toLowerCase()),
      );
    }

    const missingCosts = products.filter((p) => !p.hasCostData).length;

    container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Alert if products have no cost data -->
      ${
        missingCosts > 0
          ? `
      <div style="background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.3);
                  border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px">
        <i class="fas fa-triangle-exclamation" style="color:var(--amber);font-size:18px;flex-shrink:0"></i>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--amber)">
            ${missingCosts} product${missingCosts > 1 ? "s have" : "has"} no cost data
          </div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">
            Profit calculations will be inaccurate. Set cost per unit and packaging cost for each product.
          </div>
        </div>
      </div>`
          : ""
      }

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);
                    display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div class="card-title">Product Cost Manager</div>
            <div class="card-sub" style="margin-top:2px">Set cost per unit & packaging cost to enable profit tracking</div>
          </div>
          <div class="inp-group" style="width:220px">
            <i class="fas fa-search"></i>
            <input class="inp" placeholder="Search product or SKU…"
              oninput="profitCostFilter=this.value;renderProfitCostsTab(document.getElementById('profitTabContent'))"
              value="${escapeHtml(profitCostFilter)}">
          </div>
        </div>

        <table class="data-table">
          <thead><tr>
            <th>Product</th>
            <th>Selling Price</th>
            <th>Cost / Unit</th>
            <th>Pkg Cost</th>
            <th>Total Cost</th>
            <th>Implied Margin</th>
            <th>Stock</th>
            <th>Edit</th>
          </tr></thead>
          <tbody>
            ${
              products.length
                ? products
                    .map((p) => {
                      const marginColor =
                        p.impliedMarginPercent >= 40
                          ? "var(--lime)"
                          : p.impliedMarginPercent >= 20
                            ? "var(--amber)"
                            : "var(--rose)";
                      return `<tr>
                <td>
                  <div style="font-weight:600;font-size:13px">${escapeHtml(p.name)}</div>
                  <div style="font-size:10px;color:var(--text3);font-family:monospace">${p.sku || ""}</div>
                  ${!p.hasCostData ? '<div class="badge badge-amber" style="font-size:9px;margin-top:3px">No cost data</div>' : ""}
                </td>
                <td style="font-family:'Syne',sans-serif;font-weight:700;color:var(--lime)">
                  ${formatCurrency(p.price)}
                </td>
                <td>
                  <span id="cost-display-${p._id}" style="font-weight:600;color:var(--text)">
                    ${p.costPerUnit > 0 ? formatCurrency(p.costPerUnit) : '<span style="color:var(--text3)">—</span>'}
                  </span>
                </td>
                <td>
                  <span id="pkg-display-${p._id}" style="color:var(--text2)">
                    ${p.packagingCost > 0 ? formatCurrency(p.packagingCost) : '<span style="color:var(--text3)">—</span>'}
                  </span>
                </td>
                <td style="font-weight:600;color:var(--amber)">
                  ${p.totalCostPerUnit > 0 ? formatCurrency(p.totalCostPerUnit) : '<span style="color:var(--text3)">—</span>'}
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:7px">
                    <div style="width:48px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
                      <div style="height:100%;width:${Math.max(0, Math.min(100, p.impliedMarginPercent || 0)).toFixed(0)}%;
                                  background:${marginColor};border-radius:3px"></div>
                    </div>
                    <span style="font-size:11px;font-weight:700;color:${marginColor}">
                      ${p.impliedMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td style="color:${p.stock <= 0 ? "var(--rose)" : p.stock <= 10 ? "var(--amber)" : "var(--teal)"}">
                  ${p.stock}
                </td>
                <td>
                  <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px"
                    onclick="openProfitProductCostModal('${p._id}','${escapeHtml(p.name)}',${p.costPerUnit || 0},${p.packagingCost || 0})">
                    <i class="fas fa-pen"></i> Set Costs
                  </button>
                </td>
              </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text3)">
              No products found
            </td></tr>`
            }
          </tbody>
        </table>
      </div>

      <!-- Sync reminder -->
      <div class="card" style="padding:18px;background:var(--bg2);display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">
            <i class="fas fa-sync-alt" style="color:var(--lime);margin-right:6px"></i>
            After updating costs, sync profit snapshots to recalculate historical profit
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">
            This updates all existing order profit records with the new cost data
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="syncAllProfit()">
          <i class="fas fa-sync-alt"></i> Sync All Snapshots
        </button>
      </div>
    </div>`;
  } catch (e) {
    container.innerHTML = profitError(e.message);
  }
}

// ── Cost Editor Modal ─────────────────────────────────────────────────────────
function openProfitProductCostModal(
  productId,
  productName,
  currentCost = 0,
  currentPkg = 0,
) {
  modal(`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header">
      <div>
        <div class="modal-title">💰 Set Product Costs</div>
        <div class="modal-sub">${escapeHtml(productName)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="profitCostForm">
      <div class="modal-body">

        <div style="background:var(--bg);border-radius:12px;padding:16px;margin-bottom:20px;
                    border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
            <i class="fas fa-circle-info" style="color:var(--lime)"></i>
            These costs apply <strong>per unit</strong>. Profit = Selling Price − (Cost/Unit + Packaging) × Qty − Delivery
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-box" style="color:var(--amber);margin-right:5px"></i>
                Cost per Unit (৳) — COGS, purchase price, raw material
              </label>
              <div class="inp-group">
                <i class="fas fa-tag"></i>
                <input class="inp" name="costPerUnit" type="number" step="1" min="0"
                  placeholder="e.g. 120" value="${currentCost}"
                  oninput="updateProfitPreview()" id="costPerUnitInput">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-box-open" style="color:var(--sky);margin-right:5px"></i>
                Packaging Cost per Unit (৳) — box, tape, label, polybag
              </label>
              <div class="inp-group">
                <i class="fas fa-cube"></i>
                <input class="inp" name="packagingCost" type="number" step="1" min="0"
                  placeholder="e.g. 15" value="${currentPkg}"
                  oninput="updateProfitPreview()" id="pkgCostInput">
              </div>
            </div>
          </div>
        </div>

        <!-- Live preview -->
        <div id="profitCostPreview" style="background:linear-gradient(135deg,var(--bg2),var(--bg));
             border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                      color:var(--text3);margin-bottom:12px">Live Preview (per unit)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="profitPreviewGrid">
            <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--text3)">Total Cost/Unit</div>
              <div id="previewTotalCost" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--amber)">৳ 0</div>
            </div>
            <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--text3)">Implied Margin</div>
              <div id="previewMargin" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--lime)">— %</div>
            </div>
          </div>
        </div>

        <input type="hidden" id="profitCostProductId" value="${productId}">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="profitCostSaveBtn">
          <i class="fas fa-save"></i> Save Costs
        </button>
      </div>
    </form>
  </div>`);

  // Init preview — we need the selling price from the cost table
  // We'll just skip it if not passed; user can see result after save
  document.getElementById("profitCostForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("profitCostSaveBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    btn.disabled = true;
    const fd = new FormData(e.target);
    try {
      const res = await apiCall(`/profit/products/${productId}/costs`, {
        method: "PATCH",
        body: JSON.stringify({
          costPerUnit: parseFloat(fd.get("costPerUnit")) || 0,
          packagingCost: parseFloat(fd.get("packagingCost")) || 0,
        }),
      });
      showToast(
        `✅ Costs updated — margin: ${res.data.impliedMarginPercent}%`,
        "success",
      );
      closeModal();
      await renderProfitCostsTab(document.getElementById("profitTabContent"));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.innerHTML = '<i class="fas fa-save"></i> Save Costs';
      btn.disabled = false;
    }
  };
}

// Live preview inside cost modal (without knowing selling price — show totals only)
function updateProfitPreview() {
  const cost =
    parseFloat(document.getElementById("costPerUnitInput")?.value) || 0;
  const pkg = parseFloat(document.getElementById("pkgCostInput")?.value) || 0;
  const total = cost + pkg;
  const tc = document.getElementById("previewTotalCost");
  const mg = document.getElementById("previewMargin");
  if (tc) tc.textContent = "৳ " + total.toLocaleString();
  if (mg) mg.textContent = "Set after save";
}

// ── Sync all snapshots ────────────────────────────────────────────────────────
async function syncAllProfit() {
  if (
    !confirm(
      "Sync profit snapshots for ALL orders?\n\nThis may take a moment for large datasets.",
    )
  )
    return;
  showToast("Syncing profit snapshots…", "info");
  try {
    const res = await apiCall("/profit/sync-all", { method: "POST" });
    showToast(
      `✅ Synced ${res.synced} orders${res.failed > 0 ? ` · ${res.failed} failed` : ""}`,
      "success",
    );
    await loadProfitKpis();
  } catch (e) {
    showToast("Sync failed: " + e.message, "error");
  }
}

// ── Order profit quick view (callable from order detail) ────────────────────
async function viewOrderProfit(orderId, orderNumber) {
  modal(`<div class="modal-box" style="max-width:500px">
    <div class="modal-header">
      <div><div class="modal-title">💰 Order Profit — ${orderNumber}</div></div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
      <div class="spinner"></div>
    </div>
  </div>`);

  try {
    const res = await apiCall(`/profit/order/${orderId}`);
    const d = res.data;
    const marginColor =
      d.profitMargin >= 40
        ? "var(--lime)"
        : d.profitMargin >= 20
          ? "var(--amber)"
          : "var(--rose)";

    document.getElementById("modalContainer").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal-box" style="max-width:500px">
        <div class="modal-header">
          <div>
            <div class="modal-title">💰 Order Profit</div>
            <div class="modal-sub">${d.orderNumber} · ${d.isRealized ? "✅ Realized" : "⏳ Projected"}</div>
          </div>
          <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">

          <!-- Score ring -->
          <div style="background:var(--bg);border-radius:14px;padding:20px;margin-bottom:20px;
                      display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">GROSS PROFIT</div>
              <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;
                          color:${d.grossProfit >= 0 ? "var(--lime)" : "var(--rose)"}">
                ${formatCurrency(d.grossProfit)}
              </div>
              <div style="font-size:12px;color:${marginColor};font-weight:600;margin-top:4px">
                ${d.profitMargin}% margin
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">TOTAL REVENUE</div>
              <div style="font-size:20px;font-weight:700;color:var(--sky)">${formatCurrency(d.totalRevenue)}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:8px;margin-bottom:4px">TOTAL COST</div>
              <div style="font-size:20px;font-weight:700;color:var(--amber)">${formatCurrency(d.totalCost)}</div>
            </div>
          </div>

          <!-- Cost breakdown -->
          <div class="info-block" style="margin-bottom:16px">
            <h4><i class="fas fa-list-check" style="margin-right:6px"></i>Cost Breakdown</h4>
            <div class="info-row"><span>Product Cost</span><span style="color:var(--amber)">${formatCurrency(d.productCost)}</span></div>
            <div class="info-row"><span>Packaging Cost</span><span style="color:var(--sky)">${formatCurrency(d.packagingCost)}</span></div>
            <div class="info-row"><span>Delivery Cost</span><span style="color:var(--teal)">${formatCurrency(d.deliveryCost)}</span></div>
            <div class="info-row" style="font-weight:700"><span>Total Cost</span><span style="color:var(--amber)">${formatCurrency(d.totalCost)}</span></div>
          </div>

          <!-- Per item -->
          ${
            d.items?.length
              ? `
          <div class="info-block">
            <h4><i class="fas fa-box" style="margin-right:6px"></i>Per Item Profit</h4>
            ${d.items
              .map(
                (item) => `
              <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:10px 0">
                <div style="font-size:13px;font-weight:600">${escapeHtml(item.name || "")}</div>
                <div style="display:flex;gap:16px;font-size:11px;color:var(--text3)">
                  <span>Qty: ${item.quantity}</span>
                  <span>Sale: ${formatCurrency(item.sellingPrice)}/unit</span>
                  <span>Cost: ${formatCurrency((item.costPerUnit || 0) + (item.packagingCostPerUnit || 0))}/unit</span>
                </div>
                <div style="display:flex;gap:16px;font-size:12px">
                  <span>Revenue: <strong style="color:var(--sky)">${formatCurrency(item.itemRevenue)}</strong></span>
                  <span>Profit: <strong style="color:${item.itemProfit >= 0 ? "var(--lime)" : "var(--rose)"}">${formatCurrency(item.itemProfit)}</strong></span>
                </div>
              </div>`,
              )
              .join("")}
          </div>`
              : ""
          }

          ${
            !d.isRealized
              ? `
          <div style="margin-top:12px;padding:10px 12px;background:rgba(245,166,35,.08);
                      border:1px solid rgba(245,166,35,.2);border-radius:8px;font-size:11px;
                      color:var(--amber)">
            <i class="fas fa-clock" style="margin-right:5px"></i>
            Projected profit — will be finalized when order is marked as Delivered
          </div>`
              : ""
          }
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal()">Close</button>
          <button class="btn btn-ghost btn-sm" onclick="loadPage('profit')">
            <i class="fas fa-chart-line"></i> Full Profit Dashboard
          </button>
        </div>
      </div>
    </div>`;
  } catch (e) {
    showToast(e.message, "error");
    closeModal();
  }
}

// ── Helper: error block ────────────────────────────────────────────────────────
function profitError(msg) {
  return `<div class="card" style="text-align:center;padding:60px;color:var(--rose)">
    <i class="fas fa-exclamation-triangle" style="font-size:40px;margin-bottom:14px;display:block"></i>
    <div class="card-title" style="color:var(--rose)">Failed to load</div>
    <div class="card-sub" style="margin-top:6px">${escapeHtml(msg)}</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:16px" onclick="renderProfitTab(profitActiveTab)">
      <i class="fas fa-rotate-right"></i> Retry
    </button>
  </div>`;
}

console.log("✅ Profit & Cost Tracking module loaded");
