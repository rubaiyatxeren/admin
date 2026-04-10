// ── State ──────────────────────────────────────────────────────────────────
let paActiveCharts = [];
let paAllProducts = [];
let paAllOrders = [];
let paSelectedProductId = null;
let paSortKey = "revenue";
let paSortDir = "desc";
let paFilter = { category: "", status: "" };

function paDestroyCharts() {
  paActiveCharts.forEach((c) => {
    try {
      c.destroy();
    } catch (e) {}
  });
  paActiveCharts = [];
}

// ── Currency helper (reuse existing or define locally) ─────────────────────
function paCurrency(n) {
  return "৳ " + (n || 0).toLocaleString("en-BD");
}

// ── Main page loader ────────────────────────────────────────────────────────
async function loadProductAnalytics() {
  paDestroyCharts();
  paSelectedProductId = null;
  const c = document.getElementById("content");

  c.innerHTML = `
  <div class="section-header fade-up">
    <h2>📊 Product Analytics</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="exportProductAnalytics()">
        <i class="fas fa-file-export"></i> Export CSV
      </button>
      <button class="btn btn-primary btn-sm" onclick="loadProductAnalytics()">
        <i class="fas fa-rotate-right"></i> Refresh
      </button>
    </div>
  </div>

  <!-- Top KPI Strip -->
  <div id="paKpiStrip" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
    ${[1, 2, 3, 4, 5]
      .map(
        (i) => `
      <div class="stat-card fade-up stagger-${i}">
        <div class="skel" style="height:38px;width:38px;border-radius:10px;margin-bottom:14px"></div>
        <div class="skel" style="height:24px;width:75%;margin-bottom:6px"></div>
        <div class="skel" style="height:12px;width:50%"></div>
      </div>`,
      )
      .join("")}
  </div>

  <!-- Filter Bar -->
  <div class="card fade-up" style="margin-bottom:16px;padding:14px 20px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div class="inp-group" style="flex:1;min-width:180px">
        <i class="fas fa-search"></i>
        <input class="inp" id="paSearch" placeholder="Search products…" oninput="paRenderTable()">
      </div>
      <select class="inp" style="width:auto" id="paCatFilter" onchange="paFilter.category=this.value;paRenderTable()">
        <option value="">All Categories</option>
      </select>
      <select class="inp" style="width:auto" onchange="paFilter.status=this.value;paRenderTable()">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="lowstock">Low Stock</option>
        <option value="outofstock">Out of Stock</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="paFilter={category:'',status:''};document.getElementById('paSearch').value='';document.getElementById('paCatFilter').value='';paRenderTable()">
        <i class="fas fa-times"></i> Clear
      </button>
    </div>
  </div>

  <!-- Main Grid: Table + Mini Charts -->
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:16px">

    <!-- Product Table -->
    <div class="card fade-up" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px 0;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="card-title">Product Performance</div>
          <div class="card-sub" id="paTableSub">Loading…</div>
        </div>
        <div style="display:flex;gap:6px;font-size:11px;color:var(--text3)">
          Sort by:
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 10px" onclick="paSortBy('revenue')">Revenue</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 10px" onclick="paSortBy('unitsSold')">Units</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 10px" onclick="paSortBy('orders')">Orders</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 10px" onclick="paSortBy('stock')">Stock</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" id="paProductTable">
          <thead><tr>
            <th>#</th>
            <th>Product</th>
            <th>Revenue</th>
            <th>Units</th>
            <th>Orders</th>
            <th>Avg Price</th>
            <th>Stock</th>
            <th>Share</th>
          </tr></thead>
          <tbody id="paTableBody">
            <tr><td colspan="8" style="text-align:center;padding:48px">
              <div class="spinner" style="margin:0 auto"></div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Panel -->
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Revenue Distribution Donut -->
      <div class="card fade-up">
        <div class="card-title" style="margin-bottom:2px">Revenue Share</div>
        <div class="card-sub" style="margin-bottom:16px">Top 8 products by contribution</div>
        <div style="position:relative;height:220px">
          <canvas id="paDonutChart" role="img" aria-label="Donut chart showing revenue distribution by product"></canvas>
        </div>
        <div id="paDonutLegend" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;font-size:11px"></div>
      </div>

      <!-- Stock Health -->
      <div class="card fade-up">
        <div class="card-title" style="margin-bottom:2px">Stock Health</div>
        <div class="card-sub" style="margin-bottom:14px">Inventory status across all products</div>
        <div style="position:relative;height:180px">
          <canvas id="paStockChart" role="img" aria-label="Bar chart showing stock levels by product"></canvas>
        </div>
      </div>
    </div>
  </div>

  <!-- Monthly Trend + Category Breakdown -->
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card fade-up">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div class="card-title">Monthly Revenue Trend</div>
          <div class="card-sub">All products — delivered orders</div>
        </div>
        <select class="inp" style="width:auto;font-size:12px" id="paTrendProduct" onchange="paRenderTrendChart()">
          <option value="all">All Products</option>
        </select>
      </div>
      <div style="position:relative;height:220px">
        <canvas id="paTrendChart" role="img" aria-label="Line chart showing monthly revenue trend"></canvas>
      </div>
    </div>

    <div class="card fade-up">
      <div class="card-title" style="margin-bottom:2px">Category Breakdown</div>
      <div class="card-sub" style="margin-bottom:16px">Revenue by category</div>
      <div style="position:relative;height:220px">
        <canvas id="paCatChart" role="img" aria-label="Horizontal bar chart showing revenue by category"></canvas>
      </div>
    </div>
  </div>

  <!-- Product Detail Panel (hidden until row clicked) -->
  <div id="paDetailPanel" style="display:none"></div>

  <!-- Bottom Row: Velocity + Price-vs-Stock scatter -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card fade-up">
      <div class="card-title" style="margin-bottom:2px">Sales Velocity</div>
      <div class="card-sub" style="margin-bottom:14px">Orders per month (top 10 products)</div>
      <div style="position:relative;height:260px">
        <canvas id="paVelocityChart" role="img" aria-label="Bar chart showing sales velocity by product"></canvas>
      </div>
    </div>
    <div class="card fade-up">
      <div class="card-title" style="margin-bottom:2px">Price vs Units Sold</div>
      <div class="card-sub" style="margin-bottom:14px">Bubble size = revenue generated</div>
      <div style="position:relative;height:260px">
        <canvas id="paBubbleChart" role="img" aria-label="Bubble chart showing price vs units sold relationship"></canvas>
      </div>
    </div>
  </div>`;

  // ── Fetch data ────────────────────────────────────────────────────────────
  try {
    const [prodsRes, ordersRes, catsRes] = await Promise.all([
      apiCall("/products?limit=500&sort=newest"),
      apiCall("/orders?limit=2000"),
      apiCall("/categories"),
    ]);

    paAllProducts = prodsRes.data || [];
    paAllOrders = ordersRes.data || [];
    const cats = catsRes.data || [];

    // Populate category filter
    const catSel = document.getElementById("paCatFilter");
    if (catSel) {
      cats.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat._id;
        opt.textContent = cat.name;
        catSel.appendChild(opt);
      });
    }

    // Populate trend product select
    const trendSel = document.getElementById("paTrendProduct");
    if (trendSel) {
      paAllProducts.slice(0, 20).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p._id;
        opt.textContent =
          p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name;
        trendSel.appendChild(opt);
      });
    }

    // ── Build product stats ────────────────────────────────────────────────
    const productMap = {};
    paAllProducts.forEach((p) => {
      productMap[p._id] = {
        product: p,
        revenue: 0,
        unitsSold: 0,
        orders: 0,
        months: {},
      };
    });

    const deliveredOrders = paAllOrders.filter((o) => {
      const s = (o.orderStatus || "").toLowerCase();
      return s === "delivered" || s === "completed";
    });

    deliveredOrders.forEach((order) => {
      const monthKey = new Date(order.createdAt).toISOString().slice(0, 7);
      (order.items || []).forEach((item) => {
        const pid = item.product?._id || item.productId || item._id;
        if (!pid || !productMap[pid]) return;
        const stats = productMap[pid];
        stats.revenue += item.total || item.price * item.quantity;
        stats.unitsSold += item.quantity || 0;
        stats.orders += 1;
        stats.months[monthKey] =
          (stats.months[monthKey] || 0) + (item.total || 0);
      });
    });

    const statsArr = Object.values(productMap)
      .map((s) => ({
        ...s,
        avgPrice: s.unitsSold ? s.revenue / s.unitsSold : s.product.price,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = statsArr.reduce((s, p) => s + p.revenue, 0);
    const totalUnits = statsArr.reduce((s, p) => s + p.unitsSold, 0);
    const totalOrders = statsArr.reduce((s, p) => s + p.orders, 0);
    const topProd = statsArr[0];
    const outOfStock = paAllProducts.filter((p) => p.stock <= 0).length;
    const lowStock = paAllProducts.filter(
      (p) => p.stock > 0 && p.stock <= 10,
    ).length;

    // ── KPI Strip ─────────────────────────────────────────────────────────
    document.getElementById("paKpiStrip").innerHTML = `
      ${paKpiCard("Total Product Revenue", paCurrency(totalRevenue), "fa-coins", "#c6f135", "rgba(198,241,53,.15)", "From delivered orders", "up")}
      ${paKpiCard("Units Sold", totalUnits.toLocaleString(), "fa-cubes", "#38bdf8", "rgba(56,189,248,.15)", "All products", "up")}
      ${paKpiCard("Product Orders", totalOrders.toLocaleString(), "fa-receipt", "#2dd4bf", "rgba(45,212,191,.15)", "Line items", "up")}
      ${paKpiCard("Out of Stock", outOfStock, "fa-box-open", "#f43f5e", "rgba(244,63,94,.15)", `${lowStock} low stock`, outOfStock > 0 ? "down" : "up")}
      ${paKpiCard("Active Products", paAllProducts.filter((p) => p.isActive).length, "fa-check-circle", "#f5a623", "rgba(245,166,35,.15)", `of ${paAllProducts.length} total`, "up")}
    `;

    // Store stats for rendering
    window._paStats = { statsArr, totalRevenue, productMap };

    paRenderTable();
    paRenderDonut(statsArr, totalRevenue);
    paRenderStockChart();
    paRenderTrendChart();
    paRenderCategoryChart(statsArr, cats);
    paRenderVelocityChart(statsArr);
    paRenderBubbleChart(statsArr);
  } catch (e) {
    showToast(e.message, "error");
    document.getElementById("paKpiStrip").innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:48px">
        <i class="fas fa-exclamation-triangle" style="font-size:40px;color:var(--rose);display:block;margin-bottom:12px"></i>
        <div class="card-title">Failed to load analytics</div>
        <div class="card-sub">${e.message}</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="loadProductAnalytics()">Retry</button>
      </div>`;
  }
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function paKpiCard(label, value, icon, color, bg, sub, dir) {
  return `
    <div class="stat-card fade-up" style="--accent:${color}">
      <div class="stat-icon" style="background:${bg};color:${color}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-sub ${dir}">
        <i class="fas fa-arrow-${dir === "up" ? "up-right" : "down-right"}"></i>${sub}
      </div>
    </div>`;
}

// ── Table Sort ───────────────────────────────────────────────────────────────
function paSortBy(key) {
  if (paSortKey === key) paSortDir = paSortDir === "desc" ? "asc" : "desc";
  else {
    paSortKey = key;
    paSortDir = "desc";
  }
  paRenderTable();
}

// ── Render Table ─────────────────────────────────────────────────────────────
function paRenderTable() {
  const { statsArr, totalRevenue } = window._paStats || {};
  if (!statsArr) return;

  const search = (
    document.getElementById("paSearch")?.value || ""
  ).toLowerCase();
  const catF = paFilter.category;
  const statF = paFilter.status;

  let rows = [...statsArr];

  if (search)
    rows = rows.filter((s) => s.product.name.toLowerCase().includes(search));
  if (catF)
    rows = rows.filter(
      (s) => (s.product.category?._id || s.product.category) === catF,
    );
  if (statF === "active")
    rows = rows.filter((s) => s.product.isActive && s.product.stock > 0);
  if (statF === "lowstock")
    rows = rows.filter((s) => s.product.stock > 0 && s.product.stock <= 10);
  if (statF === "outofstock") rows = rows.filter((s) => s.product.stock <= 0);

  rows.sort((a, b) => {
    const va = a[paSortKey] ?? 0;
    const vb = b[paSortKey] ?? 0;
    return paSortDir === "desc" ? vb - va : va - vb;
  });

  const tbody = document.getElementById("paTableBody");
  const sub = document.getElementById("paTableSub");
  if (sub)
    sub.textContent = `${rows.length} product${rows.length !== 1 ? "s" : ""} · sorted by ${paSortKey} ${paSortDir === "desc" ? "↓" : "↑"}`;

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text3)">No products match filters</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((s, i) => {
      const p = s.product;
      const share = totalRevenue
        ? ((s.revenue / totalRevenue) * 100).toFixed(1)
        : "0.0";
      const stkColor =
        p.stock <= 0
          ? "var(--rose)"
          : p.stock <= 10
            ? "var(--amber)"
            : "var(--teal)";
      const stkBadge =
        p.stock <= 0
          ? `<span class="badge badge-rose" style="font-size:10px">Out</span>`
          : p.stock <= 10
            ? `<span class="badge badge-amber" style="font-size:10px">${p.stock}</span>`
            : `<span style="color:var(--teal);font-weight:600;font-size:13px">${p.stock}</span>`;

      const shareBarW = Math.max(2, parseFloat(share));

      return `
      <tr onclick="paOpenProductDetail('${p._id}')" style="cursor:pointer" id="paRow_${p._id}">
        <td style="color:var(--text3);font-size:12px;font-weight:700">${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${p.images?.[0]?.url || "https://via.placeholder.com/36x36?text=?"}"
              style="width:36px;height:36px;border-radius:8px;object-fit:cover;
                     border:1px solid var(--border);flex-shrink:0">
            <div>
              <div style="font-weight:600;font-size:13px;max-width:160px;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${p.name}
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">
                ${p.sku} · ${p.category?.name || "—"}
              </div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-family:'Syne',sans-serif;font-weight:700;
                      font-size:14px;color:var(--lime)">${paCurrency(s.revenue)}</div>
        </td>
        <td style="font-weight:600;font-size:13px">${s.unitsSold.toLocaleString()}</td>
        <td style="font-size:13px">${s.orders}</td>
        <td style="font-size:13px;color:var(--text2)">${paCurrency(Math.round(s.avgPrice))}</td>
        <td>${stkBadge}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;background:var(--bg);border-radius:99px;height:5px;min-width:50px">
              <div style="width:${shareBarW}%;height:100%;background:var(--lime);border-radius:99px;max-width:100%"></div>
            </div>
            <span style="font-size:11px;color:var(--text3);width:32px;text-align:right">${share}%</span>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// ── Revenue Donut ────────────────────────────────────────────────────────────
function paRenderDonut(statsArr, totalRevenue) {
  const top8 = statsArr.slice(0, 8);
  const otherRev = statsArr.slice(8).reduce((s, p) => s + p.revenue, 0);
  const colors = [
    "#c6f135",
    "#38bdf8",
    "#2dd4bf",
    "#f5a623",
    "#f43f5e",
    "#a78bfa",
    "#fb923c",
    "#34d399",
    "#8f9baa",
  ];

  const labels = [
    ...top8.map((s) => s.product.name.slice(0, 18)),
    ...(otherRev > 0 ? ["Others"] : []),
  ];
  const data = [
    ...top8.map((s) => s.revenue),
    ...(otherRev > 0 ? [otherRev] : []),
  ];

  const ctx = document.getElementById("paDonutChart");
  if (!ctx) return;
  const ch = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        { data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
          callbacks: {
            label: (ctx) =>
              ` ${paCurrency(ctx.raw)} (${((ctx.raw / totalRevenue) * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
  paActiveCharts.push(ch);

  const legend = document.getElementById("paDonutLegend");
  if (legend) {
    legend.innerHTML = labels
      .map(
        (l, i) => `
      <span style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2)">
        <span style="width:9px;height:9px;border-radius:2px;background:${colors[i]};flex-shrink:0"></span>
        ${l}
      </span>`,
      )
      .join("");
  }
}

// ── Stock Bar ────────────────────────────────────────────────────────────────
function paRenderStockChart() {
  const prods = paAllProducts.sort((a, b) => a.stock - b.stock).slice(0, 15);

  const ctx = document.getElementById("paStockChart");
  if (!ctx) return;

  const colors = prods.map((p) =>
    p.stock <= 0 ? "#f43f5e" : p.stock <= 10 ? "#f5a623" : "#2dd4bf",
  );

  const ch = new Chart(ctx, {
    type: "bar",
    data: {
      labels: prods.map((p) =>
        p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
      ),
      datasets: [
        {
          label: "Stock",
          data: prods.map((p) => p.stock),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
          callbacks: { label: (ctx) => ` ${ctx.raw} units in stock` },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 9 }, maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 10 } },
          beginAtZero: true,
        },
      },
    },
  });
  paActiveCharts.push(ch);
}

// ── Trend Line ────────────────────────────────────────────────────────────────
function paRenderTrendChart() {
  const { productMap } = window._paStats || {};
  if (!productMap) return;

  const selectedId = document.getElementById("paTrendProduct")?.value || "all";

  // Build 12-month labels
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  let vals;
  if (selectedId === "all") {
    vals = months.map((m) => {
      return Object.values(productMap).reduce(
        (sum, s) => sum + (s.months[m] || 0),
        0,
      );
    });
  } else {
    const pstats = productMap[selectedId];
    vals = months.map((m) => (pstats ? pstats.months[m] || 0 : 0));
  }

  const ctx = document.getElementById("paTrendChart");
  if (!ctx) return;

  // Destroy previous chart on this canvas
  const existing = Chart.getChart(ctx);
  if (existing) {
    existing.destroy();
    paActiveCharts = paActiveCharts.filter((c) => c !== existing);
  }

  const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, "rgba(198,241,53,.22)");
  grad.addColorStop(1, "rgba(198,241,53,0)");

  const shortMonths = [
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
  const labels = months.map(
    (m) => shortMonths[parseInt(m.slice(5, 7)) - 1] + " " + m.slice(2, 4),
  );

  const ch = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: vals,
          borderColor: "#c6f135",
          backgroundColor: grad,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#c6f135",
          pointBorderColor: "#0b0d0f",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
          callbacks: { label: (ctx) => " " + paCurrency(ctx.raw) },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 10 }, maxRotation: 45 },
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
  paActiveCharts.push(ch);
}

// ── Category Bar ──────────────────────────────────────────────────────────────
function paRenderCategoryChart(statsArr, cats) {
  const catRevMap = {};
  statsArr.forEach((s) => {
    const catId =
      s.product.category?._id || s.product.category || "uncategorized";
    const catName =
      s.product.category?.name ||
      cats.find((c) => c._id === catId)?.name ||
      "Uncategorized";
    catRevMap[catName] = (catRevMap[catName] || 0) + s.revenue;
  });

  const sorted = Object.entries(catRevMap).sort((a, b) => b[1] - a[1]);
  const colors = [
    "#c6f135",
    "#38bdf8",
    "#2dd4bf",
    "#f5a623",
    "#f43f5e",
    "#a78bfa",
  ];

  const ctx = document.getElementById("paCatChart");
  if (!ctx) return;

  const h = Math.max(180, sorted.length * 38 + 40);
  ctx.parentElement.style.height = h + "px";

  const ch = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [
        {
          label: "Revenue",
          data: sorted.map(([, v]) => v),
          backgroundColor: sorted.map((_, i) => colors[i % colors.length]),
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
          callbacks: { label: (ctx) => " " + paCurrency(ctx.raw) },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: {
            color: "#5a6472",
            font: { size: 10 },
            callback: (v) => "৳" + v.toLocaleString(),
          },
          beginAtZero: true,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#8f9baa", font: { size: 11 } },
        },
      },
    },
  });
  paActiveCharts.push(ch);
}

// ── Velocity Chart ────────────────────────────────────────────────────────────
function paRenderVelocityChart(statsArr) {
  // Calculate months span from oldest order
  const oldestOrder = paAllOrders.length
    ? new Date(Math.min(...paAllOrders.map((o) => new Date(o.createdAt))))
    : new Date();
  const monthSpan = Math.max(
    1,
    Math.ceil((Date.now() - oldestOrder) / (30 * 24 * 3600 * 1000)),
  );

  const top10 = statsArr.slice(0, 10);
  const ctx = document.getElementById("paVelocityChart");
  if (!ctx) return;

  const ch = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top10.map((s) =>
        s.product.name.length > 16
          ? s.product.name.slice(0, 14) + "…"
          : s.product.name,
      ),
      datasets: [
        {
          label: "Orders/month",
          data: top10.map((s) => parseFloat((s.orders / monthSpan).toFixed(2))),
          backgroundColor: "#38bdf8",
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: "Units/month",
          data: top10.map((s) =>
            parseFloat((s.unitsSold / monthSpan).toFixed(2)),
          ),
          backgroundColor: "rgba(45,212,191,.5)",
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 9 }, maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 10 } },
          beginAtZero: true,
        },
      },
    },
  });
  paActiveCharts.push(ch);
}

// ── Bubble Chart (Price vs Units, bubble=revenue) ─────────────────────────────
function paRenderBubbleChart(statsArr) {
  const active = statsArr.filter((s) => s.unitsSold > 0).slice(0, 20);
  const maxRev = Math.max(...active.map((s) => s.revenue), 1);
  const maxR = 28;
  const minR = 5;

  const ctx = document.getElementById("paBubbleChart");
  if (!ctx) return;

  const ch = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets: [
        {
          label: "Products",
          data: active.map((s) => ({
            x: Math.round(s.product.price),
            y: s.unitsSold,
            r: Math.max(minR, Math.round((s.revenue / maxRev) * maxR)),
            name: s.product.name,
            revenue: s.revenue,
          })),
          backgroundColor: "rgba(198,241,53,.35)",
          borderColor: "#c6f135",
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 16 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2328",
          borderColor: "#252b31",
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              return [
                `${d.name}`,
                `Price: ${paCurrency(d.x)}`,
                `Units sold: ${d.y}`,
                `Revenue: ${paCurrency(d.revenue)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: {
            color: "#5a6472",
            font: { size: 10 },
            callback: (v) => "৳" + v,
          },
          title: {
            display: true,
            text: "Unit Price",
            color: "#5a6472",
            font: { size: 11 },
          },
          min: 0,
        },
        y: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#5a6472", font: { size: 10 } },
          title: {
            display: true,
            text: "Units Sold",
            color: "#5a6472",
            font: { size: 11 },
          },
          beginAtZero: true,
        },
      },
    },
  });
  paActiveCharts.push(ch);
}

