// ═══════════════════════════════════════════════════════════════════
// FINANCE ADMIN MODULE — BeeHarvest Admin Panel
// Full Expense & Income Manager
// Connects to: /api/finance/*
// ═══════════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let finPage = 1,
  finTotalPages = 1;
let finFilter = {
  type: "",
  category: "",
  period: "month",
  search: "",
  paymentMethod: "",
  status: "",
};
let finPeriod = "month";
let finActiveTab = "overview"; // overview | transactions | budgets | pnl | cashflow
let finCharts = {};

// ── Formatters (reuse existing or define locally) ─────────────────────────────
const finFmt = (n) =>
  "৳ " +
  (n || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
const finFmtCompact = (n) => {
  n = Math.abs(n || 0);
  if (n >= 100000) return "৳" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "৳" + (n / 1000).toFixed(1) + "K";
  return "৳" + n.toLocaleString();
};
const finFmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// ── Page entry point (called by loadPage) ─────────────────────────────────────
async function loadFinancePage() {
  const c = document.getElementById("content");
  document.getElementById("pageTitle").textContent = "💰 Finance Manager";

  c.innerHTML = `
    <div class="fade-up">
      <!-- ── Header ── -->
      <div class="section-header" style="margin-bottom:8px">
        <div>
          <h2 style="display:flex;align-items:center;gap:10px">
            <span style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,rgba(198,241,53,.2),rgba(45,212,191,.15));display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">💰</span>
            Finance Manager
          </h2>
          <div class="card-sub" style="margin-top:4px">Income · Expenses · P&L · Budgets · Cash Flow</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="inp" style="width:auto;font-size:12px" id="finPeriodSelect" onchange="finSetPeriod(this.value)">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month" selected>This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="finImportOrders()"><i class="fas fa-download"></i> Import Orders</button>
          <button class="btn btn-ghost btn-sm" onclick="finExportCSV()"><i class="fas fa-file-csv"></i> Export</button>
          <button class="btn btn-primary btn-sm" onclick="openFinTransactionModal()"><i class="fas fa-plus"></i> Add Entry</button>
        </div>
      </div>

      <!-- ── Tabs ── -->
      <div class="tabs" style="margin-bottom:20px;width:fit-content" id="finTabs">
        ${[
          ["overview", "fa-chart-pie", "Overview"],
          ["transactions", "fa-list", "Transactions"],
          ["budgets", "fa-bullseye", "Budgets"],
          ["pnl", "fa-file-invoice", "P&L Statement"],
          ["cashflow", "fa-water", "Cash Flow"],
        ]
          .map(
            ([key, icon, label]) =>
              `<div class="tab ${key === "overview" ? "active" : ""}" onclick="finSwitchTab('${key}')">
            <i class="fas ${icon}" style="margin-right:6px;font-size:12px"></i>${label}
          </div>`,
          )
          .join("")}
      </div>

      <!-- ── Tab content ── -->
      <div id="finTabContent"></div>
    </div>
  `;

  finActiveTab = "overview";
  await finRenderTab("overview");
}

// ── Tab switcher ──────────────────────────────────────────────────────────────
async function finSwitchTab(tab) {
  finActiveTab = tab;
  document
    .querySelectorAll("#finTabs .tab")
    .forEach((t) => t.classList.remove("active"));
  const activeEl = document.querySelector(`#finTabs .tab[onclick*="'${tab}'"]`);
  if (activeEl) activeEl.classList.add("active");
  // destroy old charts
  Object.values(finCharts).forEach((ch) => {
    try {
      ch.destroy();
    } catch (e) {}
  });
  finCharts = {};
  await finRenderTab(tab);
}

async function finRenderTab(tab) {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `<div style="display:flex;justify-content:center;padding:60px"><div class="spinner"></div></div>`;
  switch (tab) {
    case "overview":
      await finRenderOverview();
      break;
    case "transactions":
      await finRenderTransactions();
      break;
    case "budgets":
      await finRenderBudgets();
      break;
    case "pnl":
      await finRenderPnL();
      break;
    case "cashflow":
      await finRenderCashFlow();
      break;
  }
}

function finSetPeriod(p) {
  finPeriod = p;
  finFilter.period = p;
  if (finActiveTab === "overview") finRenderOverview();
  if (finActiveTab === "transactions") finRenderTransactions();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
async function finRenderOverview() {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `
    <!-- KPI Row -->
    <div class="stat-grid fade-up" id="finKpiGrid" style="margin-bottom:20px">
      ${[1, 2, 3, 4].map((i) => `<div class="stat-card stagger-${i}"><div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div><div class="skel" style="height:26px;width:70%;margin-bottom:8px"></div><div class="skel" style="height:13px;width:45%"></div></div>`).join("")}
    </div>

    <!-- Charts Row -->
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card fade-up stagger-2">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div><div class="card-title">Income vs Expenses</div><div class="card-sub">Daily trend for selected period</div></div>
        </div>
        <div style="position:relative;height:220px"><canvas id="finTrendChart"></canvas></div>
      </div>
      <div class="card fade-up stagger-3">
        <div class="card-title" style="margin-bottom:4px">Expense Breakdown</div>
        <div class="card-sub" style="margin-bottom:16px">By category</div>
        <div style="position:relative;height:180px"><canvas id="finCategoryChart"></canvas></div>
        <div id="finCategoryLegend" style="margin-top:12px;display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto"></div>
      </div>
    </div>

    <!-- Second Row -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card fade-up stagger-3">
        <div class="card-title" style="margin-bottom:4px">Payment Methods</div>
        <div class="card-sub" style="margin-bottom:16px">Distribution by method</div>
        <div id="finPayMethodList" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
      <div class="card fade-up stagger-4">
        <div class="card-title" style="margin-bottom:4px">Top Expenses</div>
        <div class="card-sub" style="margin-bottom:12px">Highest single transactions</div>
        <div id="finTopExpensesList" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
      <div class="card fade-up stagger-4">
        <div class="card-title" style="margin-bottom:4px">Top Income</div>
        <div class="card-sub" style="margin-bottom:12px">Highest income entries</div>
        <div id="finTopIncomeList" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
    </div>

    <!-- Balance + Order cross-check -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card fade-up stagger-5" id="finBalanceCard">
        <div class="card-title" style="margin-bottom:16px"><i class="fas fa-scale-balanced" style="color:var(--lime);margin-right:8px"></i>Account Balances</div>
        <div id="finBalanceList"></div>
      </div>
      <div class="card fade-up stagger-5">
        <div class="card-title" style="margin-bottom:4px"><i class="fas fa-boxes-stacked" style="color:var(--sky);margin-right:8px"></i>Order Revenue Cross-Check</div>
        <div class="card-sub" style="margin-bottom:16px">Comparing manual entries vs order data</div>
        <div id="finOrderCrossCheck"></div>
      </div>
    </div>
  `;

  try {
    const [summaryRes, balanceRes] = await Promise.all([
      apiCall(`/finance/summary?period=${finPeriod}`),
      apiCall("/finance/balance"),
    ]);

    const d = summaryRes.data;
    const ov = d.overview;

    // KPI cards
    const incChange = ov.incomeChangePercent;
    const expChange = ov.expenseChangePercent;
    document.getElementById("finKpiGrid").innerHTML = `
      ${finKpiCard(
        "Total Income",
        finFmt(ov.totalIncome),
        "fa-arrow-trend-up",
        "var(--lime)",
        "rgba(198,241,53,.15)",
        incChange !== null
          ? `${incChange > 0 ? "+" : ""}${incChange}% vs prev period`
          : `${ov.incomeCount} transactions`,
        incChange >= 0 ? "up" : "down",
      )}
      ${finKpiCard(
        "Total Expenses",
        finFmt(ov.totalExpense),
        "fa-arrow-trend-down",
        "var(--rose)",
        "rgba(244,63,94,.15)",
        expChange !== null
          ? `${expChange > 0 ? "+" : ""}${expChange}% vs prev period`
          : `${ov.expenseCount} transactions`,
        expChange <= 0 ? "up" : "down",
      )}
      ${finKpiCard(
        "Net Balance",
        finFmt(ov.netBalance),
        "fa-wallet",
        ov.netBalance >= 0 ? "var(--teal)" : "var(--rose)",
        ov.netBalance >= 0 ? "rgba(45,212,191,.15)" : "rgba(244,63,94,.15)",
        ov.netBalance >= 0
          ? "Profitable period ✓"
          : "Deficit — review expenses",
        ov.netBalance >= 0 ? "up" : "down",
      )}
      ${finKpiCard(
        "Avg Expense",
        finFmt(ov.avgExpense),
        "fa-calculator",
        "var(--amber)",
        "rgba(245,166,35,.15)",
        `Avg income: ${finFmt(ov.avgIncome)}`,
        "up",
      )}
    `;

    // Trend chart
    const trendData = d.dailyTrend || [];
    const labels = trendData.map((t) =>
      t.date
        ? new Date(t.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })
        : "",
    );
    const incomeVals = trendData.map((t) => t.income || 0);
    const expenseVals = trendData.map((t) => t.expense || 0);

    const tCtx = document.getElementById("finTrendChart");
    if (tCtx) {
      const incGrad = tCtx.getContext("2d").createLinearGradient(0, 0, 0, 220);
      incGrad.addColorStop(0, "rgba(198,241,53,.3)");
      incGrad.addColorStop(1, "rgba(198,241,53,0)");
      const expGrad = tCtx.getContext("2d").createLinearGradient(0, 0, 0, 220);
      expGrad.addColorStop(0, "rgba(244,63,94,.25)");
      expGrad.addColorStop(1, "rgba(244,63,94,0)");
      finCharts.trend = new Chart(tCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Income",
              data: incomeVals,
              borderColor: "#c6f135",
              backgroundColor: incGrad,
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#c6f135",
            },
            {
              label: "Expenses",
              data: expenseVals,
              borderColor: "#f43f5e",
              backgroundColor: expGrad,
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#f43f5e",
            },
          ],
        },
        options: finChartOpts("line", true),
      });
    }

    // Category donut
    const cats = d.categoryBreakdown || [];
    const catColors = [
      "#c6f135",
      "#38bdf8",
      "#2dd4bf",
      "#f5a623",
      "#f43f5e",
      "#8b5cf6",
      "#fb923c",
      "#a3e635",
      "#22d3ee",
      "#e879f9",
    ];
    const catCtx = document.getElementById("finCategoryChart");
    if (catCtx && cats.length) {
      finCharts.cat = new Chart(catCtx, {
        type: "doughnut",
        data: {
          labels: cats.map((c) => c._id),
          datasets: [
            {
              data: cats.map((c) => c.total),
              backgroundColor: catColors
                .slice(0, cats.length)
                .map((c) => c + "CC"),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false } },
        },
      });

      const grandTotal = cats.reduce((s, c) => s + c.total, 0);
      document.getElementById("finCategoryLegend").innerHTML = cats
        .slice(0, 8)
        .map((c, i) => {
          const pct =
            grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
          return `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
          <span style="width:8px;height:8px;border-radius:2px;background:${catColors[i]};flex-shrink:0"></span>
          <span style="flex:1;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c._id}</span>
          <span style="color:var(--text3)">${pct}%</span>
          <span style="color:var(--lime);font-weight:700;min-width:60px;text-align:right">${finFmtCompact(c.total)}</span>
        </div>`;
        })
        .join("");
    }

    // Payment methods
    const methods = d.paymentMethodBreakdown || [];
    const methMap = {};
    methods.forEach((m) => {
      const k = m._id.method;
      if (!methMap[k]) methMap[k] = { income: 0, expense: 0 };
      methMap[k][m._id.type] = m.total;
    });
    const methIcons = {
      cash: "💵",
      bkash: "🔴",
      nagad: "🟠",
      rocket: "🚀",
      bank_transfer: "🏦",
      card: "💳",
      cheque: "📝",
      other: "💰",
    };
    document.getElementById("finPayMethodList").innerHTML =
      Object.entries(methMap)
        .map(
          ([m, v]) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
        <span style="font-size:16px">${methIcons[m] || "💰"}</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text2)">${m.replace(/_/g, " ")}</div>
          <div style="font-size:10px;color:var(--text3)">
            <span style="color:var(--lime)">↑ ${finFmtCompact(v.income || 0)}</span>
            <span style="margin:0 4px">·</span>
            <span style="color:var(--rose)">↓ ${finFmtCompact(v.expense || 0)}</span>
          </div>
        </div>
      </div>
    `,
        )
        .join("") ||
      '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">No data</div>';

    // Top expenses / income
    const renderTopList = (items, containerId, isExpense) => {
      const el = document.getElementById(containerId);
      if (!el || !items.length) {
        if (el)
          el.innerHTML =
            '<div style="color:var(--text3);font-size:12px;padding:8px">No transactions yet</div>';
        return;
      }
      el.innerHTML = items
        .map(
          (t) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;overflow:hidden">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title || "—"}</div>
            <div style="font-size:10px;color:var(--text3)">${t.category} · ${finFmtDate(t.date)}</div>
          </div>
          <div style="font-size:14px;font-weight:800;font-family:'Syne',sans-serif;color:${isExpense ? "var(--rose)" : "var(--lime)"};flex-shrink:0">
            ${isExpense ? "-" : "+"}${finFmtCompact(t.amount)}
          </div>
        </div>
      `,
        )
        .join("");
    };
    renderTopList(d.topExpenses || [], "finTopExpensesList", true);
    renderTopList(d.topIncome || [], "finTopIncomeList", false);

    // Balance card
    const bal = balanceRes.data;
    document.getElementById("finBalanceList").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(135deg,var(--lime-dim),rgba(45,212,191,.08));border-radius:12px;margin-bottom:12px">
        <span style="font-size:13px;font-weight:600">Net Balance</span>
        <span style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:${bal.netBalance >= 0 ? "var(--lime)" : "var(--rose)"}">${finFmt(bal.netBalance)}</span>
      </div>
      ${(bal.paymentMethods || [])
        .map(
          (m) => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
          <span style="color:var(--text2)">${methIcons[m.method] || "💰"} ${m.method.replace(/_/g, " ")}</span>
          <span style="font-weight:700;color:${m.net >= 0 ? "var(--teal)" : "var(--rose)"}">${finFmt(m.net)}</span>
        </div>
      `,
        )
        .join("")}
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" onclick="finSwitchTab('transactions')">
        <i class="fas fa-list"></i> View All Transactions
      </button>
    `;

    // Order cross-check
    const os = d.orderSales || {};
    const manualIncome = ov.totalIncome;
    const diff = manualIncome - (os.totalRevenue || 0);
    document.getElementById("finOrderCrossCheck").innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="info-row"><span>Order Revenue (delivered)</span><span style="color:var(--lime);font-weight:700">${finFmt(os.totalRevenue)}</span></div>
        <div class="info-row"><span>Manual Income Entries</span><span style="font-weight:700">${finFmt(manualIncome)}</span></div>
        <div class="info-row"><span>Delivered Orders</span><span>${os.orderCount || 0}</span></div>
        <div class="info-row"><span>Gross Profit (from orders)</span><span style="color:var(--teal);font-weight:700">${finFmt(os.totalProfit)}</span></div>
        <div style="margin-top:8px;padding:10px;background:${Math.abs(diff) < 1000 ? "var(--lime-dim)" : "rgba(245,166,35,.1)"};border-radius:10px;font-size:12px">
          ${
            Math.abs(diff) < 1000
              ? `<span style="color:var(--lime)">✓ Income entries closely match order revenue</span>`
              : `<span style="color:var(--amber)">⚠ Difference of ${finFmt(Math.abs(diff))} — consider importing orders</span>`
          }
          <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%" onclick="finImportOrders()">
            <i class="fas fa-download"></i> Auto-Import Order Income
          </button>
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById("finTabContent").innerHTML = `
      <div class="card" style="text-align:center;padding:60px;color:var(--rose)">
        <i class="fas fa-exclamation-triangle" style="font-size:40px;margin-bottom:16px;display:block"></i>
        <div class="card-title">Failed to load overview</div>
        <div class="card-sub" style="margin:8px 0">${e.message}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="finRenderOverview()"><i class="fas fa-rotate-right"></i> Retry</button>
      </div>`;
  }
}

