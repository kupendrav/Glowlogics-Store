import { Utils } from "./utils.js";

class UIManager {
  constructor() {
    this.toastStack = null;
  }

  ensureToastStack() {
    if (this.toastStack) {
      return this.toastStack;
    }
    const existing = document.querySelector(".toast-stack");
    if (existing) {
      this.toastStack = existing;
      return existing;
    }
    const stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
    this.toastStack = stack;
    return stack;
  }

  showToast(message, type = "success", duration = 2800) {
    const stack = this.ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    stack.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  showLoader(message = "Loading...") {
    if (document.querySelector(".global-loader")) {
      return;
    }
    const loader = document.createElement("div");
    loader.className = "global-loader";
    loader.innerHTML = `
      <div class="glass card" style="position:fixed;inset:auto 1rem 1rem auto;z-index:150;display:flex;gap:.6rem;align-items:center;">
        <span class="loading-shimmer" style="width:26px;height:26px;border-radius:50%;display:inline-block;"></span>
        <span>${Utils.sanitize(message)}</span>
      </div>
    `;
    document.body.appendChild(loader);
  }

  hideLoader() {
    const loader = document.querySelector(".global-loader");
    if (loader) {
      loader.remove();
    }
  }

  updateCountBadge(selector, value) {
    const badge = document.querySelector(selector);
    if (!badge) {
      return;
    }
    badge.textContent = String(value);
    badge.style.display = value > 0 ? "inline-grid" : "none";
  }

  renderStars(rating = 0) {
    const rounded = Math.round(rating * 2) / 2;
    const stars = [];
    for (let i = 1; i <= 5; i += 1) {
      if (i <= Math.floor(rounded)) {
        stars.push("★");
      } else if (i - rounded === 0.5) {
        stars.push("☆");
      } else {
        stars.push("✩");
      }
    }
    return `<span style="color:#ffd700">${stars.join("")}</span>`;
  }

  initRevealObserver() {
    const revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  bindImageFallbacks(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    const images = scope.querySelectorAll("img[data-fallbacks]");
    if (!images.length) {
      return;
    }

    images.forEach((image) => {
      if (image.dataset.fallbackBound === "true") {
        return;
      }

      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => {
        const fallbackValues = (image.dataset.fallbacks || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            try {
              return decodeURIComponent(item);
            } catch {
              return item;
            }
          });

        const fallbackIndex = Number(image.dataset.fallbackIndex || "0");
        if (fallbackIndex >= fallbackValues.length) {
          return;
        }

        image.dataset.fallbackIndex = String(fallbackIndex + 1);
        image.src = fallbackValues[fallbackIndex];
      });
    });
  }

  emptyState(container, title, subtitle, actionText, actionHref) {
    container.innerHTML = `
      <div class="card glass reveal" style="text-align:center;padding:2rem;">
        <h3>${Utils.sanitize(title)}</h3>
        <p class="text-secondary">${Utils.sanitize(subtitle)}</p>
        ${
          actionText
            ? `<a class="btn btn-primary" href="${actionHref}">${Utils.sanitize(actionText)}</a>`
            : ""
        }
      </div>
    `;
  }
}

export const UI = new UIManager();
