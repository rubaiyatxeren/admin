let productsPage = 1;
let productsTotalPages = 1;

async function loadProducts() {
  const contentArea = document.getElementById("contentArea");
  contentArea.innerHTML = `
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex flex-wrap justify-between items-center gap-4">
                <h2 class="text-2xl font-bold text-gray-800">Products Management</h2>
                <button onclick="openProductModal()" class="btn-primary text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2">
                    <i class="fas fa-plus"></i>
                    <span>Add Product</span>
                </button>
            </div>
            
            <!-- Search and Filters -->
            <div class="bg-white rounded-2xl shadow-lg p-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="relative">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="searchProducts" placeholder="Search products..." 
                               class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    </div>
                    <select id="categoryFilter" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="">All Categories</option>
                    </select>
                    <select id="statusFilter" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                    <button onclick="resetFilters()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                        <i class="fas fa-redo-alt mr-2"></i>Reset
                    </button>
                </div>
            </div>
            
            <!-- Products Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6" id="productsGrid">
                <div class="col-span-full text-center py-12">
                    <div class="loading-spinner mx-auto"></div>
                </div>
            </div>
            
            <!-- Pagination -->
            <div class="flex justify-between items-center" id="pagination">
                <button onclick="changeProductsPage(-1)" id="prevBtn" class="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <span id="pageInfo" class="text-gray-600">Page 1 of 1</span>
                <button onclick="changeProductsPage(1)" id="nextBtn" class="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
        </div>
    `;

  await loadCategoriesForFilter();
  await loadProductsList();

  document
    .getElementById("searchProducts")
    .addEventListener("input", debounce(loadProductsList, 500));
  document
    .getElementById("categoryFilter")
    .addEventListener("change", loadProductsList);
  document
    .getElementById("statusFilter")
    .addEventListener("change", loadProductsList);
}

