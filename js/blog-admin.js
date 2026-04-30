// ═══════════════════════════════════════════
// BLOG MANAGEMENT MODULE
// Add to loadPage() pages map: "blogs": loadBlogs
// Add to titles map: "blogs": "📝 Blog Manager"
// Add to pagePermissions: "blogs": ["super_admin", "admin"]
// ═══════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let blogPage = 1;
let blogTotalPages = 1;
let blogFilter = {
  search: "",
  status: "",
  category: "",
  tag: "",
  language: "",
  sort: "newest",
};

// ── Main page loader ──────────────────────────────────────────────────────────
async function loadBlogs() {
  const c = document.getElementById("content");
  c.innerHTML = `
    <div class="fade-up">
      <div class="section-header">
        <div>
          <h2>📝 Blog Manager</h2>
          <div class="card-sub" style="margin-top:4px">Create, manage, and moderate blog posts & comments</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="loadBlogAnalytics()">
            <i class="fas fa-chart-bar"></i> Analytics
          </button>
          <button class="btn btn-ghost btn-sm" onclick="openPendingCommentsModal()">
            <i class="fas fa-comments"></i> Pending Comments
            <span class="nav-badge" id="pendingCommentsBadge" style="display:none;background:var(--amber); padding: 2px 6px; border-radius: 20px; font-size: 10px; font-weight: 600; color: #0b0d0f;">0</span>
          </button>
          <button class="btn btn-primary" onclick="openBlogModal()">
            <i class="fas fa-plus"></i> New Post
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stat-grid fade-up" id="blogStatsGrid" style="margin-bottom:20px">
        ${[1, 2, 3, 4]
          .map(
            (i) => `
          <div class="stat-card stagger-${i}">
            <div class="skel" style="height:42px;width:42px;border-radius:12px;margin-bottom:16px"></div>
            <div class="skel" style="height:26px;width:70%;margin-bottom:8px"></div>
            <div class="skel" style="height:13px;width:45%"></div>
          </div>`,
          )
          .join("")}
      </div>

      <!-- Toolbar -->
      <div class="card fade-up" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr auto auto auto auto auto;gap:10px;align-items:center">
          <div class="inp-group">
            <i class="fas fa-search"></i>
            <input class="inp" id="blogSearch" placeholder="Search title, tag, author…"
              oninput="blogFilter.search=this.value;blogPage=1;loadBlogList()">
          </div>
          <select class="inp" style="width:auto"
            onchange="blogFilter.status=this.value;blogPage=1;loadBlogList()">
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
          <select class="inp" style="width:auto" id="blogCategoryFilter"
            onchange="blogFilter.category=this.value;blogPage=1;loadBlogList()">
            <option value="">All Categories</option>
          </select>
          <select class="inp" style="width:auto"
            onchange="blogFilter.language=this.value;blogPage=1;loadBlogList()">
            <option value="">All Languages</option>
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </select>
          <select class="inp" style="width:auto"
            onchange="blogFilter.sort=this.value;blogPage=1;loadBlogList()">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Most Viewed</option>
            <option value="trending">Trending</option>
          </select>
          <button class="btn btn-ghost btn-sm"
            onclick="blogFilter={search:'',status:'',category:'',tag:'',language:'',sort:'newest'};
                     blogPage=1;document.getElementById('blogSearch').value='';loadBlogs()">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="card fade-up" style="padding:0;overflow:hidden">
        <table class="data-table">
          <thead><tr>
            <th style="width:36px"><input type="checkbox" id="blogSelectAll" onchange="toggleSelectAllBlogs(this)"></th>
            <th>Post</th>
            <th>Category</th>
            <th>Status</th>
            <th>Lang</th>
            <th>Views</th>
            <th>Comments</th>
            <th>Date</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="blogTableBody">
            <tr><td colspan="9" style="text-align:center;padding:48px">
              <div class="spinner" style="margin:0 auto"></div>
            </td></tr>
          </tbody>
        </table>
        <div style="padding:16px 20px;border-top:1px solid var(--border);
                    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:13px;color:var(--text3)" id="blogInfo"></div>
            <div id="blogBulkActions" style="display:none;gap:8px">
              <button class="btn btn-ghost btn-sm" onclick="bulkBlogAction('publish')">
                <i class="fas fa-eye"></i> Publish Selected
              </button>
              <button class="btn btn-danger btn-sm" onclick="bulkBlogAction('delete')">
                <i class="fas fa-trash"></i> Delete Selected
              </button>
            </div>
          </div>
          <div class="pagination" id="blogPages"></div>
        </div>
      </div>
    </div>`;

  // Load categories for filter dropdown
  loadBlogCategoryFilter();
  // Load stats + list + pending badge
  await Promise.all([
    loadBlogStats(),
    loadBlogList(),
    loadPendingCommentsBadge(),
  ]);
}

