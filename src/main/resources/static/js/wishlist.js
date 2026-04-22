import { Storage } from "./storage.js";
import { cart } from "./cart.js";
import { UI } from "./ui.js";
import { Utils } from "./utils.js";

class WishlistManager {
  constructor() {
    this.items = Storage.getJSON("wishlist", []);
    window.addEventListener("storage", (event) => {
      if (event.key === "glowlogics_wishlist") {
        this.items = Storage.getJSON("wishlist", []);
        this.dispatch();
      }
    });
  }

  getAll() {
    return [...this.items];
  }

  has(productId) {
    return this.items.some((item) => item.id === productId);
  }

  add(product) {
    if (this.has(product.id)) {
      return;
    }
    this.items.push({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.discountPrice ?? product.price,
      imageUrl: product.imageUrl,
      addedAt: new Date().toISOString()
    });
    this.persist();
  }

  remove(productId) {
    this.items = this.items.filter((item) => item.id !== productId);
    this.persist();
  }

  toggle(product) {
    if (this.has(product.id)) {
      this.remove(product.id);
    } else {
      this.add(product);
    }
  }

  persist() {
    Storage.setJSON("wishlist", this.items);
    this.dispatch();
  }

  dispatch() {
    window.dispatchEvent(
      new CustomEvent("wishlist:updated", {
        detail: {
          items: this.getAll(),
          count: this.items.length
        }
      })
    );
  }
}

export const wishlist = new WishlistManager();

export function initWishlistPage() {
  const page = document.querySelector('[data-page="wishlist"]');
  if (!page) {
    return;
  }

  const grid = document.querySelector("#wishlistGrid");
  const emptyState = document.querySelector("#emptyWishlistState");
  const sortSelect = document.querySelector("#wishlistSort");

  function sortedItems() {
    const items = wishlist.getAll();
    const mode = sortSelect?.value || "newest";

    if (mode === "priceAsc") {
      items.sort((a, b) => a.price - b.price);
    } else if (mode === "priceDesc") {
      items.sort((a, b) => b.price - a.price);
    } else {
      items.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }
    return items;
  }

  function render() {
    const items = sortedItems();
    if (!items.length) {
      grid.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    grid.innerHTML = items
      .map(
        (item) => `
        <article class="card product-card" data-id="${item.id}">
          <div class="thumb-wrap">
            <img src="${Utils.sanitize(item.imageUrl || "")}" alt="${Utils.sanitize(item.name)}" loading="lazy" />
          </div>
          <div>
            <span class="badge badge-cyan">${Utils.sanitize(item.category)}</span>
            <h3>${Utils.sanitize(item.name)}</h3>
            <p><strong>${Utils.currency(item.price)}</strong></p>
            <p class="text-secondary" style="font-size:.8rem">Added ${Utils.relativeTime(item.addedAt)}</p>
          </div>
          <div style="display:grid;gap:.5rem">
            <button class="btn btn-primary" data-action="add-cart">Move to Cart</button>
            <button class="btn btn-secondary" data-action="remove">Remove</button>
          </div>
        </article>
      `
      )
      .join("");

    grid.querySelectorAll("[data-action='add-cart']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.closest("[data-id]").dataset.id);
        const product = items.find((entry) => entry.id === id);
        if (!product) {
          return;
        }
        cart.addItem(product, 1);
        wishlist.remove(id);
        UI.showToast("Moved to cart");
      });
    });

    grid.querySelectorAll("[data-action='remove']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.closest("[data-id]").dataset.id);
        wishlist.remove(id);
        UI.showToast("Removed from wishlist");
      });
    });
  }

  sortSelect?.addEventListener("change", render);
  document.querySelector("#shareWishlistBtn")?.addEventListener("click", async () => {
    const text = `${window.location.origin}/wishlist.html`;
    try {
      await navigator.clipboard.writeText(text);
      UI.showToast("Wishlist link copied");
    } catch (error) {
      UI.showToast("Could not copy link", "error");
    }
  });

  render();
  window.addEventListener("wishlist:updated", render);
}
