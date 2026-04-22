export const Utils = {
  currency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value) || 0);
  },

  date(value) {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  },

  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  },

  queryParams() {
    return new URLSearchParams(window.location.search);
  },

  appUrl(path = "") {
    const normalizedPath = String(path).replace(/^\/+/, "");
    const appRoot = new URL("../", import.meta.url);
    return new URL(normalizedPath, appRoot).toString();
  },

  clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  },

  slugify(text = "") {
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  },

  relativeTime(dateString) {
    const now = Date.now();
    const target = new Date(dateString).getTime();
    if (Number.isNaN(target)) {
      return "just now";
    }

    const diff = Math.max(0, now - target);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < hour) {
      return `${Math.max(1, Math.floor(diff / minute))}m ago`;
    }
    if (diff < day) {
      return `${Math.floor(diff / hour)}h ago`;
    }
    return `${Math.floor(diff / day)}d ago`;
  },

  sanitize(text = "") {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  luhnCheck(value = "") {
    const digits = value.replace(/\D/g, "");
    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return digits.length >= 12 && sum % 10 === 0;
  }
};
