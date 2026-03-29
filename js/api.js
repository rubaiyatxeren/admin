const API_BASE_URL = "http://localhost:5000/api";

class API {
  static async request(endpoint, options = {}) {
    const token = localStorage.getItem("adminToken");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminData");
        window.location.href = "index.html";
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  static get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  static post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  static delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  static async upload(endpoint, formData) {
    const token = localStorage.getItem("adminToken");
    const headers = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "index.html";
      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(data.message || "Upload failed");
    }

    return data;
  }
}
