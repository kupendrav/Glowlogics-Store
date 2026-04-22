import { api } from "./api.js";
import { cart } from "./cart.js";
import { wishlist } from "./wishlist.js";
import { UI } from "./ui.js";
import { Utils } from "./utils.js";

const DEFAULT_STATE = {
  page: 0,
  size: 12,
  totalPages: 1,
  filters: {
    search: "",
    category: [],
    minPrice: null,
    maxPrice: null,
    minRating: null,
    availableOnly: false,
    sortBy: "newest"
  }
};

function encodeFallbacks(fallbackUrls = []) {
  if (!Array.isArray(fallbackUrls) || !fallbackUrls.length) {
    return "";
  }
  return fallbackUrls.map((url) => encodeURIComponent(String(url))).join(",");
}

function productCardTemplate(product) {
  const discountPercent =
    product.discountPrice && product.price
      ? Math.max(1, Math.round(((product.price - product.discountPrice) / product.price) * 100))
      : null;
  const imageFallbacks = encodeFallbacks(Array.isArray(product.imageFallbackGroups) ? product.imageFallbackGroups[0] : []);
  const safeImageUrl = Utils.sanitize(product.imageUrl || "");

  return `
    <article class="card product-card reveal" data-product-id="${product.id}">
      <div class="thumb-wrap">
        <img loading="lazy" src="${safeImageUrl}" data-fallbacks="${Utils.sanitize(imageFallbacks)}" alt="${Utils.sanitize(product.name)}" />
      </div>
      <div>
        <span class="badge badge-cyan">${Utils.sanitize(product.category)}</span>
        <h3 style="margin-top:.45rem">${Utils.sanitize(product.name)}</h3>
        <div style="font-size:.84rem">${UI.renderStars(product.rating)} <span class="text-secondary">(${product.reviewCount})</span></div>
        <div class="price-row">
          <strong>${Utils.currency(product.discountPrice ?? product.price)}</strong>
          ${product.discountPrice ? `<span class="old-price">${Utils.currency(product.price)}</span>` : ""}
          ${discountPercent ? `<span class="badge badge-accent">-${discountPercent}%</span>` : ""}
        </div>
      </div>
      <div class="product-card-actions">
        <button class="btn product-btn-cart" data-action="cart">Add to Cart</button>
        <button class="btn product-btn-wishlist" data-action="wish">${wishlist.has(product.id) ? "Saved" : "Wishlist"}</button>
        <a class="btn product-btn-details" href="product-detail.html?id=${product.id}">View Details</a>
      </div>
    </article>
  `;
}

function buildProductGalleryImages(product) {
  const provided = Array.isArray(product.imageUrls)
    ? product.imageUrls.filter((url, index, list) => Boolean(url) && list.indexOf(url) === index)
    : [];
  const fallbackGroups = Array.isArray(product.imageFallbackGroups) ? product.imageFallbackGroups : [];

  const images = provided.map((url, index) => ({
    src: url,
    fallbacks: Array.isArray(fallbackGroups[index]) ? fallbackGroups[index] : []
  }));

  const slug = Utils.slugify(product.name || product.category || "product");
  while (images.length < 3) {
    const fallbackImage = `https://picsum.photos/seed/glowlogics-${slug}-${product.id}-${images.length + 1}/960/1080`;
    if (!images.some((entry) => entry.src === fallbackImage)) {
      images.push({ src: fallbackImage, fallbacks: [] });
    } else {
      break;
    }
  }

  return images.slice(0, 3);
}

