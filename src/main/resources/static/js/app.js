import { cart } from "./cart.js";
import { initCartPage } from "./cart.js";
import { wishlist, initWishlistPage } from "./wishlist.js";
import { auth, initProfilePage, initForgotPasswordPage } from "./auth.js";
import { UI } from "./ui.js";
import { initProductsPage, initHomeFeatured, initProductDetailPage } from "./products.js";
import { initGlobalSearch } from "./search.js";
import { initCheckoutPage } from "./checkout.js";
import { initAdminPages } from "./admin.js";
import { Utils } from "./utils.js";

function applyThemePreference() {
  if (document.querySelector("[data-admin-page]")) {
    document.documentElement.setAttribute("data-theme", "light");
    return;
  }

  const preferredTheme = localStorage.getItem("glowlogics_theme");
  const activeTheme = preferredTheme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", activeTheme);
}

function applyFavicon() {
  const faviconPath = Utils.appUrl("images/icons/logo.png");
  let favicon = document.querySelector("link[rel='icon']");

  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.append(favicon);
  }

  favicon.type = "image/png";
  favicon.href = faviconPath;
}

function bindHeader() {
  const cartCounter = document.querySelector(".cart-badge");
  const wishlistCounter = document.querySelector(".wishlist-badge");

  if (cartCounter) {
    UI.updateCountBadge(".cart-badge", cart.itemCount());
  }
  if (wishlistCounter) {
    UI.updateCountBadge(".wishlist-badge", wishlist.getAll().length);
  }

  const authName = document.querySelector("[data-auth-name]");
  if (authName) {
    authName.textContent = auth.user ? auth.user.fullName : "Guest";
  }

  const navLinks = document.querySelector(".nav-links");
  const isAdminPage = Boolean(document.querySelector("[data-admin-page]"));
  if (navLinks) {
    const existingAdminLink = navLinks.querySelector("[data-role-link='admin']");
    const hiddenCustomerLinks = ["products.html", "wishlist.html", "cart.html"];

    if (auth.isAdmin()) {
      navLinks.querySelectorAll("a").forEach((link) => {
        const href = String(link.getAttribute("href") || "").toLowerCase();
        if (hiddenCustomerLinks.some((blockedPath) => href.includes(blockedPath))) {
          link.remove();
        }
      });
    }

    if (auth.isAdmin() && !isAdminPage && !existingAdminLink) {
      const adminLink = document.createElement("a");
      adminLink.href = Utils.appUrl("admin/dashboard.html");
      adminLink.dataset.roleLink = "admin";
      adminLink.textContent = "Admin Console";
      navLinks.append(adminLink);
    }

    if (!auth.isAdmin() && existingAdminLink) {
      existingAdminLink.remove();
    }
  }

  const logoutButtons = document.querySelectorAll("[data-action='logout']");
  logoutButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      auth.logout();
      window.location.href = Utils.appUrl("index.html");
    });
  });
}

function enforceAdminPageRestrictions() {
  if (!auth.isAdmin() || Boolean(document.querySelector("[data-admin-page]"))) {
    return false;
  }

  const currentPage = String(document.body?.dataset?.page || "").toLowerCase();
  const blockedPages = new Set(["products", "wishlist", "cart"]);
  if (!blockedPages.has(currentPage)) {
    return false;
  }

  UI.showToast("Admin users use the Admin Console for catalog and orders.", "error");
  setTimeout(() => {
    window.location.href = Utils.appUrl("admin/dashboard.html");
  }, 360);
  return true;
}

function bindAuthForms() {
  const loginForm = document.querySelector("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = loginForm.elements.email.value.trim();
      const password = loginForm.elements.password.value;
      try {
        await auth.login(email, password);
        window.location.href = auth.isAdmin() ? Utils.appUrl("admin/dashboard.html") : Utils.appUrl("index.html");
      } catch (error) {
        UI.showToast(error.message, "error");
      }
    });
  }

  const signupForm = document.querySelector("#signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        fullName: signupForm.elements.fullName.value.trim(),
        email: signupForm.elements.email.value.trim(),
        password: signupForm.elements.password.value,
        phone: signupForm.elements.phone.value.trim()
      };

      if (signupForm.elements.password.value !== signupForm.elements.confirmPassword.value) {
        UI.showToast("Passwords do not match", "error");
        return;
      }

      if (!signupForm.elements.terms.checked) {
        UI.showToast("Accept terms to continue", "error");
        return;
      }

      try {
        await auth.signup(payload);
        window.location.href = Utils.appUrl("index.html");
      } catch (error) {
        UI.showToast(error.message, "error");
      }
    });
  }

  const passwordInput = document.querySelector("#signupPassword");
  const strengthBar = document.querySelector("#passwordStrengthBar");
  const strengthText = document.querySelector("#passwordStrengthText");

  if (passwordInput && strengthBar && strengthText) {
    passwordInput.addEventListener("input", () => {
      const value = passwordInput.value;
      let score = 0;
      if (value.length >= 8) score += 1;
      if (/[A-Z]/.test(value)) score += 1;
      if (/[0-9]/.test(value)) score += 1;
      if (/[^a-zA-Z0-9]/.test(value)) score += 1;

      const width = `${score * 25}%`;
      strengthBar.style.width = width;

      if (score <= 1) {
        strengthBar.style.background = "#e63946";
        strengthText.textContent = "Weak";
      } else if (score <= 3) {
        strengthBar.style.background = "#ff8c42";
        strengthText.textContent = "Medium";
      } else {
        strengthBar.style.background = "#00d66e";
        strengthText.textContent = "Strong";
      }
    });
  }
}

function initCategoryTiles() {
  document.querySelectorAll("[data-category-link]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const category = tile.dataset.categoryLink;
      localStorage.setItem("glowlogics_search", category);
      window.location.href = Utils.appUrl("products.html");
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  applyThemePreference();
  applyFavicon();
  bindHeader();
  if (enforceAdminPageRestrictions()) {
    return;
  }
  bindAuthForms();
  initGlobalSearch();
  initCategoryTiles();
  UI.initRevealObserver();
  UI.bindImageFallbacks(document);

  await initHomeFeatured();
  await initProductsPage();
  await initProductDetailPage();
  initCheckoutPage();
  initCartPage();
  initWishlistPage();
  initForgotPasswordPage();
  await initProfilePage();
  await initAdminPages();

  window.addEventListener("cart:updated", (event) => {
    UI.updateCountBadge(".cart-badge", event.detail.count);
  });

  window.addEventListener("wishlist:updated", (event) => {
    UI.updateCountBadge(".wishlist-badge", event.detail.count);
  });

  window.addEventListener("auth:changed", () => {
    bindHeader();
  });
});
