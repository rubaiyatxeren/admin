// Toast Notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 toast ${
    type === "success"
      ? "bg-gradient-to-r from-green-500 to-emerald-600"
      : type === "error"
        ? "bg-gradient-to-r from-red-500 to-pink-600"
        : type === "warning"
          ? "bg-gradient-to-r from-yellow-500 to-orange-600"
          : "bg-gradient-to-r from-blue-500 to-indigo-600"
  }`;

  const icon =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
          ? "fa-exclamation-triangle"
          : "fa-info-circle";

  toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas ${icon} text-xl"></i>
            <span class="font-medium">${message}</span>
        </div>
    `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Confirm Dialog
function confirmDialog(message, onConfirm) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center";
  modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 modal">
            <div class="text-center">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">Confirm Action</h3>
                <p class="text-gray-600 mb-6">${message}</p>
                <div class="flex space-x-3">
                    <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Cancel
                    </button>
                    <button id="confirmBtn" class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  document.getElementById("confirmBtn").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

// Close Modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

// Format Currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
  }).format(amount);
}

// Format Date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Toggle Sidebar
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("mainContent");
  sidebar.classList.toggle("open");
  if (sidebar.classList.contains("open")) {
    mainContent.classList.add("ml-0");
  } else {
    mainContent.classList.remove("ml-0");
  }
}
