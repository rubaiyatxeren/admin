// ═══════════════════════════════════════════════════════════════════════════════
// BEETRANSFER ADMIN MODULE
// Drop-in module for Beeyond Harvest Admin Dashboard
// Integrates with existing apiCall(), modal(), showToast(), renderPagination()
// ═══════════════════════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let btPage = 1,
  btTotalPages = 1;
let btFilter = { status: "", search: "", dateFrom: "", dateTo: "" };
let btActiveView = "overview"; // 'overview' | 'transfers' | 'analytics' | 'storage'
let btActiveCharts = [];

// ── Helpers ──────────────────────────────────────────────────────────────────
function btFormatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function btFormatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return diff + "d ago";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function btFormatFullDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function btDestroyCharts() {
  btActiveCharts.forEach((c) => {
    try {
      c.destroy();
    } catch (e) {}
  });
  btActiveCharts = [];
}

function btStatusBadge(status) {
  const map = {
    pending_otp: { cls: "badge-amber", icon: "🔐", label: "OTP Pending" },
    otp_verified: { cls: "badge-sky", icon: "✔", label: "Verified" },
    sent: { cls: "badge-lime", icon: "📤", label: "Sent" },
    downloaded: { cls: "badge-teal", icon: "⬇️", label: "Downloaded" },
    expired: { cls: "badge-rose", icon: "⏰", label: "Expired" },
    failed: { cls: "badge-rose", icon: "❌", label: "Failed" },
  };
  const s = map[status] || { cls: "badge-text", icon: "?", label: status };
  return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
}

function btFileTypeIcon(mimetype) {
  if (!mimetype) return "📄";
  if (mimetype.startsWith("image/")) return "🖼️";
  if (mimetype.startsWith("video/")) return "🎬";
  if (mimetype.startsWith("audio/")) return "🎵";
  if (mimetype.includes("pdf")) return "📋";
  if (
    mimetype.includes("zip") ||
    mimetype.includes("rar") ||
    mimetype.includes("7z")
  )
    return "📦";
  if (mimetype.includes("word") || mimetype.includes("document")) return "📝";
  if (mimetype.includes("sheet") || mimetype.includes("excel")) return "📊";
  if (mimetype.includes("presentation") || mimetype.includes("powerpoint"))
    return "📑";
  if (
    mimetype.includes("json") ||
    mimetype.includes("javascript") ||
    mimetype.includes("html") ||
    mimetype.includes("css")
  )
    return "💻";
  return "📄";
}