function buildActiveFilterBadges(state, container) {
  const badges = [];
  if (state.filters.search) {
    badges.push(`<span class="badge badge-cyan">Search: ${Utils.sanitize(state.filters.search)}</span>`);
  }
  if (state.filters.category.length) {
    badges.push(`<span class="badge badge-cyan">Categories: ${state.filters.category.join(", ")}</span>`);
  }
  if (state.filters.minPrice !== null || state.filters.maxPrice !== null) {
    badges.push(
      `<span class="badge badge-accent">Price: ${state.filters.minPrice ?? 0} - ${state.filters.maxPrice ?? "Any"}</span>`
    );
  }
  if (state.filters.availableOnly) {
    badges.push('<span class="badge badge-cyan">In Stock</span>');
  }
  if (state.filters.minRating) {
    badges.push(`<span class="badge badge-accent">${state.filters.minRating}+ stars</span>`);
  }
  container.innerHTML = badges.join(" ");
}

export async function initProductsPage() {
  const page = document.querySelector('[data-page="products"]');
  if (!page) {
    return;
  }

  const state = structuredClone(DEFAULT_STATE);
  const grid = document.querySelector("#productsGrid");
  const pagination = document.querySelector("#productsPagination");
  const noResults = document.querySelector("#noResults");
  const badgeContainer = document.querySelector("#activeFilterBadges");

  const form = document.querySelector("#productFilters");
  const search = document.querySelector("#productsSearch");
  const sort = document.querySelector("#productsSort");
  const minPrice = document.querySelector("#minPrice");
  const maxPrice = document.querySelector("#maxPrice");
  const rating = document.querySelector("#minRating");
  const availableOnly = document.querySelector("#availableOnly");
  const filtersSidebar = document.querySelector("#productsFiltersSidebar");
  const filtersOpenBtn = document.querySelector("#filtersOpenBtn");
  const filtersCloseBtn = document.querySelector("#filtersCloseBtn");
  const filtersBackdrop = document.querySelector("#productsFiltersBackdrop");
  const mobileFiltersQuery = window.matchMedia("(max-width: 768px)");

  function isMobileFiltersView() {
    return mobileFiltersQuery.matches;
  }

  function setFiltersOpen(isOpen) {
    if (!filtersSidebar || !filtersOpenBtn || !filtersBackdrop) {
      return;
    }

    const isMobile = isMobileFiltersView();
    const shouldOpen = isMobile && Boolean(isOpen);
    document.body.classList.toggle("products-filters-open", shouldOpen);
    filtersOpenBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    filtersSidebar.setAttribute("aria-hidden", isMobile && !shouldOpen ? "true" : "false");
    filtersSidebar.style.pointerEvents = isMobile && !shouldOpen ? "none" : "auto";
    filtersBackdrop.hidden = !shouldOpen;
  }

  setFiltersOpen(false);

  filtersOpenBtn?.addEventListener("click", () => {
    setFiltersOpen(true);
  });

  filtersCloseBtn?.addEventListener("click", () => {
    setFiltersOpen(false);
    filtersOpenBtn?.focus();
  });

  filtersBackdrop?.addEventListener("click", () => {
    setFiltersOpen(false);
    filtersOpenBtn?.focus();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isMobileFiltersView() || !document.body.classList.contains("products-filters-open")) {
      return;
    }

    const target = event.target;
    if (filtersSidebar?.contains(target) || filtersOpenBtn?.contains(target)) {
      return;
    }

    setFiltersOpen(false);
    filtersOpenBtn?.focus();
  });

  mobileFiltersQuery.addEventListener("change", () => {
    setFiltersOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !document.body.classList.contains("products-filters-open")) {
      return;
    }

    setFiltersOpen(false);
    filtersOpenBtn?.focus();
  });

  async function fetchAndRender() {
    UI.showLoader("Loading products");
    const result = await api.getProducts(state.filters, state.page, state.size);
    const products = result.content || [];
    state.totalPages = result.totalPages || 1;

    if (!products.length) {
      noResults.style.display = "block";
      grid.innerHTML = "";
      UI.hideLoader();
      return;
    }

    noResults.style.display = "none";
    grid.innerHTML = products.map(productCardTemplate).join("");
    UI.bindImageFallbacks(grid);
    bindProductActions(products);
    renderPagination();
    buildActiveFilterBadges(state, badgeContainer);
    UI.initRevealObserver();
    UI.hideLoader();
  }

  function renderPagination() {
    pagination.innerHTML = "";
    const prev = document.createElement("button");
    prev.className = "btn btn-secondary";
    prev.textContent = "Previous";
    prev.disabled = state.page === 0;
    prev.addEventListener("click", () => {
      state.page = Math.max(0, state.page - 1);
      fetchAndRender();
    });

    const next = document.createElement("button");
    next.className = "btn btn-secondary";
    next.textContent = "Next";
    next.disabled = state.page >= state.totalPages - 1;
    next.addEventListener("click", () => {
      state.page = Math.min(state.totalPages - 1, state.page + 1);
      fetchAndRender();
    });

    const label = document.createElement("span");
    label.className = "text-secondary";
    label.style.padding = "0 .6rem";
    label.textContent = `Page ${state.page + 1} of ${state.totalPages}`;

    pagination.append(prev, label, next);
  }

  function bindProductActions(products) {
    grid.querySelectorAll("[data-action='cart']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const productId = Number(btn.closest("[data-product-id]").dataset.productId);
        const product = products.find((entry) => entry.id === productId);
        if (product) {
          cart.addItem(product, 1);
          UI.showToast("Added to cart");
        }
      });
    });

    grid.querySelectorAll("[data-action='wish']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const productId = Number(btn.closest("[data-product-id]").dataset.productId);
        const product = products.find((entry) => entry.id === productId);
        if (product) {
          wishlist.toggle(product);
          btn.textContent = wishlist.has(productId) ? "Saved" : "Wishlist";
          UI.showToast(wishlist.has(productId) ? "Added to wishlist" : "Removed from wishlist");
        }
      });
    });
  }

  form?.addEventListener("change", () => {
    state.filters.category = [...form.querySelectorAll("[name='category']:checked")].map((item) => item.value);
    state.filters.availableOnly = availableOnly.checked;
    state.filters.minRating = rating.value ? Number(rating.value) : null;
    state.filters.minPrice = minPrice.value ? Number(minPrice.value) : null;
    state.filters.maxPrice = maxPrice.value ? Number(maxPrice.value) : null;
    state.filters.sortBy = sort.value;
    state.page = 0;
    if (isMobileFiltersView()) {
      setFiltersOpen(false);
    }
    fetchAndRender();
  });

  search?.addEventListener("input", Utils.debounce(() => {
    state.filters.search = search.value.trim();
    state.page = 0;
    localStorage.setItem("glowlogics_search", state.filters.search);
    if (isMobileFiltersView()) {
      setFiltersOpen(false);
    }
    fetchAndRender();
  }, 240));

  document.querySelector("#clearFilters")?.addEventListener("click", () => {
    form.reset();
    search.value = "";
    state.filters = structuredClone(DEFAULT_STATE.filters);
    state.page = 0;
    if (isMobileFiltersView()) {
      setFiltersOpen(false);
    }
    fetchAndRender();
  });

  const persisted = localStorage.getItem("glowlogics_search");
  if (persisted) {
    state.filters.search = persisted;
    search.value = persisted;
  }

  fetchAndRender();
}

