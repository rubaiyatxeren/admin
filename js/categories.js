async function loadCategories() {
  const contentArea = document.getElementById("contentArea");
  contentArea.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap justify-between items-center gap-4">
                <h2 class="text-2xl font-bold text-gray-800">Categories Management</h2>
                <button onclick="openCategoryModal()" class="btn-primary text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2">
                    <i class="fas fa-plus"></i>
                    <span>Add Category</span>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="categoriesGrid">
                <div class="col-span-full text-center py-12">
                    <div class="loading-spinner mx-auto"></div>
                </div>
            </div>
        </div>
    `;

  await loadCategoriesList();
}

async function loadCategoriesList() {
  try {
    const response = await API.get("/categories");
    if (response.success) {
      renderCategoriesGrid(response.data);
    }
  } catch (error) {
    console.error("Failed to load categories:", error);
    document.getElementById("categoriesGrid").innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4 block"></i>
                <p class="text-gray-600">Failed to load categories</p>
                <button onclick="loadCategoriesList()" class="mt-4 text-purple-600 hover:text-purple-700">Try Again</button>
            </div>
        `;
  }
}

function renderCategoriesGrid(categories) {
  const grid = document.getElementById("categoriesGrid");

  if (!categories || categories.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-folder-open text-6xl text-gray-400 mb-4 block"></i>
                <p class="text-gray-500 text-lg">No categories found</p>
                <button onclick="openCategoryModal()" class="mt-4 text-purple-600 hover:text-purple-700">
                    <i class="fas fa-plus mr-2"></i>Create your first category
                </button>
            </div>
        `;
    return;
  }

  grid.innerHTML = categories
    .map(
      (category) => `
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div class="relative h-48 overflow-hidden">
                <img src="${category.image || "https://via.placeholder.com/400x200?text=Category"}" 
                     class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-4 right-4 space-y-2">
                    <button onclick="editCategory('${category._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-edit text-blue-600"></i>
                    </button>
                    <button onclick="deleteCategory('${category._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-trash text-red-600"></i>
                    </button>
                </div>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-xl text-gray-800">${category.name}</h3>
                    <span class="badge ${category.isActive ? "badge-success" : "badge-danger"}">
                        ${category.isActive ? "Active" : "Inactive"}
                    </span>
                </div>
                ${category.nameBn ? `<p class="text-sm text-gray-500 mb-2">${category.nameBn}</p>` : ""}
                <p class="text-gray-600 text-sm mb-4">${category.description || "No description"}</p>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">
                        <i class="fas fa-tag mr-1"></i>Order: ${category.order || 0}
                    </span>
                    ${
                      category.parentCategory
                        ? `
                        <span class="text-xs text-gray-400">Parent: ${category.parentCategory.name}</span>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

async function openCategoryModal(categoryId = null) {
  const modalContainer = document.getElementById("modalContainer");

  let categoryData = null;
  if (categoryId) {
    const response = await API.get(`/categories/${categoryId}`);
    if (response.success) categoryData = response.data;
  }

  modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl w-full max-w-lg modal">
                <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h3 class="text-2xl font-bold text-gray-800">${categoryId ? "Edit Category" : "Add New Category"}</h3>
                    <button onclick="closeModal('categoryModal')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                
                <form id="categoryForm" class="p-6 space-y-6" enctype="multipart/form-data">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Category Name (English) *</label>
                        <input type="text" name="name" required value="${categoryData?.name || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Category Name (Bangla)</label>
                        <input type="text" name="nameBn" value="${categoryData?.nameBn || ""}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <textarea name="description" rows="3" class="form-input w-full px-4 py-2 border rounded-lg">${categoryData?.description || ""}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Category Image</label>
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                            <input type="file" name="image" accept="image/*" id="categoryImage" class="hidden">
                            <label for="categoryImage" class="cursor-pointer">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2 block"></i>
                                <p class="text-gray-600">Click to upload image</p>
                            </label>
                        </div>
                        <div id="imagePreview" class="mt-4">
                            ${
                              categoryData?.image
                                ? `
                                <img src="${categoryData.image}" class="w-32 h-32 object-cover rounded-lg">
                            `
                                : ""
                            }
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Display Order</label>
                        <input type="number" name="order" value="${categoryData?.order || 0}"
                               class="form-input w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div class="flex items-center">
                        <label class="flex items-center">
                            <input type="checkbox" name="isActive" value="true" ${categoryData?.isActive !== false ? "checked" : ""} class="mr-2">
                            <span class="text-sm text-gray-700">Active</span>
                        </label>
                    </div>
                    
                    <div class="flex justify-end space-x-3 pt-4 border-t">
                        <button type="button" onclick="closeModal('categoryModal')" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                            Cancel
                        </button>
                        <button type="submit" class="px-6 py-2 btn-primary text-white rounded-lg shadow-lg">
                            ${categoryId ? "Update Category" : "Create Category"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

  // Handle image preview
  document
    .getElementById("categoryImage")
    .addEventListener("change", function (e) {
      const preview = document.getElementById("imagePreview");
      if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = `<img src="${e.target.result}" class="w-32 h-32 object-cover rounded-lg">`;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

  // Handle form submission
  document.getElementById("categoryForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      let response;
      if (categoryId) {
        const data = Object.fromEntries(formData);
        response = await API.put(`/categories/${categoryId}`, data);
      } else {
        response = await API.upload("/categories", formData);
      }

      if (response.success) {
        showToast(
          `Category ${categoryId ? "updated" : "created"} successfully!`,
          "success",
        );
        closeModal("categoryModal");
        loadCategoriesList();
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };
}

async function editCategory(categoryId) {
  await openCategoryModal(categoryId);
}

async function deleteCategory(categoryId) {
  confirmDialog(
    "Are you sure you want to delete this category? Products in this category will be affected.",
    async () => {
      try {
        const response = await API.delete(`/categories/${categoryId}`);
        if (response.success) {
          showToast("Category deleted successfully!", "success");
          loadCategoriesList();
        }
      } catch (error) {
        showToast(error.message, "error");
      }
    },
  );
}
