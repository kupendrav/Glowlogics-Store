import { api } from "./api.js";
import { UI } from "./ui.js";
import { Utils } from "./utils.js";

function encodeFallbacks(fallbackUrls = []) {
  if (!Array.isArray(fallbackUrls) || !fallbackUrls.length) {
    return "";
  }
  return fallbackUrls.map((url) => encodeURIComponent(String(url))).join(",");
}

export function initGlobalSearch() {
  const searchInputs = document.querySelectorAll("[data-global-search]");
  if (!searchInputs.length) {
    return;
  }

  searchInputs.forEach((input) => {
    const wrapper = input.closest(".search-wrap") || input.parentElement;
    const panel = document.createElement("div");
    panel.className = "card glass";
    panel.style.position = "absolute";
    panel.style.top = "calc(100% + 6px)";
    panel.style.left = "0";
    panel.style.width = "100%";
    panel.style.display = "none";
    panel.style.zIndex = "70";
    wrapper.style.position = "relative";
    wrapper.appendChild(panel);

    input.addEventListener(
      "input",
      Utils.debounce(async () => {
        const text = input.value.trim();
        if (!text) {
          panel.style.display = "none";
          panel.innerHTML = "";
          return;
        }

        const results = await api.searchProducts(text);
        if (!results.length) {
          panel.innerHTML = '<p class="text-secondary" style="margin:0">No matching products</p>';
          panel.style.display = "block";
          return;
        }

        panel.innerHTML = results
          .slice(0, 6)
          .map(
            (item) => `
            <a href="${Utils.appUrl(`product-detail.html?id=${item.id}`)}" style="display:flex;align-items:center;gap:.6rem;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.08)">
              <img src="${Utils.sanitize(item.imageUrl || "")}" data-fallbacks="${Utils.sanitize(encodeFallbacks(item.imageFallbackGroups?.[0] || []))}" alt="${Utils.sanitize(item.name)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover" />
              <span>${Utils.sanitize(item.name)}</span>
            </a>
          `
          )
          .join("");
        UI.bindImageFallbacks(panel);
        panel.style.display = "block";
      }, 260)
    );

    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) {
        panel.style.display = "none";
      }
    });
  });
}