function finKpiCard(label, value, icon, color, bg, sub, dir) {
  return `<div class="stat-card fade-up" style="--accent:${color}">
    <div class="stat-icon" style="background:${bg};color:${color}"><i class="fas ${icon}"></i></div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-sub ${dir}" style="color:${color}"><i class="fas fa-circle" style="font-size:7px"></i> ${sub}</div>
  </div>`;
}

function finChartOpts(type, showLegend) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: {
        display: showLegend,
        labels: { color: "#8f9baa", font: { size: 11 }, padding: 12 },
      },
      tooltip: {
        backgroundColor: "#1e2328",
        borderColor: "#252b31",
        borderWidth: 1,
        titleColor: "#8f9baa",
        bodyColor: "#e8ecef",
        padding: 12,
        callbacks: { label: (ctx) => " " + finFmt(ctx.raw) },
      },
    },
    scales:
      type === "line" || type === "bar"
        ? {
            x: {
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: { color: "#5a6472", font: { size: 10 } },
            },
            y: {
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: {
                color: "#5a6472",
                font: { size: 10 },
                callback: (v) => finFmtCompact(v),
              },
              beginAtZero: true,
            },
          }
        : {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function finRenderTransactions() {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `
    <!-- Filters -->
    <div class="card fade-up" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr auto auto auto auto auto auto;gap:10px;align-items:center">
        <div class="inp-group"><i class="fas fa-search"></i><input class="inp" id="finSearch" placeholder="Search title, reference, party..." value="${finFilter.search}" oninput="finFilter.search=this.value;finPage=1;finLoadTransactionList()"></div>
        <select class="inp" style="width:auto" onchange="finFilter.type=this.value;finPage=1;finLoadTransactionList()">
          <option value="">All Types</option>
          <option value="income" ${finFilter.type === "income" ? "selected" : ""}>Income</option>
          <option value="expense" ${finFilter.type === "expense" ? "selected" : ""}>Expense</option>
          <option value="transfer" ${finFilter.type === "transfer" ? "selected" : ""}>Transfer</option>
        </select>
        <select class="inp" style="width:auto" onchange="finFilter.period=this.value;finPage=1;finLoadTransactionList()">
          <option value="today" ${finFilter.period === "today" ? "selected" : ""}>Today</option>
          <option value="week" ${finFilter.period === "week" ? "selected" : ""}>This Week</option>
          <option value="month" ${finFilter.period === "month" ? "selected" : ""}>This Month</option>
          <option value="year" ${finFilter.period === "year" ? "selected" : ""}>This Year</option>
          <option value="all" ${finFilter.period === "all" ? "selected" : ""}>All Time</option>
        </select>
        <select class="inp" style="width:auto" onchange="finFilter.paymentMethod=this.value;finPage=1;finLoadTransactionList()">
          <option value="">All Methods</option>
          ${["cash", "bkash", "nagad", "rocket", "bank_transfer", "card", "cheque", "other"].map((m) => `<option value="${m}" ${finFilter.paymentMethod === m ? "selected" : ""}>${m.replace(/_/g, " ")}</option>`).join("")}
        </select>
        <select class="inp" style="width:auto" onchange="finFilter.status=this.value;finPage=1;finLoadTransactionList()">
          <option value="">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="void">Voided</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="finFilter={type:'',category:'',period:'month',search:'',paymentMethod:'',status:''};finPage=1;finRenderTransactions()"><i class="fas fa-rotate-right"></i></button>
        <button class="btn btn-primary btn-sm" onclick="openFinTransactionModal()"><i class="fas fa-plus"></i> Add</button>
      </div>
    </div>

    <!-- Summary strip -->
    <div id="finTxSummary" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap"></div>

    <!-- Table -->
    <div class="card fade-up" style="padding:0;overflow:hidden">
      <table class="data-table">
        <thead><tr>
          <th>Date</th><th>Title / Ref</th><th>Category</th><th>Type</th>
          <th>Method</th><th>Party</th><th style="text-align:right">Amount</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody id="finTxBody"><tr><td colspan="9" style="text-align:center;padding:48px"><div class="spinner" style="margin:0 auto"></div></td></tr></tbody>
      </table>
      <div style="padding:16px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;color:var(--text3)" id="finTxInfo"></div>
        <div class="pagination" id="finTxPages"></div>
      </div>
    </div>
  `;
  await finLoadTransactionList();
}

async function finLoadTransactionList() {
  try {
    const qs = new URLSearchParams({ page: finPage, limit: 20 });
    if (finFilter.type) qs.set("type", finFilter.type);
    if (finFilter.period) qs.set("period", finFilter.period);
    if (finFilter.search) qs.set("search", finFilter.search);
    if (finFilter.paymentMethod)
      qs.set("paymentMethod", finFilter.paymentMethod);
    if (finFilter.status) qs.set("status", finFilter.status);

    const res = await apiCall(`/finance/transactions?${qs}`);
    finTotalPages = res.pagination?.pages || 1;
    const txs = res.data || [];
    const sum = res.summary || {};

    // Summary strip
    const sumEl = document.getElementById("finTxSummary");
    if (sumEl) {
      sumEl.innerHTML = `
        <div style="background:rgba(198,241,53,.1);border:1px solid rgba(198,241,53,.2);border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-arrow-up" style="color:var(--lime);font-size:11px"></i>
          <span style="font-size:12px;color:var(--text3)">Income</span>
          <span style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--lime)">${finFmt(sum.totalIncome)}</span>
        </div>
        <div style="background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.2);border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-arrow-down" style="color:var(--rose);font-size:11px"></i>
          <span style="font-size:12px;color:var(--text3)">Expenses</span>
          <span style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--rose)">${finFmt(sum.totalExpense)}</span>
        </div>
        <div style="background:${sum.netBalance >= 0 ? "rgba(45,212,191,.1)" : "rgba(244,63,94,.1)"};border:1px solid ${sum.netBalance >= 0 ? "rgba(45,212,191,.2)" : "rgba(244,63,94,.2)"};border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-wallet" style="color:${sum.netBalance >= 0 ? "var(--teal)" : "var(--rose)"};font-size:11px"></i>
          <span style="font-size:12px;color:var(--text3)">Net</span>
          <span style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:${sum.netBalance >= 0 ? "var(--teal)" : "var(--rose)"}">${finFmt(sum.netBalance)}</span>
        </div>
      `;
    }

    document.getElementById("finTxBody").innerHTML = txs.length
      ? txs.map((t) => finRenderTxRow(t)).join("")
      : `<tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text3)"><i class="fas fa-receipt" style="font-size:32px;margin-bottom:12px;display:block"></i>No transactions found</td></tr>`;

    document.getElementById("finTxInfo").textContent =
      `${res.pagination?.total || txs.length} transactions · Page ${finPage} of ${finTotalPages}`;
    renderPagination("finTxPages", finPage, finTotalPages, (p) => {
      finPage = p;
      finLoadTransactionList();
    });
  } catch (e) {
    showToast(e.message, "error");
  }
}

function finRenderTxRow(t) {
  const typeColor =
    t.type === "income"
      ? "var(--lime)"
      : t.type === "expense"
        ? "var(--rose)"
        : "var(--sky)";
  const typeIcon =
    t.type === "income"
      ? "fa-arrow-up"
      : t.type === "expense"
        ? "fa-arrow-down"
        : "fa-arrows-left-right";
  const statusBadgeHtml =
    t.status === "approved"
      ? '<span class="badge badge-lime" style="font-size:10px">✓ OK</span>'
      : t.status === "void"
        ? '<span class="badge badge-rose" style="font-size:10px">Void</span>'
        : '<span class="badge badge-amber" style="font-size:10px">Pending</span>';
  const isRecurring = t.isRecurring
    ? '<i class="fas fa-rotate" style="color:var(--sky);font-size:10px;margin-left:4px" title="Recurring"></i>'
    : "";

  return `
    <tr onclick="openFinTransactionModal('${t._id}')" ${t.status === "void" ? 'style="opacity:.5"' : ""}>
      <td style="font-size:12px;color:var(--text2)">${finFmtDate(t.date)}</td>
      <td>
        <div style="font-weight:600;font-size:13px">${escapeHtml(t.title)}${isRecurring}</div>
        ${t.referenceNumber ? `<div style="font-size:10px;color:var(--text3);font-family:monospace">${t.referenceNumber}</div>` : ""}
      </td>
      <td>
        <span style="background:var(--surface2);color:var(--text2);padding:2px 8px;border-radius:6px;font-size:11px">${t.category || "—"}</span>
        ${t.subcategory ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${t.subcategory}</div>` : ""}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${typeColor}">
          <i class="fas ${typeIcon}" style="font-size:10px"></i>${t.type}
        </span>
      </td>
      <td style="font-size:12px;color:var(--text2)">${(t.paymentMethod || "").replace(/_/g, " ")}</td>
      <td style="font-size:12px">${t.party?.name ? escapeHtml(t.party.name) : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="text-align:right">
        <span style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:${typeColor}">
          ${t.type === "expense" ? "-" : "+"}${finFmtCompact(t.amount)}
        </span>
      </td>
      <td>${statusBadgeHtml}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openFinTransactionModal('${t._id}')" title="Edit"><i class="fas fa-edit"></i></button>
          ${t.status !== "void" ? `<button class="btn btn-danger btn-sm btn-icon" onclick="finVoidTransaction('${t._id}')" title="Void"><i class="fas fa-ban"></i></button>` : ""}
        </div>
      </td>
    </tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — BUDGETS
// ─────────────────────────────────────────────────────────────────────────────
async function finRenderBudgets() {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-primary btn-sm" onclick="openFinBudgetModal()"><i class="fas fa-plus"></i> New Budget</button>
    </div>
    <div id="finBudgetGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
      <div style="grid-column:1/-1;text-align:center;padding:60px"><div class="spinner" style="margin:0 auto"></div></div>
    </div>
  `;
  await finLoadBudgets();
}

async function finLoadBudgets() {
  try {
    const res = await apiCall("/finance/budgets");
    const budgets = res.data || [];
    const grid = document.getElementById("finBudgetGrid");

    if (!budgets.length) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;text-align:center;padding:60px">
          <i class="fas fa-bullseye" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block"></i>
          <div class="card-title">No Budgets Set</div>
          <div class="card-sub" style="margin:8px 0">Set spending limits per category to track your expenses</div>
          <button class="btn btn-primary" style="margin-top:16px" onclick="openFinBudgetModal()"><i class="fas fa-plus"></i> Create First Budget</button>
        </div>`;
      return;
    }

    grid.innerHTML = budgets
      .map((b) => {
        const pct = b.percentage || 0;
        const isOver = b.isOverBudget;
        const isNear = b.isNearLimit && !isOver;
        const barColor = isOver
          ? "var(--rose)"
          : isNear
            ? "var(--amber)"
            : "var(--lime)";
        const statusIcon = isOver ? "🔴" : isNear ? "🟡" : "🟢";

        return `
        <div class="card fade-up" style="padding:0;overflow:hidden;border-color:${isOver ? "rgba(244,63,94,.3)" : isNear ? "rgba(245,166,35,.3)" : "var(--border)"}">
          <div style="height:3px;background:${barColor};width:${Math.min(pct, 100)}%;transition:width .6s ease"></div>
          <div style="padding:20px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
              <div>
                <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700">${escapeHtml(b.name)}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:3px">${b.category} · ${b.period}</div>
              </div>
              <div style="font-size:22px">${statusIcon}</div>
            </div>

            <!-- Progress bar -->
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:6px">
                <span>Spent: <strong style="color:var(--text)">${finFmt(b.totalSpent)}</strong></span>
                <span>Budget: <strong style="color:var(--text)">${finFmt(b.amount)}</strong></span>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${Math.min(pct, 100)}%;background:${barColor};transition:width .6s ease"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:10px">
                <span style="color:${barColor};font-weight:700">${pct.toFixed(1)}% used</span>
                <span style="color:var(--text3)">${isOver ? `Over by ${finFmt(Math.abs(b.remaining))}` : `${finFmt(b.remaining)} remaining`}</span>
              </div>
            </div>

            <!-- Dates -->
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:14px;padding:8px;background:var(--bg);border-radius:8px">
              <span>${finFmtDate(b.startDate)}</span>
              <i class="fas fa-arrow-right" style="font-size:10px"></i>
              <span>${finFmtDate(b.endDate)}</span>
            </div>

            ${b.notes ? `<div style="font-size:11px;color:var(--text3);margin-bottom:12px;font-style:italic">"${escapeHtml(b.notes)}"</div>` : ""}

            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openFinBudgetModal('${b._id}')"><i class="fas fa-edit"></i> Edit</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="finDeleteBudget('${b._id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — P&L STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function finRenderPnL() {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
      <div class="card-title">Monthly P&L Statement</div>
      <select class="inp" style="width:auto" id="finPnLMonths" onchange="finLoadPnL(this.value)">
        <option value="6">Last 6 Months</option>
        <option value="12" selected>Last 12 Months</option>
        <option value="24">Last 24 Months</option>
      </select>
    </div>

    <!-- Chart -->
    <div class="card fade-up" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:16px">Revenue, Costs & Net Profit</div>
      <div style="position:relative;height:260px"><canvas id="finPnLChart"></canvas></div>
    </div>

    <!-- Table -->
    <div class="card fade-up" style="padding:0;overflow:hidden">
      <table class="data-table" id="finPnLTable">
        <thead><tr>
          <th>Month</th><th>Sales Revenue</th><th>Other Income</th><th>COGS (Product)</th>
          <th>Packaging</th><th>Delivery</th><th>Op. Expenses</th>
          <th>Total Cost</th><th>Net Profit</th><th>Margin</th>
        </tr></thead>
        <tbody id="finPnLBody"><tr><td colspan="10" style="text-align:center;padding:48px"><div class="spinner" style="margin:0 auto"></div></td></tr></tbody>
      </table>
    </div>
  `;
  await finLoadPnL(12);
}

async function finLoadPnL(months = 12) {
  try {
    const res = await apiCall(`/finance/pnl?months=${months}`);
    const rows = res.data || [];

    // Chart
    const ctx = document.getElementById("finPnLChart");
    if (ctx) {
      if (finCharts.pnl) finCharts.pnl.destroy();
      const labels = rows.map((r) => r.label || `${r.month}/${r.year}`);
      finCharts.pnl = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Revenue",
              data: rows.map((r) => r.totalIncome),
              backgroundColor: "rgba(198,241,53,.7)",
              borderRadius: 4,
            },
            {
              label: "Costs",
              data: rows.map((r) => r.totalExpense),
              backgroundColor: "rgba(244,63,94,.5)",
              borderRadius: 4,
            },
            {
              label: "Net Profit",
              data: rows.map((r) => r.netProfit),
              type: "line",
              borderColor: "#2dd4bf",
              backgroundColor: "rgba(45,212,191,.15)",
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#2dd4bf",
            },
          ],
        },
        options: {
          ...finChartOpts("bar", true),
          scales: {
            x: {
              stacked: false,
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: { color: "#5a6472", font: { size: 10 } },
            },
            y: {
              stacked: false,
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: {
                color: "#5a6472",
                font: { size: 10 },
                callback: (v) => finFmtCompact(v),
              },
              beginAtZero: true,
            },
          },
        },
      });
    }

    // Table
    let totalRevenue = 0,
      totalProfit = 0,
      totalCost = 0;
    const tbody = document.getElementById("finPnLBody");
    tbody.innerHTML = rows.length
      ? rows
          .map((r) => {
            totalRevenue += r.totalIncome || 0;
            totalProfit += r.netProfit || 0;
            totalCost += r.totalExpense || 0;
            const profitColor =
              r.netProfit >= 0 ? "var(--lime)" : "var(--rose)";
            const marginColor =
              r.netMargin >= 20
                ? "var(--lime)"
                : r.netMargin >= 0
                  ? "var(--amber)"
                  : "var(--rose)";
            return `
        <tr>
          <td style="font-weight:600">${r.label}</td>
          <td style="color:var(--lime)">${finFmtCompact(r.salesRevenue)}</td>
          <td style="color:var(--teal)">${finFmtCompact(r.otherIncome)}</td>
          <td style="color:var(--rose)">${finFmtCompact(r.cogsProduct)}</td>
          <td style="color:var(--rose)">${finFmtCompact(r.cogsPackaging)}</td>
          <td style="color:var(--rose)">${finFmtCompact(r.cogsDelivery)}</td>
          <td style="color:var(--rose)">${finFmtCompact(r.operatingExpenses)}</td>
          <td style="font-weight:600;color:var(--text2)">${finFmtCompact(r.totalExpense)}</td>
          <td style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${profitColor}">${finFmt(r.netProfit)}</td>
          <td><span style="background:${marginColor}20;color:${marginColor};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${r.netMargin}%</span></td>
        </tr>`;
          })
          .join("") +
        `
        <tr style="background:var(--bg);border-top:2px solid var(--border2)">
          <td style="font-weight:700;color:var(--lime)">TOTAL</td>
          <td style="font-weight:700;color:var(--lime)">${finFmt(totalRevenue)}</td>
          <td colspan="5"></td>
          <td style="font-weight:700">${finFmt(totalCost)}</td>
          <td style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:${totalProfit >= 0 ? "var(--lime)" : "var(--rose)"}">${finFmt(totalProfit)}</td>
          <td><span style="font-weight:700;color:${totalProfit >= 0 ? "var(--lime)" : "var(--rose)"}">${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</span></td>
        </tr>
    `
      : `<tr><td colspan="10" style="text-align:center;padding:48px;color:var(--text3)">No P&L data available. Add transactions or import orders.</td></tr>`;
  } catch (e) {
    showToast("P&L load error: " + e.message, "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — CASH FLOW
// ─────────────────────────────────────────────────────────────────────────────
async function finRenderCashFlow() {
  const el = document.getElementById("finTabContent");
  el.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
      <div>
        <div class="card-title">Cash Flow Projection</div>
        <div class="card-sub">Based on recurring transactions</div>
      </div>
      <select class="inp" style="width:auto" id="finCfDays" onchange="finLoadCashFlow(this.value)">
        <option value="14">Next 14 days</option>
        <option value="30" selected>Next 30 days</option>
        <option value="60">Next 60 days</option>
        <option value="90">Next 90 days</option>
      </select>
    </div>

    <!-- Current balance banner -->
    <div id="finCfBanner" style="margin-bottom:20px"></div>

    <!-- Chart -->
    <div class="card fade-up" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:16px">Running Balance Projection</div>
      <div style="position:relative;height:220px"><canvas id="finCfChart"></canvas></div>
    </div>

    <!-- Category analytics for expenses -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card fade-up">
        <div class="card-title" style="margin-bottom:4px">Expense Category Trends</div>
        <div class="card-sub" style="margin-bottom:16px">Compared to last period</div>
        <div id="finCatTrends"></div>
      </div>
      <div class="card fade-up">
        <div class="card-title" style="margin-bottom:4px">Recurring Transactions</div>
        <div class="card-sub" style="margin-bottom:16px">Scheduled for upcoming period</div>
        <div id="finRecurringList"></div>
      </div>
    </div>

    <!-- Projection table -->
    <div class="card fade-up" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-family:'Syne',sans-serif;font-size:14px;font-weight:700">
        Projected Cash Events
      </div>
      <div id="finCfTable" style="max-height:360px;overflow-y:auto;padding:16px"></div>
    </div>
  `;

  await finLoadCashFlow(30);
  await finLoadCatTrends();
}

async function finLoadCashFlow(days = 30) {
  try {
    const res = await apiCall(`/finance/cashflow?days=${days}`);
    const currentBalance = res.currentBalance || 0;
    const projections = res.projections || [];

    // Banner
    const bannerEl = document.getElementById("finCfBanner");
    if (bannerEl) {
      bannerEl.innerHTML = `
        <div style="background:linear-gradient(135deg,var(--surface),var(--bg));border:1px solid var(--border);border-radius:16px;padding:20px 24px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <div style="text-align:center;min-width:120px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">CURRENT BALANCE</div>
            <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:${currentBalance >= 0 ? "var(--lime)" : "var(--rose)"}">${finFmt(currentBalance)}</div>
          </div>
          <div style="width:1px;height:40px;background:var(--border)"></div>
          <div style="flex:1;font-size:12px;color:var(--text3)">
            Calculated from all approved income minus expenses. 
            Add the <em>account</em> field on transactions to track per-account balances.
          </div>
          <button class="btn btn-ghost btn-sm" onclick="finSwitchTab('transactions')">
            <i class="fas fa-list"></i> View Transactions
          </button>
        </div>`;
    }

    // Chart
    const chartDates = projections.filter(
      (p) => p.items?.length > 0 || projections.indexOf(p) % 5 === 0,
    );
    const ctx = document.getElementById("finCfChart");
    if (ctx) {
      if (finCharts.cf) finCharts.cf.destroy();
      const labels = projections.map((p) =>
        new Date(p.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
      );
      const balances = projections.map((p) => p.runningBalance);
      const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 220);
      grad.addColorStop(
        0,
        currentBalance >= 0 ? "rgba(198,241,53,.3)" : "rgba(244,63,94,.3)",
      );
      grad.addColorStop(1, "rgba(0,0,0,0)");
      finCharts.cf = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Projected Balance",
              data: balances,
              borderColor: currentBalance >= 0 ? "#c6f135" : "#f43f5e",
              backgroundColor: grad,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 2,
              pointBackgroundColor: currentBalance >= 0 ? "#c6f135" : "#f43f5e",
            },
          ],
        },
        options: finChartOpts("line", false),
      });
    }

    // Projection table
    const tableEl = document.getElementById("finCfTable");
    const eventDays = projections.filter((p) => p.items?.length > 0);
    if (tableEl) {
      tableEl.innerHTML = eventDays.length
        ? eventDays
            .map(
              (p) => `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;letter-spacing:.5px">${finFmtDate(p.date)}</div>
          ${p.items
            .map(
              (item) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:4px;font-size:12px">
              <i class="fas fa-rotate" style="color:var(--sky);font-size:11px"></i>
              <span style="flex:1;font-weight:500">${escapeHtml(item.title)}</span>
              <span class="badge ${item.type === "income" ? "badge-lime" : "badge-rose"}" style="font-size:10px">${item.type}</span>
              <span style="font-weight:700;color:${item.type === "income" ? "var(--lime)" : "var(--rose)"}">${item.type === "income" ? "+" : "-"}${finFmtCompact(item.amount)}</span>
            </div>
          `,
            )
            .join("")}
          <div style="text-align:right;font-size:11px;color:var(--text3);margin-top:4px">
            Running balance → <strong style="color:${p.runningBalance >= 0 ? "var(--lime)" : "var(--rose)"}">${finFmt(p.runningBalance)}</strong>
          </div>
        </div>
      `,
            )
            .join("")
        : `<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px"><i class="fas fa-calendar-check" style="font-size:28px;margin-bottom:10px;display:block"></i>No scheduled events found.<br>Add recurring transactions to see projections.</div>`;
    }

    // Recurring list
    const recEl = document.getElementById("finRecurringList");
    if (recEl) {
      const allItems = eventDays.flatMap((p) => p.items);
      const uniqueByTitle = [
        ...new Map(allItems.map((i) => [i.title, i])).values(),
      ];
      recEl.innerHTML = uniqueByTitle.length
        ? uniqueByTitle
            .map(
              (i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:6px;font-size:12px">
          <i class="fas fa-rotate" style="color:var(--sky);font-size:10px"></i>
          <span style="flex:1">${escapeHtml(i.title)}</span>
          <span style="font-weight:700;color:${i.type === "income" ? "var(--lime)" : "var(--rose)"}">${i.type === "income" ? "+" : "-"}${finFmtCompact(i.amount)}</span>
        </div>
      `,
            )
            .join("")
        : '<div style="color:var(--text3);font-size:12px;padding:8px">No recurring items. Add recurring=true to transactions.</div>';
    }
  } catch (e) {
    showToast("Cash flow error: " + e.message, "error");
  }
}

async function finLoadCatTrends() {
  try {
    const res = await apiCall(
      `/finance/analytics/categories?type=expense&period=${finPeriod}`,
    );
    const cats = res.data || [];
    const el = document.getElementById("finCatTrends");
    if (!el) return;
    el.innerHTML =
      cats
        .slice(0, 8)
        .map((c) => {
          const changeNum = c.changePercent
            ? parseFloat(c.changePercent)
            : null;
          const changeColor =
            changeNum === null
              ? "var(--text3)"
              : changeNum > 0
                ? "var(--rose)"
                : "var(--lime)";
          const changeIcon =
            changeNum === null ? "" : changeNum > 0 ? "↑" : "↓";
          return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
          <div style="flex:1">
            <div style="font-weight:600;color:var(--text2)">${c.category}</div>
            <div style="font-size:10px;color:var(--text3)">${c.count} transactions</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--rose)">${finFmt(c.total)}</div>
            ${changeNum !== null ? `<div style="font-size:10px;color:${changeColor}">${changeIcon}${Math.abs(changeNum)}% vs prev</div>` : ""}
          </div>
        </div>`;
        })
        .join("") ||
      '<div style="color:var(--text3);font-size:12px;padding:8px">No category data yet.</div>';
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────────────────────

// ── Transaction Modal ─────────────────────────────────────────────────────────
async function openFinTransactionModal(id = null) {
  let tx = null;
  let cats = { expense: [], income: [] };

  try {
    const catsRes = await apiCall("/finance/categories");
    cats = catsRes.data || cats;
  } catch (e) {}

  if (id) {
    try {
      tx = (await apiCall(`/finance/transactions/${id}`)).data;
    } catch (e) {}
  }

  const fmtForInput = (d) =>
    d
      ? new Date(d).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

  modal(`
    <div class="modal-box wide" style="max-width:700px">
      <div class="modal-header" style="border-bottom-color:var(--lime)">
        <div>
          <div class="modal-title" style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${id ? "✏️" : "➕"}</span>
            ${id ? "Edit Transaction" : "New Transaction"}
          </div>
          <div class="modal-sub">${id ? "Update financial entry" : "Record income, expense or transfer"}</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="finTxForm">
        <div class="modal-body">

          <!-- Type selector -->
          <div style="display:flex;gap:8px;margin-bottom:20px" id="finTxTypeBar">
            ${["income", "expense", "transfer"]
              .map(
                (t) => `
              <label style="flex:1;cursor:pointer">
                <input type="radio" name="type" value="${t}" ${(!tx && t === "expense") || tx?.type === t ? "checked" : ""} style="display:none" onchange="finUpdateCategoryList(this.value)">
                <div class="fin-type-btn" data-type="${t}" style="padding:10px;text-align:center;border-radius:10px;border:1.5px solid var(--border);transition:all .2s;font-size:13px;font-weight:600">
                  ${t === "income" ? "↑ Income" : t === "expense" ? "↓ Expense" : "⇄ Transfer"}
                </div>
              </label>
            `,
              )
              .join("")}
          </div>

          <div class="form-grid">
            <div class="form-group full">
              <label class="form-label">Title *</label>
              <input class="inp" name="title" placeholder="e.g. Facebook Ads, Salary, Sales Revenue" required value="${escapeHtml(tx?.title || "")}">
            </div>

            <div class="form-group">
              <label class="form-label">Amount (৳) *</label>
              <div class="inp-group"><i class="fas fa-bangladeshi-taka-sign"></i>
                <input class="inp" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" value="${tx?.amount || ""}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Date *</label>
              <input class="inp" name="date" type="date" required value="${fmtForInput(tx?.date)}">
            </div>

            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="inp" name="category" id="finCategorySelect" required>
                <option value="">Select Category</option>
                ${(tx?.type === "income" ? cats.income : cats.expense).map((c) => `<option value="${c}" ${tx?.category === c ? "selected" : ""}>${c}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Sub-Category</label>
              <input class="inp" name="subcategory" placeholder="Optional sub-category" value="${escapeHtml(tx?.subcategory || "")}">
            </div>

            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select class="inp" name="paymentMethod">
                ${["cash", "bkash", "nagad", "rocket", "bank_transfer", "card", "cheque", "other"].map((m) => `<option value="${m}" ${tx?.paymentMethod === m ? "selected" : ""}>${m.replace(/_/g, " ")}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Account</label>
              <input class="inp" name="account" placeholder="e.g. Main Account, Petty Cash" value="${escapeHtml(tx?.account || "")}">
            </div>

            <div class="form-group">
              <label class="form-label">Reference Type</label>
              <select class="inp" name="referenceType">
                ${["manual", "order", "product", "supplier", "salary", "utility", "marketing", "other"].map((r) => `<option value="${r}" ${tx?.referenceType === r ? "selected" : ""}>${r}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Reference # / Invoice</label>
              <input class="inp" name="referenceNumber" placeholder="Order number, invoice #..." value="${escapeHtml(tx?.referenceNumber || "")}">
            </div>

            <!-- Party info -->
            <div class="form-group">
              <label class="form-label">Party Name</label>
              <input class="inp" name="partyName" placeholder="Vendor / Customer / Employee" value="${escapeHtml(tx?.party?.name || "")}">
            </div>

            <div class="form-group">
              <label class="form-label">Party Type</label>
              <select class="inp" name="partyType">
                ${["supplier", "customer", "employee", "utility", "other"].map((p) => `<option value="${p}" ${tx?.party?.type === p ? "selected" : ""}>${p}</option>`).join("")}
              </select>
            </div>

            <!-- Tax -->
            <div class="form-group">
              <label class="form-label">Tax Amount (৳)</label>
              <input class="inp" name="taxAmount" type="number" step="0.01" min="0" placeholder="0" value="${tx?.taxAmount || 0}">
            </div>

            <div class="form-group">
              <label class="form-label">Tags (comma separated)</label>
              <input class="inp" name="tags" placeholder="marketing, ramadan, ads" value="${(tx?.tags || []).join(", ")}">
            </div>

            <div class="form-group full">
              <label class="form-label">Description</label>
              <textarea class="inp" name="description" placeholder="Additional notes...">${escapeHtml(tx?.description || "")}</textarea>
            </div>

            <!-- Recurring -->
            <div class="form-group full">
              <div style="background:var(--bg);border-radius:12px;padding:14px;border:1px solid var(--border)">
                <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:10px">
                  <div>
                    <div style="font-size:13px;font-weight:600">Recurring Transaction</div>
                    <div style="font-size:11px;color:var(--text3)">Repeat this transaction automatically</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" name="isRecurring" id="finIsRecurring" ${tx?.isRecurring ? "checked" : ""} onchange="document.getElementById('finRecurringInterval').style.display=this.checked?'':'none'">
                    <span class="toggle-slider"></span>
                  </label>
                </label>
                <select class="inp" name="recurringInterval" id="finRecurringInterval" style="display:${tx?.isRecurring ? "" : "none"}">
                  <option value="monthly" ${tx?.recurringInterval === "monthly" ? "selected" : ""}>Monthly</option>
                  <option value="weekly" ${tx?.recurringInterval === "weekly" ? "selected" : ""}>Weekly</option>
                  <option value="yearly" ${tx?.recurringInterval === "yearly" ? "selected" : ""}>Yearly</option>
                  <option value="daily" ${tx?.recurringInterval === "daily" ? "selected" : ""}>Daily</option>
                </select>
              </div>
            </div>

            <!-- Status -->
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="inp" name="status">
                ${["approved", "pending", "rejected"].map((s) => `<option value="${s}" ${(tx?.status || "approved") === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          ${id && tx?.status !== "void" ? `<button type="button" class="btn btn-danger btn-sm" onclick="finVoidTransaction('${id}');closeModal()"><i class="fas fa-ban"></i> Void</button>` : ""}
          <button type="submit" class="btn btn-primary" id="finTxSubmitBtn">
            <i class="fas fa-${id ? "save" : "plus"}"></i> ${id ? "Save Changes" : "Add Transaction"}
          </button>
        </div>
      </form>
    </div>
  `);

  // Highlight selected type button on click
  document.querySelectorAll('[name="type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".fin-type-btn").forEach((btn) => {
        btn.style.background = "";
        btn.style.borderColor = "var(--border)";
        btn.style.color = "";
      });
      const sel = document.querySelector(
        `.fin-type-btn[data-type="${radio.value}"]`,
      );
      if (sel) {
        const colMap = {
          income: "var(--lime)",
          expense: "var(--rose)",
          transfer: "var(--sky)",
        };
        sel.style.borderColor = colMap[radio.value];
        sel.style.background = colMap[radio.value] + "15";
        sel.style.color = colMap[radio.value];
      }
    });
  });

  // Trigger initial highlight
  const initialType = tx?.type || "expense";
  const initialRadio = document.querySelector(
    `[name="type"][value="${initialType}"]`,
  );
  if (initialRadio) initialRadio.dispatchEvent(new Event("change"));

  // Form submit
  document.getElementById("finTxForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("finTxSubmitBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    btn.disabled = true;
    const fd = new FormData(e.target);
    const payload = {
      type: fd.get("type"),
      title: fd.get("title"),
      amount: parseFloat(fd.get("amount")),
      date: fd.get("date"),
      category: fd.get("category"),
      subcategory: fd.get("subcategory") || undefined,
      paymentMethod: fd.get("paymentMethod"),
      account: fd.get("account") || undefined,
      referenceType: fd.get("referenceType"),
      referenceNumber: fd.get("referenceNumber") || undefined,
      taxAmount: parseFloat(fd.get("taxAmount")) || 0,
      description: fd.get("description") || undefined,
      tags: fd.get("tags")
        ? fd
            .get("tags")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      isRecurring: e.target.isRecurring?.checked || false,
      recurringInterval: e.target.isRecurring?.checked
        ? fd.get("recurringInterval")
        : null,
      status: fd.get("status"),
      party: {
        name: fd.get("partyName") || undefined,
        type: fd.get("partyType"),
      },
    };
    try {
      if (id) {
        await apiCall(`/finance/transactions/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Transaction updated ✓", "success");
      } else {
        await apiCall("/finance/transactions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Transaction added ✓", "success");
      }
      closeModal();
      if (finActiveTab === "transactions") finLoadTransactionList();
      else if (finActiveTab === "overview") finRenderOverview();
    } catch (err) {
      showToast(err.message, "error");
      btn.innerHTML = `<i class="fas fa-${id ? "save" : "plus"}"></i> ${id ? "Save Changes" : "Add Transaction"}`;
      btn.disabled = false;
    }
  };
}

// Category list update when type changes
function finUpdateCategoryList(type) {
  apiCall("/finance/categories?type=" + type)
    .then((res) => {
      const cats = res.data || [];
      const sel = document.getElementById("finCategorySelect");
      if (!sel) return;
      sel.innerHTML =
        '<option value="">Select Category</option>' +
        cats.map((c) => `<option value="${c}">${c}</option>`).join("");
    })
    .catch(() => {});
}

// ── Budget Modal ──────────────────────────────────────────────────────────────
async function openFinBudgetModal(id = null) {
  let budget = null;
  if (id) {
    try {
      const res = await apiCall("/finance/budgets");
      budget = (res.data || []).find((b) => b._id === id);
    } catch (e) {}
  }

  // Get categories for dropdown
  let cats = [];
  try {
    cats = (await apiCall("/finance/categories?type=expense")).data || [];
  } catch (e) {}

  const fmtForInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

  modal(`
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">${id ? "✏️ Edit Budget" : "🎯 New Budget"}</div>
          <div class="modal-sub">Set spending limits per category</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="finBudgetForm">
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="form-group">
              <label class="form-label">Budget Name *</label>
              <input class="inp" name="name" placeholder="e.g. Monthly Marketing Budget" required value="${escapeHtml(budget?.name || "")}">
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="inp" name="category" required>
                <option value="">Select Category</option>
                ${cats.map((c) => `<option value="${c}" ${budget?.category === c ? "selected" : ""}>${c}</option>`).join("")}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">Budget Amount (৳) *</label>
                <div class="inp-group"><i class="fas fa-bangladeshi-taka-sign"></i>
                  <input class="inp" name="amount" type="number" min="0" required placeholder="0" value="${budget?.amount || ""}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Period</label>
                <select class="inp" name="period">
                  ${["monthly", "weekly", "quarterly", "yearly"].map((p) => `<option value="${p}" ${(budget?.period || "monthly") === p ? "selected" : ""}>${p}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Start Date *</label>
                <input class="inp" name="startDate" type="date" required value="${fmtForInput(budget?.startDate) || new Date().toISOString().split("T")[0]}">
              </div>
              <div class="form-group">
                <label class="form-label">End Date *</label>
                <input class="inp" name="endDate" type="date" required value="${fmtForInput(budget?.endDate)}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alert Threshold (%)</label>
              <input class="inp" name="alertThreshold" type="number" min="0" max="100" placeholder="80" value="${budget?.alertThreshold ?? 80}">
              <div style="font-size:11px;color:var(--text3);margin-top:4px">Alert when spending reaches this % of budget</div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="inp" name="notes" placeholder="Optional notes...">${escapeHtml(budget?.notes || "")}</textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="finBudgetSubmitBtn">
            <i class="fas fa-${id ? "save" : "plus"}"></i> ${id ? "Save" : "Create Budget"}
          </button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("finBudgetForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("finBudgetSubmitBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name"),
      category: fd.get("category"),
      amount: parseFloat(fd.get("amount")),
      period: fd.get("period"),
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      alertThreshold: parseFloat(fd.get("alertThreshold")) || 80,
      notes: fd.get("notes") || undefined,
      isActive: true,
    };
    try {
      if (id) {
        await apiCall(`/finance/budgets/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Budget updated ✓", "success");
      } else {
        await apiCall("/finance/budgets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Budget created ✓", "success");
      }
      closeModal();
      finLoadBudgets();
    } catch (err) {
      showToast(err.message, "error");
      btn.innerHTML = `<i class="fas fa-${id ? "save" : "plus"}"></i> ${id ? "Save" : "Create Budget"}`;
      btn.disabled = false;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function finVoidTransaction(id) {
  if (
    !confirm(
      "Void this transaction? It will be hidden from reports but not deleted.",
    )
  )
    return;
  try {
    await apiCall(`/finance/transactions/${id}`, { method: "DELETE" });
    showToast("Transaction voided", "success");
    finLoadTransactionList();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function finDeleteBudget(id) {
  if (!confirm("Delete this budget?")) return;
  try {
    await apiCall(`/finance/budgets/${id}`, { method: "DELETE" });
    showToast("Budget deleted", "success");
    finLoadBudgets();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function finImportOrders() {
  modal(`
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <div><div class="modal-title">📥 Import Order Income</div><div class="modal-sub">Auto-create income entries from delivered orders</div></div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="finImportForm">
        <div class="modal-body">
          <div style="background:var(--lime-dim);border:1px solid rgba(198,241,53,.3);border-radius:12px;padding:14px;margin-bottom:16px;font-size:13px;color:var(--text2)">
            <i class="fas fa-info-circle" style="color:var(--lime);margin-right:8px"></i>
            This will create <strong>income</strong> transactions for all delivered orders that don't already have one.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div class="form-group">
              <label class="form-label">From Date (optional)</label>
              <input class="inp" name="startDate" type="date">
            </div>
            <div class="form-group">
              <label class="form-label">To Date (optional)</label>
              <input class="inp" name="endDate" type="date">
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">
            <label class="toggle"><input type="checkbox" name="overwrite"><span class="toggle-slider"></span></label>
            <div>
              <div style="font-weight:600">Overwrite existing</div>
              <div style="font-size:11px;color:var(--text3)">Re-import even if entry already exists</div>
            </div>
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="finImportBtn"><i class="fas fa-download"></i> Import</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("finImportForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("finImportBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing…';
    btn.disabled = true;
    const fd = new FormData(e.target);
    try {
      const res = await apiCall("/finance/import/orders", {
        method: "POST",
        body: JSON.stringify({
          startDate: fd.get("startDate") || undefined,
          endDate: fd.get("endDate") || undefined,
          overwrite: e.target.overwrite?.checked || false,
        }),
      });
      showToast(
        `✅ Created ${res.created}, skipped ${res.skipped} existing`,
        "success",
      );
      closeModal();
      if (finActiveTab === "transactions") finLoadTransactionList();
      else finRenderOverview();
    } catch (err) {
      showToast(err.message, "error");
      btn.innerHTML = '<i class="fas fa-download"></i> Import';
      btn.disabled = false;
    }
  };
}

async function finExportCSV() {
  try {
    showToast("Preparing CSV export…", "info");
    const qs = new URLSearchParams();
    if (finFilter.type) qs.set("type", finFilter.type);
    if (finFilter.period) qs.set("period", finFilter.period);
    const url = `${API_URL}/finance/export?${qs}`;
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${finFilter.period || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("CSV downloaded ✓", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER IN loadPage + sidebar
// ─────────────────────────────────────────────────────────────────────────────

// The main admin-dash.js loadPage function needs these entries added.
// Since we can't modify that file, we patch them here:
(function patchAdminForFinance() {
  // Wait for DOM to be ready and patch the existing loadPage
  const _interval = setInterval(() => {
    if (
      typeof loadPage === "function" &&
      typeof window._financePatched === "undefined"
    ) {
      window._financePatched = true;
      clearInterval(_interval);

      // Patch pages map inside the real loadPage by wrapping it
      const origLoadPage = window.loadPage;
      window.loadPage = function (page) {
        if (page === "finance") {
          currentPage = "finance";
          document
            .querySelectorAll(".nav-link")
            .forEach((l) => l.classList.remove("active"));
          document
            .querySelector('[data-page="finance"]')
            ?.classList.add("active");
          destroyCharts();
          loadFinancePage();
          return;
        }
        origLoadPage(page);
      };

      // Add permission entry
      const origPagePermissions = window._pagePermissions;

      console.log("✅ [Finance] Module patched into admin panel");
    }
  }, 200);
})();