export async function initHomeFeatured() {
  const container = document.querySelector("#featuredProducts");
  if (!container) {
    return;
  }

  const result = await api.getProducts({ sortBy: "newest" }, 0, 8);
  const products = result.content || [];
  container.innerHTML = products.map(productCardTemplate).join("");
  UI.bindImageFallbacks(container);

  container.querySelectorAll("[data-action='cart']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const article = btn.closest("[data-product-id]");
      const productId = Number(article.dataset.productId);
      const product = products.find((item) => item.id === productId);
      if (product) {
        cart.addItem(product, 1);
        UI.showToast("Item added to cart");
      }
    });
  });

  container.querySelectorAll("[data-action='wish']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const article = btn.closest("[data-product-id]");
      const productId = Number(article.dataset.productId);
      const product = products.find((item) => item.id === productId);
      if (product) {
        wishlist.toggle(product);
        UI.showToast(wishlist.has(productId) ? "Saved to wishlist" : "Removed from wishlist");
      }
    });
  });

  const rail = document.querySelector("#featuredRail");
  if (rail) {
    setInterval(() => {
      rail.scrollBy({ left: 260, behavior: "smooth" });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12) {
        rail.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 3000);
  }

  UI.initRevealObserver();
}

export async function initProductDetailPage() {
  const page = document.querySelector('[data-page="product-detail"]');
  if (!page) {
    return;
  }

  const params = Utils.queryParams();
  const id = Number(params.get("id") || 1);
  const product = await api.getProductById(id);

  if (!product) {
    const shell = document.querySelector("#productDetailShell");
    UI.emptyState(shell, "Product not found", "Try browsing all products", "Go to products", "products.html");
    return;
  }

  const shell = document.querySelector("#productDetailShell");
  const galleryImages = buildProductGalleryImages(product);
  const firstGalleryImage = galleryImages[0] || { src: "", fallbacks: [] };
  const safeProductName = Utils.sanitize(product.name);
  shell.innerHTML = `
    <section class="grid-2">
      <article class="card glass reveal product-gallery-card">
        <div class="detail-gallery">
          <button class="gallery-nav gallery-nav-left" id="galleryPrev" type="button" aria-label="Show previous image">&#10094;</button>
          <img id="detailMainImage" class="detail-main-image" src="${Utils.sanitize(firstGalleryImage.src)}" data-fallbacks="${Utils.sanitize(encodeFallbacks(firstGalleryImage.fallbacks))}" alt="${safeProductName} image 1" />
          <button class="gallery-nav gallery-nav-right" id="galleryNext" type="button" aria-label="Show next image">&#10095;</button>
        </div>
        <div class="detail-thumb-row" id="detailThumbs">
          ${galleryImages
            .map(
              (image, index) => `
                <button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-image-index="${index}" aria-label="View ${safeProductName} image ${index + 1}">
                  <img loading="lazy" src="${Utils.sanitize(image.src)}" data-fallbacks="${Utils.sanitize(encodeFallbacks(image.fallbacks))}" alt="${safeProductName} thumbnail ${index + 1}" />
                </button>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="card glass reveal">
        <div class="badge badge-cyan">${Utils.sanitize(product.category)}</div>
        <h1 style="margin:.6rem 0">${safeProductName}</h1>
        <div>${UI.renderStars(product.rating)} <span class="text-secondary">${product.reviewCount} reviews</span></div>
        <div style="margin:1rem 0;display:flex;gap:.6rem;align-items:center">
          <strong style="font-size:1.6rem">${Utils.currency(product.discountPrice ?? product.price)}</strong>
          ${product.discountPrice ? `<span class="old-price">${Utils.currency(product.price)}</span>` : ""}
        </div>
        <p class="text-secondary">${Utils.sanitize(product.description)}</p>
        <div style="display:flex;gap:.6rem;align-items:center;margin:.9rem 0">
          <button class="btn btn-secondary" id="qtyMinus">-</button>
          <input id="detailQty" class="form-control" type="number" value="1" min="1" style="max-width:80px;text-align:center" />
          <button class="btn btn-secondary" id="qtyPlus">+</button>
        </div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap">
          <button class="btn btn-primary" id="detailAddCart">Add to Cart</button>
          <button class="btn btn-secondary" id="detailWishlist">${wishlist.has(product.id) ? "Saved" : "Add to Wishlist"}</button>
          <a class="btn btn-accent" id="detailBuyNow" href="checkout.html">Buy Now</a>
        </div>
      </article>
    </section>
    <section class="section card glass reveal">
      <h3>Product Details</h3>
      <p class="text-secondary">Designed for premium experiences with refined materials and future-facing finishes.</p>
      <table class="table">
        <tbody>
          <tr><td>Stock</td><td>${product.stock}</td></tr>
          <tr><td>Category</td><td>${Utils.sanitize(product.category)}</td></tr>
          <tr><td>Shipping</td><td>2-5 business days</td></tr>
          <tr><td>Returns</td><td>30-day free return policy</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section">
      <div class="section-head"><h3>Related Products</h3><a href="products.html" class="text-secondary">View more</a></div>
      <div id="relatedProducts" class="product-grid"></div>
    </section>
  `;
  UI.bindImageFallbacks(shell);

  const mainImage = document.querySelector("#detailMainImage");
  const thumbButtons = [...document.querySelectorAll("#detailThumbs .detail-thumb")];
  let currentImageIndex = 0;

  function syncActiveImage(nextIndex) {
    const imageCount = galleryImages.length;
    currentImageIndex = (nextIndex + imageCount) % imageCount;
    const activeImage = galleryImages[currentImageIndex];

    if (mainImage) {
      mainImage.src = activeImage.src;
      mainImage.dataset.fallbacks = encodeFallbacks(activeImage.fallbacks);
      mainImage.dataset.fallbackIndex = "0";
      mainImage.alt = `${safeProductName} image ${currentImageIndex + 1}`;
    }

    thumbButtons.forEach((thumb, index) => {
      thumb.classList.toggle("active", index === currentImageIndex);
      thumb.setAttribute("aria-current", index === currentImageIndex ? "true" : "false");
    });
  }

  document.querySelector("#galleryPrev")?.addEventListener("click", () => {
    syncActiveImage(currentImageIndex - 1);
  });

  document.querySelector("#galleryNext")?.addEventListener("click", () => {
    syncActiveImage(currentImageIndex + 1);
  });

  thumbButtons.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      syncActiveImage(Number(thumb.dataset.imageIndex));
    });
  });

  const qtyInput = document.querySelector("#detailQty");
  document.querySelector("#qtyMinus")?.addEventListener("click", () => {
    qtyInput.value = String(Math.max(1, Number(qtyInput.value) - 1));
  });
  document.querySelector("#qtyPlus")?.addEventListener("click", () => {
    qtyInput.value = String(Number(qtyInput.value) + 1);
  });

  document.querySelector("#detailAddCart")?.addEventListener("click", () => {
    const quantity = Math.max(1, Number(qtyInput.value || "1"));
    cart.addItem(product, quantity);
    UI.showToast("Added to cart");
  });

  document.querySelector("#detailWishlist")?.addEventListener("click", (event) => {
    wishlist.toggle(product);
    event.currentTarget.textContent = wishlist.has(product.id) ? "Saved" : "Add to Wishlist";
    UI.showToast(wishlist.has(product.id) ? "Added to wishlist" : "Removed from wishlist");
  });

  document.querySelector("#detailBuyNow")?.addEventListener("click", () => {
    const quantity = Math.max(1, Number(qtyInput.value || "1"));
    cart.addItem(product, quantity);
  });

  const related = await api.getProducts({ category: [product.category] }, 0, 4);
  const relatedContainer = document.querySelector("#relatedProducts");
  relatedContainer.innerHTML = (related.content || []).map(productCardTemplate).join("");
  UI.bindImageFallbacks(relatedContainer);

  relatedContainer.querySelectorAll("[data-action='cart']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.closest("[data-product-id]");
      const relatedProduct = (related.content || []).find((item) => item.id === Number(parent.dataset.productId));
      if (relatedProduct) {
        cart.addItem(relatedProduct, 1);
        UI.showToast("Added to cart");
      }
    });
  });

  relatedContainer.querySelectorAll("[data-action='wish']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.closest("[data-product-id]");
      const relatedProduct = (related.content || []).find((item) => item.id === Number(parent.dataset.productId));
      if (relatedProduct) {
        wishlist.toggle(relatedProduct);
        UI.showToast(wishlist.has(relatedProduct.id) ? "Saved to wishlist" : "Removed from wishlist");
      }
    });
  });

  UI.initRevealObserver();
}
