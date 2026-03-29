let ordersPage = 1;
let ordersTotalPages = 1;

async function loadOrders() {
  const contentArea = document.getElementById("contentArea");
  contentArea.innerHTML = `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-800">Orders Management</h2>
            
            <!-- Filters -->
            <div class="bg-white rounded-2xl shadow-lg p-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="relative">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="searchOrders" placeholder="Search by order # or customer..." 
                               class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    <select id="orderStatusFilter" class="px-4 py-2 border border-gray-300 rounded-lg">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select id="paymentStatusFilter" class="px-4 py-2 border border-gray-300 rounded-lg">
                        <option value="">All Payment Status</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button onclick="resetOrderFilters()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                        <i class="fas fa-redo-alt mr-2"></i>Reset
                    </button>
                </div>
            </div>
            
            <!-- Orders Table -->
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="data-table w-full">
                        <thead class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                            <tr>
                                <th class="px-6 py-4 text-left">Order #</th>
                                <th class="px-6 py-4 text-left">Customer</th>
                                <th class="px-6 py-4 text-left">Total</th>
                                <th class="px-6 py-4 text-left">Payment</th>
                                <th class="px-6 py-4 text-left">Status</th>
                                <th class="px-6 py-4 text-left">Date</th>
                                <th class="px-6 py-4 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody" class="divide-y divide-gray-200">
                            <tr><td colspan="7" class="text-center py-12"><div class="loading-spinner mx-auto"></div></td></tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- Pagination -->
                <div class="px-6 py-4 border-t flex justify-between items-center">
                    <button onclick="changeOrdersPage(-1)" id="ordersPrevBtn" class="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
                    <span id="ordersPageInfo" class="text-gray-600">Page 1 of 1</span>
                    <button onclick="changeOrdersPage(1)" id="ordersNextBtn" class="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
            </div>
        </div>
    `;

  await loadOrdersList();

  document
    .getElementById("searchOrders")
    .addEventListener("input", debounce(loadOrdersList, 500));
  document
    .getElementById("orderStatusFilter")
    .addEventListener("change", loadOrdersList);
  document
    .getElementById("paymentStatusFilter")
    .addEventListener("change", loadOrdersList);
}

async function loadOrdersList() {
  try {
    const search = document.getElementById("searchOrders")?.value || "";
    const orderStatus =
      document.getElementById("orderStatusFilter")?.value || "";
    const paymentStatus =
      document.getElementById("paymentStatusFilter")?.value || "";

    let url = `/orders?page=${ordersPage}&limit=10`;
    if (search) url += `&search=${search}`;
    if (orderStatus) url += `&orderStatus=${orderStatus}`;
    if (paymentStatus) url += `&paymentStatus=${paymentStatus}`;

    const response = await API.get(url);

    if (response.success) {
      ordersTotalPages = response.pagination?.pages || 1;
      renderOrdersTable(response.data);
      updateOrdersPagination();
    }
  } catch (error) {
    console.error("Failed to load orders:", error);
    document.getElementById("ordersTableBody").innerHTML = `
            <tr><td colspan="7" class="text-center py-12">
                <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4 block"></i>
                <p class="text-gray-600">Failed to load orders</p>
                <button onclick="loadOrdersList()" class="mt-4 text-purple-600">Try Again</button>
            </td></tr>
        `;
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
            <tr><td colspan="7" class="text-center py-12">
                <i class="fas fa-shopping-cart text-6xl text-gray-400 mb-4 block"></i>
                <p class="text-gray-500 text-lg">No orders found</p>
            </td></tr>
        `;
    return;
  }

  tbody.innerHTML = orders
    .map(
      (order) => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4">
                <p class="font-semibold text-gray-800">${order.orderNumber}</p>
                <p class="text-xs text-gray-500">${order._id.slice(-6)}</p>
            </td>
            <td class="px-6 py-4">
                <p class="font-medium">${order.customer.name}</p>
                <p class="text-sm text-gray-500">${order.customer.phone}</p>
            </td>
            <td class="px-6 py-4">
                <p class="font-bold text-purple-600">${formatCurrency(order.total)}</p>
                <p class="text-xs text-gray-500">${order.items.length} items</p>
            </td>
            <td class="px-6 py-4">
                <span class="badge ${order.paymentStatus === "paid" ? "badge-success" : order.paymentStatus === "pending" ? "badge-warning" : "badge-danger"}">
                    ${order.paymentStatus}
                </span>
                <p class="text-xs text-gray-500 mt-1">${order.paymentMethod}</p>
            </td>
            <td class="px-6 py-4">
                <select onchange="updateOrderStatus('${order._id}', this.value)" 
                        class="px-3 py-1 border rounded-lg text-sm font-medium ${getStatusColor(order.orderStatus)}">
                    <option value="pending" ${order.orderStatus === "pending" ? "selected" : ""}>Pending</option>
                    <option value="confirmed" ${order.orderStatus === "confirmed" ? "selected" : ""}>Confirmed</option>
                    <option value="processing" ${order.orderStatus === "processing" ? "selected" : ""}>Processing</option>
                    <option value="shipped" ${order.orderStatus === "shipped" ? "selected" : ""}>Shipped</option>
                    <option value="delivered" ${order.orderStatus === "delivered" ? "selected" : ""}>Delivered</option>
                    <option value="cancelled" ${order.orderStatus === "cancelled" ? "selected" : ""}>Cancelled</option>
                </select>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">
                ${formatDate(order.createdAt)}
            </td>
            <td class="px-6 py-4">
                <button onclick="viewOrderDetails('${order._id}')" class="text-purple-600 hover:text-purple-800 transition">
                    <i class="fas fa-eye text-xl"></i>
                </button>
            </td>
        </tr>
    `,
    )
    .join("");
}

