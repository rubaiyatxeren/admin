async function loadBanners() {
  const contentArea = document.getElementById("contentArea");
  contentArea.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap justify-between items-center gap-4">
                <h2 class="text-2xl font-bold text-gray-800">Banner Management</h2>
                <button onclick="openBannerModal()" class="btn-primary text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2">
                    <i class="fas fa-plus"></i>
                    <span>Add Banner</span>
                </button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6" id="bannersGrid">
                <div class="col-span-full text-center py-12">
                    <div class="loading-spinner mx-auto"></div>
                </div>
            </div>
        </div>
    `;

  await loadBannersList();
}

async function loadBannersList() {
  try {
    const response = await API.get("/banners");
    if (response.success) {
      renderBannersGrid(response.data);
    }
  } catch (error) {
    console.error("Failed to load banners:", error);
    document.getElementById("bannersGrid").innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4 block"></i>
                <p class="text-gray-600">Failed to load banners</p>
                <button onclick="loadBannersList()" class="mt-4 text-purple-600 hover:text-purple-700">Try Again</button>
            </div>
        `;
  }
}

function renderBannersGrid(banners) {
  const grid = document.getElementById("bannersGrid");

  if (!banners || banners.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-image text-6xl text-gray-400 mb-4 block"></i>
                <p class="text-gray-500 text-lg">No banners found</p>
                <button onclick="openBannerModal()" class="mt-4 text-purple-600 hover:text-purple-700">
                    <i class="fas fa-plus mr-2"></i>Create your first banner
                </button>
            </div>
        `;
    return;
  }

  grid.innerHTML = banners
    .map(
      (banner) => `
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div class="relative h-64 overflow-hidden">
                <img src="${banner.image.url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-4 right-4 space-y-2">
                    <button onclick="editBanner('${banner._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-edit text-blue-600"></i>
                    </button>
                    <button onclick="deleteBanner('${banner._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-trash text-red-600"></i>
                    </button>
                </div>
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                    <h3 class="text-white font-bold text-xl">${banner.title}</h3>
                    ${banner.subtitle ? `<p class="text-white/80 text-sm">${banner.subtitle}</p>` : ""}
                </div>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <span class="badge ${banner.isActive ? "badge-success" : "badge-danger"}">
                        ${banner.isActive ? "Active" : "Inactive"}
                    </span>
                    <span class="badge badge-info">${banner.position.replace("_", " ")}</span>
                </div>
                ${
                  banner.link
                    ? `
                    <a href="${banner.link}" target="_blank" class="text-purple-600 hover:text-purple-700 text-sm flex items-center">
                        <i class="fas fa-link mr-1"></i>View Link
                        <i class="fas fa-external-link-alt ml-1 text-xs"></i>
                    </a>
                `
                    : ""
                }
                <p class="text-xs text-gray-500 mt-3">Order: ${banner.order || 0}</p>
            </div>
        </div>
    `,
    )
    .join("");
}

async function openBannerModal(bannerId = null) {
  const modalContainer = document.getElementById("modalContainer");

  let bannerData = null;
  if (bannerId) {
    const response = await API.get(`/banners/${bannerId}`);
    if (response.success) bannerData = response.data;
  }

  modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl w-full max-w-lg modal">
                <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h3 class="text-2xl font-bold text-gray-800">${bannerId ? "Edit Banner" : "Add New Banner"}</h3>
                    <button onclick="closeModal('bannerModal')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                
                <form id="bannerForm" class="p-6 space-y-6" enctype="multipart/form-data">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Title (English) *</label>
                        <input type="text" name="title" required value="${bannerData?.title || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Title (Bangla)</label>
                        <input type="text" name="titleBn" value="${bannerData?.titleBn || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Subtitle</label>
                        <input type="text" name="subtitle" value="${bannerData?.subtitle || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Button Text</label>
                        <input type="text" name="buttonText" value="${bannerData?.buttonText || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Link URL</label>
                        <input type="url" name="link" value="${bannerData?.link || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg"
                               placeholder="https://example.com">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                        <select name="position" class="form-input w-full px-4 py-2 border rounded-lg">
                            <option value="home_top" ${bannerData?.position === "home_top" ? "selected" : ""}>Home Top</option>
                            <option value="home_middle" ${bannerData?.position === "home_middle" ? "selected" : ""}>Home Middle</option>
                            <option value="home_bottom" ${bannerData?.position === "home_bottom" ? "selected" : ""}>Home Bottom</option>
                            <option value="category_top" ${bannerData?.position === "category_top" ? "selected" : ""}>Category Top</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Display Order</label>
                        <input type="number" name="order" value="${bannerData?.order || 0}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Banner Image *</label>
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                            <input type="file" name="image" accept="image/*" id="bannerImage" ${!bannerId ? "required" : ""} class="hidden">
                            <label for="bannerImage" class="cursor-pointer">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2 block"></i>
                                <p class="text-gray-600">Click to upload image</p>
                                <p class="text-xs text-gray-500 mt-1">Recommended: 1920x1080px</p>
                            </label>
                        </div>
                        <div id="imagePreview" class="mt-4">
                            ${
                              bannerData?.image?.url
                                ? `
                                <img src="${bannerData.image.url}" class="w-full h-48 object-cover rounded-lg">
                            `
                                : ""
                            }
                        </div>
                    </div>
                    
                    <div class="flex items-center">
                        <label class="flex items-center">
                            <input type="checkbox" name="isActive" value="true" ${bannerData?.isActive !== false ? "checked" : ""} class="mr-2">
                            <span class="text-sm text-gray-700">Active</span>
                        </label>
                    </div>
                    
                    <div class="flex justify-end space-x-3 pt-4 border-t">
                        <button type="button" onclick="closeModal('bannerModal')" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                            Cancel
                        </button>
                        <button type="submit" class="px-6 py-2 btn-primary text-white rounded-lg shadow-lg">
                            ${bannerId ? "Update Banner" : "Create Banner"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

  // Handle image preview
  document
    .getElementById("bannerImage")
    .addEventListener("change", function (e) {
      const preview = document.getElementById("imagePreview");
      if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = `<img src="${e.target.result}" class="w-full h-48 object-cover rounded-lg">`;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

  // Handle form submission
  document.getElementById("bannerForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      let response;
      if (bannerId) {
        const data = Object.fromEntries(formData);
        response = await API.put(`/banners/${bannerId}`, data);
      } else {
        response = await API.upload("/banners", formData);
      }

      if (response.success) {
        showToast(
          `Banner ${bannerId ? "updated" : "created"} successfully!`,
          "success",
        );
        closeModal("bannerModal");
        loadBannersList();
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };
}

async function editBanner(bannerId) {
  await openBannerModal(bannerId);
}

async function deleteBanner(bannerId) {
  confirmDialog("Are you sure you want to delete this banner?", async () => {
    try {
      const response = await API.delete(`/banners/${bannerId}`);
      if (response.success) {
        showToast("Banner deleted successfully!", "success");
        loadBannersList();
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}
