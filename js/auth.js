async function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (!token && window.location.pathname.includes("dashboard.html")) {
    window.location.href = "index.html";
    return false;
  }

  if (token && window.location.pathname.includes("index.html")) {
    window.location.href = "dashboard.html";
    return false;
  }

  if (token && window.location.pathname.includes("dashboard.html")) {
    await loadAdminProfile();
  }

  return true;
}

async function loadAdminProfile() {
  try {
    const response = await API.get("/auth/me");
    if (response.success) {
      const admin = response.data;
      document.getElementById("adminName").textContent = admin.name;
      document.getElementById("adminEmail").textContent = admin.email;
    }
  } catch (error) {
    console.error("Failed to load profile:", error);
  }
}

function logout() {
  confirmDialog("Are you sure you want to logout?", () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminData");
    window.location.href = "index.html";
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});