// ── Product Detail Panel ──────────────────────────────────────────────────────
async function paOpenProductDetail(productId) {
  const { statsArr } = window._paStats || {};
  if (!statsArr) return;

  const stats = statsArr.find((s) => s.product._id === productId);
  if (!stats) return;

  paSelectedProductId = productId;

  // Highlight row
  document
    .querySelectorAll('[id^="paRow_"]')
    .forEach((r) => (r.style.background = ""));
  const row = document.getElementById(`paRow_${productId}`);
  if (row) row.style.background = "var(--lime-dim)";

  const panel = document.getElementById("paDetailPanel");
  if (!panel) return;

  const p = stats.product;
  const convRate =
    stats.orders && paAllOrders.length
      ? ((stats.orders / paAllOrders.length) * 100).toFixed(1)
      : "0.0";
  const avgPer = stats.orders ? (stats.revenue / stats.orders).toFixed(0) : 0;
  const stockDays = stats.unitsSold
    ? Math.round(p.stock / (stats.unitsSold / 30)).toString() + " days"
    : "∞";
  const isLowStock = p.stock > 0 && p.stock <= 10;
  const isOOS = p.stock <= 0;

  // Monthly breakdown for this product
  const now = new Date();
  const months12 = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months12.push(d.toISOString().slice(0, 7));
  }
  const shortM = [
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
  const monthLabels = months12.map(
    (m) => shortM[parseInt(m.slice(5, 7)) - 1] + "'" + m.slice(2, 4),
  );
  const monthVals = months12.map((m) => stats.months[m] || 0);

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="card fade-up" style="margin-bottom:16px;border-color:var(--lime);
         border-left:3px solid var(--lime)">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;
                  padding-bottom:18px;border-bottom:1px solid var(--border)">
        <img src="${p.images?.[0]?.url || "https://via.placeholder.com/72x72?text=?"}"
          style="width:72px;height:72px;border-radius:12px;object-fit:cover;
                 border:1px solid var(--border);flex-shrink:0">
        <div style="flex:1">
          <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;
                      margin-bottom:4px">${p.name}</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
            SKU: ${p.sku} · ${p.category?.name || "—"} · ${p.weight || "—"}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge ${p.isActive ? "badge-lime" : "badge-rose"}">${p.isActive ? "Active" : "Inactive"}</span>
            ${p.isFeatured ? '<span class="badge badge-teal"><i class="fas fa-star"></i> Featured</span>' : ""}
            ${isOOS ? '<span class="badge badge-rose">Out of Stock</span>' : isLowStock ? `<span class="badge badge-amber">Low Stock: ${p.stock}</span>` : `<span class="badge badge-lime">${p.stock} in stock</span>`}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;
                      color:var(--lime)">${paCurrency(p.price)}</div>
          ${p.comparePrice ? `<div style="font-size:13px;color:var(--text3);text-decoration:line-through">${paCurrency(p.comparePrice)}</div>` : ""}
          <div style="font-size:11px;color:var(--text3);margin-top:4px">unit price</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="panel.style.display='none';document.querySelectorAll('[id^=paRow_]').forEach(r=>r.style.background='');paSelectedProductId=null" 
          style="align-self:flex-start" onclick="document.getElementById('paDetailPanel').style.display='none'">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Detail KPIs -->
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px">
        ${paDetailKpi("Total Revenue", paCurrency(stats.revenue), "#c6f135")}
        ${paDetailKpi("Units Sold", stats.unitsSold.toLocaleString(), "#38bdf8")}
        ${paDetailKpi("Total Orders", stats.orders, "#2dd4bf")}
        ${paDetailKpi("Avg Order Value", paCurrency(Math.round(avgPer)), "#f5a623")}
        ${paDetailKpi("Order Contribution", convRate + "%", "#a78bfa")}
        ${paDetailKpi("Stock Runway", stockDays, isOOS ? "#f43f5e" : isLowStock ? "#f5a623" : "#2dd4bf")}
      </div>

      <!-- Monthly Chart -->
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:.6px;
                    text-transform:uppercase;color:var(--text3);margin-bottom:12px">
          Monthly Revenue — Last 12 Months
        </div>
        <div style="position:relative;height:180px">
          <canvas id="paDetailMonthChart" role="img" aria-label="Monthly revenue chart for ${p.name}"></canvas>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:10px;margin-top:18px;padding-top:16px;
                  border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onclick="editProduct('${p._id}')">
          <i class="fas fa-edit"></i> Edit Product
        </button>
        <button class="btn btn-ghost btn-sm" onclick="loadPage('orders');setTimeout(()=>{ordFilter.search='${p.name.replace(/'/g, "\\'")}';loadOrdersList();},400)">
          <i class="fas fa-receipt"></i> View Orders
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.open('${p.images?.[0]?.url || "#"}','_blank')">
          <i class="fas fa-image"></i> View Image
        </button>
        ${
          isOOS || isLowStock
            ? `
        <button class="btn btn-danger btn-sm" style="margin-left:auto">
          <i class="fas fa-triangle-exclamation"></i> ${isOOS ? "Restock Needed" : "Low Stock Alert"}
        </button>`
            : ""
        }
      </div>
    </div>`;

  // Render detail month chart
  const dCtx = document.getElementById("paDetailMonthChart");
  if (dCtx) {
    const grad = dCtx.getContext("2d").createLinearGradient(0, 0, 0, 150);
    grad.addColorStop(0, "rgba(198,241,53,.25)");
    grad.addColorStop(1, "rgba(198,241,53,0)");

    const dCh = new Chart(dCtx, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: "Revenue",
            data: monthVals,
            backgroundColor: monthVals.map((v, i) =>
              i === monthVals.length - 1 ? "#c6f135" : "rgba(198,241,53,.4)",
            ),
            borderRadius: 5,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1e2328",
            borderColor: "#252b31",
            borderWidth: 1,
            callbacks: { label: (ctx) => " " + paCurrency(ctx.raw) },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#5a6472", font: { size: 10 } },
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
    paActiveCharts.push(dCh);
  }

  // Scroll to panel
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paDetailKpi(label, value, color) {
  return `
    <div style="background:var(--bg);border-radius:10px;padding:14px 12px;
                border:1px solid var(--border);text-align:center">
      <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;
                  color:${color};margin-bottom:4px">${value}</div>
      <div style="font-size:10px;color:var(--text3);letter-spacing:.3px">${label}</div>
    </div>`;
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportProductAnalytics() {
  const { statsArr, totalRevenue } = window._paStats || {};
  if (!statsArr) {
    showToast("Load analytics first", "warning");
    return;
  }

  const rows = [
    [
      "Rank",
      "Product Name",
      "SKU",
      "Category",
      "Revenue",
      "Units Sold",
      "Orders",
      "Avg Price",
      "Revenue Share %",
      "Current Stock",
      "Status",
    ],
  ];
  statsArr.forEach((s, i) => {
    const p = s.product;
    rows.push([
      i + 1,
      `"${p.name}"`,
      p.sku,
      `"${p.category?.name || ""}"`,
      s.revenue.toFixed(2),
      s.unitsSold,
      s.orders,
      Math.round(s.avgPrice),
      ((s.revenue / totalRevenue) * 100).toFixed(2),
      p.stock,
      p.stock <= 0 ? "Out of Stock" : p.stock <= 10 ? "Low Stock" : "In Stock",
    ]);
  });

  const csv = rows.map((r) => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `product_analytics_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  showToast("Product analytics exported!", "success");
}
