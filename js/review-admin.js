// ═══════════════════════════════════════════════════════════════════
// REVIEWS ADMIN MODULE — BeeHarvest
// Drop into admin-dash.js or load as review-admin.js
// Requires: apiCall(), showToast(), formatDate(), formatCurrency(),
//           renderPagination(), modal(), closeModal(), statusBadge()
// ═══════════════════════════════════════════════════════════════════

// ── State ───────────────────────────────────────────────────────────
let reviewPage = 1;
let reviewTotalPages = 1;
let reviewFilter = { status: "pending", rating: "", search: "" };
let reviewCharts = [];

// ── Helpers ─────────────────────────────────────────────────────────
function destroyReviewCharts() {
  reviewCharts.forEach((c) => {
    try {
      c.destroy();
    } catch (_) {}
  });
  reviewCharts = [];
}

function starHtml(rating, size = "12px") {
  return Array.from(
    { length: 5 },
    (_, i) =>
      `<i class="fas fa-star" style="font-size:${size};color:${i < rating ? "#F5A623" : "#2a2f36"}"></i>`,
  ).join("");
}

function reviewStatusBadge(status) {
  const map = {
    pending: { cls: "badge-amber", icon: "fa-clock", label: "Pending" },
    approved: { cls: "badge-lime", icon: "fa-check-circle", label: "Approved" },
    rejected: { cls: "badge-rose", icon: "fa-xmark-circle", label: "Rejected" },
  };
  const m = map[status] || map.pending;
  return `<span class="badge ${m.cls}"><i class="fas ${m.icon}" style="font-size:9px"></i> ${m.label}</span>`;
}

function ratingColor(avg) {
  if (avg >= 4.5) return "var(--lime)";
  if (avg >= 3.5) return "#F5A623";
  if (avg >= 2.5) return "var(--amber)";
  return "var(--rose)";
}