function getStatusColor(status) {
  switch (status) {
    case "delivered":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "shipped":
      return "bg-blue-100 text-blue-700";
    case "processing":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await API.put(`/orders/${orderId}/status`, {
      orderStatus: status,
    });
    if (response.success) {
      showToast(`Order status updated to ${status}`, "success");
      loadOrdersList();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function viewOrderDetails(orderId) {
  try {
    const response = await API.get(`/orders/${orderId}`);
    if (response.success) {
      const order = response.data;
      const modalContainer = document.getElementById("modalContainer");

      modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div class="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto modal">
                        <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                            <div>
                                <h3 class="text-2xl font-bold text-gray-800">Order Details</h3>
                                <p class="text-gray-500">${order.orderNumber}</p>
                            </div>
                            <button onclick="closeModal('orderModal')" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-2xl"></i>
                            </button>
                        </div>
                        
                        <div class="p-6 space-y-6">
                            <!-- Customer Info -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                                    <h4 class="font-bold text-lg mb-3 flex items-center">
                                        <i class="fas fa-user mr-2 text-blue-600"></i>Customer Information
                                    </h4>
                                    <p><strong>Name:</strong> ${order.customer.name}</p>
                                    <p><strong>Email:</strong> ${order.customer.email}</p>
                                    <p><strong>Phone:</strong> ${order.customer.phone}</p>
                                    <p><strong>Address:</strong> ${order.customer.address?.street}, ${order.customer.address?.area}, ${order.customer.address?.city}</p>
                                </div>
                                
                                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                                    <h4 class="font-bold text-lg mb-3 flex items-center">
                                        <i class="fas fa-info-circle mr-2 text-green-600"></i>Order Information
                                    </h4>
                                    <p><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
                                    <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                                    <p><strong>Payment Status:</strong> <span class="badge ${order.paymentStatus === "paid" ? "badge-success" : "badge-warning"}">${order.paymentStatus}</span></p>
                                    <p><strong>Order Status:</strong> <span class="badge ${getStatusColor(order.orderStatus)}">${order.orderStatus}</span></p>
                                    ${order.trackingNumber ? `<p><strong>Tracking:</strong> ${order.trackingNumber}</p>` : ""}
                                </div>
                            </div>
                            
                            <!-- Order Items -->
                            <div class="bg-white rounded-xl border overflow-hidden">
                                <h4 class="font-bold text-lg p-4 border-b bg-gray-50">Order Items</h4>
                                <div class="overflow-x-auto">
                                    <table class="w-full">
                                        <thead class="bg-gray-50">
                                            <tr>
                                                <th class="px-4 py-2 text-left">Product</th>
                                                <th class="px-4 py-2 text-left">Quantity</th>
                                                <th class="px-4 py-2 text-left">Price</th>
                                                <th class="px-4 py-2 text-left">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${order.items
                                              .map(
                                                (item) => `
                                                <tr class="border-t">
                                                    <td class="px-4 py-3">${item.name}</td>
                                                    <td class="px-4 py-3">${item.quantity}</td>
                                                    <td class="px-4 py-3">${formatCurrency(item.price)}</td>
                                                    <td class="px-4 py-3 font-semibold">${formatCurrency(item.total)}</td>
                                                </tr>
                                            `,
                                              )
                                              .join("")}
                                        </tbody>
                                        <tfoot class="bg-gray-50">
                                            <tr class="border-t">
                                                <td colspan="3" class="px-4 py-3 text-right font-semibold">Subtotal:</td>
                                                <td class="px-4 py-3">${formatCurrency(order.subtotal)}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="px-4 py-3 text-right font-semibold">Delivery Charge:</td>
                                                <td class="px-4 py-3">${formatCurrency(order.deliveryCharge)}</td>
                                            </tr>
                                            <tr class="border-t">
                                                <td colspan="3" class="px-4 py-3 text-right font-bold text-lg">Total:</td>
                                                <td class="px-4 py-3 font-bold text-purple-600 text-lg">${formatCurrency(order.total)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            
                            ${
                              order.notes
                                ? `
                                <div class="bg-yellow-50 rounded-xl p-4">
                                    <h4 class="font-semibold mb-2">Customer Notes</h4>
                                    <p class="text-gray-700">${order.notes}</p>
                                </div>
                            `
                                : ""
                            }
                        </div>
                    </div>
                </div>
            `;
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

function resetOrderFilters() {
  document.getElementById("searchOrders").value = "";
  document.getElementById("orderStatusFilter").value = "";
  document.getElementById("paymentStatusFilter").value = "";
  ordersPage = 1;
  loadOrdersList();
}

function changeOrdersPage(delta) {
  const newPage = ordersPage + delta;
  if (newPage >= 1 && newPage <= ordersTotalPages) {
    ordersPage = newPage;
    loadOrdersList();
  }
}

function updateOrdersPagination() {
  const pageInfo = document.getElementById("ordersPageInfo");
  const prevBtn = document.getElementById("ordersPrevBtn");
  const nextBtn = document.getElementById("ordersNextBtn");

  if (pageInfo)
    pageInfo.textContent = `Page ${ordersPage} of ${ordersTotalPages}`;
  if (prevBtn) prevBtn.disabled = ordersPage === 1;
  if (nextBtn) nextBtn.disabled = ordersPage === ordersTotalPages;
}
