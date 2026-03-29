// Content loader function
async function loadContent(page) {
  // Update active sidebar item
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.classList.remove("active");
  });
  const activeItem = document.querySelector(`[data-page="${page}"]`);
  if (activeItem) {
    activeItem.classList.add("active");
  }

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    products: "Products Management",
    categories: "Categories Management",
    orders: "Orders Management",
    banners: "Banner Management",
    settings: "Settings",
  };
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.textContent = titles[page] || "Dashboard";
  }

  // Load page content
  switch (page) {
    case "dashboard":
      await loadDashboard();
      break;
    case "products":
      if (typeof loadProducts === "function") {
        await loadProducts();
      } else {
        console.error("loadProducts function not found");
        showToast("Products module not loaded", "error");
      }
      break;
    case "categories":
      if (typeof loadCategories === "function") {
        await loadCategories();
      } else {
        console.error("loadCategories function not found");
        showToast("Categories module not loaded", "error");
      }
      break;
    case "orders":
      if (typeof loadOrders === "function") {
        await loadOrders();
      } else {
        console.error("loadOrders function not found");
        showToast("Orders module not loaded", "error");
      }
      break;
    case "banners":
      if (typeof loadBanners === "function") {
        await loadBanners();
      } else {
        console.error("loadBanners function not found");
        showToast("Banners module not loaded", "error");
      }
      break;
    case "settings":
      await loadSettings();
      break;
    default:
      await loadDashboard();
      break;
  }
}

