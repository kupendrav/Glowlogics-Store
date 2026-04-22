const KEYS = {
  cart: "glowlogics_cart",
  wishlist: "glowlogics_wishlist",
  user: "glowlogics_user",
  token: "glowlogics_auth_token",
  preferences: "glowlogics_preferences",
  checkoutDraft: "glowlogics_checkout_draft",
  productImageCache: "glowlogics_product_image_cache"
};

class StorageManager {
  getKey(name) {
    return KEYS[name] || name;
  }

  getJSON(name, fallback = null) {
    const key = this.getKey(name);
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  setJSON(name, value) {
    const key = this.getKey(name);
    localStorage.setItem(key, JSON.stringify(value));
  }

  get(name, fallback = null) {
    const key = this.getKey(name);
    const value = localStorage.getItem(key);
    return value ?? fallback;
  }

  set(name, value) {
    const key = this.getKey(name);
    localStorage.setItem(key, value);
  }

  remove(name) {
    const key = this.getKey(name);
    localStorage.removeItem(key);
  }

  clearSessionData() {
    localStorage.removeItem(KEYS.cart);
    localStorage.removeItem(KEYS.wishlist);
    sessionStorage.removeItem(KEYS.checkoutDraft);
  }

  saveDraft(name, value) {
    sessionStorage.setItem(this.getKey(name), JSON.stringify(value));
  }

  loadDraft(name, fallback = null) {
    try {
      const value = sessionStorage.getItem(this.getKey(name));
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }
}

export const Storage = new StorageManager();
export { KEYS };
