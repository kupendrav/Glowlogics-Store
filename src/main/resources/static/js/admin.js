import { api } from "./api.js";
import { auth } from "./auth.js";
import { Utils } from "./utils.js";
import { UI } from "./ui.js";

const DEFAULT_PRODUCT_IMAGE = "https://picsum.photos/seed/new-product/600/760";
const ORDER_STATUS_OPTIONS = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const CHART_COLORS = ["#2d8de0", "#f4b400", "#17a974", "#f26d6d", "#6f87ff", "#e38b2c", "#8f67d8"];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOrderDate(order = {}) {
  const raw = order.createdAt || order.created_at || order.orderDate || order.date || Date.now();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getOrderItems(order = {}) {
  if (Array.isArray(order.items)) {
    return order.items;
  }
  if (Array.isArray(order.orderItems)) {
    return order.orderItems;
  }
  return [];
}

function getOrderItemQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? item.count ?? item.units ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function getOrderCustomerKey(order = {}) {
  return (
    order.shippingAddress?.email ||
    order.userEmail ||
    order.customerEmail ||
    order.email ||
    (order.userId ? `user-${order.userId}` : "") ||
    (order.customerId ? `customer-${order.customerId}` : "") ||
    (order.id ? `order-${order.id}` : "")
  );
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrderItemCategory(item = {}, productCategoryById = new Map()) {
  if (item.category) {
    return String(item.category);
  }

  const candidateId = Number(item.productId ?? item.product_id ?? item.id);
  if (Number.isFinite(candidateId) && productCategoryById.has(candidateId)) {
    return String(productCategoryById.get(candidateId));
  }

  return "Other";
}

function getProductImages(product = {}) {
  const images = [
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    product.imageUrl,
    product.image_url
  ]
    .filter((url, index, list) => Boolean(url) && list.indexOf(url) === index)
    .slice(0, 3);

  return images.length ? images : [DEFAULT_PRODUCT_IMAGE];
}

function renderSalesBarChart(container, sales = []) {
  if (!container) {
    return;
  }

  const points = Array.isArray(sales) ? sales : [];
  const maxValue = Math.max(...points.map((point) => Number(point.value) || 0), 0);

  if (!points.length || maxValue <= 0) {
    container.innerHTML = "<p class='admin-chart-empty'>No revenue data available for the last 7 days yet.</p>";
    return;
  }

  container.innerHTML = `
    <div class="admin-bar-chart">
      ${points
        .map((point) => {
          const value = Number(point.value) || 0;
          const normalizedHeight = Math.max(0, Math.round((value / maxValue) * 100));
          const fillHeight = value > 0 ? Math.max(8, normalizedHeight) : 0;

          return `
            <article class="admin-bar-col">
              <span class="admin-bar-value">${Utils.currency(value)}</span>
              <div class="admin-bar-track">
                <div class="admin-bar-fill" style="height:${fillHeight}%"></div>
              </div>
              <span class="admin-bar-label">${Utils.sanitize(point.label || "-")}</span>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCategoryPieChart(container, categorySales = []) {
  if (!container) {
    return;
  }

  const entries = Array.isArray(categorySales)
    ? categorySales
        .filter((entry) => Number(entry.value) > 0)
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, 7)
    : [];

  if (!entries.length) {
    container.innerHTML = "<p class='admin-chart-empty'>No category-level sales distribution available yet.</p>";
    return;
  }

  const total = entries.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  if (!total) {
    container.innerHTML = "<p class='admin-chart-empty'>No category-level sales distribution available yet.</p>";
    return;
  }

  let start = 0;
  const prepared = entries.map((entry, index) => {
    const value = Number(entry.value || 0);
    const percentage = (value / total) * 100;
    const end = start + percentage;
    const color = CHART_COLORS[index % CHART_COLORS.length];
    const segment = {
      ...entry,
      value,
      percentage,
      color,
      gradient: `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    };
    start = end;
    return segment;
  });

  const gradient = `conic-gradient(${prepared.map((entry) => entry.gradient).join(", ")})`;
  container.innerHTML = `
    <div class="admin-pie-layout">
      <div class="admin-pie-chart" style="background:${gradient}" aria-label="Category sales distribution"></div>
      <ul class="admin-pie-legend">
        ${prepared
          .map(
            (entry) => `
              <li>
                <span class="admin-pie-meta">
                  <span class="admin-pie-swatch" style="background:${entry.color}"></span>
                  <span>${Utils.sanitize(entry.label || "Other")}</span>
                </span>
                <strong>${entry.percentage.toFixed(1)}%</strong>
              </li>
            `
          )
          .join("")}
      </ul>
    </div>
  `;
}

function buildDashboardStats(orders = [], products = []) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(dayStart);
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeWindowStart = new Date(now);
  activeWindowStart.setDate(activeWindowStart.getDate() - 30);

  const productCategoryById = new Map(
    (Array.isArray(products) ? products : []).map((product) => [
      Number(product.id),
      product.category || "Other"
    ])
  );

  const dayBuckets = [];
  const revenueByDay = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const bucketDate = new Date(dayStart);
    bucketDate.setDate(dayStart.getDate() - offset);
    const key = formatDayKey(bucketDate);
    dayBuckets.push({ key, label: bucketDate.toLocaleDateString("en-US", { weekday: "short" }) });
    revenueByDay.set(key, 0);
  }

  let soldToday = 0;
  let soldWeek = 0;
  let soldMonth = 0;
  let totalRevenue = 0;
  const activeCustomers = new Set();
  const monthlyProductSales = new Map();
  const monthlyCategorySales = new Map();

  orders.forEach((order) => {
    const orderDate = getOrderDate(order);
    const items = getOrderItems(order);
    const itemCount = items.reduce((sum, item) => sum + getOrderItemQuantity(item), 0);
    const orderAmount = toNumber(order.totalAmount ?? order.total ?? order.amount, 0);

    const orderDayKey = formatDayKey(orderDate);
    if (revenueByDay.has(orderDayKey)) {
      revenueByDay.set(orderDayKey, toNumber(revenueByDay.get(orderDayKey), 0) + orderAmount);
    }

    if (orderDate >= dayStart) {
      soldToday += itemCount;
    }
    if (orderDate >= weekStart) {
      soldWeek += itemCount;
    }
    if (orderDate >= monthStart) {
      soldMonth += itemCount;
      items.forEach((item) => {
        const name = item.name || item.productName || item.title || "Unnamed Product";
        const quantity = getOrderItemQuantity(item);
        monthlyProductSales.set(name, (monthlyProductSales.get(name) || 0) + quantity);

        const category = getOrderItemCategory(item, productCategoryById);
        monthlyCategorySales.set(category, (monthlyCategorySales.get(category) || 0) + quantity);
      });
    }

    if (orderDate >= activeWindowStart) {
      const key = getOrderCustomerKey(order);
      if (key) {
        activeCustomers.add(String(key).toLowerCase());
      }
    }

    totalRevenue += orderAmount;
  });

  const topProducts = [...monthlyProductSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sold]) => ({ name, sold }));

  const categorySales = [...monthlyCategorySales.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const last7DayRevenue = dayBuckets.map((bucket) => ({
    label: bucket.label,
    value: toNumber(revenueByDay.get(bucket.key), 0)
  }));

  return {
    soldToday,
    soldWeek,
    soldMonth,
    totalRevenue,
    activeCustomers: activeCustomers.size,
    topProducts,
    categorySales,
    last7DayRevenue
  };
}

function renderProductsTable(container, products) {
  if (!products.length) {
    container.innerHTML = "<p class='text-secondary'>No products yet. Add your first catalog item above.</p>";
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Product</th>
          <th>Category</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Image</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (item) => `
          <tr>
            <td>${item.id}</td>
            <td>
              <strong>${Utils.sanitize(item.name)}</strong>
              <div class="text-secondary" style="font-size:.78rem;margin-top:.18rem">${Utils.sanitize(item.description || "No description")}</div>
            </td>
            <td>${Utils.sanitize(item.category)}</td>
            <td>${Utils.currency(item.discountPrice ?? item.price)}</td>
            <td>${item.stock}</td>
            <td><img src="${Utils.sanitize(getProductImages(item)[0])}" alt="${Utils.sanitize(item.name)}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.18)" /></td>
            <td>
              <button class="btn btn-secondary" data-edit="${item.id}">Edit</button>
              <button class="btn btn-secondary" data-delete="${item.id}">Delete</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export async function initAdminPages() {
  const page = document.querySelector("[data-admin-page]");
  if (!page) {
    return;
  }

  if (!auth.isLoggedIn() || !auth.isAdmin()) {
    UI.showToast("Admin access only. Please log in with an admin account.", "error");
    setTimeout(() => {
      window.location.href = Utils.appUrl("auth/login.html");
    }, 450);
    return;
  }

  const pageType = page.dataset.adminPage;

  if (pageType === "dashboard") {
    const metricsContainer = document.querySelector("#adminMetrics");
    const salesBarChart = document.querySelector("#adminSalesBarChart");
    const categoryPieChart = document.querySelector("#adminCategoryPieChart");
    if (!metricsContainer) {
      return;
    }

    const [products, orders, users] = await Promise.all([
      api.adminGetProducts(),
      api.adminGetOrders(),
      api.adminGetUsers()
    ]);

    const stats = buildDashboardStats(orders, products);

    metricsContainer.innerHTML = `
      <article class="stat-card"><p class="text-secondary">Items Sold Today</p><h3>${stats.soldToday}</h3></article>
      <article class="stat-card"><p class="text-secondary">Items Sold This Week</p><h3>${stats.soldWeek}</h3></article>
      <article class="stat-card"><p class="text-secondary">Items Sold This Month</p><h3>${stats.soldMonth}</h3></article>
      <article class="stat-card"><p class="text-secondary">Active Customers (30d)</p><h3>${stats.activeCustomers}</h3></article>
      <article class="stat-card"><p class="text-secondary">Total Revenue</p><h3>${Utils.currency(stats.totalRevenue)}</h3></article>
      <article class="stat-card"><p class="text-secondary">Total Orders</p><h3>${orders.length}</h3></article>
      <article class="stat-card"><p class="text-secondary">Registered Users</p><h3>${users.length}</h3></article>
      <article class="stat-card"><p class="text-secondary">Products</p><h3>${products.length}</h3></article>
    `;

    renderSalesBarChart(salesBarChart, stats.last7DayRevenue);
    renderCategoryPieChart(categoryPieChart, stats.categorySales);

    const recentOrders = document.querySelector("#recentOrders");
    const recent = [...orders]
      .sort((a, b) => getOrderDate(b).getTime() - getOrderDate(a).getTime())
      .slice(0, 8);

    recentOrders.innerHTML = `
      <table class="table">
        <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${(recent.length ? recent : [
            { id: "GLW-1284", createdAt: new Date().toISOString(), totalAmount: 249.99, status: "PENDING", items: [{ quantity: 2 }] },
            { id: "GLW-1283", createdAt: new Date(Date.now() - 86400000).toISOString(), totalAmount: 412.0, status: "SHIPPED", items: [{ quantity: 3 }] }
          ])
            .map(
              (order) => `
              <tr>
                <td>${order.id}</td>
                <td>${Utils.date(getOrderDate(order).toISOString())}</td>
                <td>${getOrderItems(order).reduce((sum, item) => sum + getOrderItemQuantity(item), 0)}</td>
                <td>${Utils.currency(order.totalAmount ?? 0)}</td>
                <td>${order.status}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;

    const topProductsContainer = document.querySelector("#adminTopProducts");
    if (topProductsContainer) {
      if (!stats.topProducts.length) {
        topProductsContainer.innerHTML = "<p class='text-secondary'>No product sales recorded this month yet.</p>";
      } else {
        topProductsContainer.innerHTML = `
          <table class="table">
            <thead><tr><th>Product</th><th>Units Sold (Month)</th></tr></thead>
            <tbody>
              ${stats.topProducts
                .map((entry) => `<tr><td>${Utils.sanitize(entry.name)}</td><td>${entry.sold}</td></tr>`)
                .join("")}
            </tbody>
          </table>
        `;
      }
    }
  }

  if (pageType === "products") {
    const tableShell = document.querySelector("#adminProductsTable");
    const form = document.querySelector("#adminProductForm");
    if (!tableShell || !form) {
      return;
    }

    const modeLabel = document.querySelector("#adminProductModeLabel");
    const submitLabel = document.querySelector("#adminProductSubmitLabel");
    const resetButton = document.querySelector("#adminProductReset");
    const preview = document.querySelector("#adminProductPreview");
    let products = await api.adminGetProducts();

    function setFormMode(editing = false) {
      if (modeLabel) {
        modeLabel.textContent = editing ? "Edit existing product" : "Add a new product";
      }
      if (submitLabel) {
        submitLabel.textContent = editing ? "Update Product" : "Add Product";
      }
    }

    function resetFormState() {
      form.reset();
      form.elements.id.value = "";
      form.elements.rating.value = "4.5";
      form.elements.reviewCount.value = "0";
      setFormMode(false);
      renderProductPreview();
    }

    function renderProductPreview() {
      if (!preview) {
        return;
      }

      const name = form.elements.name.value.trim() || "Product name preview";
      const category = form.elements.category.value.trim() || "Category";
      const price = toNumber(form.elements.price.value, 0);
      const discountPrice = toNumber(form.elements.discountPrice.value, 0);
      const primaryImage = form.elements.imageUrl.value.trim() || DEFAULT_PRODUCT_IMAGE;
      const description = form.elements.description.value.trim() || "Description preview";

      preview.innerHTML = `
        <article class="card glass" style="padding:.8rem;display:grid;gap:.55rem">
          <img src="${Utils.sanitize(primaryImage)}" alt="Preview" style="width:100%;max-height:190px;object-fit:cover;border-radius:10px" />
          <span class="badge badge-cyan">${Utils.sanitize(category)}</span>
          <strong>${Utils.sanitize(name)}</strong>
          <p class="text-secondary" style="font-size:.84rem;margin:0">${Utils.sanitize(description)}</p>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            <strong>${Utils.currency(discountPrice > 0 ? discountPrice : price)}</strong>
            ${discountPrice > 0 ? `<span class="old-price">${Utils.currency(price)}</span>` : ""}
          </div>
        </article>
      `;
    }

    function refreshTable() {
      const sortedProducts = [...products].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      renderProductsTable(tableShell, sortedProducts);
      tableShell.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = Number(button.dataset.delete);
          if (!window.confirm("Delete this product?")) {
            return;
          }
          await api.adminDeleteProduct(id);
          products = products.filter((item) => item.id !== id);
          refreshTable();
          UI.showToast("Product deleted");
        });
      });

      tableShell.querySelectorAll("[data-edit]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = Number(button.dataset.edit);
          const item = products.find((entry) => entry.id === id);
          if (!item) {
            return;
          }

          const [firstImage = "", secondImage = "", thirdImage = ""] = getProductImages(item);

          form.elements.id.value = item.id;
          form.elements.name.value = item.name;
          form.elements.category.value = item.category;
          form.elements.price.value = item.price;
          form.elements.discountPrice.value = item.discountPrice ?? "";
          form.elements.stock.value = item.stock;
          form.elements.imageUrl.value = firstImage;
          form.elements.imageUrl2.value = secondImage;
          form.elements.imageUrl3.value = thirdImage;
          form.elements.description.value = item.description;
          form.elements.rating.value = item.rating ?? 4.5;
          form.elements.reviewCount.value = item.reviewCount ?? 0;
          setFormMode(true);
          renderProductPreview();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    }

    form?.addEventListener("input", () => {
      renderProductPreview();
    });

    resetButton?.addEventListener("click", () => {
      resetFormState();
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const imageUrls = [
        form.elements.imageUrl.value.trim(),
        form.elements.imageUrl2.value.trim(),
        form.elements.imageUrl3.value.trim()
      ].filter(Boolean);

      const basePrice = toNumber(form.elements.price.value, 0);
      const discountPrice = toNumber(form.elements.discountPrice.value, 0);

      if (!basePrice || !imageUrls.length) {
        UI.showToast("Please provide a valid price and at least one image link", "error");
        return;
      }

      const payload = {
        id: form.elements.id.value ? Number(form.elements.id.value) : null,
        name: form.elements.name.value.trim(),
        category: form.elements.category.value.trim(),
        price: basePrice,
        discountPrice: discountPrice > 0 && discountPrice < basePrice ? discountPrice : null,
        stock: Number(form.elements.stock.value),
        imageUrl: imageUrls[0],
        imageUrls,
        description: form.elements.description.value.trim(),
        rating: toNumber(form.elements.rating.value, 4.5),
        reviewCount: toNumber(form.elements.reviewCount.value, 0)
      };

      const saved = await api.adminSaveProduct(payload);
      const idx = products.findIndex((item) => item.id === saved.id);
      if (idx >= 0) {
        products[idx] = saved;
      } else {
        products.unshift(saved);
      }

      resetFormState();
      refreshTable();
      UI.showToast("Product saved");
    });

    resetFormState();
    refreshTable();
  }

  if (pageType === "orders") {
    const container = document.querySelector("#adminOrdersTable");
    if (!container) {
      return;
    }

    let orders = await api.adminGetOrders();

    function renderOrdersTable() {
      const ordered = [...orders].sort((a, b) => getOrderDate(b).getTime() - getOrderDate(a).getTime());

      container.innerHTML = `
        <table class="table">
          <thead><tr><th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${
              (ordered.length ? ordered : [
                { id: "GLW-1290", createdAt: new Date().toISOString(), totalAmount: 182.12, status: "PROCESSING", items: [{ quantity: 1 }] },
                { id: "GLW-1289", createdAt: new Date(Date.now() - 54000000).toISOString(), totalAmount: 95.9, status: "SHIPPED", items: [{ quantity: 2 }] }
              ])
                .map(
                  (order) => `
                <tr>
                  <td>${order.id}</td>
                  <td>${Utils.date(getOrderDate(order).toISOString())}</td>
                  <td>${getOrderItems(order).reduce((sum, item) => sum + getOrderItemQuantity(item), 0)}</td>
                  <td>${Utils.currency(order.totalAmount ?? 0)}</td>
                  <td>
                    <select class="form-control" data-order-status="${order.id}" style="min-width:130px;padding:.45rem .6rem">
                      ${ORDER_STATUS_OPTIONS.map((status) => `<option value="${status}" ${status === (order.status || "PENDING") ? "selected" : ""}>${status}</option>`).join("")}
                    </select>
                  </td>
                  <td><button class="btn btn-secondary" data-save-order="${order.id}">Save</button></td>
                </tr>
              `
                )
                .join("")
            }
          </tbody>
        </table>
      `;

      container.querySelectorAll("[data-save-order]").forEach((button) => {
        button.addEventListener("click", () => {
          const orderId = button.dataset.saveOrder;
          const statusSelect = container.querySelector(`[data-order-status="${orderId}"]`);
          const order = orders.find((entry) => String(entry.id) === String(orderId));
          if (!order || !statusSelect) {
            return;
          }
          order.status = statusSelect.value;
          UI.showToast(`Order ${orderId} updated to ${statusSelect.value}`);
        });
      });
    }

    renderOrdersTable();
  }

  if (pageType === "users") {
    const container = document.querySelector("#adminUsersTable");
    if (!container) {
      return;
    }

    const [users, orders] = await Promise.all([api.adminGetUsers(), api.adminGetOrders()]);
    const activeUsers = new Set();
    const activeWindowStart = new Date();
    activeWindowStart.setDate(activeWindowStart.getDate() - 30);

    orders.forEach((order) => {
      if (getOrderDate(order) < activeWindowStart) {
        return;
      }

      const email =
        order.shippingAddress?.email || order.userEmail || order.customerEmail || order.email || "";
      if (email) {
        activeUsers.add(String(email).toLowerCase());
      }
    });

    container.innerHTML = `
      <table class="table">
        <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          ${users
            .map(
              (user) => `
            <tr>
              <td>${user.id}</td>
              <td>${Utils.sanitize(user.fullName || "-")}</td>
              <td>${Utils.sanitize(user.email || "-")}</td>
              <td>${Utils.sanitize(user.phone || "-")}</td>
              <td>${user.isAdmin ? "Admin" : "Customer"}</td>
              <td>${user.isAdmin || activeUsers.has(String(user.email || "").toLowerCase()) ? "ACTIVE" : "INACTIVE"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }
}