// Settings page
async function loadSettings() {
  const contentArea = document.getElementById("contentArea");
  if (!contentArea) return;

  const adminData = JSON.parse(localStorage.getItem("adminData") || "{}");

  contentArea.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold text-gray-800">Settings</h2>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Profile Settings -->
                <div class="bg-white rounded-2xl shadow-lg p-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-user-circle text-purple-600 mr-2"></i>
                        Profile Settings
                    </h3>
                    <form id="profileForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                            <input type="text" name="name" id="profileName" value="${adminData.name || ""}"
                                   class="form-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                            <input type="email" name="email" id="profileEmail" value="${adminData.email || ""}"
                                   class="form-input w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" readonly>
                            <p class="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                            <input type="password" name="password" id="profilePassword"
                                   class="form-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                   placeholder="Leave blank to keep current password">
                        </div>
                        <button type="submit" class="btn-primary text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all w-full">
                            <i class="fas fa-save mr-2"></i>Update Profile
                        </button>
                    </form>
                </div>
                
                <!-- System Information -->
                <div class="bg-white rounded-2xl shadow-lg p-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-server text-purple-600 mr-2"></i>
                        System Information
                    </h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center py-2 border-b">
                            <span class="text-gray-600">API Version</span>
                            <span class="font-semibold text-gray-800">1.0.0</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b">
                            <span class="text-gray-600">Environment</span>
                            <span class="font-semibold text-gray-800">Development</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b">
                            <span class="text-gray-600">Admin Role</span>
                            <span class="badge badge-info">${adminData.role || "Admin"}</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b">
                            <span class="text-gray-600">Last Login</span>
                            <span class="font-semibold text-gray-800">${new Date().toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b">
                            <span class="text-gray-600">Server Status</span>
                            <span class="badge badge-success" id="serverStatus">Checking...</span>
                        </div>
                    </div>
                    
                    <div class="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                        <h4 class="font-semibold text-gray-800 mb-2">Quick Tips</h4>
                        <ul class="text-sm text-gray-600 space-y-1">
                            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Update your password regularly for security</li>
                            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Keep your profile information up to date</li>
                            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Contact support if you need assistance</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

  // Check server status
  checkServerStatus();

  // Handle profile form submission
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';
      submitBtn.disabled = true;

      const formData = new FormData(e.target);
      const data = {};
      formData.forEach((value, key) => {
        if (value) data[key] = value;
      });

      try {
        const response = await API.put("/auth/update", data);
        if (response.success) {
          showToast("Profile updated successfully!", "success");
          localStorage.setItem("adminData", JSON.stringify(response.data));
          const adminNameElement = document.getElementById("adminName");
          if (adminNameElement) {
            adminNameElement.textContent = response.data.name;
          }
          // Refresh the settings page to show updated data
          await loadSettings();
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    };
  }
}

// Check server status
async function checkServerStatus() {
  try {
    const response = await fetch("http://localhost:5000/health");
    const serverStatus = document.getElementById("serverStatus");
    if (response.ok) {
      if (serverStatus) {
        serverStatus.innerHTML = "Online";
        serverStatus.className = "badge badge-success";
      }
    } else {
      if (serverStatus) {
        serverStatus.innerHTML = "Offline";
        serverStatus.className = "badge badge-danger";
      }
    }
  } catch (error) {
    const serverStatus = document.getElementById("serverStatus");
    if (serverStatus) {
      serverStatus.innerHTML = "Offline";
      serverStatus.className = "badge badge-danger";
    }
  }
}

async function loadDashboard() {
  try {
    const response = await API.get("/dashboard/stats");
    const orders = await API.get("/orders?limit=5");

    if (response.success) {
      const stats = response.data;

      const contentArea = document.getElementById("contentArea");
      if (!contentArea) return;

      contentArea.innerHTML = `
                <div class="space-y-6">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div class="stat-card p-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-gray-500 text-sm mb-1">Total Products</p>
                                    <p class="text-3xl font-bold text-gray-800">${stats.totalProducts || 0}</p>
                                    <p class="text-xs text-green-600 mt-2">Active products</p>
                                </div>
                                <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <i class="fas fa-box text-white text-xl"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card p-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-gray-500 text-sm mb-1">Total Orders</p>
                                    <p class="text-3xl font-bold text-gray-800">${stats.totalOrders || 0}</p>
                                    <p class="text-xs text-green-600 mt-2">All time orders</p>
                                </div>
                                <div class="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <i class="fas fa-shopping-cart text-white text-xl"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card p-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-gray-500 text-sm mb-1">Total Revenue</p>
                                    <p class="text-3xl font-bold text-gray-800">${formatCurrency(stats.totalRevenue || 0)}</p>
                                    <p class="text-xs text-green-600 mt-2">From completed orders</p>
                                </div>
                                <div class="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <i class="fas fa-taka-sign text-white text-xl"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card p-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-gray-500 text-sm mb-1">Low Stock Items</p>
                                    <p class="text-3xl font-bold text-red-600">${stats.lowStockProducts || 0}</p>
                                    <p class="text-xs text-red-600 mt-2">Need attention</p>
                                </div>
                                <div class="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <i class="fas fa-exclamation-triangle text-white text-xl"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Charts and Recent Orders -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="bg-white rounded-2xl shadow-lg p-6">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">Sales Overview</h3>
                            <canvas id="salesChart" height="300"></canvas>
                        </div>
                        
                        <div class="bg-white rounded-2xl shadow-lg p-6">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">Recent Orders</h3>
                            <div class="space-y-3 max-h-96 overflow-y-auto">
                                ${
                                  orders.data && orders.data.length > 0
                                    ? orders.data
                                        .map(
                                          (order) => `
                                    <div class="flex justify-between items-center p-3 border rounded-xl hover:shadow-md transition cursor-pointer" onclick="viewOrderDetails('${order._id}')">
                                        <div>
                                            <p class="font-semibold text-gray-800">${order.orderNumber}</p>
                                            <p class="text-sm text-gray-500">${order.customer.name}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="font-bold text-purple-600">${formatCurrency(order.total)}</p>
                                            <span class="badge ${getStatusColor(order.orderStatus)}">${order.orderStatus}</span>
                                        </div>
                                    </div>
                                `,
                                        )
                                        .join("")
                                    : '<p class="text-gray-500 text-center">No orders yet</p>'
                                }
                            </div>
                        </div>
                    </div>
                    
                    <!-- Top Products -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">Top Selling Products</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="topProducts">
                            ${
                              stats.topProducts && stats.topProducts.length > 0
                                ? stats.topProducts
                                    .map(
                                      (product) => `
                                <div class="flex items-center space-x-3 p-3 border rounded-xl hover:shadow-md transition">
                                    <img src="${product.product.images[0]?.url || "https://via.placeholder.com/50"}" class="w-12 h-12 object-cover rounded-lg">
                                    <div class="flex-1">
                                        <p class="font-semibold text-gray-800">${product.product.name}</p>
                                        <p class="text-sm text-gray-500">Sold: ${product.totalSold} units</p>
                                    </div>
                                    <p class="font-bold text-purple-600">${formatCurrency(product.revenue)}</p>
                                </div>
                            `,
                                    )
                                    .join("")
                                : '<p class="text-gray-500 text-center col-span-full">No sales data yet</p>'
                            }
                        </div>
                    </div>
                </div>
            `;

      // Load sales chart
      await loadSalesChart();
    }
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    const contentArea = document.getElementById("contentArea");
    if (contentArea) {
      contentArea.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4 block"></i>
                    <p class="text-gray-600">Failed to load dashboard data</p>
                    <button onclick="loadDashboard()" class="mt-4 text-purple-600 hover:text-purple-700">Try Again</button>
                </div>
            `;
    }
  }
}

async function loadSalesChart() {
  try {
    const response = await API.get("/dashboard/sales?period=monthly");
    if (response.success) {
      const ctx = document.getElementById("salesChart");
      if (!ctx) return;

      const chartCtx = ctx.getContext("2d");
      const months = [
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
      const sales = new Array(12).fill(0);

      response.data.forEach((item) => {
        if (item._id >= 1 && item._id <= 12) {
          sales[item._id - 1] = item.total;
        }
      });

      new Chart(chartCtx, {
        type: "line",
        data: {
          labels: months,
          datasets: [
            {
              label: "Sales (৳)",
              data: sales,
              borderColor: "#667eea",
              backgroundColor: "rgba(102, 126, 234, 0.1)",
              borderWidth: 3,
              pointBackgroundColor: "#667eea",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "top",
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `৳ ${context.raw.toLocaleString()}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (value) {
                  return "৳ " + value.toLocaleString();
                },
              },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error("Failed to load sales chart:", error);
  }
}

// Helper function to get status color
function getStatusColor(status) {
  switch (status) {
    case "delivered":
      return "badge-success";
    case "cancelled":
      return "badge-danger";
    case "shipped":
      return "badge-info";
    case "processing":
      return "badge-warning";
    default:
      return "badge-warning";
  }
}

// Initialize dashboard on page load
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on dashboard page
  if (window.location.pathname.includes("dashboard.html")) {
    loadContent("dashboard");
  }
});
