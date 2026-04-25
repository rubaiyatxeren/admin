// ═══════════════════════════════════════════════════════════════════════
// ██  COMPLAINT MANAGEMENT — Full Admin Control Panel

// ── State ────────────────────────────────────────────────────────────────────
let cmpPage = 1,
  cmpTotal = 1;
let cmpFilter = {
  status: "",
  priority: "",
  category: "",
  search: "",
  flagged: "",
  dateFrom: "",
  dateTo: "",
};
let cmpSelectedIds = new Set();

// ── Config ───────────────────────────────────────────────────────────────────
const CMP_STATUS_CONFIG = {
  open: {
    label: "Open",
    icon: "📬",
    color: "var(--sky)",
    bg: "rgba(56,189,248,.15)",
    badge: "badge-sky",
  },
  under_review: {
    label: "Reviewing",
    icon: "🔍",
    color: "var(--teal)",
    bg: "rgba(45,212,191,.15)",
    badge: "badge-teal",
  },
  on_hold: {
    label: "On Hold",
    icon: "⏸️",
    color: "var(--amber)",
    bg: "rgba(245,166,35,.15)",
    badge: "badge-amber",
  },
  escalated: {
    label: "Escalated",
    icon: "⬆️",
    color: "var(--rose)",
    bg: "rgba(244,63,94,.15)",
    badge: "badge-rose",
  },
  resolved: {
    label: "Resolved",
    icon: "✅",
    color: "var(--lime)",
    bg: "rgba(198,241,53,.15)",
    badge: "badge-lime",
  },
  rejected: {
    label: "Rejected",
    icon: "❌",
    color: "#6B7280",
    bg: "rgba(107,114,128,.15)",
    badge: "badge-text",
  },
  closed: {
    label: "Closed",
    icon: "🔒",
    color: "#374151",
    bg: "rgba(55,65,81,.15)",
    badge: "badge-text",
  },
};
const CMP_PRIORITY_CONFIG = {
  low: { label: "Low", icon: "🔵", color: "#64748B", badge: "badge-text" },
  medium: {
    label: "Medium",
    icon: "🟡",
    color: "var(--amber)",
    badge: "badge-amber",
  },
  high: {
    label: "High",
    icon: "🔴",
    color: "var(--rose)",
    badge: "badge-rose",
  },
  urgent: {
    label: "Urgent",
    icon: "🚨",
    color: "#DC2626",
    badge: "badge-rose",
  },
};
const CMP_CATEGORY_LABELS = {
  wrong_product: "ভুল পণ্য",
  damaged_product: "নষ্ট পণ্য",
  missing_item: "পণ্য পাইনি",
  delivery_issue: "ডেলিভারি সমস্যা",
  payment_issue: "পেমেন্ট সমস্যা",
  refund_request: "রিফান্ড অনুরোধ",
  quality_issue: "মানসম্পন্ন নয়",
  late_delivery: "দেরিতে ডেলিভারি",
  rude_behavior: "অভদ্র আচরণ",
  other: "অন্যান্য",
};
const CMP_REJECTION_REASONS = [
  { value: "duplicate", label: "Duplicate complaint" },
  { value: "invalid_claim", label: "Invalid claim" },
  { value: "out_of_policy", label: "Out of policy" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
  { value: "abusive_content", label: "Abusive content" },
  { value: "other", label: "Other" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const cmpBadge = (status) => {
  const c = CMP_STATUS_CONFIG[status] || {};
  return `<span class="badge ${c.badge || "badge-text"}">${c.icon || ""} ${c.label || status}</span>`;
};
const cmpPBadge = (priority) => {
  const c = CMP_PRIORITY_CONFIG[priority] || {};
  return `<span class="badge ${c.badge || "badge-text"}" style="color:${c.color}">${c.icon || ""} ${c.label || priority}</span>`;
};
const cmpCatLabel = (cat) => CMP_CATEGORY_LABELS[cat] || cat;
const cmpApi = (endpoint, opts = {}) => apiCall(`/complaints${endpoint}`, opts);

// ── Nav badge updater ─────────────────────────────────────────────────────────
async function cmpRefreshBadge() {
  try {
    const res = await cmpApi("/stats");
    const d = res.data;
    const urgent = (d.open || 0) + (d.underReview || 0) + (d.escalated || 0);
    const badge = document.getElementById("complaintBadge");
    if (badge) {
      badge.textContent = urgent;
      badge.style.display = urgent > 0 ? "" : "none";
    }
  } catch (e) {}
}
cmpRefreshBadge();
setInterval(cmpRefreshBadge, 60000);

// ═══════════════════════════════════════════════════════════════════════════
// ██  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
async function loadComplaints() {
  const c = document.getElementById("content");
  c.innerHTML = `
    <div class="fade-up">
      <div class="section-header">
        <div>
          <h2 style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">📋</span> Complaint Management
          </h2>
          <div class="card-sub" style="margin-top:4px">Full lifecycle complaint control · SLA tracking · Customer communication</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="cmpBulkModal()" id="cmpBulkBtn" style="display:none">
            <i class="fas fa-layer-group"></i> Bulk Action (<span id="cmpSelCount">0</span>)
          </button>
          <button class="btn btn-ghost btn-sm" onclick="exportComplaints()">
            <i class="fas fa-file-export"></i> Export CSV
          </button>
          <button class="btn btn-ghost btn-sm" onclick="loadComplaints()">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- STATS -->
      <div class="stat-grid fade-up" id="cmpStatsGrid" style="margin-bottom:20px">
        ${[1, 2, 3, 4].map((i) => `<div class="stat-card stagger-${i}"><div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div><div class="skel" style="height:26px;width:65%;margin-bottom:8px"></div><div class="skel" style="height:13px;width:45%"></div></div>`).join("")}
      </div>

      <!-- TOOLBAR -->
      <div class="card fade-up" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr auto auto auto auto auto auto;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="inp-group">
            <i class="fas fa-search"></i>
            <input class="inp" id="cmpSearch" placeholder="Search ticket, name, email, phone, order…"
              oninput="cmpFilter.search=this.value;cmpPage=1;loadComplaintsList()">
          </div>
          <select class="inp" style="width:auto" onchange="cmpFilter.status=this.value;cmpPage=1;loadComplaintsList()">
            <option value="">All Status</option>
            ${Object.entries(CMP_STATUS_CONFIG)
              .map(
                ([k, v]) =>
                  `<option value="${k}">${v.icon} ${v.label}</option>`,
              )
              .join("")}
          </select>
          <select class="inp" style="width:auto" onchange="cmpFilter.priority=this.value;cmpPage=1;loadComplaintsList()">
            <option value="">All Priority</option>
            ${Object.entries(CMP_PRIORITY_CONFIG)
              .map(
                ([k, v]) =>
                  `<option value="${k}">${v.icon} ${v.label}</option>`,
              )
              .join("")}
          </select>
          <select class="inp" style="width:auto" onchange="cmpFilter.category=this.value;cmpPage=1;loadComplaintsList()">
            <option value="">All Categories</option>
            ${Object.entries(CMP_CATEGORY_LABELS)
              .map(([k, v]) => `<option value="${k}">${v}</option>`)
              .join("")}
          </select>
          <select class="inp" style="width:auto" onchange="cmpFilter.flagged=this.value;cmpPage=1;loadComplaintsList()">
            <option value="">All</option>
            <option value="true">🚩 Flagged only</option>
          </select>
          <select class="inp" style="width:auto" id="cmpSortSelect" onchange="cmpFilter.sort=this.value;cmpPage=1;loadComplaintsList()">
            <option value="">Latest First</option>
            <option value="priority">By Priority</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="cmpFilter={status:'',priority:'',category:'',search:'',flagged:'',dateFrom:'',dateTo:''};cmpPage=1;document.getElementById('cmpSearch').value='';loadComplaints()">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
        <!-- Date range row -->
        <div style="display:flex;gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--text3)">Date range:</span>
          <input class="inp" type="date" style="width:auto" onchange="cmpFilter.dateFrom=this.value;cmpPage=1;loadComplaintsList()">
          <span style="color:var(--text3);font-size:12px">to</span>
          <input class="inp" type="date" style="width:auto" onchange="cmpFilter.dateTo=this.value;cmpPage=1;loadComplaintsList()">
        </div>
      </div>

      <!-- TABLE -->
      <div class="card fade-up" style="padding:0;overflow:hidden">
        <table class="data-table">
          <thead><tr>
            <th><input type="checkbox" id="cmpSelectAll" onchange="cmpToggleAll(this.checked)" style="cursor:pointer"></th>
            <th>Ticket</th>
            <th>Customer</th>
            <th>Category</th>
            <th>Subject</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Replies</th>
            <th>Date</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="cmpTableBody">
            <tr><td colspan="10" style="text-align:center;padding:48px"><div class="spinner" style="margin:0 auto"></div></td></tr>
          </tbody>
        </table>
        <div style="padding:16px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:13px;color:var(--text3)" id="cmpInfo"></div>
          <div class="pagination" id="cmpPages"></div>
        </div>
      </div>
    </div>`;

  await Promise.all([loadCmpStats(), loadComplaintsList()]);
}

// ── Stats ────────────────────────────────────────────────────────────────────
async function loadCmpStats() {
  try {
    const res = await cmpApi("/stats");
    const d = res.data;
    document.getElementById("cmpStatsGrid").innerHTML = `
      ${cmpStatCard("Total", d.total || 0, "fa-ticket-alt", "var(--lime)", "rgba(198,241,53,.15)", `${d.todayCount || 0} today`)}
      ${cmpStatCard("Open", d.open || 0, "fa-envelope-open", "var(--sky)", "rgba(56,189,248,.15)", `${d.escalated || 0} escalated`)}
      ${cmpStatCard("In Review", (d.underReview || 0) + (d.onHold || 0), "fa-search", "var(--teal)", "rgba(45,212,191,.15)", `${d.onHold || 0} on hold`)}
      ${cmpStatCard("Resolved", d.resolved || 0, "fa-check-circle", "var(--amber)", "rgba(245,166,35,.15)", `${d.resolutionRate || 0}% rate`)}
      ${cmpStatCard("Rejected", d.rejected || 0, "fa-ban", "var(--rose)", "rgba(244,63,94,.15)", `${d.closed || 0} closed`)}
      ${cmpStatCard("Urgent Open", d.urgent || 0, "fa-exclamation-triangle", "#DC2626", "rgba(220,38,38,.15)", "Need attention")}
      ${cmpStatCard("This Week", d.weekCount || 0, "fa-calendar-week", "var(--sky)", "rgba(56,189,248,.15)", "Last 7 days")}
      ${cmpStatCard("Resolution%", (d.resolutionRate || 0) + "%", "fa-chart-pie", "var(--lime)", "rgba(198,241,53,.15)", "All time")}
    `;
  } catch (e) {
    console.error("cmp stats:", e.message);
  }
}

function cmpStatCard(label, value, icon, color, bg, sub) {
  return `<div class="stat-card fade-up" style="--accent:${color}">
    <div class="stat-icon" style="background:${bg};color:${color}"><i class="fas ${icon}"></i></div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-sub up" style="color:${color}"><i class="fas fa-circle" style="font-size:7px"></i> ${sub}</div>
  </div>`;
}

// ── List ─────────────────────────────────────────────────────────────────────
async function loadComplaintsList() {
  try {
    const qs = new URLSearchParams({ page: cmpPage, limit: 15 });
    if (cmpFilter.status) qs.set("status", cmpFilter.status);
    if (cmpFilter.priority) qs.set("priority", cmpFilter.priority);
    if (cmpFilter.category) qs.set("category", cmpFilter.category);
    if (cmpFilter.search) qs.set("search", cmpFilter.search);
    if (cmpFilter.flagged) qs.set("flagged", cmpFilter.flagged);
    if (cmpFilter.sort) qs.set("sort", cmpFilter.sort);
    if (cmpFilter.dateFrom) qs.set("dateFrom", cmpFilter.dateFrom);
    if (cmpFilter.dateTo) qs.set("dateTo", cmpFilter.dateTo);

    const res = await cmpApi(`?${qs}`);
    cmpTotal = res.pagination?.pages || 1;
    const complaints = res.data || [];
    cmpSelectedIds.clear();
    cmpUpdateBulkBtn();

    document.getElementById("cmpTableBody").innerHTML = complaints.length
      ? complaints.map(renderCmpRow).join("")
      : `<tr><td colspan="10" style="text-align:center;padding:60px;color:var(--text3)">
           <i class="fas fa-ticket-alt" style="font-size:36px;margin-bottom:14px;display:block"></i>
           No complaints found
         </td></tr>`;

    document.getElementById("cmpInfo").textContent =
      `${complaints.length} complaints · Page ${cmpPage} of ${cmpTotal}`;

    renderPagination("cmpPages", cmpPage, cmpTotal, (p) => {
      cmpPage = p;
      loadComplaintsList();
    });

    // Update select-all state
    const sa = document.getElementById("cmpSelectAll");
    if (sa) sa.checked = false;
  } catch (e) {
    showToast(e.message, "error");
  }
}

function renderCmpRow(c) {
  const sc = CMP_STATUS_CONFIG[c.status] || {};
  const pc = CMP_PRIORITY_CONFIG[c.priority] || {};
  const hasNewReply = c.replies?.some((r) => r.authorType === "customer");

  return `
  <tr onclick="openCmpDetail('${c._id}')" style="cursor:pointer;${c.isFlagged ? "background:rgba(244,63,94,.04)" : ""}">
    <td onclick="event.stopPropagation()">
      <input type="checkbox" class="cmp-checkbox" value="${c._id}"
        onchange="cmpToggleSelect('${c._id}',this.checked)" style="cursor:pointer">
    </td>
    <td>
      <div style="font-family:monospace;font-size:12px;font-weight:700;color:var(--lime)">${c.ticketNumber}</div>
      ${c.isFlagged ? `<span style="font-size:10px;color:var(--rose)">🚩 Flagged</span>` : ""}
      ${c.orderNumber ? `<div style="font-size:10px;color:var(--amber)">📦 ${c.orderNumber}</div>` : ""}
    </td>
    <td>
      <div style="font-weight:500;font-size:13px">${c.customer?.name || "—"}</div>
      <div style="font-size:11px;color:var(--text3)">${c.customer?.email || ""}</div>
    </td>
    <td><span class="badge badge-text" style="font-size:10px">${cmpCatLabel(c.category)}</span></td>
    <td>
      <div style="font-size:12px;font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.subject}">${c.subject}</div>
    </td>
    <td>${cmpPBadge(c.priority)}</td>
    <td>${cmpBadge(c.status)}</td>
    <td>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--sky)">${c.replies?.length || 0}</span>
        ${hasNewReply ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--amber);display:inline-block" title="Customer replied"></span>` : ""}
      </div>
    </td>
    <td style="font-size:12px;color:var(--text2)">${formatDate(c.createdAt)}</td>
    <td onclick="event.stopPropagation()">
      <div style="display:flex;gap:4px;align-items:center">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openCmpDetail('${c._id}')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="cmpQuickReply('${c._id}')" title="Reply"
          style="color:var(--sky)">
          <i class="fas fa-reply"></i>
        </button>
        ${
          c.status === "open" || c.status === "under_review"
            ? `
        <button class="btn btn-ghost btn-sm btn-icon" onclick="cmpQuickResolve('${c._id}')" title="Resolve"
          style="color:var(--lime)">
          <i class="fas fa-check"></i>
        </button>`
            : ""
        }
        <button class="btn btn-ghost btn-sm btn-icon"
          onclick="cmpToggleFlag('${c._id}',${c.isFlagged})"
          title="${c.isFlagged ? "Unflag" : "Flag"}"
          style="color:${c.isFlagged ? "var(--rose)" : "var(--text3)"}">
          <i class="fas fa-flag"></i>
        </button>
      </div>
    </td>
  </tr>`;
}

// ── Selection / Bulk ──────────────────────────────────────────────────────────
function cmpToggleSelect(id, checked) {
  checked ? cmpSelectedIds.add(id) : cmpSelectedIds.delete(id);
  cmpUpdateBulkBtn();
}
function cmpToggleAll(checked) {
  document.querySelectorAll(".cmp-checkbox").forEach((cb) => {
    cb.checked = checked;
    checked ? cmpSelectedIds.add(cb.value) : cmpSelectedIds.delete(cb.value);
  });
  cmpUpdateBulkBtn();
}
function cmpUpdateBulkBtn() {
  const btn = document.getElementById("cmpBulkBtn");
  const cnt = document.getElementById("cmpSelCount");
  if (!btn) return;
  if (cmpSelectedIds.size > 0) {
    btn.style.display = "";
    if (cnt) cnt.textContent = cmpSelectedIds.size;
  } else {
    btn.style.display = "none";
  }
}

function cmpBulkModal() {
  modal(`
    <div class="modal-box" style="max-width:420px">
      <div class="modal-header">
        <div><div class="modal-title">Bulk Action</div>
        <div class="modal-sub">${cmpSelectedIds.size} complaints selected</div></div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-ghost" style="justify-content:flex-start" onclick="cmpDoBulk('close')">
            🔒 Close selected
          </button>
          <button class="btn btn-ghost" style="justify-content:flex-start;color:var(--lime)" onclick="cmpDoBulk('resolve')">
            ✅ Mark as Resolved
          </button>
          <button class="btn btn-danger" style="justify-content:flex-start" onclick="cmpDoBulk('reject')">
            ❌ Reject selected
          </button>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Reason / Note (optional)</label>
          <textarea class="inp" id="bulkReason" placeholder="Reason for bulk action…" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </div>`);
}

async function cmpDoBulk(action) {
  const reason = document.getElementById("bulkReason")?.value || "";
  const ids = [...cmpSelectedIds];
  try {
    const res = await cmpApi("/bulk-action", {
      method: "POST",
      body: JSON.stringify({ ids, action, reason }),
    });
    showToast(res.message || "Bulk action done", "success");
    closeModal();
    cmpSelectedIds.clear();
    loadComplaintsList();
    loadCmpStats();
    cmpRefreshBadge();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Export CSV ────────────────────────────────────────────────────────────────
async function exportComplaints() {
  try {
    const res = await cmpApi("?limit=1000");
    const complaints = res.data || [];
    const rows = [
      [
        "Ticket",
        "Customer",
        "Email",
        "Phone",
        "Category",
        "Subject",
        "Priority",
        "Status",
        "OrderNo",
        "Replies",
        "Created",
      ],
    ];
    complaints.forEach((c) =>
      rows.push([
        c.ticketNumber,
        c.customer?.name,
        c.customer?.email,
        c.customer?.phone || "",
        cmpCatLabel(c.category),
        c.subject,
        c.priority,
        c.status,
        c.orderNumber || "",
        c.replies?.length || 0,
        new Date(c.createdAt).toLocaleDateString(),
      ]),
    );
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv," + encodeURIComponent(csv);
    a.download = `complaints_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("Complaints exported!", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ██  COMPLAINT DETAIL MODAL (FULL)
// ═══════════════════════════════════════════════════════════════════════════
async function openCmpDetail(id) {
  modal(`<div class="modal-box wide"><div class="modal-header">
    <div><div class="modal-title">Loading complaint…</div></div>
    <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
  </div><div class="modal-body" style="display:flex;justify-content:center;padding:48px"><div class="spinner"></div></div></div>`);

  try {
    const res = await cmpApi(`/${id}`);
    const c = res.data;
    const sc = CMP_STATUS_CONFIG[c.status] || {};
    const pc = CMP_PRIORITY_CONFIG[c.priority] || {};

    // SLA calculation
    const hoursOpen = Math.round(
      (new Date() - new Date(c.createdAt)) / 3600000,
    );
    const slaStatus =
      c.status === "resolved" ||
      c.status === "closed" ||
      c.status === "rejected"
        ? "done"
        : hoursOpen > 48
          ? "breached"
          : hoursOpen > 24
            ? "warning"
            : "ok";
    const slaColor =
      slaStatus === "done"
        ? "var(--lime)"
        : slaStatus === "breached"
          ? "var(--rose)"
          : slaStatus === "warning"
            ? "var(--amber)"
            : "var(--teal)";

    // Build status timeline
    const statuses = [
      "open",
      "under_review",
      "on_hold",
      "escalated",
      "resolved",
    ];
    const curIdx = statuses.indexOf(c.status);

    // Public replies only for display
    const publicReplies = (c.replies || []).filter((r) => !r.isInternal);
    const internalReplies = (c.replies || []).filter((r) => r.isInternal);

    document.getElementById("modalContainer").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal-box wide" style="max-width:900px">
        <!-- HEADER -->
        <div class="modal-header" style="background:linear-gradient(135deg,var(--bg2),var(--bg));border-bottom-color:${sc.color || "var(--border)"}">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <div class="modal-title" style="font-family:monospace;color:var(--lime)">${c.ticketNumber}</div>
              ${cmpBadge(c.status)}
              ${cmpPBadge(c.priority)}
              ${c.isFlagged ? `<span class="badge badge-rose">🚩 Flagged</span>` : ""}
              ${c.satisfactionRating?.score ? `<span class="badge badge-amber">⭐ ${c.satisfactionRating.score}/5</span>` : ""}
            </div>
            <div style="font-size:13px;color:var(--text2);margin-top:4px">${c.subject}</div>
          </div>
          <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
        </div>

        <div class="modal-body" style="padding:0">
          <div style="display:grid;grid-template-columns:1fr 340px;height:calc(100vh - 220px);min-height:400px;max-height:680px">

            <!-- LEFT PANEL -->
            <div style="overflow-y:auto;padding:24px;border-right:1px solid var(--border)">

              <!-- SLA strip -->
              <div style="background:${slaStatus === "breached" ? "rgba(244,63,94,.08)" : slaStatus === "warning" ? "rgba(245,166,35,.08)" : "rgba(198,241,53,.06)"};
                          border:1px solid ${slaColor}30;border-radius:10px;padding:10px 14px;
                          display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
                <div style="font-size:12px;color:${slaColor}">
                  <i class="fas fa-clock"></i>
                  ${slaStatus === "done" ? "Ticket closed" : "Open for <strong>" + hoursOpen + "h</strong>"}
                  ${c.slaBreached ? '<span class="badge badge-rose" style="margin-left:6px;font-size:9px">SLA BREACHED</span>' : ""}
                </div>
                <div style="font-size:11px;color:var(--text3)">Created: ${formatFullDate(c.createdAt)}</div>
              </div>

              <!-- Status Timeline -->
              <div class="status-timeline" style="margin-bottom:20px">
                ${statuses
                  .map((s, i) => {
                    const done =
                      i < curIdx ||
                      c.status === "resolved" ||
                      c.status === "closed";
                    const curr = s === c.status;
                    const sc2 = CMP_STATUS_CONFIG[s] || {};
                    return `<div class="timeline-step ${done ? "done" : curr ? "current" : ""}">
                    <div class="timeline-dot">${sc2.icon || i + 1}</div>
                    <div class="timeline-label">${sc2.label || s}</div>
                  </div>`;
                  })
                  .join("")}
              </div>

              <!-- Description -->
              <div class="info-block" style="margin-bottom:16px">
                <h4><i class="fas fa-align-left" style="margin-right:6px"></i>Complaint Details</h4>
                <div style="margin-bottom:12px">
                  <div style="font-size:10px;color:var(--text3);margin-bottom:4px">CATEGORY</div>
                  <span class="badge badge-sky">${cmpCatLabel(c.category)}</span>
                </div>
                <div style="font-size:13px;color:var(--text2);line-height:1.7;background:var(--bg);
                            border-radius:10px;padding:14px">${c.description}</div>
                ${
                  c.attachments?.length
                    ? `
                <div style="margin-top:12px">
                  <div style="font-size:10px;color:var(--text3);margin-bottom:8px">ATTACHMENTS (${c.attachments.length})</div>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${c.attachments
                      .map(
                        (a) => `
                      <a href="${a.url}" target="_blank" style="background:var(--surface2);border:1px solid var(--border);
                         border-radius:8px;padding:5px 10px;font-size:11px;color:var(--sky);text-decoration:none;
                         display:flex;align-items:center;gap:5px">
                        <i class="fas fa-paperclip"></i> ${a.fileName || "Attachment"}
                      </a>`,
                      )
                      .join("")}
                  </div>
                </div>`
                    : ""
                }
              </div>

              <!-- Conversation Thread -->
              <div style="font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
                          color:var(--text3);margin-bottom:14px">
                <i class="fas fa-comments" style="margin-right:6px"></i>
                Conversation Thread (${publicReplies.length} messages)
              </div>

              <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px" id="cmpThreadContainer">
                ${
                  publicReplies.length === 0
                    ? `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;background:var(--bg);border-radius:10px">
                       <i class="fas fa-comment-slash" style="font-size:24px;margin-bottom:8px;display:block"></i>
                       No messages yet
                     </div>`
                    : publicReplies.map((r) => renderCmpReplyBubble(r)).join("")
                }
              </div>

              <!-- Internal Notes section -->
              ${
                internalReplies.length
                  ? `
              <div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
                          color:var(--amber);margin-bottom:10px">
                <i class="fas fa-lock" style="margin-right:6px"></i>Internal Notes (${internalReplies.length})
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
                ${internalReplies.map((r) => renderCmpReplyBubble(r)).join("")}
              </div>`
                  : ""
              }

              <!-- Reply Box -->
              ${
                c.status !== "closed" && c.status !== "rejected"
                  ? `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:14px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                  <div style="font-size:12px;font-weight:600;color:var(--text2)">Admin Reply</div>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px">
                    <input type="checkbox" id="cmpInternalCheck">
                    <span style="color:var(--amber)">🔒 Internal note only</span>
                  </label>
                </div>
                <textarea class="inp" id="cmpReplyText" rows="3"
                  placeholder="Type your reply… customer will receive email notification (unless internal note)"></textarea>
                <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="cmpSendReply('${c._id}')">
                  <i class="fas fa-paper-plane"></i> Send Reply
                </button>
              </div>`
                  : `
              <div style="background:var(--bg);border-radius:10px;padding:14px;text-align:center;color:var(--text3);font-size:13px">
                <i class="fas fa-lock"></i> This ticket is ${c.status} — replies are disabled
              </div>`
              }
            </div>

            <!-- RIGHT PANEL -->
            <div style="overflow-y:auto;background:var(--bg2)">

              <!-- Customer card -->
              <div style="padding:18px;border-bottom:1px solid var(--border)">
                <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:12px">
                  CUSTOMER
                </div>
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                  <div style="width:40px;height:40px;border-radius:12px;background:var(--lime-dim);
                              display:flex;align-items:center;justify-content:center;
                              font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--lime)">
                    ${(c.customer?.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:14px">${c.customer?.name}</div>
                    <div style="font-size:11px;color:var(--text3)">${c.customer?.email}</div>
                  </div>
                </div>
                ${c.customer?.phone ? `<div style="font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px;margin-bottom:6px"><i class="fas fa-phone" style="color:var(--text3)"></i>${c.customer.phone}</div>` : ""}
                ${c.orderNumber ? `<div style="font-size:12px;color:var(--amber);display:flex;align-items:center;gap:6px"><i class="fas fa-receipt" style="color:var(--text3)"></i>Order: <strong>${c.orderNumber}</strong></div>` : ""}
                ${
                  c.satisfactionRating?.score
                    ? `
                  <div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px">
                    <div style="font-size:10px;color:var(--text3);margin-bottom:4px">SATISFACTION RATING</div>
                    <div style="color:var(--amber);font-size:18px">${"⭐".repeat(c.satisfactionRating.score)}</div>
                    ${c.satisfactionRating.feedback ? `<div style="font-size:11px;color:var(--text2);margin-top:4px">"${c.satisfactionRating.feedback}"</div>` : ""}
                  </div>`
                    : ""
                }
              </div>

              <!-- Manage Panel -->
              <div style="padding:18px;border-bottom:1px solid var(--border)">
                <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:12px">
                  MANAGE
                </div>
                <!-- Status update -->
                <div class="form-group" style="margin-bottom:10px">
                  <label class="form-label">Status</label>
                  <div style="display:flex;gap:6px">
                    <select class="inp" id="cmpStatusSelect" style="flex:1">
                      ${Object.entries(CMP_STATUS_CONFIG)
                        .map(
                          ([k, v]) =>
                            `<option value="${k}"${c.status === k ? " selected" : ""}>${v.icon} ${v.label}</option>`,
                        )
                        .join("")}
                    </select>
                    <button class="btn btn-ghost btn-sm" onclick="cmpUpdateStatus('${c._id}')">Set</button>
                  </div>
                </div>
                <!-- Priority update -->
                <div class="form-group" style="margin-bottom:10px">
                  <label class="form-label">Priority</label>
                  <div style="display:flex;gap:6px">
                    <select class="inp" id="cmpPrioritySelect" style="flex:1">
                      ${Object.entries(CMP_PRIORITY_CONFIG)
                        .map(
                          ([k, v]) =>
                            `<option value="${k}"${c.priority === k ? " selected" : ""}>${v.icon} ${v.label}</option>`,
                        )
                        .join("")}
                    </select>
                    <button class="btn btn-ghost btn-sm" onclick="cmpAssign('${c._id}')">Set</button>
                  </div>
                </div>
                <!-- Assign -->
                <div class="form-group" style="margin-bottom:14px">
                  <label class="form-label">Assigned To</label>
                  <div style="display:flex;gap:6px">
                    <input class="inp" id="cmpAssignInput" value="${c.assignedTo || ""}" placeholder="Admin name / email">
                    <button class="btn btn-ghost btn-sm" onclick="cmpAssign('${c._id}')">Assign</button>
                  </div>
                </div>
                <!-- Action buttons -->
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${
                    c.status !== "resolved" &&
                    c.status !== "closed" &&
                    c.status !== "rejected"
                      ? `
                  <button class="btn btn-primary btn-sm" style="justify-content:flex-start;width:100%"
                    onclick="openCmpResolveModal('${c._id}')">
                    <i class="fas fa-check-circle"></i> Resolve Complaint
                  </button>
                  <button class="btn btn-danger btn-sm" style="justify-content:flex-start;width:100%"
                    onclick="openCmpRejectModal('${c._id}')">
                    <i class="fas fa-ban"></i> Reject Complaint
                  </button>`
                      : ""
                  }
                  <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;width:100%;color:${c.isFlagged ? "var(--rose)" : "var(--text2)"}"
                    onclick="cmpToggleFlag('${c._id}',${c.isFlagged});closeModal()">
                    <i class="fas fa-flag"></i> ${c.isFlagged ? "Remove Flag" : "Flag as Spam/Fraud"}
                  </button>
                  <button class="btn btn-danger btn-sm" style="justify-content:flex-start;width:100%;opacity:.7"
                    onclick="cmpDelete('${c._id}')">
                    <i class="fas fa-trash"></i> Delete Complaint
                  </button>
                </div>
              </div>

              <!-- Status History -->
              ${
                c.statusHistory?.length
                  ? `
              <div style="padding:18px;border-bottom:1px solid var(--border)">
                <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:12px">
                  STATUS HISTORY
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto">
                  ${[...c.statusHistory]
                    .reverse()
                    .map((h) => {
                      const from = CMP_STATUS_CONFIG[h.from] || {
                        label: h.from,
                      };
                      const to = CMP_STATUS_CONFIG[h.to] || { label: h.to };
                      return `<div style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg);border-radius:7px">
                      <span style="color:var(--text3)">${from.icon || ""} ${from.label || h.from}</span>
                      <i class="fas fa-arrow-right" style="font-size:9px;color:var(--text3)"></i>
                      <span style="font-weight:600">${to.icon || ""} ${to.label || h.to}</span>
                      <span style="margin-left:auto;color:var(--text3)">${formatDate(h.createdAt)}</span>
                    </div>`;
                    })
                    .join("")}
                </div>
              </div>`
                  : ""
              }

              <!-- Resolution block -->
              ${
                c.resolution?.details
                  ? `
              <div style="padding:18px;border-bottom:1px solid var(--border)">
                <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:10px">
                  RESOLUTION
                </div>
                <div style="background:rgba(198,241,53,.06);border:1px solid rgba(198,241,53,.2);border-radius:10px;padding:12px">
                  <div style="font-size:11px;color:var(--lime);font-weight:700;margin-bottom:6px">${(c.resolution.type || "").replace(/_/g, " ").toUpperCase()}</div>
                  <div style="font-size:12px;color:var(--text2)">${c.resolution.details}</div>
                  ${c.resolution.refundAmount ? `<div style="margin-top:6px;color:var(--lime);font-size:13px;font-weight:700">Refund: ৳${c.resolution.refundAmount}</div>` : ""}
                  ${c.resolution.couponCode ? `<div style="margin-top:4px;font-family:monospace;color:var(--amber);font-size:13px">Coupon: ${c.resolution.couponCode}</div>` : ""}
                  <div style="margin-top:6px;font-size:10px;color:var(--text3)">By: ${c.resolution.resolvedBy || "admin"} · ${formatDate(c.resolution.resolvedAt)}</div>
                </div>
              </div>`
                  : ""
              }

              <!-- Rejection block -->
              ${
                c.rejectionNote
                  ? `
              <div style="padding:18px">
                <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:10px">
                  REJECTION
                </div>
                <div style="background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);border-radius:10px;padding:12px">
                  <div style="font-size:11px;color:var(--rose);font-weight:700;margin-bottom:4px">${(c.rejectionReason || "").replace(/_/g, " ").toUpperCase()}</div>
                  <div style="font-size:12px;color:var(--text2)">${c.rejectionNote}</div>
                </div>
              </div>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="modal-footer" style="justify-content:space-between">
          <div style="font-size:12px;color:var(--text3)">
            IP: ${c.ipAddress || "—"} &nbsp;|&nbsp; #${c._id?.slice(-8)}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="cmpRefreshDetail('${c._id}')">
              <i class="fas fa-rotate-right"></i> Refresh
            </button>
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
          </div>
        </div>
      </div>
    </div>`;
  } catch (e) {
    showToast(e.message, "error");
    closeModal();
  }
}

function cmpRefreshDetail(id) {
  openCmpDetail(id);
}

function renderCmpReplyBubble(r) {
  const isAdmin = r.authorType === "admin";
  const isInternal = r.isInternal;
  return `
  <div style="display:flex;${isAdmin ? "flex-direction:row-reverse" : "flex-direction:row"};gap:8px;align-items:flex-start">
    <div style="width:32px;height:32px;border-radius:10px;flex-shrink:0;
                display:flex;align-items:center;justify-content:center;font-size:13px;
                background:${isInternal ? "rgba(245,166,35,.15)" : isAdmin ? "var(--lime-dim)" : "var(--surface2)"}">
      ${isInternal ? "🔒" : isAdmin ? "👨‍💼" : "👤"}
    </div>
    <div style="max-width:78%">
      <div style="font-size:10px;color:var(--text3);margin-bottom:3px;${isAdmin ? "text-align:right" : ""}">
        <strong>${r.authorName || "Unknown"}</strong> · ${formatDate(r.createdAt)}
        ${isInternal ? '<span class="badge badge-amber" style="font-size:9px;margin-left:4px">Internal</span>' : ""}
      </div>
      <div style="background:${isInternal ? "rgba(245,166,35,.08)" : isAdmin ? "var(--lime-dim)" : "var(--surface)"};
                  border:1px solid ${isInternal ? "rgba(245,166,35,.2)" : isAdmin ? "rgba(198,241,53,.2)" : "var(--border)"};
                  border-radius:${isAdmin ? "14px 14px 3px 14px" : "14px 14px 14px 3px"};
                  padding:10px 13px;font-size:13px;line-height:1.6;
                  color:${isAdmin ? "var(--text)" : "var(--text2)"}">
        ${r.message}
      </div>
    </div>
  </div>`;
}

// ── Send Reply ────────────────────────────────────────────────────────────────
async function cmpSendReply(id) {
  const msg = document.getElementById("cmpReplyText")?.value?.trim();
  const isInternal = document.getElementById("cmpInternalCheck")?.checked;
  if (!msg) return showToast("Message cannot be empty", "warning");
  try {
    await cmpApi(`/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: msg, isInternal, senderType: "admin" }),
    });
    showToast("Reply sent!", "success");
    openCmpDetail(id); // refresh modal
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Quick Reply (from table) ──────────────────────────────────────────────────
function cmpQuickReply(id) {
  modal(`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header">
      <div><div class="modal-title">Quick Reply</div></div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Message *</label>
        <textarea class="inp" id="qrMsg" rows="4" placeholder="Write your reply…"></textarea>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px;font-size:13px">
        <input type="checkbox" id="qrInternal">
        <span>🔒 Internal note (not visible to customer)</span>
      </label>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="cmpDoQuickReply('${id}')">
        <i class="fas fa-paper-plane"></i> Send
      </button>
    </div>
  </div>`);
}

async function cmpDoQuickReply(id) {
  const msg = document.getElementById("qrMsg")?.value?.trim();
  const isInternal = document.getElementById("qrInternal")?.checked;
  if (!msg) return showToast("Message cannot be empty", "warning");
  try {
    await cmpApi(`/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: msg, isInternal, senderType: "admin" }),
    });
    showToast("Reply sent!", "success");
    closeModal();
    loadComplaintsList();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Update Status ─────────────────────────────────────────────────────────────
async function cmpUpdateStatus(id) {
  const status = document.getElementById("cmpStatusSelect")?.value;
  const reason =
    prompt("Optional: Add a reason / note for this status change:") || "";
  if (!status) return;
  try {
    await cmpApi(`/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    showToast(
      `Status → ${CMP_STATUS_CONFIG[status]?.label || status}`,
      "success",
    );
    openCmpDetail(id);
    loadComplaintsList();
    loadCmpStats();
    cmpRefreshBadge();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Assign / Priority ─────────────────────────────────────────────────────────
async function cmpAssign(id) {
  const assignedTo = document.getElementById("cmpAssignInput")?.value;
  const priority = document.getElementById("cmpPrioritySelect")?.value;
  try {
    await cmpApi(`/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo, priority }),
    });
    showToast("Complaint updated!", "success");
    openCmpDetail(id);
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Quick Resolve (from table) ────────────────────────────────────────────────
function cmpQuickResolve(id) {
  openCmpResolveModal(id);
}

// ── Resolve Modal ─────────────────────────────────────────────────────────────
function openCmpResolveModal(id) {
  modal(`
  <div class="modal-box" style="max-width:520px">
    <div class="modal-header" style="border-bottom-color:var(--lime)">
      <div>
        <div class="modal-title">✅ Resolve Complaint</div>
        <div class="modal-sub">Provide resolution details — customer will be notified via email</div>
      </div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Resolution Type *</label>
        <select class="inp" id="resolveType">
          <option value="refund">💰 Refund</option>
          <option value="replacement">📦 Replacement</option>
          <option value="discount_coupon">🎟️ Discount Coupon</option>
          <option value="apology">🙏 Apology</option>
          <option value="no_action">🚫 No Action Required</option>
          <option value="other">📝 Other</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Resolution Details *</label>
        <textarea class="inp" id="resolveDetails" rows="3" placeholder="Describe how this was resolved…"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Refund Amount (৳)</label>
          <input class="inp" id="resolveRefund" type="number" min="0" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Coupon Code</label>
          <input class="inp" id="resolveCoupon" placeholder="e.g. SORRY20">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="resolveSubmitBtn" onclick="cmpDoResolve('${id}')">
        <i class="fas fa-check-circle"></i> Mark as Resolved
      </button>
    </div>
  </div>`);
}

async function cmpDoResolve(id) {
  const type = document.getElementById("resolveType").value;
  const details = document.getElementById("resolveDetails").value.trim();
  const refundAmount = document.getElementById("resolveRefund").value;
  const couponCode = document.getElementById("resolveCoupon").value.trim();
  if (!details) return showToast("Resolution details required", "warning");

  const btn = document.getElementById("resolveSubmitBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resolving…';
  btn.disabled = true;

  try {
    await cmpApi(`/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        type,
        details,
        couponCode: couponCode || undefined,
        refundAmount: refundAmount || undefined,
      }),
    });
    showToast("✅ Complaint resolved! Customer notified.", "success");
    closeModal();
    loadComplaintsList();
    loadCmpStats();
    cmpRefreshBadge();
  } catch (e) {
    showToast(e.message, "error");
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Resolved';
    btn.disabled = false;
  }
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function openCmpRejectModal(id) {
  modal(`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header" style="border-bottom-color:var(--rose)">
      <div>
        <div class="modal-title">❌ Reject Complaint</div>
        <div class="modal-sub">Customer will be notified with reason</div>
      </div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Rejection Reason *</label>
        <select class="inp" id="rejectReason">
          ${CMP_REJECTION_REASONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Detailed Note *</label>
        <textarea class="inp" id="rejectNote" rows="3" placeholder="Explain why this complaint is being rejected…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="rejectSubmitBtn" onclick="cmpDoReject('${id}')">
        <i class="fas fa-ban"></i> Reject Complaint
      </button>
    </div>
  </div>`);
}

async function cmpDoReject(id) {
  const rejectionReason = document.getElementById("rejectReason").value;
  const rejectionNote = document.getElementById("rejectNote").value.trim();
  if (!rejectionNote) return showToast("Rejection note required", "warning");

  const btn = document.getElementById("rejectSubmitBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  try {
    await cmpApi(`/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionReason, rejectionNote }),
    });
    showToast("Complaint rejected. Customer notified.", "success");
    closeModal();
    loadComplaintsList();
    loadCmpStats();
    cmpRefreshBadge();
  } catch (e) {
    showToast(e.message, "error");
    btn.innerHTML = '<i class="fas fa-ban"></i> Reject';
    btn.disabled = false;
  }
}

// ── Flag / Unflag ─────────────────────────────────────────────────────────────
async function cmpToggleFlag(id, isFlagged) {
  let flagReason = "";
  if (!isFlagged) {
    flagReason = prompt("Reason for flagging this complaint (spam/fraud/etc):");
    if (flagReason === null) return;
  }
  try {
    await cmpApi(`/${id}/flag`, {
      method: "PATCH",
      body: JSON.stringify({ isFlagged: !isFlagged, flagReason }),
    });
    showToast(isFlagged ? "Flag removed" : "🚩 Complaint flagged", "success");
    loadComplaintsList();
    loadCmpStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function cmpDelete(id) {
  if (!confirm("Permanently delete this complaint? This cannot be undone."))
    return;
  try {
    await cmpApi(`/${id}`, { method: "DELETE" });
    showToast("Complaint deleted", "success");
    closeModal();
    loadComplaintsList();
    loadCmpStats();
    cmpRefreshBadge();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ██  REGISTER loadComplaints into the loadPage router
// ═══════════════════════════════════════════════════════════════════════════
(function patchLoadPage() {
  const _orig = window.loadPage;
  if (!_orig) return;
  window.loadPage = function (page) {
    if (page === "complaints") {
      currentPage = page;
      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      document
        .querySelector('[data-page="complaints"]')
        ?.classList.add("active");
      document.getElementById("pageTitle").textContent =
        "📋 Complaint Management";
      destroyCharts();
      loadComplaints();
      return;
    }
    _orig(page);
  };
})();

console.log("✅ Complaint Admin module loaded");