// ── Nav switcher ──────────────────────────────────────────────────────────────
function btSetView(view) {
  btActiveView = view;
  btDestroyCharts();
  document
    .querySelectorAll(".bt-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  const views = ["overview", "transfers", "analytics", "storage"];
  views.forEach((v) => {
    const el = document.getElementById(`btView_${v}`);
    if (el) el.style.display = v === view ? "" : "none";
  });
  if (view === "overview") btLoadOverview();
  if (view === "transfers") btLoadTransferList();
  if (view === "analytics") btLoadAnalytics();
  if (view === "storage") btLoadStorage();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE LOADER
// Called via loadPage('beetransfer') from the sidebar
// ═══════════════════════════════════════════════════════════════════════════════
async function loadBeeTransferPage() {
  btDestroyCharts();
  btPage = 1;
  btFilter = { status: "", search: "", dateFrom: "", dateTo: "" };

  const c = document.getElementById("content");
  c.innerHTML = `
    <div class="fade-up">
      <!-- ── Page Header ──────────────────────────────────────────────────── -->
      <div class="section-header" style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:52px;height:52px;border-radius:16px;
                      background:linear-gradient(135deg,#F5A623,#C47F11);
                      display:flex;align-items:center;justify-content:center;font-size:24px">
            🐝
          </div>
          <div>
            <h2 style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;
                       margin-bottom:2px;display:flex;align-items:center;gap:10px">
              BeeTransfer
              <span class="badge badge-lime" style="font-size:10px;font-weight:600">BETA</span>
            </h2>
            <div class="card-sub">Secure file delivery · OTP-verified · Auto-expiring links</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="btSetView(btActiveView)">
            <i class="fas fa-rotate-right"></i> Refresh
          </button>
          <button class="btn btn-primary btn-sm" onclick="btOpenNewTransferModal()">
            <i class="fas fa-plus"></i> New Transfer
          </button>
        </div>
      </div>

      <!-- ── Sub-navigation tabs ──────────────────────────────────────────── -->
      <div style="display:flex;gap:4px;background:var(--bg);border-radius:12px;padding:5px;
                  margin-bottom:24px;border:1px solid var(--border);width:fit-content">
        ${[
          { v: "overview", icon: "fa-gauge-high", label: "Overview" },
          { v: "transfers", icon: "fa-paper-plane", label: "Transfers" },
          { v: "analytics", icon: "fa-chart-line", label: "Analytics" },
          { v: "storage", icon: "fa-hard-drive", label: "Storage" },
        ]
          .map(
            (t) => `
          <button class="bt-tab btn btn-ghost btn-sm${btActiveView === t.v ? " active" : ""}"
            data-view="${t.v}" onclick="btSetView('${t.v}')"
            style="border:none;${btActiveView === t.v ? "background:var(--surface2);color:var(--lime);" : ""}">
            <i class="fas ${t.icon}"></i> ${t.label}
          </button>`,
          )
          .join("")}
      </div>

      <!-- ── View containers ─────────────────────────────────────────────── -->
      <div id="btView_overview"></div>
      <div id="btView_transfers"  style="display:none"></div>
      <div id="btView_analytics"  style="display:none"></div>
      <div id="btView_storage"    style="display:none"></div>
    </div>`;

  btSetView("overview");
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 1 — OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
async function btLoadOverview() {
  const el = document.getElementById("btView_overview");
  if (!el) return;

  el.innerHTML = `
    <!-- KPI Skeleton -->
    <div class="stat-grid fade-up" id="btKpiGrid" style="margin-bottom:24px">
      ${[1, 2, 3, 4, 5, 6]
        .map(
          (i) => `
        <div class="stat-card stagger-${i}">
          <div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div>
          <div class="skel" style="height:26px;width:65%;margin-bottom:8px"></div>
          <div class="skel" style="height:12px;width:45%"></div>
        </div>`,
        )
        .join("")}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card fade-up stagger-2" id="btStatusChartCard">
        <div class="card-title" style="margin-bottom:4px">Transfer Status Breakdown</div>
        <div class="card-sub" style="margin-bottom:16px">All-time distribution</div>
        <div style="position:relative;height:200px"><canvas id="btStatusChart"></canvas></div>
        <div id="btStatusLegend" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:14px"></div>
      </div>
      <div class="card fade-up stagger-3" id="btTopSendersCard">
        <div class="card-title" style="margin-bottom:4px">Top Senders</div>
        <div class="card-sub" style="margin-bottom:16px">By transfer count</div>
        <div id="btTopSendersList" style="min-height:160px;display:flex;align-items:center;justify-content:center">
          <div class="spinner"></div>
        </div>
      </div>
    </div>

    <!-- Recent transfers -->
    <div class="card fade-up stagger-4" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="card-title">Recent Transfers</div>
          <div class="card-sub">Latest activity across all senders</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="btSetView('transfers')">
          View All <i class="fas fa-arrow-right"></i>
        </button>
      </div>
      <div id="btRecentList">
        <div style="display:flex;justify-content:center;padding:48px"><div class="spinner"></div></div>
      </div>
    </div>`;

  // Load data
  try {
    const [statsRes, listRes] = await Promise.all([
      apiCall("/transfers/admin/stats"),
      apiCall("/transfers?limit=8&page=1"),
    ]);
    const s = statsRes.data || {};
    const transfers = listRes.data || [];

    // KPI Cards
    document.getElementById("btKpiGrid").innerHTML = [
      {
        label: "Total Transfers",
        value: s.total || 0,
        icon: "fa-paper-plane",
        color: "var(--lime)",
        bg: "rgba(198,241,53,.15)",
        sub: "All-time",
      },
      {
        label: "Pending OTP",
        value: s.pending || 0,
        icon: "fa-lock",
        color: "var(--amber)",
        bg: "rgba(245,166,35,.15)",
        sub: "Awaiting verification",
      },
      {
        label: "Successfully Sent",
        value: s.sent || 0,
        icon: "fa-check-circle",
        color: "var(--teal)",
        bg: "rgba(45,212,191,.15)",
        sub: "Delivered to receiver",
      },
      {
        label: "Downloaded",
        value: s.downloaded || 0,
        icon: "fa-download",
        color: "var(--sky)",
        bg: "rgba(56,189,248,.15)",
        sub: "Files retrieved",
      },
      {
        label: "Expired",
        value: s.expired || 0,
        icon: "fa-clock",
        color: "var(--rose)",
        bg: "rgba(244,63,94,.15)",
        sub: "Past expiry date",
      },
      {
        label: "Data Transferred",
        value: s.totalDataTransferred || "0 B",
        icon: "fa-database",
        color: "var(--lime)",
        bg: "rgba(198,241,53,.12)",
        sub: s.totalFilesTransferred + " files total",
      },
    ]
      .map(
        (k, i) => `
      <div class="stat-card fade-up stagger-${i + 1}" style="--accent:${k.color}">
        <div class="stat-icon" style="background:${k.bg};color:${k.color}">
          <i class="fas ${k.icon}"></i>
        </div>
        <div class="stat-value">${k.value}</div>
        <div class="stat-label">${k.label}</div>
        <div class="stat-sub up" style="color:${k.color}">
          <i class="fas fa-circle" style="font-size:7px"></i> ${k.sub}
        </div>
      </div>`,
      )
      .join("");

    // Status donut chart
    btDestroyCharts();
    const statusData = {
      labels: ["Pending OTP", "Sent", "Downloaded", "Expired", "Failed"],
      counts: [
        s.pending || 0,
        s.sent || 0,
        s.downloaded || 0,
        s.expired || 0,
        s.failed || 0,
      ],
      colors: ["#F5A623", "#2DD4BF", "#38BDF8", "#F43F5E", "#8F9BAA"],
    };
    const ctx = document.getElementById("btStatusChart");
    if (ctx) {
      const ch = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: statusData.labels,
          datasets: [
            {
              data: statusData.counts,
              backgroundColor: statusData.colors,
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "72%",
          plugins: { legend: { display: false } },
        },
      });
      btActiveCharts.push(ch);
      const legend = document.getElementById("btStatusLegend");
      if (legend) {
        legend.innerHTML = statusData.labels
          .map(
            (l, i) => `
          <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)">
            <span style="width:9px;height:9px;border-radius:2px;background:${statusData.colors[i]};display:inline-block"></span>
            ${l} <strong>${statusData.counts[i]}</strong>
          </span>`,
          )
          .join("");
      }
    }

    // Top senders: derive from transfer list
    const senderMap = {};
    transfers.forEach((t) => {
      const e = t.sender?.email || "—";
      if (!senderMap[e]) senderMap[e] = 0;
      senderMap[e]++;
    });
    const topSenders = Object.entries(senderMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxSends = topSenders[0]?.[1] || 1;
    document.getElementById("btTopSendersList").innerHTML = topSenders.length
      ? topSenders
          .map(
            ([email, count]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="width:30px;height:30px;border-radius:8px;background:var(--lime-dim);
                        display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                        color:var(--lime);flex-shrink:0">${email[0].toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${email}</div>
              <div style="height:3px;background:var(--surface2);border-radius:2px;overflow:hidden;margin-top:4px">
                <div style="height:100%;width:${Math.round((count / maxSends) * 100)}%;background:var(--lime);border-radius:2px"></div>
              </div>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--lime);flex-shrink:0">${count}</div>
          </div>`,
          )
          .join("")
      : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No data yet</div>';

    // Recent transfers mini-table
    document.getElementById("btRecentList").innerHTML = transfers.length
      ? `<table class="data-table">
          <thead><tr>
            <th>Transfer ID</th><th>From → To</th><th>Files</th><th>Size</th><th>Status</th><th>Date</th><th>Actions</th>
          </tr></thead>
          <tbody>${transfers.map((t) => btRenderMiniRow(t)).join("")}</tbody>
        </table>`
      : '<div style="text-align:center;padding:48px;color:var(--text3)"><i class="fas fa-paper-plane" style="font-size:32px;margin-bottom:12px;display:block"></i>No transfers yet</div>';
  } catch (e) {
    showToast("BeeTransfer: " + e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 2 — TRANSFERS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
async function btLoadTransferList() {
  const el = document.getElementById("btView_transfers");
  if (!el) return;

  el.innerHTML = `
    <!-- Toolbar -->
    <div class="card fade-up" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr auto auto auto auto auto auto;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="inp-group">
          <i class="fas fa-search"></i>
          <input class="inp" id="btSearch" placeholder="Search ID, sender, or receiver…"
            value="${btFilter.search}"
            oninput="btFilter.search=this.value;btPage=1;btLoadTransferList()">
        </div>
        <select class="inp" style="width:auto" onchange="btFilter.status=this.value;btPage=1;btLoadTransferList()">
          <option value="">All Status</option>
          <option value="pending_otp" ${btFilter.status === "pending_otp" ? "selected" : ""}>OTP Pending</option>
          <option value="sent"        ${btFilter.status === "sent" ? "selected" : ""}>Sent</option>
          <option value="downloaded"  ${btFilter.status === "downloaded" ? "selected" : ""}>Downloaded</option>
          <option value="expired"     ${btFilter.status === "expired" ? "selected" : ""}>Expired</option>
          <option value="failed"      ${btFilter.status === "failed" ? "selected" : ""}>Failed</option>
        </select>
        <input class="inp" type="date" style="width:140px" title="From"
          value="${btFilter.dateFrom}"
          onchange="btFilter.dateFrom=this.value;btPage=1;btLoadTransferList()">
        <input class="inp" type="date" style="width:140px" title="To"
          value="${btFilter.dateTo}"
          onchange="btFilter.dateTo=this.value;btPage=1;btLoadTransferList()">
        <button class="btn btn-ghost btn-sm" onclick="btFilter={status:'',search:'',dateFrom:'',dateTo:''};btPage=1;btLoadTransferList()">
          <i class="fas fa-rotate-right"></i>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="btExportCSV()">
          <i class="fas fa-file-export"></i> CSV
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="card fade-up" style="padding:0;overflow:hidden">
      <table class="data-table">
        <thead><tr>
          <th>Transfer ID</th>
          <th>Sender</th>
          <th>Receiver</th>
          <th>Files</th>
          <th>Total Size</th>
          <th>OTP</th>
          <th>Status</th>
          <th>Expires</th>
          <th>Date</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="btTableBody">
          <tr><td colspan="10" style="text-align:center;padding:48px">
            <div class="spinner" style="margin:0 auto"></div>
          </td></tr>
        </tbody>
      </table>
      <div style="padding:16px 20px;border-top:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;color:var(--text3)" id="btTableInfo"></div>
        <div class="pagination" id="btTablePages"></div>
      </div>
    </div>`;

  await btFetchAndRenderTable();
}

async function btFetchAndRenderTable() {
  const qs = new URLSearchParams({ page: btPage, limit: 15 });
  if (btFilter.status) qs.set("status", btFilter.status);
  if (btFilter.search) qs.set("search", btFilter.search);
  if (btFilter.dateFrom) qs.set("dateFrom", btFilter.dateFrom);
  if (btFilter.dateTo) qs.set("dateTo", btFilter.dateTo);

  try {
    const res = await apiCall(`/transfers?${qs}`);
    btTotalPages = res.pagination?.pages || 1;
    const transfers = res.data || [];

    document.getElementById("btTableBody").innerHTML = transfers.length
      ? transfers.map((t) => btRenderFullRow(t)).join("")
      : `<tr><td colspan="10" style="text-align:center;padding:56px;color:var(--text3)">
           <i class="fas fa-paper-plane" style="font-size:36px;margin-bottom:12px;display:block"></i>
           No transfers found
         </td></tr>`;

    document.getElementById("btTableInfo").textContent =
      `${transfers.length} transfer${transfers.length !== 1 ? "s" : ""} · Page ${btPage} of ${btTotalPages}`;

    renderPagination("btTablePages", btPage, btTotalPages, (p) => {
      btPage = p;
      btFetchAndRenderTable();
    });
  } catch (e) {
    showToast(e.message, "error");
  }
}

function btRenderMiniRow(t) {
  const expiredSoon =
    t.expiresAt && new Date(t.expiresAt) - Date.now() < 86400000;
  return `
    <tr onclick="btViewTransfer('${t.transferId}')">
      <td><span style="font-family:monospace;font-size:12px;color:var(--lime)">${t.transferId}</span></td>
      <td>
        <div style="font-size:12px;font-weight:600">${t.sender?.email || "—"}</div>
        <div style="font-size:10px;color:var(--text3)">→ ${t.receiver?.email || "—"}</div>
      </td>
      <td><span style="font-size:13px;font-weight:700">${t.files?.length || 0}</span></td>
      <td><span style="font-size:12px;color:var(--text2)">${btFormatBytes(t.totalSizeBytes)}</span></td>
      <td>${btStatusBadge(t.status)}</td>
      <td style="font-size:12px;color:var(--text2)">${btFormatDate(t.createdAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="btViewTransfer('${t.transferId}')" title="View">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="btDeleteTransfer('${t.transferId}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

function btRenderFullRow(t) {
  const isExpiringSoon =
    t.expiresAt &&
    new Date(t.expiresAt) - Date.now() < 86400000 &&
    t.status !== "expired";
  const otpVerified = t.otp?.verified;
  const totalDownloads = (t.files || []).reduce(
    (s, f) => s + (f.downloadCount || 0),
    0,
  );

  return `
    <tr onclick="btViewTransfer('${t.transferId}')">
      <td>
        <div style="font-family:monospace;font-size:12px;font-weight:700;color:var(--lime)">${t.transferId}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">#${String(t._id || "").slice(-6)}</div>
      </td>
      <td>
        <div style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
             title="${t.sender?.email || "—"}">${t.sender?.email || "—"}</div>
        ${t.sender?.name ? `<div style="font-size:10px;color:var(--text3)">${t.sender.name}</div>` : ""}
      </td>
      <td>
        <div style="font-size:12px;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
             title="${t.receiver?.email || "—"}">${t.receiver?.email || "—"}</div>
        ${t.receiver?.name ? `<div style="font-size:10px;color:var(--text3)">${t.receiver.name}</div>` : ""}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--sky)">${t.files?.length || 0}</span>
          <div style="display:flex;gap:2px">
            ${(t.files || [])
              .slice(0, 3)
              .map(
                (f) =>
                  `<span title="${f.originalName}">${btFileTypeIcon(f.mimetype)}</span>`,
              )
              .join("")}
            ${(t.files || []).length > 3 ? `<span style="font-size:10px;color:var(--text3)">+${t.files.length - 3}</span>` : ""}
          </div>
        </div>
        ${totalDownloads > 0 ? `<div style="font-size:10px;color:var(--teal)"><i class="fas fa-download" style="font-size:8px"></i> ${totalDownloads} dl</div>` : ""}
      </td>
      <td>
        <div style="font-size:12px;font-weight:600">${btFormatBytes(t.totalSizeBytes)}</div>
      </td>
      <td>
        ${
          otpVerified
            ? `<span style="font-size:11px;color:var(--lime)"><i class="fas fa-check-circle"></i> Verified</span>
             <div style="font-size:10px;color:var(--text3)">${btFormatDate(t.otp?.verifiedAt)}</div>`
            : t.status === "pending_otp"
              ? `<span class="badge badge-amber" style="font-size:10px">⏳ Pending</span>
                 <div style="font-size:10px;color:var(--text3)">${t.otp?.attempts || 0} attempts</div>`
              : '<span style="color:var(--text3);font-size:11px">—</span>'
        }
      </td>
      <td>${btStatusBadge(t.status)}</td>
      <td>
        ${
          t.expiresAt
            ? `<div style="font-size:11px;color:${isExpiringSoon ? "var(--rose)" : "var(--text2)"}">
               ${isExpiringSoon ? "⚠️ " : ""}${btFormatDate(t.expiresAt)}
             </div>`
            : '<span style="color:var(--text3)">—</span>'
        }
      </td>
      <td style="font-size:12px;color:var(--text2)">${btFormatDate(t.createdAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="btViewTransfer('${t.transferId}')" title="View Details">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="btResendLinks('${t.transferId}')" title="Resend emails"
            style="color:var(--sky)">
            <i class="fas fa-envelope"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="btDeleteTransfer('${t.transferId}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 3 — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
async function btLoadAnalytics() {
  const el = document.getElementById("btView_analytics");
  if (!el) return;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- File Type Breakdown -->
      <div class="card fade-up stagger-1">
        <div class="card-title" style="margin-bottom:4px">File Types</div>
        <div class="card-sub" style="margin-bottom:16px">By MIME category</div>
        <div style="position:relative;height:160px"><canvas id="btFileTypeChart"></canvas></div>
        <div id="btFileTypeLegend" style="display:flex;flex-direction:column;gap:4px;margin-top:12px"></div>
      </div>

      <!-- Status over time (placeholder bar) -->
      <div class="card fade-up stagger-2" style="grid-column:span 2">
        <div class="card-title" style="margin-bottom:4px">Transfer Volume</div>
        <div class="card-sub" style="margin-bottom:16px">Last 30 days</div>
        <div style="height:160px"><canvas id="btVolumeChart"></canvas></div>
      </div>
    </div>

    <!-- Metrics row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px" id="btAnalyticsMetrics">
      ${[1, 2, 3, 4]
        .map(
          (i) => `
        <div class="card" style="text-align:center">
          <div class="skel" style="height:18px;width:60%;margin:0 auto 8px"></div>
          <div class="skel" style="height:30px;width:40%;margin:0 auto"></div>
        </div>`,
        )
        .join("")}
    </div>

    <!-- Funnel -->
    <div class="card fade-up" style="margin-bottom:20px">
      <div class="card-title" style="margin-bottom:4px">Transfer Funnel</div>
      <div class="card-sub" style="margin-bottom:20px">Initiated → OTP verified → Sent → Downloaded</div>
      <div id="btFunnelContainer"></div>
    </div>

    <!-- Top file types table -->
    <div class="card fade-up">
      <div class="card-title" style="margin-bottom:16px">File Extension Breakdown</div>
      <div id="btExtTable"></div>
    </div>`;

  try {
    const [statsRes, listRes] = await Promise.all([
      apiCall("/transfers/admin/stats"),
      apiCall("/transfers?limit=200"),
    ]);
    const s = statsRes.data || {};
    const transfers = listRes.data || [];

    // ── Derive analytics from transfer list ──────────────────────────────────
    const total = s.total || transfers.length;
    const otpVerif = transfers.filter((t) => t.otp?.verified).length;
    const sent = s.sent || 0;
    const downloaded = s.downloaded || 0;

    // File type categorisation
    const mimeGroups = {
      Images: 0,
      Documents: 0,
      Archives: 0,
      "Video/Audio": 0,
      "Code/Data": 0,
      Other: 0,
    };
    const extMap = {};
    let totalFiles = 0,
      totalBytes = 0;

    transfers.forEach((t) => {
      (t.files || []).forEach((f) => {
        totalFiles++;
        totalBytes += f.sizeBytes || 0;
        const m = f.mimetype || "";
        if (m.startsWith("image/")) mimeGroups["Images"]++;
        else if (
          m.includes("pdf") ||
          m.includes("document") ||
          m.includes("sheet") ||
          m.includes("presentation") ||
          m.includes("text")
        )
          mimeGroups["Documents"]++;
        else if (
          m.includes("zip") ||
          m.includes("rar") ||
          m.includes("7z") ||
          m.includes("tar")
        )
          mimeGroups["Archives"]++;
        else if (m.startsWith("video/") || m.startsWith("audio/"))
          mimeGroups["Video/Audio"]++;
        else if (
          m.includes("json") ||
          m.includes("javascript") ||
          m.includes("html") ||
          m.includes("css")
        )
          mimeGroups["Code/Data"]++;
        else mimeGroups["Other"]++;

        const ext =
          (f.originalName || "").split(".").pop().toLowerCase() || "unknown";
        if (!extMap[ext]) extMap[ext] = { count: 0, bytes: 0 };
        extMap[ext].count++;
        extMap[ext].bytes += f.sizeBytes || 0;
      });
    });

    // Analytics metrics
    const convRate = total > 0 ? Math.round((downloaded / total) * 100) : 0;
    document.getElementById("btAnalyticsMetrics").innerHTML = [
      {
        label: "Initiation→Send Conv.",
        value: total > 0 ? Math.round((sent / total) * 100) + "%" : "—",
        color: "var(--lime)",
        icon: "fa-route",
      },
      {
        label: "Download Rate",
        value: sent > 0 ? Math.round((downloaded / sent) * 100) + "%" : "—",
        color: "var(--sky)",
        icon: "fa-download",
      },
      {
        label: "Avg Files / Transfer",
        value:
          transfers.length > 0
            ? (totalFiles / transfers.length).toFixed(1)
            : "—",
        color: "var(--teal)",
        icon: "fa-layer-group",
      },
      {
        label: "Avg File Size",
        value: totalFiles > 0 ? btFormatBytes(totalBytes / totalFiles) : "—",
        color: "var(--amber)",
        icon: "fa-weight-hanging",
      },
    ]
      .map(
        (m) => `
      <div class="card" style="text-align:center;--accent:${m.color}">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);
                    display:flex;align-items:center;justify-content:center;margin:0 auto 10px">
          <i class="fas ${m.icon}" style="font-size:16px;color:${m.color}"></i>
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:${m.color}">${m.value}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${m.label}</div>
      </div>`,
      )
      .join("");

    // File type donut
    btDestroyCharts();
    const ftLabels = Object.keys(mimeGroups).filter((k) => mimeGroups[k] > 0);
    const ftCounts = ftLabels.map((k) => mimeGroups[k]);
    const ftColors = [
      "#38BDF8",
      "#C6F135",
      "#F5A623",
      "#F43F5E",
      "#2DD4BF",
      "#8F9BAA",
    ];
    const ftCtx = document.getElementById("btFileTypeChart");
    if (ftCtx) {
      const ch = new Chart(ftCtx, {
        type: "doughnut",
        data: {
          labels: ftLabels,
          datasets: [
            {
              data: ftCounts,
              backgroundColor: ftColors,
              borderWidth: 0,
              hoverOffset: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: { legend: { display: false } },
        },
      });
      btActiveCharts.push(ch);
      const maxFt = Math.max(...ftCounts, 1);
      document.getElementById("btFileTypeLegend").innerHTML = ftLabels
        .map(
          (l, i) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:11px">
          <span style="width:8px;height:8px;border-radius:2px;background:${ftColors[i]};flex-shrink:0"></span>
          <span style="flex:1;color:var(--text2)">${l}</span>
          <span style="color:${ftColors[i]};font-weight:700">${ftCounts[i]}</span>
        </div>`,
        )
        .join("");
    }

    // Volume chart (daily buckets from last 30 days)
    const buckets = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().split("T")[0]] = 0;
    }
    transfers.forEach((t) => {
      const day = (t.createdAt || "").split("T")[0];
      if (buckets[day] !== undefined) buckets[day]++;
    });
    const vCtx = document.getElementById("btVolumeChart");
    if (vCtx) {
      const vLabels = Object.keys(buckets).map((d) => {
        const dt = new Date(d);
        return dt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });
      });
      const vData = Object.values(buckets);
      const grad = vCtx.getContext("2d").createLinearGradient(0, 0, 0, 160);
      grad.addColorStop(0, "rgba(198,241,53,.3)");
      grad.addColorStop(1, "rgba(198,241,53,0)");
      const ch = new Chart(vCtx, {
        type: "bar",
        data: {
          labels: vLabels,
          datasets: [
            {
              label: "Transfers",
              data: vData,
              backgroundColor: "rgba(198,241,53,.6)",
              borderColor: "var(--lime)",
              borderRadius: 4,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#5a6472", font: { size: 9 }, maxTicksLimit: 10 },
            },
            y: {
              grid: { color: "rgba(255,255,255,.04)" },
              ticks: { color: "#5a6472", font: { size: 10 } },
              beginAtZero: true,
            },
          },
        },
      });
      btActiveCharts.push(ch);
    }

    // Funnel
    const funnelSteps = [
      { label: "Initiated", value: total, color: "#8F9BAA" },
      { label: "OTP Verified", value: otpVerif, color: "#38BDF8" },
      { label: "Sent", value: sent, color: "#2DD4BF" },
      { label: "Downloaded", value: downloaded, color: "#C6F135" },
    ];
    const maxF = Math.max(...funnelSteps.map((s) => s.value), 1);
    document.getElementById("btFunnelContainer").innerHTML = funnelSteps
      .map((step, i) => {
        const pct = Math.round((step.value / maxF) * 100);
        const conv =
          i > 0 && funnelSteps[i - 1].value > 0
            ? Math.round((step.value / funnelSteps[i - 1].value) * 100)
            : 100;
        return `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:110px;font-size:12px;color:var(--text2);text-align:right">${step.label}</div>
          <div style="flex:1;height:32px;background:var(--bg);border-radius:6px;overflow:hidden;position:relative">
            <div style="height:100%;width:${pct}%;background:${step.color};border-radius:6px;
                        display:flex;align-items:center;padding-left:10px;transition:width .6s ease">
              <span style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#0b0d0f">${step.value}</span>
            </div>
          </div>
          ${i > 0 ? `<div style="width:44px;text-align:right;font-size:11px;color:var(--text3)">${conv}%</div>` : '<div style="width:44px"></div>'}
        </div>`;
      })
      .join("");

    // Ext breakdown table
    const topExts = Object.entries(extMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    document.getElementById("btExtTable").innerHTML = topExts.length
      ? `<table class="data-table">
          <thead><tr><th>Extension</th><th>Files</th><th>Total Size</th><th>Share</th></tr></thead>
          <tbody>
          ${topExts
            .map(([ext, d]) => {
              const pct = Math.round((d.count / totalFiles) * 100);
              return `<tr>
              <td><span style="font-family:monospace;color:var(--lime);font-size:13px">.${ext}</span></td>
              <td style="font-weight:700">${d.count}</td>
              <td style="color:var(--text2)">${btFormatBytes(d.bytes)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:80px;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--lime)"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text3)">${pct}%</span>
                </div>
              </td>
            </tr>`;
            })
            .join("")}
          </tbody>
        </table>`
      : '<div style="text-align:center;padding:24px;color:var(--text3)">No file data yet</div>';
  } catch (e) {
    showToast("Analytics error: " + e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 4 — STORAGE HEALTH
// ═══════════════════════════════════════════════════════════════════════════════
async function btLoadStorage() {
  const el = document.getElementById("btView_storage");
  if (!el) return;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Storage gauge -->
      <div class="card fade-up stagger-1">
        <div class="card-title" style="margin-bottom:4px">Storage Usage</div>
        <div class="card-sub" style="margin-bottom:20px">Cloudinary / disk footprint of active transfers</div>
        <div id="btStorageGauge" style="min-height:180px;display:flex;align-items:center;justify-content:center">
          <div class="spinner"></div>
        </div>
      </div>

      <!-- Health indicators -->
      <div class="card fade-up stagger-2">
        <div class="card-title" style="margin-bottom:16px">Health Indicators</div>
        <div id="btHealthIndicators" style="display:flex;flex-direction:column;gap:0">
          ${[1, 2, 3, 4, 5]
            .map(
              () => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              <div class="skel" style="width:10px;height:10px;border-radius:50%"></div>
              <div class="skel" style="flex:1;height:14px"></div>
              <div class="skel" style="width:60px;height:14px"></div>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </div>

    <!-- Expiry timeline -->
    <div class="card fade-up stagger-3" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div class="card-title">Expiry Timeline</div>
          <div class="card-sub">Files expiring over the next 7 days</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="btCleanupExpired()">
          <i class="fas fa-broom"></i> Clean Expired
        </button>
      </div>
      <div id="btExpiryTimeline" style="min-height:80px;display:flex;align-items:center;justify-content:center">
        <div class="spinner"></div>
      </div>
    </div>

    <!-- Storage by status breakdown -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
      <div class="card fade-up stagger-4">
        <div class="card-title" style="margin-bottom:4px">⏰ Expiring Soon</div>
        <div class="card-sub" style="margin-bottom:12px">Within 24 hours</div>
        <div id="btExpiringSoon"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
      <div class="card fade-up stagger-5">
        <div class="card-title" style="margin-bottom:4px">🗂️ Largest Transfers</div>
        <div class="card-sub" style="margin-bottom:12px">Top 5 by total size</div>
        <div id="btLargestTransfers"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
      <div class="card fade-up stagger-5">
        <div class="card-title" style="margin-bottom:4px">🔁 Most Downloaded</div>
        <div class="card-sub" style="margin-bottom:12px">Top 5 by download count</div>
        <div id="btMostDownloaded"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
    </div>`;

  try {
    const [statsRes, listRes] = await Promise.all([
      apiCall("/transfers/admin/stats"),
      apiCall("/transfers?limit=500"),
    ]);
    const s = statsRes.data || {};
    const transfers = listRes.data || [];

    // ── Storage gauge ──────────────────────────────────────────────────────
    const totalBytes = s.totalDataTransferredBytes || 0;
    const maxBytes = 1024 * 1024 * 1024; // 1 GB soft cap for display
    const usagePct = Math.min(Math.round((totalBytes / maxBytes) * 100), 100);
    const gaugeColor =
      usagePct > 80 ? "#F43F5E" : usagePct > 60 ? "#F5A623" : "#C6F135";

    document.getElementById("btStorageGauge").innerHTML = `
      <div style="text-align:center">
        <div style="position:relative;width:160px;height:160px;margin:0 auto">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="65" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="12"/>
            <circle cx="80" cy="80" r="65" fill="none" stroke="${gaugeColor}" stroke-width="12"
              stroke-dasharray="${Math.round((2 * Math.PI * 65 * usagePct) / 100)} ${Math.round((2 * Math.PI * 65 * (100 - usagePct)) / 100)}"
              stroke-linecap="round" transform="rotate(-90 80 80)"
              style="transition:stroke-dasharray 1s ease"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                      align-items:center;justify-content:center">
            <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:${gaugeColor}">${usagePct}%</div>
            <div style="font-size:11px;color:var(--text3)">Used</div>
          </div>
        </div>
        <div style="margin-top:12px">
          <div style="font-size:18px;font-weight:700;color:var(--text)">${btFormatBytes(totalBytes)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">of ${btFormatBytes(maxBytes)} soft cap</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;width:200px;margin-left:auto;margin-right:auto">
          <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:var(--lime)">${s.totalFilesTransferred || 0}</div>
            <div style="font-size:10px;color:var(--text3)">Files</div>
          </div>
          <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:var(--sky)">${s.total || 0}</div>
            <div style="font-size:10px;color:var(--text3)">Transfers</div>
          </div>
        </div>
      </div>`;

    // ── Health indicators ──────────────────────────────────────────────────
    const now = Date.now();
    const expiredCount = transfers.filter((t) => t.status === "expired").length;
    const failedCount = transfers.filter((t) => t.status === "failed").length;
    const pendingOldCount = transfers.filter(
      (t) =>
        t.status === "pending_otp" && now - new Date(t.createdAt) > 3600000,
    ).length;
    const expiringSoon = transfers.filter(
      (t) =>
        t.expiresAt &&
        new Date(t.expiresAt) - now < 86400000 &&
        t.status !== "expired",
    ).length;
    const activeTransfers = transfers.filter((t) =>
      ["sent", "otp_verified"].includes(t.status),
    ).length;

    const indicators = [
      {
        label: "Active Transfers",
        value: `${activeTransfers} active`,
        ok: activeTransfers >= 0,
        icon: "fa-paper-plane",
      },
      {
        label: "Expired (unclean)",
        value: `${expiredCount} expired`,
        ok: expiredCount === 0,
        icon: "fa-clock",
      },
      {
        label: "Failed Transfers",
        value: `${failedCount} failed`,
        ok: failedCount === 0,
        icon: "fa-circle-xmark",
      },
      {
        label: "Stale OTP (>1h)",
        value: `${pendingOldCount} stale`,
        ok: pendingOldCount === 0,
        icon: "fa-lock",
      },
      {
        label: "Expiring in 24h",
        value: `${expiringSoon} transfers`,
        ok: expiringSoon < 5,
        icon: "fa-triangle-exclamation",
      },
    ];

    document.getElementById("btHealthIndicators").innerHTML = indicators
      .map(
        (ind) => `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)">
        <span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;
                     background:${ind.ok ? "var(--lime)" : "var(--rose)"}"></span>
        <i class="fas ${ind.icon}" style="font-size:12px;color:var(--text3);width:16px"></i>
        <span style="flex:1;font-size:13px;color:var(--text2)">${ind.label}</span>
        <span style="font-size:12px;font-weight:600;color:${ind.ok ? "var(--text2)" : "var(--rose)"}">${ind.value}</span>
      </div>`,
      )
      .join("");

    // ── Expiry timeline ────────────────────────────────────────────────────
    const expiryBuckets = {};
    for (let i = 0; i < 8; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      expiryBuckets[d.toISOString().split("T")[0]] = 0;
    }
    transfers.forEach((t) => {
      if (!t.expiresAt) return;
      const day = new Date(t.expiresAt).toISOString().split("T")[0];
      if (expiryBuckets[day] !== undefined) expiryBuckets[day]++;
    });
    const exMax = Math.max(...Object.values(expiryBuckets), 1);
    document.getElementById("btExpiryTimeline").innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;align-items:end">
        ${Object.entries(expiryBuckets)
          .map(([day, count], i) => {
            const h = Math.max(Math.round((count / exMax) * 80), 4);
            const label =
              i === 0
                ? "Today"
                : i === 1
                  ? "Tomorrow"
                  : new Date(day).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    });
            const col =
              count > 5
                ? "var(--rose)"
                : count > 2
                  ? "var(--amber)"
                  : "var(--lime)";
            return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${col}">${count}</div>
              <div style="width:100%;height:${h}px;background:${col};border-radius:4px 4px 0 0;opacity:.8"></div>
              <div style="font-size:9px;color:var(--text3);text-align:center;word-break:break-word">${label}</div>
            </div>`;
          })
          .join("")}
      </div>`;

    // ── Expiring soon list ─────────────────────────────────────────────────
    const expiringSoonList = transfers
      .filter(
        (t) =>
          t.expiresAt &&
          new Date(t.expiresAt) - now < 86400000 &&
          t.status !== "expired",
      )
      .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
      .slice(0, 5);

    document.getElementById("btExpiringSoon").innerHTML =
      expiringSoonList.length
        ? expiringSoonList
            .map(
              (t) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer"
               onclick="btViewTransfer('${t.transferId}')">
            <div style="font-family:monospace;font-size:11px;color:var(--rose)">${t.transferId}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">
              ${t.sender?.email || "—"} · ${t.files?.length || 0} files
            </div>
            <div style="font-size:10px;color:var(--rose);margin-top:2px">
              ⚠️ Expires ${btFormatFullDate(t.expiresAt)}
            </div>
          </div>`,
            )
            .join("")
        : '<div style="text-align:center;padding:16px;color:var(--teal);font-size:12px">✅ None expiring in 24h</div>';

    // ── Largest transfers ──────────────────────────────────────────────────
    const largest = [...transfers]
      .sort((a, b) => (b.totalSizeBytes || 0) - (a.totalSizeBytes || 0))
      .slice(0, 5);
    document.getElementById("btLargestTransfers").innerHTML = largest.length
      ? largest
          .map(
            (t) => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer"
               onclick="btViewTransfer('${t.transferId}')">
            <div style="flex:1;min-width:0">
              <div style="font-family:monospace;font-size:11px;color:var(--lime)">
                ${t.transferId}</div>
              <div style="font-size:10px;color:var(--text3)">${t.files?.length || 0} files</div>
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--sky)">${btFormatBytes(t.totalSizeBytes)}</div>
          </div>`,
          )
          .join("")
      : '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">No data</div>';

    // ── Most downloaded ────────────────────────────────────────────────────
    const byDownloads = transfers
      .map((t) => ({
        t,
        dl: (t.files || []).reduce((s, f) => s + (f.downloadCount || 0), 0),
      }))
      .filter((x) => x.dl > 0)
      .sort((a, b) => b.dl - a.dl)
      .slice(0, 5);

    document.getElementById("btMostDownloaded").innerHTML = byDownloads.length
      ? byDownloads
          .map(
            ({ t, dl }) => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer"
               onclick="btViewTransfer('${t.transferId}')">
            <div style="flex:1;min-width:0">
              <div style="font-family:monospace;font-size:11px;color:var(--lime)">${t.transferId}</div>
              <div style="font-size:10px;color:var(--text3)">${t.sender?.email || "—"}</div>
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--teal)">
              <i class="fas fa-download" style="font-size:10px"></i> ${dl}
            </div>
          </div>`,
          )
          .join("")
      : '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">No downloads yet</div>';
  } catch (e) {
    showToast("Storage error: " + e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFER DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
async function btViewTransfer(transferId) {
  modal(`
    <div class="modal-box wide">
      <div class="modal-header">
        <div><div class="modal-title">Transfer Details</div></div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    const res = await apiCall(`/transfers/${transferId}`);
    const t = res.data;
    const totalDownloads = (t.files || []).reduce(
      (s, f) => s + (f.downloadCount || 0),
      0,
    );
    const isExpired = t.expiresAt && new Date(t.expiresAt) < new Date();

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide" style="max-width:780px">
          <div class="modal-header">
            <div>
              <div class="modal-title" style="display:flex;align-items:center;gap:10px">
                🐝 ${t.transferId}
                ${btStatusBadge(t.status)}
              </div>
              <div class="modal-sub">${btFormatFullDate(t.createdAt)}</div>
            </div>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- Transfer summary strip -->
            <div style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;
                        padding:20px 24px;margin-bottom:20px">
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
                ${[
                  {
                    label: "Files",
                    value: `${t.files?.length || 0} files`,
                    icon: "📁",
                    color: "#FDD882",
                  },
                  {
                    label: "Total Size",
                    value: btFormatBytes(t.totalSizeBytes),
                    icon: "💾",
                    color: "#FDD882",
                  },
                  {
                    label: "Downloads",
                    value: totalDownloads,
                    icon: "⬇️",
                    color: "#FDD882",
                  },
                  {
                    label: "Expires",
                    value: isExpired ? "EXPIRED" : btFormatDate(t.expiresAt),
                    icon: "⏰",
                    color: isExpired ? "#F43F5E" : "#FDD882",
                  },
                ]
                  .map(
                    (s) => `
                  <div style="text-align:center">
                    <div style="font-size:22px;margin-bottom:4px">${s.icon}</div>
                    <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${s.color}">${s.value}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px">${s.label}</div>
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>

            <!-- Parties -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
              <div class="info-block">
                <h4><i class="fas fa-paper-plane" style="margin-right:6px;color:var(--sky)"></i>Sender</h4>
                <div class="info-row"><span>Email</span><span>${t.sender?.email || "—"}</span></div>
                <div class="info-row"><span>Name</span><span>${t.sender?.name || "—"}</span></div>
                <div class="info-row"><span>IP Address</span>
                  <span style="font-family:monospace;font-size:11px">${t.ipAddress || "—"}</span></div>
              </div>
              <div class="info-block">
                <h4><i class="fas fa-inbox" style="margin-right:6px;color:var(--teal)"></i>Receiver</h4>
                <div class="info-row"><span>Email</span><span>${t.receiver?.email || "—"}</span></div>
                <div class="info-row"><span>Name</span><span>${t.receiver?.name || "—"}</span></div>
                <div class="info-row"><span>OTP Verified</span>
                  <span>${t.otp?.verified ? `<span class="badge badge-lime">✔ ${btFormatDate(t.otp?.verifiedAt)}</span>` : '<span class="badge badge-amber">Pending</span>'}</span></div>
              </div>
            </div>

            <!-- Message -->
            ${
              t.message
                ? `
            <div class="info-block" style="margin-bottom:20px">
              <h4><i class="fas fa-comment" style="margin-right:6px"></i>Message from Sender</h4>
              <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-top:8px;
                          font-style:italic">"${t.message}"</div>
            </div>`
                : ""
            }

            <!-- Files -->
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                        color:var(--text3);margin-bottom:12px">
              <i class="fas fa-folder" style="margin-right:6px"></i>Files (${t.files?.length || 0})
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">
              ${(t.files || [])
                .map(
                  (f) => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;
                            background:var(--bg);border-radius:10px;border:1px solid var(--border)">
                  <span style="font-size:22px;flex-shrink:0">${btFileTypeIcon(f.mimetype)}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      ${f.originalName}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px">
                      ${f.mimetype || "—"} · ${btFormatBytes(f.sizeBytes)}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:13px;font-weight:700;color:${f.downloadCount > 0 ? "var(--teal)" : "var(--text3)"}">
                      <i class="fas fa-download" style="font-size:10px"></i> ${f.downloadCount || 0}
                    </div>
                    ${
                      f.cloudinaryUrl
                        ? `
                    <a href="${f.cloudinaryUrl}" target="_blank"
                       style="font-size:11px;color:var(--sky);text-decoration:none;margin-top:2px;display:block">
                       <i class="fas fa-external-link-alt" style="font-size:9px"></i> View File
                    </a>`
                        : ""
                    }
                  </div>
                </div>`,
                )
                .join("")}
            </div>

            <!-- OTP Activity -->
            <div class="info-block">
              <h4><i class="fas fa-shield-halved" style="margin-right:6px"></i>OTP Activity</h4>
              <div class="info-row"><span>Attempts</span>
                <span style="color:${(t.otp?.attempts || 0) >= 3 ? "var(--rose)" : "var(--text2)"}">${t.otp?.attempts || 0} / 5</span></div>
              <div class="info-row"><span>Verified</span>
                <span>${t.otp?.verified ? `<span class="badge badge-lime">Yes</span>` : '<span class="badge badge-amber">No</span>'}</span></div>
              <div class="info-row"><span>Status</span><span>${btStatusBadge(t.status)}</span></div>
              <div class="info-row"><span>User Agent</span>
                <span style="font-size:10px;max-width:260px;word-break:break-all">${(t.userAgent || "—").slice(0, 80)}</span></div>
            </div>
          </div>
          <div class="modal-footer" style="justify-content:space-between">
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" onclick="btResendLinks('${t.transferId}')">
                <i class="fas fa-envelope"></i> Resend
              </button>
              <button class="btn btn-danger btn-sm" onclick="closeModal();btDeleteTransfer('${t.transferId}')">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    showToast(e.message, "error");
    closeModal();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function btDeleteTransfer(transferId) {
  if (
    !confirm(
      `Delete transfer ${transferId}?\n\nThis will permanently remove all files and cannot be undone.`,
    )
  )
    return;
  try {
    await apiCall(`/transfers/${transferId}`, { method: "DELETE" });
    showToast("Transfer deleted", "success");
    btSetView(btActiveView);
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function btResendLinks(transferId) {
  showToast(
    "Resend feature — add POST /transfers/:id/resend to backend",
    "info",
  );
}

async function btCleanupExpired() {
  if (
    !confirm(
      "Delete ALL expired transfers?\n\nThis will permanently remove expired files and cannot be undone.",
    )
  )
    return;
  try {
    // You'd add DELETE /transfers?status=expired to backend
    showToast(
      "Cleanup endpoint: add DELETE /transfers/cleanup/expired to backend",
      "info",
    );
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── New Transfer Modal ──────────────────────────────────────────────────────
function btOpenNewTransferModal() {
  modal(`
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">📤 New Transfer (Admin)</div>
          <div class="modal-sub">Initiate a file transfer — OTP will be sent to sender</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div style="background:rgba(198,241,53,.08);border:1px solid rgba(198,241,53,.2);
                    border-radius:12px;padding:14px;margin-bottom:20px">
          <div style="font-size:12px;color:var(--lime);font-weight:600;margin-bottom:4px">
            <i class="fas fa-info-circle"></i> How it works
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.6">
            1. Fill in sender &amp; receiver email<br>
            2. Upload up to 10 files (15MB each)<br>
            3. Sender gets an OTP email to verify<br>
            4. On verification, receiver gets download link
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group">
            <label class="form-label">Sender Email *</label>
            <input class="inp" id="btNewSenderEmail" placeholder="sender@example.com">
          </div>
          <div class="form-group">
            <label class="form-label">Sender Name</label>
            <input class="inp" id="btNewSenderName" placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Receiver Email *</label>
            <input class="inp" id="btNewReceiverEmail" placeholder="receiver@example.com">
          </div>
          <div class="form-group">
            <label class="form-label">Receiver Name</label>
            <input class="inp" id="btNewReceiverName" placeholder="Optional">
          </div>
          <div class="form-group full">
            <label class="form-label">Message (optional)</label>
            <textarea class="inp" id="btNewMessage" placeholder="A note for the receiver…"></textarea>
          </div>
          <div class="form-group full">
            <label class="form-label">Files * (max 10, 15MB each)</label>
            <div class="upload-zone" onclick="document.getElementById('btNewFiles').click()">
              <i class="fas fa-cloud-arrow-up"></i>
              <p>Click to choose files</p>
              <span id="btFileCountDisplay">No files selected</span>
            </div>
            <input type="file" id="btNewFiles" multiple style="display:none"
              onchange="btUpdateFileDisplay(this)">
            <div id="btFilePreview" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btNewTransferBtn" onclick="btSubmitNewTransfer()">
          <i class="fas fa-paper-plane"></i> Initiate Transfer
        </button>
      </div>
    </div>`);
}

function btUpdateFileDisplay(input) {
  const files = Array.from(input.files);
  const countEl = document.getElementById("btFileCountDisplay");
  const previewEl = document.getElementById("btFilePreview");
  if (countEl)
    countEl.textContent = files.length
      ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
      : "No files selected";
  if (previewEl) {
    previewEl.innerHTML = files
      .map(
        (f) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;
                  background:var(--bg);border-radius:8px;font-size:12px">
        <span>${btFileTypeIcon(f.type)}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
        <span style="color:var(--text3)">${btFormatBytes(f.size)}</span>
        ${f.size > 15 * 1024 * 1024 ? `<span class="badge badge-rose" style="font-size:9px">TOO LARGE</span>` : ""}
      </div>`,
      )
      .join("");
  }
}

async function btSubmitNewTransfer() {
  const senderEmail = document
    .getElementById("btNewSenderEmail")
    ?.value?.trim();
  const senderName = document.getElementById("btNewSenderName")?.value?.trim();
  const receiverEmail = document
    .getElementById("btNewReceiverEmail")
    ?.value?.trim();
  const receiverName = document
    .getElementById("btNewReceiverName")
    ?.value?.trim();
  const message = document.getElementById("btNewMessage")?.value?.trim();
  const filesInput = document.getElementById("btNewFiles");

  if (!senderEmail || !receiverEmail) {
    showToast("Sender and receiver email required", "warning");
    return;
  }
  if (!filesInput?.files?.length) {
    showToast("Select at least one file", "warning");
    return;
  }

  const oversized = Array.from(filesInput.files).find(
    (f) => f.size > 15 * 1024 * 1024,
  );
  if (oversized) {
    showToast(`"${oversized.name}" exceeds 15MB limit`, "error");
    return;
  }

  const btn = document.getElementById("btNewTransferBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initiating…';

  try {
    const fd = new FormData();
    fd.append("senderEmail", senderEmail);
    fd.append("senderName", senderName);
    fd.append("receiverEmail", receiverEmail);
    fd.append("receiverName", receiverName);
    fd.append("message", message);
    Array.from(filesInput.files).forEach((f) => fd.append("files", f));

    const res = await apiUpload("/transfers/initiate", fd);
    showToast(`✅ Transfer initiated! OTP sent to ${senderEmail}`, "success");
    closeModal();
    btSetView("transfers");
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Initiate Transfer';
    }
  }
}

// ── CSV Export ───────────────────────────────────────────────────────────────
async function btExportCSV() {
  try {
    const res = await apiCall("/transfers?limit=1000");
    const transfers = res.data || [];
    const rows = [
      [
        "Transfer ID",
        "Sender",
        "Receiver",
        "Files",
        "Size",
        "Status",
        "OTP Verified",
        "Created",
        "Expires",
      ],
    ];
    transfers.forEach((t) =>
      rows.push([
        t.transferId,
        t.sender?.email || "",
        t.receiver?.email || "",
        t.files?.length || 0,
        btFormatBytes(t.totalSizeBytes),
        t.status,
        t.otp?.verified ? "Yes" : "No",
        new Date(t.createdAt).toLocaleDateString(),
        t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "",
      ]),
    );
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv," + encodeURIComponent(csv);
    a.download = `beetransfer_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("CSV exported!", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}