async function loadProductsList() {
  try {
    const search = document.getElementById("searchProducts")?.value || "";
    const category = document.getElementById("categoryFilter")?.value || "";
    const isActive = document.getElementById("statusFilter")?.value;

    let url = `/products?page=${productsPage}&limit=9`;
    if (search) url += `&search=${search}`;
    if (category) url += `&category=${category}`;
    if (isActive) url += `&isActive=${isActive}`;

    const response = await API.get(url);

    if (response.success) {
      productsTotalPages = response.pagination?.pages || 1;
      renderProductsGrid(response.data);
      updateProductsPagination();
    }
  } catch (error) {
    console.error("Failed to load products:", error);
    document.getElementById("productsGrid").innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4 block"></i>
                <p class="text-gray-600">Failed to load products</p>
                <button onclick="loadProductsList()" class="mt-4 text-purple-600 hover:text-purple-700">Try Again</button>
            </div>
        `;
  }
}

function renderProductsGrid(products) {
  const grid = document.getElementById("productsGrid");

  if (!products || products.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-box-open text-6xl text-gray-400 mb-4 block"></i>
                <p class="text-gray-500 text-lg">No products found</p>
                <button onclick="openProductModal()" class="mt-4 text-purple-600 hover:text-purple-700">
                    <i class="fas fa-plus mr-2"></i>Add your first product
                </button>
            </div>
        `;
    return;
  }

  grid.innerHTML = products
    .map(
      (product) => `
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div class="relative h-56 overflow-hidden">
                <img src="${product.images[0]?.url || "https://via.placeholder.com/300x200?text=No+Image"}" 
                     class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-4 right-4 space-y-2">
                    <button onclick="editProduct('${product._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-edit text-blue-600"></i>
                    </button>
                    <button onclick="deleteProduct('${product._id}')" class="bg-white p-2 rounded-full shadow-lg hover:shadow-xl transition">
                        <i class="fas fa-trash text-red-600"></i>
                    </button>
                </div>
                ${
                  product.stock <= 10
                    ? `
                    <div class="absolute bottom-4 left-4">
                        <span class="badge badge-warning">Low Stock: ${product.stock}</span>
                    </div>
                `
                    : ""
                }
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-xl text-gray-800">${product.name}</h3>
                    <span class="badge ${product.isActive ? "badge-success" : "badge-danger"}">
                        ${product.isActive ? "Active" : "Inactive"}
                    </span>
                </div>
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${product.description || "No description"}</p>
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-2xl font-bold text-purple-600">${formatCurrency(product.price)}</p>
                        ${product.comparePrice ? `<p class="text-sm text-gray-400 line-through">${formatCurrency(product.comparePrice)}</p>` : ""}
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">SKU: ${product.sku}</p>
                        <p class="text-sm font-semibold ${product.stock > 0 ? "text-green-600" : "text-red-600"}">
                            ${product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

async function openProductModal(productId = null) {
  const modalContainer = document.getElementById("modalContainer");

  // Load categories for select
  const categoriesResponse = await API.get("/categories");
  const categories = categoriesResponse.success ? categoriesResponse.data : [];

  let productData = null;
  if (productId) {
    const response = await API.get(`/products/${productId}`);
    if (response.success) productData = response.data;
  }

  modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto modal">
                <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h3 class="text-2xl font-bold text-gray-800">${productId ? "Edit Product" : "Add New Product"}</h3>
                    <button onclick="closeModal('productModal')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                
                <form id="productForm" class="p-6 space-y-6" enctype="multipart/form-data">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Product Name *</label>
                            <input type="text" name="name" required value="${productData?.name || ""}"
                                   class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">SKU *</label>
                            <input type="text" name="sku" required value="${productData?.sku || ""}"
                                   class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Price *</label>
                            <input type="number" name="price" step="0.01" required value="${productData?.price || ""}"
                                   class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Compare Price</label>
                            <input type="number" name="comparePrice" step="0.01" value="${productData?.comparePrice || ""}"
                                   class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Stock *</label>
                            <input type="number" name="stock" required value="${productData?.stock || ""}"
                                   class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                            <select name="category" required class="form-input w-full px-4 py-2 border rounded-lg">
                                <option value="">Select Category</option>
                                ${categories
                                  .map(
                                    (cat) => `
                                    <option value="${cat._id}" ${productData?.category?._id === cat._id ? "selected" : ""}>
                                        ${cat.name}
                                    </option>
                                `,
                                  )
                                  .join("")}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                        <textarea name="description" rows="4" required
                                  class="form-input w-full px-4 py-2 border rounded-lg">${productData?.description || ""}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Product Images</label>
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                            <input type="file" name="images" multiple accept="image/*" id="productImages" class="hidden">
                            <label for="productImages" class="cursor-pointer">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2 block"></i>
                                <p class="text-gray-600">Click to upload images</p>
                                <p class="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                            </label>
                        </div>
                        <div id="imagePreview" class="grid grid-cols-3 gap-2 mt-4"></div>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <label class="flex items-center">
                            <input type="checkbox" name="isActive" value="true" ${productData?.isActive !== false ? "checked" : ""} class="mr-2">
                            <span class="text-sm text-gray-700">Active</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" name="isFeatured" value="true" ${productData?.isFeatured ? "checked" : ""} class="mr-2">
                            <span class="text-sm text-gray-700">Featured</span>
                        </label>
                    </div>
                    
                    <div class="flex justify-end space-x-3 pt-4 border-t">
                        <button type="button" onclick="closeModal('productModal')" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                            Cancel
                        </button>
                        <button type="submit" class="px-6 py-2 btn-primary text-white rounded-lg shadow-lg">
                            ${productId ? "Update Product" : "Create Product"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

  // Handle image preview
  document
    .getElementById("productImages")
    .addEventListener("change", function (e) {
      const preview = document.getElementById("imagePreview");
      preview.innerHTML = "";
      Array.from(e.target.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML += `
                    <div class="relative">
                        <img src="${e.target.result}" class="w-full h-24 object-cover rounded-lg">
                    </div>
                `;
        };
        reader.readAsDataURL(file);
      });
    });

  // Handle form submission
  document.getElementById("productForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      let response;
      if (productId) {
        const data = Object.fromEntries(formData);
        response = await API.put(`/products/${productId}`, data);
      } else {
        response = await API.upload("/products", formData);
      }

      if (response.success) {
        showToast(
          `Product ${productId ? "updated" : "created"} successfully!`,
          "success",
        );
        closeModal("productModal");
        loadProductsList();
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };
}

async function editProduct(productId) {
  await openProductModal(productId);
}

async function deleteProduct(productId) {
  confirmDialog(
    "Are you sure you want to delete this product? This action cannot be undone.",
    async () => {
      try {
        const response = await API.delete(`/products/${productId}`);
        if (response.success) {
          showToast("Product deleted successfully!", "success");
          loadProductsList();
        }
      } catch (error) {
        showToast(error.message, "error");
      }
    },
  );
}

async function loadCategoriesForFilter() {
  try {
    const response = await API.get("/categories");
    if (response.success) {
      const select = document.getElementById("categoryFilter");
      if (select) {
        select.innerHTML =
          '<option value="">All Categories</option>' +
          response.data
            .map((cat) => `<option value="${cat._id}">${cat.name}</option>`)
            .join("");
      }
    }
  } catch (error) {
    console.error("Failed to load categories:", error);
  }
}

function resetFilters() {
  document.getElementById("searchProducts").value = "";
  document.getElementById("categoryFilter").value = "";
  document.getElementById("statusFilter").value = "";
  productsPage = 1;
  loadProductsList();
}

function changeProductsPage(delta) {
  const newPage = productsPage + delta;
  if (newPage >= 1 && newPage <= productsTotalPages) {
    productsPage = newPage;
    loadProductsList();
  }
}

function updateProductsPagination() {
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (pageInfo)
    pageInfo.textContent = `Page ${productsPage} of ${productsTotalPages}`;
  if (prevBtn) prevBtn.disabled = productsPage === 1;
  if (nextBtn) nextBtn.disabled = productsPage === productsTotalPages;
}
