import { createMockProducts, MOCK_USERS } from "./mock-data.js";
import { Storage } from "./storage.js";
import { Utils } from "./utils.js";

const MOCK_PRODUCTS = createMockProducts();
let MOCK_ORDERS = [];
let MOCK_USERS_DB = [...MOCK_USERS];
let MOCK_PAYMENTS = {};

const PLACEHOLDER_IMAGE_PATTERN = /loremflickr\.com/i;
const IMAGE_FILE_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
const DOMAIN_WITH_OPTIONAL_PATH_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i;
const URL_IN_TEXT_PATTERN = /(https?:\/\/[^\s"'<>]+)/i;
const USE_LOCAL_PRODUCT_CATALOG = false;
let PRODUCT_IMAGE_CACHE = Storage.getJSON("productImageCache", {});

function getApiBaseUrl() {
  const configured = String(Storage.get("apiBaseUrl", "") || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL("/api", window.location.origin).toString().replace(/\/+$/, "");
}

function getPaymentGatewayBaseUrl() {
  const configured = String(Storage.get("paymentGatewayBaseUrl", "") || "").trim();
  return configured ? configured.replace(/\/+$/, "") : "";
}

function getPaymentGatewayTimeoutMs() {
  const configured = Number(Storage.get("paymentGatewayTimeoutMs", 10000));
  if (!Number.isFinite(configured) || configured < 1000) {
    return 10000;
  }
  return configured;
}

function isPaymentSuccessStatus(status = "") {
  return ["success", "succeeded", "paid", "completed"].includes(String(status).toLowerCase());
}

function isPaymentFailureStatus(status = "") {
  return ["failed", "failure", "declined", "cancelled", "canceled", "error"].includes(String(status).toLowerCase());
}

function createMockPaymentRecord(payload = {}) {
  const paymentId = `PAY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const forcedSimulation = String(payload.simulate || "").toLowerCase();
  const initialStatus =
    forcedSimulation === "success"
      ? "success"
      : forcedSimulation === "failed" || forcedSimulation === "failure"
        ? "failed"
        : Math.random() > 0.25
          ? "success"
          : "failed";

  const record = {
    payment_id: paymentId,
    status: initialStatus,
    amount: payload.amount,
    currency: payload.currency || "USD",
    user: payload.user || null,
    created_at: new Date().toISOString(),
    attempts: 0
  };

  MOCK_PAYMENTS = {
    ...MOCK_PAYMENTS,
    [paymentId]: record
  };

  return record;
}

function uniqueUrls(urls = []) {
  return urls.filter((url, index, list) => Boolean(url) && list.indexOf(url) === index);
}

function toPublicUser(user = {}) {
  return {
    id: user.id,
    fullName: user.fullName || user.name || "",
    email: user.email || user.username || "",
    phone: user.phone || user.mobile || "",
    isAdmin: Boolean(user.isAdmin || user.admin || String(user.role || "").toUpperCase() === "ADMIN")
  };
}

function isPlaceholderImage(url = "") {
  return PLACEHOLDER_IMAGE_PATTERN.test(url);
}

function isDirectImage(url = "") {
  return IMAGE_FILE_PATTERN.test(url) || /^data:image\//i.test(url);
}

function stripWrappingQuotes(value = "") {
  return String(value).trim().replace(/^["']+|["']+$/g, "");
}

function safeDecode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeToHttps(url = "") {
  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) {
    return url;
  }

  if (DOMAIN_WITH_OPTIONAL_PATH_PATTERN.test(url)) {
    return `https://${url}`;
  }

  return url;
}

function extractUrlFromText(value = "") {
  const cleaned = stripWrappingQuotes(safeDecode(String(value || "").trim()));
  if (!cleaned) {
    return "";
  }

  const directMatch = cleaned.match(URL_IN_TEXT_PATTERN);
  if (directMatch?.[1]) {
    return stripWrappingQuotes(directMatch[1]);
  }

  return "";
}

function normalizeSourceUrl(rawUrl = "") {
  let source = normalizeToHttps(stripWrappingQuotes(String(rawUrl || "").trim()));
  if (!source) {
    return "";
  }

  let extractedFromRaw = extractUrlFromText(source);
  if (extractedFromRaw) {
    source = normalizeToHttps(extractedFromRaw);
  }

  try {
    const parsed = new URL(source);
    const searchParams = parsed.searchParams;

    // Some seeds contain search URLs where the original target URL is inside query params.
    const candidateParamKeys = ["imgurl", "mediaurl", "url", "u", "q", "target"];
    for (const key of candidateParamKeys) {
      const candidateValue = searchParams.get(key);
      if (!candidateValue) {
        continue;
      }

      const extracted = extractUrlFromText(candidateValue);
      if (extracted) {
        source = normalizeToHttps(extracted);
        break;
      }
    }
  } catch {
    extractedFromRaw = extractUrlFromText(source);
    if (extractedFromRaw) {
      source = normalizeToHttps(extractedFromRaw);
    }
  }

  return stripWrappingQuotes(source);
}

function hashText(value = "") {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildInlinePlaceholderImage(seedText = "Product") {
  const label = String(seedText || "Product").trim().slice(0, 24) || "Product";
  const palettes = [
    ["#0f766e", "#14b8a6"],
    ["#1d4ed8", "#38bdf8"],
    ["#7c3aed", "#a78bfa"],
    ["#be123c", "#fb7185"],
    ["#a16207", "#fbbf24"]
  ];
  const palette = palettes[hashText(label) % palettes.length];

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'>
<defs>
<linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
<stop offset='0%' stop-color='${palette[0]}' />
<stop offset='100%' stop-color='${palette[1]}' />
</linearGradient>
</defs>
<rect width='1200' height='900' fill='url(#g)' />
<circle cx='1020' cy='120' r='220' fill='rgba(255,255,255,0.16)' />
<circle cx='180' cy='760' r='260' fill='rgba(255,255,255,0.12)' />
<text x='80' y='470' fill='white' font-size='88' font-family='Segoe UI, Arial, sans-serif' font-weight='700'>${Utils.sanitize(label)}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getCachedImageUrls(productId) {
  const cached = PRODUCT_IMAGE_CACHE?.[String(productId)];
  if (!Array.isArray(cached)) {
    return [];
  }
  return uniqueUrls(cached).slice(0, 3);
}

function setCachedImageUrls(productId, imageUrls) {
  if (productId === null || productId === undefined) {
    return;
  }

  PRODUCT_IMAGE_CACHE = {
    ...PRODUCT_IMAGE_CACHE,
    [String(productId)]: imageUrls.slice(0, 3)
  };
  Storage.setJSON("productImageCache", PRODUCT_IMAGE_CACHE);
}

function buildSeededImageUrls(product) {
  const slug = Utils.slugify(product?.name || product?.category || "product");
  const stableId = Number(product?.id) || 1;

  return Array.from({ length: 3 }, (_, index) => {
    return `https://picsum.photos/seed/glowlogics-${slug}-${stableId}-${index + 1}/960/1080`;
  });
}

function getHostName(url) {
  try {
    return new URL(url).hostname || "";
  } catch {
    return "";
  }
}

function buildImageCandidates(rawUrl, seedText = "") {
  const source = normalizeSourceUrl(rawUrl);
  if (!source) {
    return ["/images/icons/logo.png", buildInlinePlaceholderImage(seedText || "Product")];
  }

  const candidates = [];
  if (isDirectImage(source)) {
    candidates.push(source);
  }

  if (/^https?:\/\//i.test(source)) {
    candidates.push(`https://s.wordpress.com/mshots/v1/${encodeURIComponent(source)}?w=1200`);
    candidates.push(`https://image.thum.io/get/width/1200/noanimate/${encodeURI(source)}`);
  }

  const hostName = getHostName(source);
  if (hostName) {
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostName)}&sz=256`);
  }

  candidates.push(`https://picsum.photos/seed/${Utils.slugify(seedText || source)}/960/1080`);
  candidates.push("/images/icons/logo.png");
  candidates.push(buildInlinePlaceholderImage(seedText || source));
  return uniqueUrls(candidates);
}

function normalizeProduct(product) {
  if (!product) {
    return null;
  }

  const providedImages = uniqueUrls([
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    ...(Array.isArray(product.sourceImageLinks) ? product.sourceImageLinks : []),
    product.imageUrl
  ]).filter((url) => !isPlaceholderImage(url));

  const cachedImageUrls = getCachedImageUrls(product.id).filter((url) => !isPlaceholderImage(url));
  let imageCandidateGroups = providedImages.slice(0, 3).map((imageUrl, index) =>
    buildImageCandidates(imageUrl, `${product.id || "product"}-${index + 1}-${product.name || "item"}`)
  );

  let imageUrls = imageCandidateGroups.map((group) => group[0]).filter(Boolean);
  let imageFallbackGroups = imageCandidateGroups.map((group) => group.slice(1));

  if (!imageUrls.length && cachedImageUrls.length) {
    imageUrls = cachedImageUrls.slice(0, 3);
    imageFallbackGroups = imageUrls.map(() => []);
  }

  if (!imageUrls.length) {
    const seededImageUrls = buildSeededImageUrls(product);
    imageUrls = seededImageUrls.slice(0, 3);
    imageFallbackGroups = imageUrls.map(() => []);
  }

  imageUrls = uniqueUrls(imageUrls).slice(0, 3);
  imageFallbackGroups = imageFallbackGroups.slice(0, imageUrls.length);

  if (imageUrls.length) {
    setCachedImageUrls(product.id, imageUrls);
  }

  return {
    ...product,
    imageUrl: imageUrls[0] || product.imageUrl || "",
    imageUrls,
    imageFallbackGroups,
    sourceImageLinks: providedImages.slice(0, 3),
    finalPrice: product.discountPrice ?? product.price
  };
}

function applyProductFilters(list, filters = {}) {
  let result = [...list];

  if (filters.search) {
    const text = filters.search.toLowerCase();
    result = result.filter(
      (item) =>
        item.name.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text) ||
        item.category.toLowerCase().includes(text)
    );
  }

  if (filters.category && filters.category.length) {
    const chosen = Array.isArray(filters.category) ? filters.category : [filters.category];
    result = result.filter((item) => chosen.includes(item.category));
  }

  if (typeof filters.minPrice === "number") {
    result = result.filter((item) => (item.discountPrice ?? item.price) >= filters.minPrice);
  }

  if (typeof filters.maxPrice === "number") {
    result = result.filter((item) => (item.discountPrice ?? item.price) <= filters.maxPrice);
  }

  if (typeof filters.minRating === "number") {
    result = result.filter((item) => item.rating >= filters.minRating);
  }

  if (filters.availableOnly) {
    result = result.filter((item) => item.stock > 0);
  }

  if (filters.sortBy) {
    if (filters.sortBy === "priceAsc") {
      result.sort((a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price));
    } else if (filters.sortBy === "priceDesc") {
      result.sort((a, b) => (b.discountPrice ?? b.price) - (a.discountPrice ?? a.price));
    } else if (filters.sortBy === "topRated") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  return result.map(normalizeProduct);
}

class APIClient {
  constructor(baseURL = getApiBaseUrl()) {
    this.baseURL = baseURL;
  }

  get token() {
    return Storage.get("token", "");
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async paymentGatewayRequest(endpoint, options = {}) {
    const baseUrl = getPaymentGatewayBaseUrl();
    if (!baseUrl) {
      throw new Error("Payment gateway base URL is not configured");
    }

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getPaymentGatewayTimeoutMs());

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        const message =
          typeof body === "string" ? body : body?.detail || body?.message || body?.error || `HTTP ${response.status}`;
        const error = new Error(message || `HTTP ${response.status}`);
        error.status = response.status;
        error.body = body;
        throw error;
      }

      return body;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Payment gateway timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async withFallback(remote, fallback) {
    try {
      return await remote();
    } catch (error) {
      return fallback(error);
    }
  }

  async getProducts(filters = {}, page = 0, size = 12) {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      const filtered = applyProductFilters(MOCK_PRODUCTS, filters);
      const start = page * size;
      const pageContent = filtered.slice(start, start + size);
      return {
        content: pageContent,
        totalElements: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / size)),
        number: page,
        size
      };
    }

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("size", String(size));

    if (filters.search) {
      query.set("search", filters.search);
    }
    if (filters.category && filters.category.length) {
      query.set("category", Array.isArray(filters.category) ? filters.category[0] : filters.category);
    }
    if (typeof filters.minPrice === "number") {
      query.set("minPrice", String(filters.minPrice));
    }
    if (typeof filters.maxPrice === "number") {
      query.set("maxPrice", String(filters.maxPrice));
    }
    if (filters.sortBy) {
      query.set("sort", filters.sortBy);
    }

    const response = await this.withFallback(
      () => this.request(`/products?${query.toString()}`),
      () => {
        const filtered = applyProductFilters(MOCK_PRODUCTS, filters);
        const start = page * size;
        const pageContent = filtered.slice(start, start + size);
        return {
          content: pageContent,
          totalElements: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / size)),
          number: page,
          size
        };
      }
    );

    const normalizedContent = Array.isArray(response?.content) ? response.content.map(normalizeProduct) : [];

    return {
      ...response,
      content: normalizedContent
    };
  }

  async getProductById(id) {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      return normalizeProduct(MOCK_PRODUCTS.find((item) => Number(item.id) === Number(id)));
    }

    const product = await this.withFallback(
      () => this.request(`/products/${id}`),
      () => normalizeProduct(MOCK_PRODUCTS.find((item) => Number(item.id) === Number(id)))
    );

    if (!product) {
      return null;
    }

    return normalizeProduct(product);
  }

  async searchProducts(query) {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      return applyProductFilters(MOCK_PRODUCTS, { search: query }).slice(0, 8);
    }

    const products = await this.withFallback(
      () => this.request(`/products/search?query=${encodeURIComponent(query)}`),
      () => applyProductFilters(MOCK_PRODUCTS, { search: query }).slice(0, 8)
    );

    return Array.isArray(products) ? products.map(normalizeProduct) : [];
  }

  async login(credentials) {
    return this.withFallback(
      () => this.request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
      () => {
        const found = MOCK_USERS_DB.find(
          (user) =>
            user.email.toLowerCase() === credentials.email.toLowerCase() && user.password === credentials.password
        );
        if (!found) {
          throw new Error("Invalid email or password");
        }
        return {
          token: `mock-token-${Utils.uid("user")}`,
          user: {
            id: found.id,
            email: found.email,
            fullName: found.fullName,
            phone: found.phone,
            isAdmin: found.isAdmin
          }
        };
      }
    );
  }

  async signup(userData) {
    return this.withFallback(
      () => this.request("/auth/signup", { method: "POST", body: JSON.stringify(userData) }),
      () => {
        if (MOCK_USERS_DB.some((user) => user.email.toLowerCase() === userData.email.toLowerCase())) {
          throw new Error("Email already exists");
        }
        const newUser = {
          id: MOCK_USERS_DB.length + 1,
          fullName: userData.fullName,
          email: userData.email,
          phone: userData.phone,
          password: userData.password,
          isAdmin: false
        };
        MOCK_USERS_DB.push(newUser);
        return {
          token: `mock-token-${Utils.uid("user")}`,
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            phone: newUser.phone,
            isAdmin: false
          }
        };
      }
    );
  }

  async getProfile() {
    return this.request("/users/me");
  }

  async updateProfile(payload) {
    return this.request("/users/me", { method: "PUT", body: JSON.stringify(payload) });
  }

  async getWishlist() {
    return this.withFallback(
      () => this.request("/wishlist"),
      () => Storage.getJSON("wishlist", [])
    );
  }

  async addWishlist(productId) {
    return this.withFallback(
      () => this.request(`/wishlist/${productId}`, { method: "POST" }),
      () => ({ success: true })
    );
  }

  async removeWishlist(productId) {
    return this.withFallback(
      () => this.request(`/wishlist/${productId}`, { method: "DELETE" }),
      () => ({ success: true })
    );
  }

  async getCart() {
    return this.withFallback(
      () => this.request("/cart"),
      () => Storage.getJSON("cart", [])
    );
  }

  async updateCart(items) {
    return this.withFallback(
      () => this.request("/cart", { method: "PUT", body: JSON.stringify(items) }),
      () => ({ success: true })
    );
  }

  async createOrder(orderPayload) {
    return this.withFallback(
      () => this.request("/orders", { method: "POST", body: JSON.stringify(orderPayload) }),
      () => {
        const order = {
          id: `GLW-${Date.now()}`,
          ...orderPayload,
          createdAt: new Date().toISOString(),
          status: "PENDING"
        };
        MOCK_ORDERS.unshift(order);
        return order;
      }
    );
  }

  async getOrders() {
    return this.withFallback(
      () => this.request("/orders"),
      () => MOCK_ORDERS
    );
  }

  async adminGetOrders() {
    const orders = await this.withFallback(
      () => this.request("/admin/orders"),
      () => this.getOrders()
    );

    return Array.isArray(orders) ? orders : [];
  }

  async adminGetUsers() {
    const users = await this.withFallback(
      () => this.request("/admin/users"),
      () => MOCK_USERS_DB.map(toPublicUser)
    );

    return Array.isArray(users) ? users.map(toPublicUser) : [];
  }

  async createPayment(payload) {
    return this.withFallback(
      () => this.paymentGatewayRequest("/payment", { method: "POST", body: JSON.stringify(payload) }),
      async () => {
        return this.withFallback(
          () => this.request("/payment/process", { method: "POST", body: JSON.stringify(payload) }),
          () => createMockPaymentRecord(payload)
        );
      }
    );
  }

  async checkPaymentStatus(paymentId) {
    return this.withFallback(
      () => this.paymentGatewayRequest(`/status/${encodeURIComponent(paymentId)}`),
      () => {
        const existing = MOCK_PAYMENTS[paymentId];
        if (!existing) {
          return {
            payment_id: paymentId,
            status: "not_found"
          };
        }

        const attempts = Number(existing.attempts || 0) + 1;
        const nextStatus = isPaymentSuccessStatus(existing.status) || isPaymentFailureStatus(existing.status)
          ? existing.status
          : attempts > 1
            ? "success"
            : "processing";

        const updated = {
          ...existing,
          attempts,
          status: nextStatus,
          updated_at: new Date().toISOString()
        };

        MOCK_PAYMENTS = {
          ...MOCK_PAYMENTS,
          [paymentId]: updated
        };

        return updated;
      }
    );
  }

  async refundPayment(paymentId, payload = {}) {
    return this.withFallback(
      () => this.paymentGatewayRequest(`/refund/${encodeURIComponent(paymentId)}`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
      () => {
        const existing = MOCK_PAYMENTS[paymentId];
        if (!existing) {
          throw new Error("Payment not found for refund");
        }

        const refunded = {
          ...existing,
          status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_reason: payload.reason || "manual-refund"
        };

        MOCK_PAYMENTS = {
          ...MOCK_PAYMENTS,
          [paymentId]: refunded
        };

        return {
          payment_id: paymentId,
          status: "refunded"
        };
      }
    );
  }

  async processPayment(payload) {
    return this.createPayment(payload);
  }

  async adminGetProducts() {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      return MOCK_PRODUCTS.map(normalizeProduct);
    }

    const products = await this.withFallback(
      () => this.request("/admin/products"),
      () => MOCK_PRODUCTS
    );

    return Array.isArray(products) ? products.map(normalizeProduct) : [];
  }

  async adminSaveProduct(payload) {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      if (payload.id) {
        const idx = MOCK_PRODUCTS.findIndex((item) => item.id === payload.id);
        if (idx >= 0) {
          MOCK_PRODUCTS[idx] = { ...MOCK_PRODUCTS[idx], ...payload };
          return normalizeProduct(MOCK_PRODUCTS[idx]);
        }
      }
      const product = {
        id: MOCK_PRODUCTS.length + 1,
        ...payload,
        createdAt: new Date().toISOString()
      };
      MOCK_PRODUCTS.push(product);
      return normalizeProduct(product);
    }

    const saved = await this.withFallback(
      () => this.request("/admin/products", { method: "POST", body: JSON.stringify(payload) }),
      () => {
        if (payload.id) {
          const idx = MOCK_PRODUCTS.findIndex((item) => item.id === payload.id);
          if (idx >= 0) {
            MOCK_PRODUCTS[idx] = { ...MOCK_PRODUCTS[idx], ...payload };
            return MOCK_PRODUCTS[idx];
          }
        }
        const product = {
          id: MOCK_PRODUCTS.length + 1,
          ...payload,
          createdAt: new Date().toISOString()
        };
        MOCK_PRODUCTS.push(product);
        return product;
      }
    );

    return normalizeProduct(saved);
  }

  async adminDeleteProduct(id) {
    if (USE_LOCAL_PRODUCT_CATALOG) {
      const idx = MOCK_PRODUCTS.findIndex((item) => item.id === Number(id));
      if (idx >= 0) {
        MOCK_PRODUCTS.splice(idx, 1);
      }
      return { success: true };
    }

    return this.withFallback(
      () => this.request(`/admin/products/${id}`, { method: "DELETE" }),
      () => {
        const idx = MOCK_PRODUCTS.findIndex((item) => item.id === Number(id));
        if (idx >= 0) {
          MOCK_PRODUCTS.splice(idx, 1);
        }
        return { success: true };
      }
    );
  }
}

export const api = new APIClient();
