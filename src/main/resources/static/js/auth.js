import { api } from "./api.js";
import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Utils } from "./utils.js";

class AuthManager {
  constructor() {
    this.user = Storage.getJSON("user", null);
  }

  get token() {
    return Storage.get("token", "");
  }

  isLoggedIn() {
    return Boolean(this.user && this.token);
  }

  isAdmin() {
    return Boolean(this.user?.isAdmin || this.user?.admin);
  }

  async login(email, password) {
    const response = await api.login({ email, password });
    this.persistSession(response);
    UI.showToast(`Welcome back, ${response.user.fullName}`);
    return response.user;
  }

  async signup(payload) {
    const response = await api.signup(payload);
    this.persistSession(response);
    UI.showToast("Account created successfully");
    return response.user;
  }

  persistSession(response) {
    this.user = response.user;
    Storage.setJSON("user", response.user);
    Storage.set("token", response.token);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: response.user }));
  }

  logout() {
    this.user = null;
    Storage.remove("user");
    Storage.remove("token");
    Storage.remove("cart");
    Storage.remove("wishlist");
    UI.showToast("Signed out", "success");
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: null }));
  }
}

export const auth = new AuthManager();

export async function initProfilePage() {
  const page = document.querySelector('[data-page="profile"]');
  if (!page) {
    return;
  }

  if (!auth.isLoggedIn()) {
    UI.showToast("Please log in to view profile", "error");
    setTimeout(() => {
      window.location.href = Utils.appUrl("auth/login.html");
    }, 500);
    return;
  }

  const fullNameInput = document.querySelector("#profileName");
  const emailInput = document.querySelector("#profileEmail");
  const phoneInput = document.querySelector("#profilePhone");
  const form = document.querySelector("#profileForm");
  const orderContainer = document.querySelector("#profileOrders");
  const adminShortcut = document.querySelector("#profileAdminLink");

  fullNameInput.value = auth.user.fullName || "";
  emailInput.value = auth.user.email || "";
  phoneInput.value = auth.user.phone || "";

  if (adminShortcut && auth.isAdmin()) {
    adminShortcut.style.display = "inline-flex";
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      fullName: fullNameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim()
    };

    auth.user = { ...auth.user, ...payload };
    Storage.setJSON("user", auth.user);

    try {
      await api.updateProfile(payload);
    } catch (error) {
      // The local profile remains updated when backend is unavailable.
    }
    UI.showToast("Profile saved");
  });

  let orders = [];
  try {
    orders = await api.getOrders();
  } catch (error) {
    orders = [];
  }

  if (!orders.length) {
    orderContainer.innerHTML = "<p class='text-secondary'>No orders yet. Start shopping to see your order history.</p>";
    return;
  }

  orderContainer.innerHTML = `
    <table class="table">
      <thead><tr><th>Order ID</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${orders
          .slice(0, 10)
          .map(
            (order) => `
          <tr>
            <td>${order.id}</td>
            <td>${Utils.date(order.createdAt)}</td>
            <td>${Utils.currency(order.totalAmount ?? 0)}</td>
            <td>${order.status || "PENDING"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function initForgotPasswordPage() {
  const form = document.querySelector("#forgotPasswordForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    UI.showToast("Password reset link sent (simulation)");
    form.reset();
  });
}
