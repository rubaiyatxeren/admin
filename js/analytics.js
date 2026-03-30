// API Configuration
const API_URL = "https://beeyond-harvest-admin.onrender.com/api";
let token = localStorage.getItem("adminToken");
let revenueChart = null;
let categoryChart = null;
let hourlyChart = null;
let customerTypeChart = null;
let currentData = null;

// Helper Functions
function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  toast.innerHTML = `${icon} ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatCurrency(amount) {
  return "৳ " + (amount || 0).toLocaleString("en-BD");
}

async function apiCall(endpoint, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "index.html";
  }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// Date Helpers
function getDefaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split("T")[0];
}

// Load All Analytics
async function loadAllAnalytics() {
  const startDate =
    document.getElementById("startDate")?.value || getDefaultStartDate();
  const endDate =
    document.getElementById("endDate")?.value || getDefaultEndDate();
  const comparePeriod =
    document.getElementById("comparePeriod")?.value || "none";

  showToast("Loading analytics data...", "info");

  try {
    // Fetch orders
    const ordersRes = await apiCall(
      `/orders?limit=5000&dateFrom=${startDate}&dateTo=${endDate}`,
    );
    let orders = ordersRes.data || [];

    // Filter delivered orders for revenue
    const deliveredOrders = orders.filter((o) => o.orderStatus === "delivered");
    const totalRevenue = deliveredOrders.reduce(
      (sum, o) => sum + (o.total || 0),
      0,
    );
    const totalOrders = orders.length;

    // Unique customers
    const uniqueCustomers = new Set(orders.map((o) => o.customer?.phone)).size;

    // Conversion rate (delivered / total)
    const conversionRate = totalOrders
      ? ((deliveredOrders.length / totalOrders) * 100).toFixed(1)
      : 0;

    // Calculate trends
    let revenueTrend = "",
      ordersTrend = "",
      customersTrend = "",
      conversionTrend = "";

    if (comparePeriod !== "none") {
      const daysDiff = Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24),
      );
      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - daysDiff);
      const prevEnd = new Date(endDate);
      prevEnd.setDate(prevEnd.getDate() - daysDiff);

      const prevOrdersRes = await apiCall(
        `/orders?limit=5000&dateFrom=${prevStart.toISOString().split("T")[0]}&dateTo=${prevEnd.toISOString().split("T")[0]}`,
      );
      const prevOrders = prevOrdersRes.data || [];
      const prevDelivered = prevOrders.filter(
        (o) => o.orderStatus === "delivered",
      );
      const prevRevenue = prevDelivered.reduce(
        (sum, o) => sum + (o.total || 0),
        0,
      );
      const prevTotalOrders = prevOrders.length;
      const prevCustomers = new Set(prevOrders.map((o) => o.customer?.phone))
        .size;
      const prevConversion = prevTotalOrders
        ? ((prevDelivered.length / prevTotalOrders) * 100).toFixed(1)
        : 0;

      revenueTrend = calculateTrend(totalRevenue, prevRevenue);
      ordersTrend = calculateTrend(totalOrders, prevTotalOrders);
      customersTrend = calculateTrend(uniqueCustomers, prevCustomers);
      conversionTrend = calculateTrend(
        parseFloat(conversionRate),
        parseFloat(prevConversion),
      );
    }

    // Update KPI cards
    document.getElementById("totalRevenue").innerHTML =
      formatCurrency(totalRevenue);
    document.getElementById("totalOrders").innerHTML =
      totalOrders.toLocaleString();
    document.getElementById("uniqueCustomers").innerHTML =
      uniqueCustomers.toLocaleString();
    document.getElementById("conversionRate").innerHTML = `${conversionRate}%`;

    document.getElementById("revenueTrend").innerHTML = revenueTrend;
    document.getElementById("ordersTrend").innerHTML = ordersTrend;
    document.getElementById("customersTrend").innerHTML = customersTrend;
    document.getElementById("conversionTrend").innerHTML = conversionTrend;

    // Prepare data for charts
    currentData = { orders, startDate, endDate };

    // Load all charts
    await loadRevenueChart(orders);
    await loadCategoryChart(orders);
    await loadHourlyHeatmap(orders);
    await loadTopProducts(orders);
    await loadCustomerTypeChart(orders);
    await loadTopLocations(orders);
    await loadAvgDeliveryTime(orders);

    showToast("Analytics loaded successfully!");
  } catch (err) {
    console.error(err);
    showToast("Failed to load analytics: " + err.message, "error");
  }
}

function calculateTrend(current, previous) {
  if (previous === 0)
    return '<span class="trend-up"><i class="fas fa-arrow-up"></i> +100%</span>';
  const percent = (((current - previous) / previous) * 100).toFixed(1);
  const isPositive = current >= previous;
  const icon = isPositive
    ? '<i class="fas fa-arrow-up"></i>'
    : '<i class="fas fa-arrow-down"></i>';
  const color = isPositive ? "trend-up" : "trend-down";
  return `<span class="${color}">${icon} ${Math.abs(percent)}%</span>`;
}

async function loadRevenueChart(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  const dailyData = {};

  delivered.forEach((order) => {
    const date = new Date(order.createdAt).toLocaleDateString();
    dailyData[date] = (dailyData[date] || 0) + (order.total || 0);
  });

  const sortedDates = Object.keys(dailyData).sort(
    (a, b) => new Date(a) - new Date(b),
  );
  const revenues = sortedDates.map((d) => dailyData[d]);

  const ctx = document.getElementById("revenueChart").getContext("2d");
  if (revenueChart) revenueChart.destroy();

  revenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: sortedDates.slice(-14),
      datasets: [
        {
          label: "Revenue",
          data: revenues.slice(-14),
          borderColor: "#c6f135",
          backgroundColor: "rgba(198, 241, 53, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#8f9baa" } },
        tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } },
      },
      scales: {
        x: {
          ticks: { color: "#5a6472" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: {
            color: "#5a6472",
            callback: (v) => "৳" + v.toLocaleString(),
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

window.updateRevenueChartType = function () {
  if (currentData) loadRevenueChart(currentData.orders);
};

async function loadCategoryChart(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  const categoryRevenue = {};

  delivered.forEach((order) => {
    (order.items || []).forEach((item) => {
      const cat = item.categoryName || "Uncategorized";
      categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (item.total || 0);
    });
  });

  const sorted = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const ctx = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [
        {
          data: sorted.map((s) => s[1]),
          backgroundColor: [
            "#c6f135",
            "#38bdf8",
            "#f5a623",
            "#2dd4bf",
            "#f43f5e",
            "#8b5cf6",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#8f9baa", font: { size: 11 } },
        },
        tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } },
      },
    },
  });
}

async function loadHourlyHeatmap(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  const hourlyCount = new Array(24).fill(0);

  delivered.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    hourlyCount[hour]++;
  });

  const ctx = document.getElementById("hourlyChart").getContext("2d");
  if (hourlyChart) hourlyChart.destroy();

  hourlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: "Orders",
          data: hourlyCount,
          backgroundColor: "rgba(198, 241, 53, 0.7)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#8f9baa" } } },
    },
  });
}

async function loadTopProducts(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  const productRevenue = {};
  const productQuantity = {};

  delivered.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item.name;
      productRevenue[name] = (productRevenue[name] || 0) + (item.total || 0);
      productQuantity[name] =
        (productQuantity[name] || 0) + (item.quantity || 0);
    });
  });

  const sorted = Object.entries(productRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const container = document.getElementById("topProductsList");

  container.innerHTML = sorted
    .map(
      ([name, revenue], i) => `
        <div class="product-item">
            <div class="product-rank">${i + 1}</div>
            <div class="product-info">
                <div class="product-name">${name}</div>
                <div class="product-stats">${productQuantity[name]} units sold</div>
            </div>
            <div class="product-revenue">${formatCurrency(revenue)}</div>
        </div>
    `,
    )
    .join("");
}

async function loadCustomerTypeChart(orders) {
  const customerOrders = {};
  orders.forEach((order) => {
    const phone = order.customer?.phone;
    if (phone) customerOrders[phone] = (customerOrders[phone] || 0) + 1;
  });

  const newCustomers = Object.values(customerOrders).filter(
    (c) => c === 1,
  ).length;
  const returningCustomers = Object.values(customerOrders).filter(
    (c) => c > 1,
  ).length;

  const ctx = document.getElementById("customerTypeChart").getContext("2d");
  if (customerTypeChart) customerTypeChart.destroy();

  customerTypeChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["New Customers", "Returning Customers"],
      datasets: [
        {
          data: [newCustomers, returningCustomers],
          backgroundColor: ["#c6f135", "#38bdf8"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom", labels: { color: "#8f9baa" } } },
    },
  });
}

async function loadTopLocations(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  const locations = {};

  delivered.forEach((order) => {
    const city = order.customer?.address?.city || "Unknown";
    locations[city] = (locations[city] || 0) + 1;
  });

  const sorted = Object.entries(locations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const container = document.getElementById("topLocationsList");

  container.innerHTML = sorted
    .map(
      ([city, count]) => `
        <div class="location-item">
            <span class="location-name"><i class="fas fa-map-pin"></i> ${city}</span>
            <span class="location-count">${count} orders</span>
        </div>
    `,
    )
    .join("");
}

async function loadAvgDeliveryTime(orders) {
  const delivered = orders.filter((o) => o.orderStatus === "delivered");
  let totalHours = 0;
  let count = 0;

  delivered.forEach((order) => {
    const created = new Date(order.createdAt);
    const updated = new Date(order.updatedAt);
    const hours = (updated - created) / (1000 * 60 * 60);
    if (hours > 0 && hours < 720) {
      // Less than 30 days
      totalHours += hours;
      count++;
    }
  });

  const avgHours = count ? (totalHours / count).toFixed(1) : 0;
  document.getElementById("avgDeliveryTime").innerHTML = avgHours;
}

function applyDateFilter() {
  loadAllAnalytics();
}

// Export Analytics as PNG
document
  .getElementById("exportAnalyticsBtn")
  ?.addEventListener("click", async () => {
    const btn = document.getElementById("exportAnalyticsBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;

    try {
      const container = document.querySelector(".analytics-container");
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: "#0b0d0f",
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `analytics_report_${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      showToast("Analytics report downloaded!");
    } catch (err) {
      showToast("Failed to generate report: " + err.message, "error");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

// Initialize
if (!token) {
  window.location.href = "index.html";
} else {
  document.getElementById("startDate").value = getDefaultStartDate();
  document.getElementById("endDate").value = getDefaultEndDate();
  loadAllAnalytics();
}