// ── Main page loader ─────────────────────────────────────────────────
async function loadReviewsPage() {
  destroyReviewCharts();
  const c = document.getElementById("content");
  if (!c) return;

  c.innerHTML = `
    <div class="fade-up">
      <div class="section-header" style="margin-bottom:24px">
        <div>
          <h2 style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">⭐</span> Reviews
            <span class="badge badge-amber" id="pendingReviewBadge" style="display:none">0 pending</span>
          </h2>
          <div class="card-sub" style="margin-top:4px">Customer feedback · Moderation · Sentiment analytics</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="exportReviewsCsv()">
            <i class="fas fa-file-export"></i> Export CSV
          </button>
          <button class="btn btn-ghost btn-sm" onclick="loadReviewsPage()">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- KPI Stats -->
      <div class="stat-grid fade-up" id="reviewStatsGrid" style="margin-bottom:24px">
        ${[1, 2, 3, 4]
          .map(
            (i) => `
          <div class="stat-card stagger-${i}">
            <div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div>
            <div class="skel" style="height:26px;width:65%;margin-bottom:8px"></div>
            <div class="skel" style="height:13px;width:45%"></div>
          </div>`,
          )
          .join("")}
      </div>

      <!-- Analytics Row -->
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-bottom:20px">

        <!-- Rating Distribution -->
        <div class="card fade-up stagger-2">
          <div class="card-title" style="margin-bottom:4px">Rating Distribution</div>
          <div class="card-sub" style="margin-bottom:16px">Approved reviews breakdown</div>
          <div id="ratingDistribution" style="display:flex;flex-direction:column;gap:8px">
            <div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></div>
          </div>
        </div>

        <!-- Verdict donut -->
        <div class="card fade-up stagger-3">
          <div class="card-title" style="margin-bottom:4px">Moderation Status</div>
          <div class="card-sub" style="margin-bottom:12px">All time</div>
          <div style="position:relative;height:160px">
            <canvas id="reviewStatusChart" role="img" aria-label="Review moderation status donut chart"></canvas>
          </div>
          <div id="reviewStatusLegend" style="display:flex;justify-content:center;gap:14px;margin-top:12px;flex-wrap:wrap"></div>
        </div>

        <!-- Top Products -->
        <div class="card fade-up stagger-4">
          <div class="card-title" style="margin-bottom:4px">Top Reviewed Products</div>
          <div class="card-sub" style="margin-bottom:12px">By review count</div>
          <div id="topReviewedProducts" style="display:flex;flex-direction:column;gap:6px">
            <div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></div>
          </div>
        </div>

      </div>

      <!-- Filter Toolbar -->
      <div class="card fade-up" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr auto auto auto auto auto;gap:10px;align-items:center">
          <div class="inp-group">
            <i class="fas fa-search"></i>
            <input class="inp" id="reviewSearch" placeholder="Search customer name or order…"
              oninput="reviewFilter.search=this.value;reviewPage=1;loadReviewList()">
          </div>
          <select class="inp" style="width:auto" id="reviewStatusFilter"
            onchange="reviewFilter.status=this.value;reviewPage=1;loadReviewList()">
            <option value="">All Status</option>
            <option value="pending"  selected>⏳ Pending</option>
            <option value="approved">✅ Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>
          <select class="inp" style="width:auto"
            onchange="reviewFilter.rating=this.value;reviewPage=1;loadReviewList()">
            <option value="">All Ratings</option>
            <option value="5">★★★★★ 5</option>
            <option value="4">★★★★☆ 4</option>
            <option value="3">★★★☆☆ 3</option>
            <option value="2">★★☆☆☆ 2</option>
            <option value="1">★☆☆☆☆ 1</option>
          </select>
          <select class="inp" style="width:auto"
            onchange="reviewFilter.product=this.value;reviewPage=1;loadReviewList()">
            <option value="">All Products</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="approveAllPending()">
            <i class="fas fa-check-double"></i> Approve All Pending
          </button>
          <button class="btn btn-ghost btn-sm"
            onclick="reviewFilter={status:'pending',rating:'',search:''};reviewPage=1;
                     document.getElementById('reviewSearch').value='';
                     document.getElementById('reviewStatusFilter').value='pending';
                     loadReviewList()">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- Reviews Table -->
      <div class="card fade-up" style="padding:0;overflow:hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Review</th>
              <th>Helpful</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="reviewsTableBody">
            <tr><td colspan="8" style="text-align:center;padding:48px">
              <div class="spinner" style="margin:0 auto"></div>
            </td></tr>
          </tbody>
        </table>
        <div style="padding:16px 20px;border-top:1px solid var(--border);
                    display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:13px;color:var(--text3)" id="reviewInfo"></div>
          <div class="pagination" id="reviewPages"></div>
        </div>
      </div>
    </div>`;

  // Populate product filter dropdown
  populateProductFilter();

  // Parallel load
  await Promise.all([loadReviewStats(), loadReviewList()]);
}

// ── Populate product filter ──────────────────────────────────────────
async function populateProductFilter() {
  try {
    const res = await apiCall("/products?limit=100&isActive=true");
    const products = res.data || [];
    const sel = document.querySelector(
      "#content select:nth-of-type(4), #content .card select[onchange*='product']",
    );
    // target the 4th select in the toolbar
    const selects = document.querySelectorAll("#content .card select");
    const productSel = selects[3];
    if (!productSel) return;
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p._id;
      opt.textContent = p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name;
      productSel.appendChild(opt);
    });
    productSel.addEventListener("change", () => {
      reviewFilter.product = productSel.value;
      reviewPage = 1;
      loadReviewList();
    });
  } catch (_) {}
}

