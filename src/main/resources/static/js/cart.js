import { Storage } from "./storage.js";
import { Utils } from "./utils.js";

class CartManager {
  constructor() {
    this.items = Storage.getJSON("cart", []);
    window.addEventListener("storage", (event) => {
      if (event.key === "glowlogics_cart") {
        this.items = Storage.getJSON("cart", []);
        this.dispatch();
      }
    });
  }

  getAll() {
    return [...this.items];
  }

  addItem(product, quantity = 1) {
    const index = this.items.findIndex((item) => item.id === product.id);
    if (index >= 0) {
      this.items[index].quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.discountPrice ?? product.price,
        quantity,
        category: product.category
      });
    }
    this.persist();
  }

  updateQuantity(productId, quantity) {
    const item = this.items.find((entry) => entry.id === productId);
    if (!item) {
      return;
    }
    item.quantity = Math.max(1, quantity);
    this.persist();
  }

  removeItem(productId) {
    this.items = this.items.filter((entry) => entry.id !== productId);
    this.persist();
  }

  clear() {
    this.items = [];
    this.persist();
  }

  subtotal() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  tax() {
    return this.subtotal() * 0.08;
  }

  shipping() {
    return this.subtotal() > 150 ? 0 : this.items.length ? 12 : 0;
  }

  total() {
    return this.subtotal() + this.tax() + this.shipping();
  }

  itemCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  persist() {
    Storage.setJSON("cart", this.items);
    this.dispatch();
  }

  dispatch() {
    window.dispatchEvent(
      new CustomEvent("cart:updated", {
        detail: {
          items: this.getAll(),
          count: this.itemCount(),
          total: this.total()
        }
      })
    );
  }
}

export const cart = new CartManager();

export function initCartPage() {
  const page = document.querySelector('[data-page="cart"]');
  if (!page) {
    return;
  }

  const tbody = document.querySelector("#cartItemsBody");
  const subtotal = document.querySelector("#cartSubtotal");
  const shipping = document.querySelector("#cartShipping");
  const tax = document.querySelector("#cartTax");
  const total = document.querySelector("#cartTotal");
  const emptyState = document.querySelector("#emptyCartState");
  const tableWrap = document.querySelector("#cartTableWrap table");

  function render() {
    const items = cart.getAll();

    subtotal.textContent = Utils.currency(cart.subtotal());
    shipping.textContent = Utils.currency(cart.shipping());
    tax.textContent = Utils.currency(cart.tax());
    total.textContent = Utils.currency(cart.total());

    if (!items.length) {
      tbody.innerHTML = "";
      emptyState.style.display = "block";
      tableWrap.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    tableWrap.style.display = "table";
    tbody.innerHTML = items
      .map(
        (item) => `
        <tr data-id="${item.id}">
          <td>
            <div style="display:flex;gap:.6rem;align-items:center">
              <img src="${Utils.sanitize(item.imageUrl || "")}" alt="${Utils.sanitize(item.name)}" style="width:56px;height:56px;border-radius:8px;object-fit:cover" />
              <div>
                <a href="${Utils.appUrl(`product-detail.html?id=${item.id}`)}">${Utils.sanitize(item.name)}</a>
                <div class="text-secondary" style="font-size:.8rem">${Utils.sanitize(item.category)}</div>
              </div>
            </div>
          </td>
          <td>${Utils.currency(item.price)}</td>
          <td>
            <div style="display:flex;gap:.4rem;align-items:center">
              <button class="btn btn-secondary" data-qty="minus">-</button>
              <span>${item.quantity}</span>
              <button class="btn btn-secondary" data-qty="plus">+</button>
            </div>
          </td>
          <td>${Utils.currency(item.price * item.quantity)}</td>
          <td><button class="btn btn-secondary" data-remove="true">Remove</button></td>
        </tr>
      `
      )
      .join("");

    tbody.querySelectorAll("[data-qty='minus']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.closest("tr").dataset.id);
        const target = cart.getAll().find((entry) => entry.id === id);
        if (target) {
          cart.updateQuantity(id, Math.max(1, target.quantity - 1));
        }
      });
    });

    tbody.querySelectorAll("[data-qty='plus']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.closest("tr").dataset.id);
        const target = cart.getAll().find((entry) => entry.id === id);
        if (target) {
          cart.updateQuantity(id, target.quantity + 1);
        }
      });
    });

    tbody.querySelectorAll("[data-remove='true']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.closest("tr").dataset.id);
        cart.removeItem(id);
      });
    });
  }

  render();
  window.addEventListener("cart:updated", render);
}