// ── Load category filter options ──────────────────────────────────────────────
async function loadBlogCategoryFilter() {
  try {
    const res = await apiCall("/blogs/meta/categories");
    const cats = res.data || [];
    const sel = document.getElementById("blogCategoryFilter");
    if (!sel) return;
    cats.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = `${c.name} (${c.count})`;
      sel.appendChild(opt);
    });
  } catch (e) {
    /* silent */
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────
async function loadBlogStats() {
  try {
    const res = await apiCall("/blogs/meta/analytics");
    const d = res.data?.overview || {};
    const topPosts = res.data?.topPosts || [];
    const last30 = res.data?.last30Days || 0;

    const grid = document.getElementById("blogStatsGrid");
    if (!grid) return;
    grid.innerHTML = `
      ${blogStatCard("Total Posts", d.total ?? 0, "fa-newspaper", "var(--lime)", "rgba(198,241,53,.15)", `${d.published ?? 0} published`)}
      ${blogStatCard("Total Views", (d.totalViews ?? 0).toLocaleString(), "fa-eye", "var(--sky)", "rgba(56,189,248,.15)", "All-time")}
      ${blogStatCard("Total Likes", (d.totalLikes ?? 0).toLocaleString(), "fa-heart", "var(--rose)", "rgba(244,63,94,.15)", "Engagement")}
      ${blogStatCard("Last 30 Days", last30, "fa-calendar-alt", "var(--amber)", "rgba(245,166,35,.15)", "New posts")}
    `;
  } catch (e) {
    console.error("blog stats:", e.message);
  }
}

function blogStatCard(label, value, icon, color, bg, sub) {
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

// ── Pending comments badge ────────────────────────────────────────────────────
async function loadPendingCommentsBadge() {
  try {
    const res = await apiCall("/blogs/meta/pending-comments");
    const count = res.total || 0;
    const badge = document.getElementById("pendingCommentsBadge");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "" : "none";
    }
  } catch (e) {
    /* silent */
  }
}

// ── Blog list table ───────────────────────────────────────────────────────────
async function loadBlogList() {
  try {
    const qs = new URLSearchParams({ page: blogPage, limit: 12 });
    if (blogFilter.search) qs.set("search", blogFilter.search);
    if (blogFilter.status) qs.set("status", blogFilter.status);
    if (blogFilter.category) qs.set("category", blogFilter.category);
    if (blogFilter.tag) qs.set("tag", blogFilter.tag);
    if (blogFilter.language) qs.set("language", blogFilter.language);
    if (blogFilter.sort) qs.set("sort", blogFilter.sort);

    // Pass token so admin sees all statuses
    const res = await apiCall(`/blogs?${qs}`);
    blogTotalPages = res.pagination?.pages || 1;
    const posts = res.data || [];

    document.getElementById("blogTableBody").innerHTML = posts.length
      ? posts.map(renderBlogRow).join("")
      : `<tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text3)">
           <i class="fas fa-newspaper" style="font-size:32px;margin-bottom:12px;display:block"></i>
           No posts found
         </td></tr>`;

    document.getElementById("blogInfo").textContent =
      `${posts.length} posts · Page ${blogPage} of ${blogTotalPages}`;

    renderPagination("blogPages", blogPage, blogTotalPages, (p) => {
      blogPage = p;
      loadBlogList();
    });
  } catch (e) {
    showToast(e.message, "error");
  }
}

function renderBlogRow(p) {
  const statusMap = {
    published: "badge-lime",
    draft: "badge-amber",
    scheduled: "badge-sky",
    archived: "badge-rose",
  };
  const statusIcon = {
    published: "fa-circle-check",
    draft: "fa-pen",
    scheduled: "fa-clock",
    archived: "fa-archive",
  };

  const coverThumb = p.coverImage?.url
    ? `<img src="${p.coverImage.url}" style="width:48px;height:36px;object-fit:cover;
               border-radius:6px;border:1px solid var(--border);flex-shrink:0">`
    : `<div style="width:48px;height:36px;border-radius:6px;background:var(--bg3);
                  display:flex;align-items:center;justify-content:center;flex-shrink:0">
         <i class="fas fa-image" style="font-size:14px;color:var(--text3)"></i>
       </div>`;

  const langBadge =
    p.language === "bn"
      ? `<span class="badge badge-text" style="font-size:10px">বাং</span>`
      : `<span class="badge badge-text" style="font-size:10px">EN</span>`;

  return `
    <tr>
      <td><input type="checkbox" class="blog-select-cb" value="${p._id}"
        onchange="updateBlogBulkBar()"></td>
      <td onclick="openBlogModal('${p._id}')" style="cursor:pointer">
        <div style="display:flex;align-items:center;gap:10px">
          ${coverThumb}
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;
                        overflow:hidden;text-overflow:ellipsis;max-width:220px"
                 title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              ${escapeHtml(p.author?.name || "—")}
              ${p.readingTime ? `· ${p.readingTime} min read` : ""}
              ${p.isFeatured ? `<span class="badge badge-teal" style="font-size:9px;margin-left:4px">Featured</span>` : ""}
              ${p.isPinned ? `<span class="badge badge-sky" style="font-size:9px;margin-left:4px">Pinned</span>` : ""}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-size:12px;background:var(--bg);padding:3px 8px;
                     border-radius:6px;border:1px solid var(--border)">
          ${escapeHtml(p.category)}
        </span>
      </td>
      <td>
        <span class="badge ${statusMap[p.status] || "badge-text"}">
          <i class="fas ${statusIcon[p.status] || "fa-circle"}" style="font-size:9px"></i>
          ${p.status}
        </span>
      </td>
      <td>${langBadge}</td>
      <td>
        <div style="font-size:13px;font-weight:600">${(p.views || 0).toLocaleString()}</div>
      </td>
      <td>
        <div style="font-size:13px">${p.commentCount ?? 0}</div>
      </td>
      <td style="font-size:12px;color:var(--text2)">
        ${p.publishedAt ? formatDate(p.publishedAt) : formatDate(p.createdAt)}
      </td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-ghost btn-sm btn-icon"
            onclick="openBlogModal('${p._id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon"
            onclick="toggleBlogPublish('${p._id}','${p.status}')"
            title="${p.status === "published" ? "Unpublish" : "Publish"}"
            style="color:${p.status === "published" ? "var(--amber)" : "var(--lime)"}">
            <i class="fas ${p.status === "published" ? "fa-eye-slash" : "fa-eye"}"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon"
            onclick="viewBlogComments('${p._id}','${escapeHtml(p.title)}')"
            title="Comments">
            <i class="fas fa-comments"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon"
            onclick="softDeleteBlog('${p._id}')" title="Archive">
            <i class="fas fa-archive"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

// ── Bulk selection ────────────────────────────────────────────────────────────
function toggleSelectAllBlogs(cb) {
  document
    .querySelectorAll(".blog-select-cb")
    .forEach((el) => (el.checked = cb.checked));
  updateBlogBulkBar();
}

function updateBlogBulkBar() {
  const checked = document.querySelectorAll(".blog-select-cb:checked").length;
  const bar = document.getElementById("blogBulkActions");
  if (bar) bar.style.display = checked > 0 ? "flex" : "none";
}

function getSelectedBlogIds() {
  return Array.from(document.querySelectorAll(".blog-select-cb:checked")).map(
    (el) => el.value,
  );
}

async function bulkBlogAction(action) {
  const ids = getSelectedBlogIds();
  if (!ids.length) return;
  if (
    !confirm(
      `${action === "delete" ? "Archive" : "Publish"} ${ids.length} post(s)?`,
    )
  )
    return;

  let ok = 0,
    fail = 0;
  for (const id of ids) {
    try {
      if (action === "publish") {
        await apiCall(`/blogs/${id}/toggle-publish`, { method: "PATCH" });
      } else {
        await apiCall(`/blogs/${id}`, { method: "DELETE" });
      }
      ok++;
    } catch (e) {
      fail++;
    }
  }
  showToast(
    `${ok} done${fail > 0 ? `, ${fail} failed` : ""}`,
    ok > 0 ? "success" : "error",
  );
  loadBlogList();
  loadBlogStats();
}

// ── Toggle publish ────────────────────────────────────────────────────────────
async function toggleBlogPublish(id, currentStatus) {
  try {
    const res = await apiCall(`/blogs/${id}/toggle-publish`, {
      method: "PATCH",
    });
    showToast(
      `Post ${res.data.status === "published" ? "published ✅" : "unpublished"}`,
      "success",
    );
    loadBlogList();
    loadBlogStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Soft delete ───────────────────────────────────────────────────────────────
async function softDeleteBlog(id) {
  if (!confirm("Archive this post? It won't be visible to readers.")) return;
  try {
    await apiCall(`/blogs/${id}`, { method: "DELETE" });
    showToast("Post archived", "success");
    loadBlogList();
    loadBlogStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE / EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
async function openBlogModal(id = null) {
  let post = null;
  if (id) {
    try {
      post = (await apiCall(`/blogs/${id}`)).data;
    } catch (e) {
      showToast(e.message, "error");
      return;
    }
  }

  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 16) : "");
  const tagsStr = (post?.tags || []).join(", ");

  modal(`
    <div class="modal-box wide" style="max-width:860px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${id ? "✏️ Edit Post" : "📝 New Blog Post"}</div>
          <div class="modal-sub">${id ? `Editing: ${escapeHtml(post?.title || "")}` : "Create a new post"}</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>

      <form id="blogForm">
        <div class="modal-body" style="max-height:72vh;overflow-y:auto">

          <!-- Title & Slug -->
          <div class="form-grid" style="margin-bottom:16px">
            <div class="form-group full">
              <label class="form-label">Title *</label>
              <input class="inp" name="title" placeholder="Post title…" required
                value="${escapeHtml(post?.title || "")}"
                oninput="autoBlogSlug(this.value)">
            </div>
            <div class="form-group full">
              <label class="form-label">Slug</label>
              <div class="inp-group">
                <i class="fas fa-link"></i>
                <input class="inp" name="slug" id="blogSlugField" placeholder="auto-generated-from-title"
                  value="${escapeHtml(post?.slug || "")}">
              </div>
            </div>
          </div>

          <!-- Author & Category row -->
          <div class="form-grid" style="margin-bottom:16px">
            <div class="form-group">
              <label class="form-label">Author Name *</label>
              <input class="inp" name="authorName" placeholder="Author's name" required
                value="${escapeHtml(post?.author?.name || "")}">
            </div>
            <div class="form-group">
              <label class="form-label">Author Bio</label>
              <input class="inp" name="authorBio" placeholder="Short bio…"
                value="${escapeHtml(post?.author?.bio || "")}">
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <input class="inp" name="category" list="blogCatList" placeholder="e.g. Honey, Health"
                required value="${escapeHtml(post?.category || "")}">
              <datalist id="blogCatList"></datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Tags <span style="color:var(--text3)">(comma-separated)</span></label>
              <input class="inp" name="tags" placeholder="organic, honey, health"
                value="${escapeHtml(tagsStr)}">
            </div>
          </div>

          <!-- Body -->
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Body *
              <span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:8px">
                HTML or plain text supported
              </span>
            </label>
            <textarea class="inp" name="body" rows="10"
              placeholder="Write your post content here… HTML is supported."
              required style="font-family:monospace;font-size:12px;line-height:1.6">${escapeHtml(post?.body || "")}</textarea>
          </div>

          <!-- Excerpt -->
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Excerpt
              <span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:8px">
                Leave blank to auto-generate from body
              </span>
            </label>
            <textarea class="inp" name="excerpt" rows="2"
              placeholder="Short summary shown in listing pages (max 500 chars)…"
              maxlength="500">${escapeHtml(post?.excerpt || "")}</textarea>
          </div>

          <!-- Cover image URL -->
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Cover Image URL</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
              <input class="inp" name="coverImageUrl" placeholder="https://…"
                value="${escapeHtml(post?.coverImage?.url || "")}"
                oninput="previewBlogCover(this.value)">
              <div id="blogCoverPreview" style="width:80px;height:52px;border-radius:8px;
                   background:var(--bg3);overflow:hidden;border:1px solid var(--border)">
                ${
                  post?.coverImage?.url
                    ? `<img src="${post.coverImage.url}" style="width:100%;height:100%;object-fit:cover">`
                    : `<div style="display:flex;align-items:center;justify-content:center;height:100%">
                       <i class="fas fa-image" style="color:var(--text3)"></i>
                     </div>`
                }
              </div>
            </div>
            <input class="inp" name="coverImageAlt" placeholder="Alt text for cover image"
              style="margin-top:6px" value="${escapeHtml(post?.coverImage?.alt || "")}">
          </div>

          <!-- Settings row -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="inp" name="status">
                ${["draft", "published", "scheduled", "archived"]
                  .map(
                    (s) =>
                      `<option value="${s}" ${(post?.status || "draft") === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Language</label>
              <select class="inp" name="language">
                <option value="bn" ${(post?.language || "bn") === "bn" ? "selected" : ""}>বাংলা (bn)</option>
                <option value="en" ${post?.language === "en" ? "selected" : ""}>English (en)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Scheduled At</label>
              <input class="inp" name="scheduledAt" type="datetime-local"
                value="${fmtDate(post?.scheduledAt)}">
            </div>
          </div>

          <!-- Toggles -->
          <div style="background:var(--bg);border-radius:12px;padding:14px;
                      display:flex;flex-wrap:wrap;gap:20px;margin-bottom:16px">
            ${[
              {
                name: "isFeatured",
                label: "Featured",
                checked: post?.isFeatured,
              },
              { name: "isPinned", label: "Pinned", checked: post?.isPinned },
              {
                name: "allowComments",
                label: "Allow Comments",
                checked: post?.allowComments !== false,
              },
            ]
              .map(
                (t) => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:500">
                <label class="toggle">
                  <input type="checkbox" name="${t.name}" ${t.checked ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                ${t.label}
              </label>`,
              )
              .join("")}
          </div>

          <!-- SEO section -->
          <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
            <div style="padding:12px 16px;background:var(--bg3);display:flex;align-items:center;
                        justify-content:space-between;cursor:pointer"
                 onclick="toggleSection('seoSection','seoChevron')">
              <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px">
                <i class="fas fa-search" style="color:var(--lime)"></i> SEO Settings
              </div>
              <i class="fas fa-chevron-down" id="seoChevron" style="font-size:11px;transition:.2s"></i>
            </div>
            <div id="seoSection" style="display:none;padding:16px">
              <div class="form-grid">
                <div class="form-group full">
                  <label class="form-label">Meta Title <span style="color:var(--text3)">(max 70)</span></label>
                  <input class="inp" name="seoMetaTitle" maxlength="70"
                    placeholder="SEO page title…" value="${escapeHtml(post?.seo?.metaTitle || "")}">
                </div>
                <div class="form-group full">
                  <label class="form-label">Meta Description <span style="color:var(--text3)">(max 160)</span></label>
                  <textarea class="inp" name="seoMetaDescription" maxlength="160" rows="2"
                    placeholder="SEO description shown in search results…">${escapeHtml(post?.seo?.metaDescription || "")}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">OG Image URL</label>
                  <input class="inp" name="seoOgImage" placeholder="https://…"
                    value="${escapeHtml(post?.seo?.ogImage || "")}">
                </div>
                <div class="form-group">
                  <label class="form-label">Canonical URL</label>
                  <input class="inp" name="seoCanonicalUrl" placeholder="https://…"
                    value="${escapeHtml(post?.seo?.canonicalUrl || "")}">
                </div>
                <div class="form-group">
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                    <label class="toggle">
                      <input type="checkbox" name="seoNoIndex" ${post?.seo?.noIndex ? "checked" : ""}>
                      <span class="toggle-slider"></span>
                    </label>
                    No-Index (hide from search engines)
                  </label>
                </div>
              </div>
            </div>
          </div>

        </div><!-- /modal-body -->

        <div class="modal-footer" style="justify-content:space-between">
          <div style="display:flex;gap:8px">
            ${
              id
                ? `
              <button type="button" class="btn btn-danger btn-sm"
                onclick="softDeleteBlog('${id}');closeModal()">
                <i class="fas fa-archive"></i> Archive
              </button>`
                : ""
            }
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button type="button" class="btn btn-ghost btn-sm" id="blogSaveAsDraftBtn"
              onclick="submitBlogForm(${id ? `'${id}'` : null}, 'draft')"
              ${post?.status !== "published" ? "" : 'style="display:none"'}>
              <i class="fas fa-floppy-disk"></i> Save Draft
            </button>
            <button type="submit" class="btn btn-primary" id="blogSubmitBtn">
              <i class="fas fa-${id ? "save" : "plus"}"></i>
              ${id ? "Save Changes" : "Create Post"}
            </button>
          </div>
        </div>
      </form>
    </div>`);

  // Populate datalist with existing categories
  try {
    const catRes = await apiCall("/blogs/meta/categories");
    const dl = document.getElementById("blogCatList");
    if (dl)
      (catRes.data || []).forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.name;
        dl.appendChild(opt);
      });
  } catch (e) {
    /* silent */
  }

  // Form submit
  document.getElementById("blogForm").onsubmit = (e) => {
    e.preventDefault();
    submitBlogForm(id, null);
  };
}

// ── Auto-slug helper ──────────────────────────────────────────────────────────
function autoBlogSlug(title) {
  const field = document.getElementById("blogSlugField");
  if (!field || field.dataset.manual === "true") return;
  field.value = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// ── Cover preview ─────────────────────────────────────────────────────────────
function previewBlogCover(url) {
  const el = document.getElementById("blogCoverPreview");
  if (!el) return;
  el.innerHTML = url
    ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover"
           onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--rose);\\'><i class=\\'fas fa-broken-image\\'></i></div>'">`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%">
         <i class="fas fa-image" style="color:var(--text3)"></i>
       </div>`;
}

// ── Toggle collapsible section ────────────────────────────────────────────────
function toggleSection(sectionId, chevronId) {
  const sec = document.getElementById(sectionId);
  const chev = document.getElementById(chevronId);
  if (!sec) return;
  const open = sec.style.display !== "none";
  sec.style.display = open ? "none" : "block";
  if (chev) chev.style.transform = open ? "" : "rotate(180deg)";
}

// ── Submit form ───────────────────────────────────────────────────────────────
async function submitBlogForm(id, forcedStatus) {
  const form = document.getElementById("blogForm");
  if (!form) return;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const btn = document.getElementById("blogSubmitBtn");
  const draftBtn = document.getElementById("blogSaveAsDraftBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  btn.disabled = true;
  if (draftBtn) draftBtn.disabled = true;

  const fd = new FormData(form);

  const payload = {
    title: fd.get("title"),
    slug: fd.get("slug") || undefined,
    excerpt: fd.get("excerpt") || undefined,
    body: fd.get("body"),
    category: fd.get("category"),
    tags: fd.get("tags")
      ? fd
          .get("tags")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    status: forcedStatus || fd.get("status") || "draft",
    language: fd.get("language"),
    author: {
      name: fd.get("authorName"),
      bio: fd.get("authorBio") || undefined,
    },
    coverImage: fd.get("coverImageUrl")
      ? { url: fd.get("coverImageUrl"), alt: fd.get("coverImageAlt") || "" }
      : undefined,
    isFeatured: form.isFeatured?.checked || false,
    isPinned: form.isPinned?.checked || false,
    allowComments: form.allowComments?.checked !== false,
    scheduledAt: fd.get("scheduledAt") || undefined,
    seo: {
      metaTitle: fd.get("seoMetaTitle") || undefined,
      metaDescription: fd.get("seoMetaDescription") || undefined,
      ogImage: fd.get("seoOgImage") || undefined,
      canonicalUrl: fd.get("seoCanonicalUrl") || undefined,
      noIndex: form.seoNoIndex?.checked || false,
    },
  };

  try {
    if (id) {
      await apiCall(`/blogs/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("✅ Post updated!", "success");
    } else {
      await apiCall("/blogs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("✅ Post created!", "success");
    }
    closeModal();
    loadBlogList();
    loadBlogStats();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    if (draftBtn) draftBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ── View comments for a specific post ────────────────────────────────────────
async function viewBlogComments(blogId, blogTitle) {
  modal(`
    <div class="modal-box wide">
      <div class="modal-header">
        <div>
          <div class="modal-title"><i class="fas fa-comments" style="color:var(--lime);margin-right:8px"></i>Comments</div>
          <div class="modal-sub" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${escapeHtml(blogTitle)}
          </div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    const res = await apiCall(`/blogs/${blogId}`);
    const post = res.data;
    const comments = post.comments || [];

    const pendingCount = comments.filter((c) => !c.isApproved).length;
    const approvedCount = comments.filter((c) => c.isApproved).length;

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide">
          <div class="modal-header">
            <div>
              <div class="modal-title"><i class="fas fa-comments" style="color:var(--lime);margin-right:8px"></i>Comments (${comments.length})</div>
              <div class="modal-sub">${escapeHtml(blogTitle)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${pendingCount > 0 ? `<span class="badge badge-amber">${pendingCount} pending</span>` : ""}
              <span class="badge badge-lime">${approvedCount} approved</span>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="modal-body" style="max-height:65vh;overflow-y:auto">
            ${
              comments.length
                ? renderCommentsHtml(comments, blogId)
                : `
              <div style="text-align:center;padding:60px;color:var(--text3)">
                <i class="fas fa-comment-slash" style="font-size:40px;margin-bottom:12px;display:block"></i>
                No comments yet
              </div>`
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
            <button class="btn btn-ghost btn-sm" onclick="viewBlogComments('${blogId}','${escapeHtml(blogTitle)}')">
              <i class="fas fa-rotate-right"></i> Refresh
            </button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    showToast(e.message, "error");
    closeModal();
  }
}

function renderCommentsHtml(comments, blogId) {
  return comments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(
      (c) => `
      <div style="padding:16px;border-bottom:1px solid var(--border);
                  ${!c.isApproved ? "background:rgba(245,166,35,.05);" : ""}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <div style="width:36px;height:36px;border-radius:50%;
                        background:linear-gradient(135deg,var(--lime-dim),var(--bg3));
                        display:flex;align-items:center;justify-content:center;
                        font-size:14px;font-weight:700;color:var(--lime);flex-shrink:0">
              ${(c.author || "?")[0].toUpperCase()}
            </div>
            <div style="min-width:0">
              <div style="font-weight:600;font-size:13px">${escapeHtml(c.author)}</div>
              <div style="font-size:11px;color:var(--text3)">
                ${escapeHtml(c.email)} · ${formatDate(c.createdAt)}
                ${c.ip ? `· IP: ${c.ip}` : ""}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            ${
              !c.isApproved
                ? `<span class="badge badge-amber"><i class="fas fa-clock" style="font-size:9px"></i> Pending</span>`
                : `<span class="badge badge-lime"><i class="fas fa-check" style="font-size:9px"></i> Approved</span>`
            }
            ${
              !c.isApproved
                ? `<button class="btn btn-primary btn-sm" style="font-size:11px"
                   onclick="approveComment('${blogId}','${c._id}',true)">
                   <i class="fas fa-check"></i> Approve
                 </button>`
                : ""
            }
            <button class="btn btn-danger btn-sm btn-icon"
              onclick="deleteCommentFromModal('${blogId}','${c._id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div style="margin-top:10px;margin-left:46px;font-size:13px;color:var(--text2);
                    line-height:1.6;background:var(--bg);padding:10px 12px;border-radius:8px">
          ${escapeHtml(c.body)}
        </div>
        <div style="margin-top:6px;margin-left:46px;display:flex;align-items:center;gap:12px">
          <span style="font-size:11px;color:var(--text3)">
            <i class="fas fa-heart" style="font-size:9px"></i> ${c.likes || 0} likes
          </span>
          ${c.approvedAt ? `<span style="font-size:11px;color:var(--text3)">Approved: ${formatDate(c.approvedAt)}</span>` : ""}
        </div>
      </div>`,
    )
    .join("");
}

async function approveComment(blogId, commentId, approve) {
  try {
    await apiCall(`/blogs/${blogId}/comments/${commentId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approve }),
    });
    showToast(
      approve ? "✅ Comment approved" : "Comment rejected",
      approve ? "success" : "warning",
    );
    // Refresh comment modal if open
    const modal = document.getElementById("modalContainer");
    if (modal && modal.innerHTML) {
      // Re-fetch and re-render by finding the post title
      loadPendingCommentsBadge();
    }
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteCommentFromModal(blogId, commentId) {
  if (!confirm("Delete this comment permanently?")) return;
  try {
    await apiCall(`/blogs/${blogId}/comments/${commentId}`, {
      method: "DELETE",
    });
    showToast("Comment deleted", "success");
    loadPendingCommentsBadge();
    // Refresh by removing the comment row from DOM
    const row = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (row) row.remove();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── Global pending comments modal ─────────────────────────────────────────────
async function openPendingCommentsModal() {
  modal(`
    <div class="modal-box wide">
      <div class="modal-header">
        <div>
          <div class="modal-title">⏳ Pending Comments</div>
          <div class="modal-sub">All comments awaiting approval</div>
        </div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    const res = await apiCall("/blogs/meta/pending-comments");
    const pending = res.data || [];

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide">
          <div class="modal-header">
            <div>
              <div class="modal-title">⏳ Pending Comments (${pending.length})</div>
              <div class="modal-sub">Approve or reject submitted comments</div>
            </div>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" style="max-height:68vh;overflow-y:auto">
            ${
              pending.length
                ? pending
                    .map(
                      (item) => `
              <div style="padding:16px;border-bottom:1px solid var(--border);
                          background:rgba(245,166,35,.03)">
                <div style="display:flex;align-items:center;justify-content:space-between;
                            margin-bottom:10px">
                  <div>
                    <a href="#" onclick="closeModal();openBlogModal('${item.blogId}');return false"
                       style="font-size:12px;color:var(--lime);font-weight:600">
                      <i class="fas fa-newspaper" style="margin-right:4px"></i>
                      ${escapeHtml(item.blogTitle)}
                    </a>
                  </div>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-primary btn-sm" style="font-size:11px"
                      onclick="approveAndRefreshPending('${item.blogId}','${item.comment._id}',true)">
                      <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm" style="font-size:11px"
                      onclick="approveAndRefreshPending('${item.blogId}','${item.comment._id}',false)">
                      <i class="fas fa-times"></i> Reject
                    </button>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                  <div style="width:30px;height:30px;border-radius:50%;background:var(--bg3);
                              display:flex;align-items:center;justify-content:center;
                              font-size:12px;font-weight:700;color:var(--lime)">
                    ${(item.comment.author || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:13px">${escapeHtml(item.comment.author)}</div>
                    <div style="font-size:11px;color:var(--text3)">
                      ${escapeHtml(item.comment.email)} · ${formatDate(item.comment.createdAt)}
                    </div>
                  </div>
                </div>
                <div style="font-size:13px;color:var(--text2);background:var(--bg);
                            padding:10px 12px;border-radius:8px;line-height:1.6;margin-left:38px">
                  ${escapeHtml(item.comment.body)}
                </div>
              </div>`,
                    )
                    .join("")
                : `<div style="text-align:center;padding:60px;color:var(--text3)">
                 <i class="fas fa-check-circle" style="font-size:48px;color:var(--lime);margin-bottom:16px;display:block"></i>
                 No pending comments! All caught up.
               </div>`
            }
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

async function approveAndRefreshPending(blogId, commentId, approve) {
  try {
    await apiCall(`/blogs/${blogId}/comments/${commentId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approve }),
    });
    showToast(
      approve ? "✅ Comment approved" : "Comment rejected",
      approve ? "success" : "warning",
    );
    openPendingCommentsModal();
    loadPendingCommentsBadge();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOG ANALYTICS MODAL
// ═══════════════════════════════════════════════════════════════════════════════
async function loadBlogAnalytics() {
  modal(`
    <div class="modal-box wide">
      <div class="modal-header">
        <div><div class="modal-title">📊 Blog Analytics</div></div>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="display:flex;justify-content:center;padding:48px">
        <div class="spinner"></div>
      </div>
    </div>`);

  try {
    const [analyticsRes, categoriesRes, tagsRes] = await Promise.all([
      apiCall("/blogs/meta/analytics"),
      apiCall("/blogs/meta/categories"),
      apiCall("/blogs/meta/tags"),
    ]);

    const d = analyticsRes.data;
    const overview = d.overview || {};
    const topPosts = d.topPosts || [];
    const categories = categoriesRes.data || [];
    const tags = tagsRes.data || [];

    const maxViews = topPosts[0]?.views || 1;
    const maxCatCount = categories[0]?.count || 1;

    document.getElementById("modalContainer").innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal-box wide" style="max-width:800px">
          <div class="modal-header">
            <div>
              <div class="modal-title">📊 Blog Analytics</div>
              <div class="modal-sub">Overview of all blog content and engagement</div>
            </div>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" style="max-height:70vh;overflow-y:auto">

            <!-- Overview numbers -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
              ${[
                {
                  label: "Published",
                  value: overview.published ?? 0,
                  color: "var(--lime)",
                },
                {
                  label: "Drafts",
                  value: overview.draft ?? 0,
                  color: "var(--amber)",
                },
                {
                  label: "Total Views",
                  value: (overview.totalViews ?? 0).toLocaleString(),
                  color: "var(--sky)",
                },
                {
                  label: "Total Likes",
                  value: (overview.totalLikes ?? 0).toLocaleString(),
                  color: "var(--rose)",
                },
                {
                  label: "Total Comments",
                  value: (overview.totalComments ?? 0).toLocaleString(),
                  color: "var(--teal)",
                },
                {
                  label: "Archived",
                  value: overview.archived ?? 0,
                  color: "var(--text3)",
                },
                {
                  label: "Last 30 Days",
                  value: d.last30Days ?? 0,
                  color: "var(--amber)",
                },
                {
                  label: "Total Posts",
                  value: overview.total ?? 0,
                  color: "var(--text2)",
                },
              ]
                .map(
                  (m) => `
                <div style="background:var(--bg);border-radius:12px;padding:14px;
                            text-align:center;border:1px solid var(--border)">
                  <div style="font-size:11px;color:var(--text3);margin-bottom:6px">${m.label}</div>
                  <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:${m.color}">${m.value}</div>
                </div>`,
                )
                .join("")}
            </div>

            <!-- Top Posts -->
            ${
              topPosts.length
                ? `
            <div style="margin-bottom:24px">
              <div style="font-size:13px;font-weight:700;margin-bottom:12px;
                          display:flex;align-items:center;gap:8px">
                <i class="fas fa-trophy" style="color:var(--amber)"></i> Top 5 Posts by Views
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${topPosts
                  .map(
                    (p, i) => `
                  <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                              background:var(--bg);border-radius:10px;border:1px solid var(--border)">
                    <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;
                                color:var(--text3);width:20px;text-align:right">${i + 1}</div>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:13px;font-weight:600;white-space:nowrap;
                                  overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.title)}</div>
                      <div class="progress-bar-wrap" style="margin-top:5px">
                        <div class="progress-bar-fill"
                          style="width:${Math.round((p.views / maxViews) * 100)}%"></div>
                      </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-size:13px;font-weight:700;color:var(--sky)">
                        ${(p.views || 0).toLocaleString()} views
                      </div>
                      <div style="font-size:11px;color:var(--text3)">${formatDate(p.publishedAt)}</div>
                    </div>
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>`
                : ""
            }

            <!-- Categories + Tags in 2 cols -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

              <!-- Categories -->
              <div>
                <div style="font-size:13px;font-weight:700;margin-bottom:10px;
                            display:flex;align-items:center;gap:8px">
                  <i class="fas fa-folder" style="color:var(--teal)"></i> Categories
                </div>
                <div style="display:flex;flex-direction:column;gap:5px">
                  ${categories
                    .slice(0, 10)
                    .map((c) => {
                      const pct = Math.round((c.count / maxCatCount) * 100);
                      return `
                    <div style="display:flex;align-items:center;gap:8px;font-size:12px">
                      <span style="flex:1;color:var(--text2)">${escapeHtml(c.name)}</span>
                      <div style="width:80px;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:var(--teal);border-radius:2px"></div>
                      </div>
                      <span style="color:var(--teal);font-weight:700;width:20px;text-align:right">${c.count}</span>
                    </div>`;
                    })
                    .join("")}
                </div>
              </div>

              <!-- Tags cloud -->
              <div>
                <div style="font-size:13px;font-weight:700;margin-bottom:10px;
                            display:flex;align-items:center;gap:8px">
                  <i class="fas fa-tags" style="color:var(--lime)"></i> Popular Tags
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  ${tags
                    .slice(0, 20)
                    .map(
                      (t) => `
                    <span style="background:var(--bg);border:1px solid var(--border);
                                 border-radius:20px;padding:3px 10px;font-size:11px;
                                 cursor:pointer;color:var(--text2)"
                          onclick="closeModal();blogFilter.tag='${escapeHtml(t.tag)}';
                                   loadBlogList()">
                      ${escapeHtml(t.tag)}
                      <span style="color:var(--lime);margin-left:3px">${t.count}</span>
                    </span>`,
                    )
                    .join("")}
                </div>
              </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR NAV INJECTION
// Call injectBlogNavLink() after DOM is ready (alongside updateSidebarByRole)
// ═══════════════════════════════════════════════════════════════════════════════
function injectBlogNavLink() {
  const nav = document.querySelector("#sidebar nav");
  if (!nav || document.querySelector('[data-page="blogs"]')) return;

  // Find the "Catalog" section label to insert blog link after it
  const catalogLabel = Array.from(
    nav.querySelectorAll(".nav-section-label"),
  ).find((el) => el.textContent.trim() === "Catalog");

  const link = document.createElement("a");
  link.className = "nav-link";
  link.setAttribute("data-page", "blogs");
  link.href = "#";
  link.innerHTML = `<i class="fas fa-newspaper"></i> Blog Manager
    <span class="nav-badge" id="pendingCommentNavBadge"
      style="display:none;background:var(--amber)">0</span>`;
  link.onclick = (e) => {
    e.preventDefault();
    loadPage("blogs");
  };

  if (catalogLabel) {
    // Insert right before the first nav-link after catalogLabel
    let next = catalogLabel.nextElementSibling;
    catalogLabel.parentNode.insertBefore(link, next);
  } else {
    nav.appendChild(link);
  }

  // Patch loadPage to include "blogs"
  const orig = window.loadPage;
  window.loadPage = function (page) {
    if (page === "blogs") {
      if (
        typeof cleanupGodTracker === "function" &&
        currentPage === "god-tracker"
      ) {
        cleanupGodTracker();
      }
      currentPage = "blogs";
      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      document.querySelector('[data-page="blogs"]')?.classList.add("active");
      if (document.getElementById("pageTitle"))
        document.getElementById("pageTitle").textContent = "📝 Blog Manager";
      if (typeof destroyCharts === "function") destroyCharts();
      loadBlogs();
      return;
    }
    orig(page);
  };

  // Also add to updateSidebarByRole hidden pages (managers can't access)
  // (Role control handled by loadPage permission check in original code)
}

// Run injection
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectBlogNavLink);
} else {
  injectBlogNavLink();
}

// Periodically refresh pending comments badge (every 2 minutes)
setInterval(() => {
  if (currentPage === "blogs") loadPendingCommentsBadge();
  // Also update nav badge
  apiCall("/blogs/meta/pending-comments")
    .then((res) => {
      const count = res.total || 0;
      const nb = document.getElementById("pendingCommentNavBadge");
      if (nb) {
        nb.textContent = count;
        nb.style.display = count > 0 ? "" : "none";
      }
    })
    .catch(() => {});
}, 120000);