// ── Stats ────────────────────────────────────────────────────────────
async function loadReviewStats() {
  try {
    const res = await apiCall("/reviews/admin?limit=1000");
    const all = res.data || [];

    const total = all.length;
    const pending = all.filter((r) => r.status === "pending").length;
    const approved = all.filter((r) => r.status === "approved").length;
    const rejected = all.filter((r) => r.status === "rejected").length;
    const approvedList = all.filter((r) => r.status === "approved");
    const avgRating = approvedList.length
      ? (
          approvedList.reduce((s, r) => s + r.rating, 0) / approvedList.length
        ).toFixed(1)
      : "—";

    // Update badge in nav / page header
    const badge = document.getElementById("pendingReviewBadge");
    if (badge && pending > 0) {
      badge.textContent = `${pending} pending`;
      badge.style.display = "";
    }

    // KPI Cards
    const grid = document.getElementById("reviewStatsGrid");
    if (grid) {
      grid.innerHTML = `
        ${reviewStatCard("Total Reviews", total, "fa-comments", "var(--lime)", "rgba(198,241,53,.15)", "All submitted")}
        ${reviewStatCard("Pending", pending, "fa-clock", "var(--amber)", "rgba(245,166,35,.15)", "Need moderation")}
        ${reviewStatCard("Approved", approved, "fa-check-circle", "var(--teal)", "rgba(45,212,191,.15)", "Live on site")}
        ${reviewStatCard("Avg Rating", avgRating + (avgRating !== "—" ? " ★" : ""), "fa-star", ratingColor(parseFloat(avgRating)), "rgba(245,166,35,.12)", "From approved reviews")}
      `;
    }

    // Rating distribution (1–5 stars)
    const ratingDist = document.getElementById("ratingDistribution");
    if (ratingDist) {
      const counts = [5, 4, 3, 2, 1].map((n) => ({
        star: n,
        count: approvedList.filter((r) => r.rating === n).length,
      }));
      const maxCount = Math.max(...counts.map((c) => c.count), 1);
      ratingDist.innerHTML = counts
        .map((c) => {
          const pct = Math.round((c.count / maxCount) * 100);
          const barColor =
            c.star >= 4
              ? "var(--lime)"
              : c.star === 3
                ? "var(--amber)"
                : "var(--rose)";
          return `
          <div style="display:flex;align-items:center;gap:8px">
            <div style="display:flex;gap:2px;width:70px;flex-shrink:0">${starHtml(c.star, "10px")}</div>
            <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .6s ease"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--text2);width:22px;text-align:right">${c.count}</span>
          </div>`;
        })
        .join("");
    }

    // Status donut
    const ctx = document.getElementById("reviewStatusChart");
    if (ctx) {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
      const ch = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Approved", "Pending", "Rejected"],
          datasets: [
            {
              data: [approved, pending, rejected],
              backgroundColor: ["#c6f135CC", "#f5a623CC", "#f43f5eCC"],
              borderColor: ["#c6f135", "#f5a623", "#f43f5e"],
              borderWidth: 2,
              hoverOffset: 6,
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
      reviewCharts.push(ch);

      const legend = document.getElementById("reviewStatusLegend");
      if (legend) {
        legend.innerHTML = [
          { label: "Approved", color: "#c6f135", val: approved },
          { label: "Pending", color: "#f5a623", val: pending },
          { label: "Rejected", color: "#f43f5e", val: rejected },
        ]
          .map(
            (l) => `
          <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)">
            <span style="width:8px;height:8px;border-radius:2px;background:${l.color}"></span>
            ${l.label} <strong>${l.val}</strong>
          </span>`,
          )
          .join("");
      }
    }

    // Top reviewed products
    const productMap = {};
    approvedList.forEach((r) => {
      const id = r.product?._id || r.product;
      const name = r.product?.name || "Unknown";
      if (!productMap[id]) productMap[id] = { name, count: 0, totalRating: 0 };
      productMap[id].count++;
      productMap[id].totalRating += r.rating;
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topEl = document.getElementById("topReviewedProducts");
    if (topEl) {
      topEl.innerHTML = topProducts.length
        ? topProducts
            .map((p, i) => {
              const avg = (p.totalRating / p.count).toFixed(1);
              return `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                <span style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;
                             color:var(--text3);width:16px;flex-shrink:0">${i + 1}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
                  <div style="font-size:10px;color:var(--text3)">${p.count} review${p.count !== 1 ? "s" : ""}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:12px;font-weight:700;color:${ratingColor(parseFloat(avg))}">${avg} ★</div>
                </div>
              </div>`;
            })
            .join("")
        : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No approved reviews yet</div>';
    }
  } catch (e) {
    console.error("Review stats error:", e.message);
    const grid = document.getElementById("reviewStatsGrid");
    if (grid)
      grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--rose)">${e.message}</div>`;
  }
}

function reviewStatCard(label, value, icon, color, bg, sub) {
  return `
    <div class="stat-card fade-up" style="--accent:${color}">
      <div class="stat-icon" style="background:${bg};color:${color}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-sub up" style="color:${color}">
        <i class="fas fa-circle" style="font-size:7px"></i> ${sub}
      </div>
    </div>`;
}

// ── Review List ──────────────────────────────────────────────────────
async function loadReviewList() {
  try {
    const qs = new URLSearchParams({ page: reviewPage, limit: 15 });
    if (reviewFilter.status) qs.set("status", reviewFilter.status);
    if (reviewFilter.rating) qs.set("rating", reviewFilter.rating);
    if (reviewFilter.search) qs.set("search", reviewFilter.search);
    if (reviewFilter.product) qs.set("product", reviewFilter.product);

    const res = await apiCall(`/reviews/admin?${qs}`);
    reviewTotalPages = res.pagination?.pages || 1;
    const reviews = res.data || [];

    const tbody = document.getElementById("reviewsTableBody");
    if (tbody) {
      tbody.innerHTML = reviews.length
        ? reviews.map(renderReviewRow).join("")
        : `<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text3)">
             <i class="fas fa-comments" style="font-size:32px;margin-bottom:12px;display:block"></i>
             No reviews found
           </td></tr>`;
    }

    const info = document.getElementById("reviewInfo");
    if (info)
      info.textContent = `${reviews.length} reviews · Page ${reviewPage} of ${reviewTotalPages}`;

    renderPagination("reviewPages", reviewPage, reviewTotalPages, (p) => {
      reviewPage = p;
      loadReviewList();
    });

    // Update pending badge count
    if (reviewFilter.status === "pending") {
      const badge = document.getElementById("pendingReviewBadge");
      if (badge && res.pagination?.total > 0) {
        badge.textContent = `${res.pagination.total} pending`;
        badge.style.display = "";
      }
    }
  } catch (e) {
    showToast(e.message, "error");
  }
}

function renderReviewRow(r) {
  const productName = r.product?.name || "Unknown Product";
  const truncBody =
    (r.body || "").length > 80
      ? r.body.slice(0, 77) + "…"
      : r.body || "<em style='color:var(--text3)'>No comment</em>";
  const helpfulScore = (r.helpfulVotes || 0) - (r.notHelpfulVotes || 0);
  const helpfulColor =
    helpfulScore > 0
      ? "var(--lime)"
      : helpfulScore < 0
        ? "var(--rose)"
        : "var(--text3)";

  return `
    <tr onclick="openReviewDetail('${r._id}')" style="cursor:pointer">
      <td>
        <div style="font-weight:600;font-size:13px">${r.customerName || "—"}</div>
        <div style="font-size:10px;color:var(--text3);font-family:monospace">${r.orderNumber || ""}</div>
        ${r.isVerifiedPurchase ? `<span class="badge badge-lime" style="font-size:9px;margin-top:3px">✓ Verified</span>` : ""}
      </td>
      <td>
        <div style="font-size:12px;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
             title="${productName}">${productName}</div>
        ${
          r.product?.images?.[0]?.url
            ? `<img src="${r.product.images[0].url}" style="width:28px;height:28px;object-fit:cover;border-radius:6px;margin-top:4px;border:1px solid var(--border)">`
            : ""
        }
      </td>
      <td>
        <div style="display:flex;gap:2px;margin-bottom:3px">${starHtml(r.rating, "11px")}</div>
        <div style="font-size:10px;color:var(--text3)">${r.rating}/5</div>
      </td>
      <td style="max-width:220px">
        ${r.title ? `<div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--text)">${r.title}</div>` : ""}
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${truncBody}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:5px">
          <i class="fas fa-thumbs-up" style="font-size:11px;color:${helpfulScore >= 0 ? "var(--lime)" : "var(--text3)"}"></i>
          <span style="font-size:13px;font-weight:700;color:${helpfulColor}">${helpfulScore > 0 ? "+" : ""}${helpfulScore}</span>
        </div>
        <div style="font-size:10px;color:var(--text3)">${r.helpfulVotes || 0}👍 ${r.notHelpfulVotes || 0}👎</div>
      </td>
      <td>${reviewStatusBadge(r.status)}</td>
      <td style="font-size:12px;color:var(--text2)">${formatDate(r.createdAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;align-items:center">
          ${
            r.status !== "approved"
              ? `<button class="btn btn-ghost btn-sm btn-icon" style="color:var(--lime)"
                 title="Approve" onclick="quickModerate('${r._id}','approved')">
                 <i class="fas fa-check"></i>
               </button>`
              : ""
          }
          ${
            r.status !== "rejected"
              ? `<button class="btn btn-danger btn-sm btn-icon"
                 title="Reject" onclick="quickModerate('${r._id}','rejected')">
                 <i class="fas fa-xmark"></i>
               </button>`
              : ""
          }
          <button class="btn btn-ghost btn-sm btn-icon"
            title="View Detail" onclick="openReviewDetail('${r._id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon"
            title="Delete" onclick="deleteReview('${r._id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

// ── Review Detail Modal ──────────────────────────────────────────────
async function openReviewDetail(id) {
  modal(`
    <div class="modal-box wide">
      <div class="modal-header">
        <div><div class="modal-title">Review Detail</div></div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    // Get from admin list (fetch single by passing search)
    const res = await apiCall(`/reviews/admin?limit=200`);
    const all = res.data || [];
    let r = all.find((x) => x._id === id);

    // If not in current page results, do a broader search
    if (!r) {
      // Fallback: fetch all statuses
      const res2 = await apiCall(`/reviews/admin?limit=1000`);
      r = (res2.data || []).find((x) => x._id === id);
    }

    if (!r) {
      showToast("Review not found", "error");
      closeModal();
      return;
    }

    const productName = r.product?.name || "Unknown Product";
    const productImg = r.product?.images?.[0]?.url || "";
    const helpfulScore = (r.helpfulVotes || 0) - (r.notHelpfulVotes || 0);

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide">
          <div class="modal-header">
            <div>
              <div class="modal-title">
                <i class="fas fa-star" style="color:#F5A623;margin-right:8px"></i>
                Review Detail
              </div>
              <div class="modal-sub">${r.orderNumber || "No order number"} · ${formatDate(r.createdAt)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${reviewStatusBadge(r.status)}
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="modal-body">

            <!-- Product + Customer info -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
              <div class="info-block">
                <h4><i class="fas fa-box-open" style="margin-right:6px;color:#F5A623"></i>Product</h4>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                  ${
                    productImg
                      ? `<img src="${productImg}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;border:1px solid var(--border)">`
                      : `<div style="width:52px;height:52px;background:var(--surface2);border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-box" style="color:var(--text3)"></i></div>`
                  }
                  <div style="flex:1">
                    <div style="font-weight:700;font-size:14px">${productName}</div>
                    <div style="display:flex;gap:2px;margin-top:4px">${starHtml(r.rating, "13px")}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px">${r.rating}/5 stars</div>
                  </div>
                </div>
                <div class="info-row"><span>Current Avg</span>
                  <span style="color:${ratingColor(r.product?.ratings?.average || 0)}">
                    ${r.product?.ratings?.average || "—"} ★ (${r.product?.ratings?.count || 0} reviews)
                  </span>
                </div>
              </div>
              <div class="info-block">
                <h4><i class="fas fa-user" style="margin-right:6px"></i>Customer</h4>
                <div class="info-row"><span>Name</span><span>${r.customerName || "—"}</span></div>
                <div class="info-row"><span>Email</span><span style="font-size:11px">${r.customerEmail || "—"}</span></div>
                <div class="info-row"><span>Order #</span>
                  <span style="font-family:monospace;color:var(--lime);cursor:pointer"
                    onclick="closeModal();loadPage('orders');
                             setTimeout(()=>{ordFilter.search='${r.orderNumber}';loadOrdersList()},400)">
                    ${r.orderNumber || "—"}
                  </span>
                </div>
                <div class="info-row"><span>Verified Purchase</span>
                  <span>${
                    r.isVerifiedPurchase
                      ? '<span class="badge badge-lime">✓ Verified</span>'
                      : '<span class="badge badge-text">Unverified</span>'
                  }</span>
                </div>
              </div>
            </div>

            <!-- Review Content -->
            <div class="info-block" style="margin-bottom:20px">
              <h4><i class="fas fa-pen" style="margin-right:6px"></i>Review Content</h4>
              ${
                r.title
                  ? `<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px">"${r.title}"</div>`
                  : ""
              }
              <div style="font-size:14px;color:var(--text2);line-height:1.8;padding:14px;
                          background:var(--bg);border-radius:12px;border:1px solid var(--border)">
                ${r.body || '<em style="color:var(--text3)">No written review — rating only</em>'}
              </div>
            </div>

            <!-- Helpfulness + Moderation info -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
              <div class="info-block">
                <h4><i class="fas fa-thumbs-up" style="margin-right:6px"></i>Helpfulness</h4>
                <div style="display:flex;align-items:center;gap:16px;padding:12px 0">
                  <div style="text-align:center">
                    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--lime)">${r.helpfulVotes || 0}</div>
                    <div style="font-size:11px;color:var(--text3)">Helpful</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--rose)">${r.notHelpfulVotes || 0}</div>
                    <div style="font-size:11px;color:var(--text3)">Not Helpful</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;
                                color:${helpfulScore >= 0 ? "var(--lime)" : "var(--rose)"}">
                      ${helpfulScore > 0 ? "+" : ""}${helpfulScore}
                    </div>
                    <div style="font-size:11px;color:var(--text3)">Net Score</div>
                  </div>
                </div>
              </div>
              <div class="info-block">
                <h4><i class="fas fa-shield-halved" style="margin-right:6px"></i>Moderation</h4>
                <div class="info-row"><span>Current Status</span><span>${reviewStatusBadge(r.status)}</span></div>
                ${
                  r.moderatedAt
                    ? `<div class="info-row"><span>Moderated</span><span>${formatDate(r.moderatedAt)}</span></div>`
                    : ""
                }
                ${
                  r.moderationNote
                    ? `<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text2)">
                       <strong>Note:</strong> ${r.moderationNote}
                     </div>`
                    : ""
                }
              </div>
            </div>

            <!-- Moderate form -->
            ${
              r.status === "pending"
                ? `
              <div style="background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.2);
                          border-radius:14px;padding:16px;margin-bottom:4px">
                <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:12px">
                  <i class="fas fa-gavel" style="margin-right:6px"></i>Moderation Action Required
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label class="form-label">Optional Note (visible in admin logs)</label>
                  <input class="inp" id="moderationNoteInput" placeholder="e.g. Approved — genuine verified purchase">
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-primary" style="flex:1" onclick="moderateFromModal('${r._id}','approved')">
                    <i class="fas fa-check"></i> Approve & Publish
                  </button>
                  <button class="btn btn-danger" style="flex:1" onclick="moderateFromModal('${r._id}','rejected')">
                    <i class="fas fa-xmark"></i> Reject & Hide
                  </button>
                </div>
              </div>
            `
                : r.status === "approved"
                  ? `
              <div style="background:rgba(198,241,53,.05);border:1px solid rgba(198,241,53,.15);
                          border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:13px;color:var(--lime)">
                  <i class="fas fa-circle-check" style="margin-right:8px"></i>
                  This review is live on the product page.
                </div>
                <button class="btn btn-ghost btn-sm" onclick="moderateFromModal('${r._id}','rejected')">
                  <i class="fas fa-eye-slash"></i> Unpublish
                </button>
              </div>
            `
                  : `
              <div style="background:rgba(244,63,94,.05);border:1px solid rgba(244,63,94,.15);
                          border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:13px;color:var(--rose)">
                  <i class="fas fa-eye-slash" style="margin-right:8px"></i>
                  This review is hidden from customers.
                </div>
                <button class="btn btn-ghost btn-sm" style="color:var(--lime)"
                  onclick="moderateFromModal('${r._id}','approved')">
                  <i class="fas fa-eye"></i> Re-publish
                </button>
              </div>
            `
            }
          </div>
          <div class="modal-footer" style="justify-content:space-between">
            <div>
              <button class="btn btn-danger btn-sm" onclick="deleteReview('${r._id}')">
                <i class="fas fa-trash"></i> Delete Permanently
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

// ── Quick moderate from table row ────────────────────────────────────
async function quickModerate(id, status) {
  try {
    await apiCall(`/reviews/admin/${id}/moderate`, {
      method: "PUT",
      body: JSON.stringify({ status, moderationNote: "" }),
    });
    showToast(
      status === "approved"
        ? "✅ Review approved & published"
        : "❌ Review rejected & hidden",
      "success",
    );
    loadReviewList();
    loadReviewStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Moderate from detail modal ───────────────────────────────────────
async function moderateFromModal(id, status) {
  const noteEl = document.getElementById("moderationNoteInput");
  const note = noteEl?.value?.trim() || "";
  const btn = document.querySelector(
    `.modal-body button[onclick*="${status}"]`,
  );
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }
  try {
    await apiCall(`/reviews/admin/${id}/moderate`, {
      method: "PUT",
      body: JSON.stringify({ status, moderationNote: note }),
    });
    showToast(
      status === "approved"
        ? "✅ Review approved & published"
        : "❌ Review rejected & hidden",
      "success",
    );
    closeModal();
    loadReviewList();
    loadReviewStats();
  } catch (e) {
    showToast(e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        status === "approved" ? "Approve & Publish" : "Reject & Hide";
    }
  }
}

// ── Approve all pending ──────────────────────────────────────────────
async function approveAllPending() {
  const confirmed = confirm(
    "Approve ALL pending reviews?\n\nThis will publish them all to the product pages.",
  );
  if (!confirmed) return;

  try {
    const res = await apiCall("/reviews/admin?status=pending&limit=200");
    const pending = res.data || [];
    if (!pending.length) {
      showToast("No pending reviews", "info");
      return;
    }

    showToast(`Approving ${pending.length} reviews…`, "info");

    const results = await Promise.allSettled(
      pending.map((r) =>
        apiCall(`/reviews/admin/${r._id}/moderate`, {
          method: "PUT",
          body: JSON.stringify({
            status: "approved",
            moderationNote: "Bulk approved",
          }),
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    showToast(
      `✅ ${succeeded} approved${failed > 0 ? ` · ${failed} failed` : ""}`,
      "success",
    );
    loadReviewList();
    loadReviewStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Delete ───────────────────────────────────────────────────────────
async function deleteReview(id) {
  if (
    !confirm(
      "Permanently delete this review?\n\nProduct ratings will update automatically.",
    )
  )
    return;
  try {
    await apiCall(`/reviews/admin/${id}`, { method: "DELETE" });
    showToast("🗑️ Review deleted — product ratings updated", "success");
    closeModal();
    loadReviewList();
    loadReviewStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Send review request email manually ──────────────────────────────
async function sendReviewEmail(orderId) {
  if (!orderId) return;
  try {
    await apiCall(`/reviews/send-request/${orderId}`, { method: "POST" });
    showToast("📧 Review request email sent!", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Export CSV ───────────────────────────────────────────────────────
async function exportReviewsCsv() {
  try {
    const res = await apiCall("/reviews/admin?limit=1000");
    const reviews = res.data || [];
    const rows = [
      [
        "Order #",
        "Customer",
        "Email",
        "Product",
        "Rating",
        "Title",
        "Body",
        "Status",
        "Helpful Votes",
        "Date",
      ],
    ];
    reviews.forEach((r) =>
      rows.push([
        r.orderNumber || "",
        r.customerName || "",
        r.customerEmail || "",
        r.product?.name || "",
        r.rating,
        `"${(r.title || "").replace(/"/g, '""')}"`,
        `"${(r.body || "").replace(/"/g, '""')}"`,
        r.status,
        r.helpfulVotes || 0,
        new Date(r.createdAt).toLocaleDateString(),
      ]),
    );
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `reviews_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("Reviews exported!", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Public reviews widget for product pages (admin preview helper) ──
async function previewProductReviews(productId, productName) {
  modal(`
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">⭐ Customer Reviews</div>
          <div class="modal-sub">${productName}</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    const res = await apiCall(
      `/reviews/product/${productId}?limit=10&sort=newest`,
    );
    const { reviews, summary } = res.data || {};

    const avgColor = ratingColor(summary?.average || 0);

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide">
          <div class="modal-header">
            <div>
              <div class="modal-title">⭐ Customer Reviews</div>
              <div class="modal-sub">${productName} · ${summary?.count || 0} approved reviews</div>
            </div>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- Summary -->
            <div style="display:flex;align-items:center;gap:24px;padding:20px;
                        background:var(--bg);border-radius:14px;margin-bottom:20px;
                        border:1px solid var(--border)">
              <div style="text-align:center;flex-shrink:0">
                <div style="font-family:'Syne',sans-serif;font-size:48px;font-weight:800;color:${avgColor};line-height:1">
                  ${summary?.average?.toFixed(1) || "—"}
                </div>
                <div style="display:flex;justify-content:center;gap:2px;margin:6px 0">
                  ${starHtml(Math.round(summary?.average || 0), "16px")}
                </div>
                <div style="font-size:12px;color:var(--text3)">${summary?.count || 0} reviews</div>
              </div>
              <div style="flex:1">
                ${[5, 4, 3, 2, 1]
                  .map((n) => {
                    const cnt = summary?.breakdown?.[n] || 0;
                    const total = summary?.count || 1;
                    const pct = Math.round((cnt / total) * 100);
                    return `
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                      <span style="font-size:11px;color:var(--text3);width:8px">${n}</span>
                      <i class="fas fa-star" style="font-size:9px;color:#F5A623"></i>
                      <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:${n >= 4 ? "var(--lime)" : n === 3 ? "var(--amber)" : "var(--rose)"};border-radius:3px"></div>
                      </div>
                      <span style="font-size:11px;color:var(--text3);width:18px;text-align:right">${cnt}</span>
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>

            <!-- Review cards -->
            <div style="display:flex;flex-direction:column;gap:12px">
              ${
                (reviews || []).length
                  ? (reviews || [])
                      .map(
                        (r) => `
                    <div style="padding:16px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
                        <div>
                          <div style="font-weight:700;font-size:13px">${r.customerName}</div>
                          <div style="display:flex;gap:2px;margin-top:3px">${starHtml(r.rating, "11px")}</div>
                        </div>
                        <div style="text-align:right">
                          ${r.isVerifiedPurchase ? '<span class="badge badge-lime" style="font-size:9px">✓ Verified</span>' : ""}
                          <div style="font-size:10px;color:var(--text3);margin-top:4px">${formatDate(r.createdAt)}</div>
                        </div>
                      </div>
                      ${r.title ? `<div style="font-weight:700;font-size:13px;margin-bottom:6px">${r.title}</div>` : ""}
                      ${r.body ? `<div style="font-size:13px;color:var(--text2);line-height:1.7">${r.body}</div>` : ""}
                      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                        <i class="fas fa-thumbs-up" style="font-size:11px;color:var(--text3)"></i>
                        <span style="font-size:11px;color:var(--text3)">${r.helpfulVotes || 0} helpful</span>
                      </div>
                    </div>`,
                      )
                      .join("")
                  : '<div style="text-align:center;padding:32px;color:var(--text3)">No approved reviews yet</div>'
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    showToast(e.message, "error");
    closeModal();
  }
}
