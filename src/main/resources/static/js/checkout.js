import { cart } from "./cart.js";
import { UI } from "./ui.js";
import { paymentProcessor } from "./payment.js";
import { api } from "./api.js";
import { Utils } from "./utils.js";
import { Storage } from "./storage.js";

export function initCheckoutPage() {
  const page = document.querySelector('[data-page="checkout"]');
  if (!page) {
    return;
  }

  let currentStep = 1;
  const totalSteps = 4;

  const summary = document.querySelector("#checkoutSummary");
  const stepElements = document.querySelectorAll(".step");
  const sectionElements = document.querySelectorAll("[data-step-panel]");
  const nextBtn = document.querySelector("#checkoutNext");
  const prevBtn = document.querySelector("#checkoutPrev");
  const placeBtn = document.querySelector("#placeOrder");
  const redirectHint = document.querySelector("#checkoutRedirectHint");
  let redirectTimeoutId = null;
  let redirectIntervalId = null;

  function clearRedirectTimer() {
    if (redirectTimeoutId) {
      window.clearTimeout(redirectTimeoutId);
      redirectTimeoutId = null;
    }
    if (redirectIntervalId) {
      window.clearInterval(redirectIntervalId);
      redirectIntervalId = null;
    }
  }

  function scheduleHomeRedirect(seconds = 5) {
    clearRedirectTimer();
    if (!redirectHint) {
      return;
    }

    let remaining = Number(seconds);
    redirectHint.textContent = `Redirecting to home in ${remaining}s...`;

    redirectIntervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        redirectHint.textContent = `Redirecting to home in ${remaining}s...`;
      }
    }, 1000);

    redirectTimeoutId = window.setTimeout(() => {
      window.location.href = Utils.appUrl("index.html");
    }, seconds * 1000);
  }

  function getCurrencyByCountry(country = "") {
    const normalized = String(country || "").trim().toLowerCase();
    if (normalized === "india") {
      return "INR";
    }
    if (normalized === "united kingdom") {
      return "GBP";
    }
    return "USD";
  }

  function buildPaymentPayload(shippingPayload) {
    const method = document.querySelector("#paymentMethod").value;
    const cardNumber = document.querySelector("#cardNumber").value;
    const cardDigits = String(cardNumber || "").replace(/\D/g, "");
    const cardLast4 = cardDigits.slice(-4);

    return {
      amount: Number(cart.total().toFixed(2)),
      currency: getCurrencyByCountry(shippingPayload.country),
      method,
      user: {
        full_name: shippingPayload.fullName,
        email: shippingPayload.email,
        phone: shippingPayload.phone
      },
      metadata: {
        source: "glowlogics-checkout",
        city: shippingPayload.city,
        country: shippingPayload.country
      },
      card_last4: cardLast4 || undefined
    };
  }

  function syncSummary() {
    const items = cart.getAll();
    if (!items.length) {
      summary.innerHTML = "<p class='text-secondary'>Cart is empty.</p>";
      return;
    }

    summary.innerHTML = `
      <div style="display:grid;gap:.5rem">
        ${items
          .map(
            (item) => `
          <div style="display:flex;justify-content:space-between;gap:.5rem">
            <span>${Utils.sanitize(item.name)} x ${item.quantity}</span>
            <strong>${Utils.currency(item.price * item.quantity)}</strong>
          </div>
        `
          )
          .join("")}
      </div>
      <hr style="border-color:rgba(255,255,255,.1);margin:1rem 0" />
      <p>Subtotal: <strong>${Utils.currency(cart.subtotal())}</strong></p>
      <p>Shipping: <strong>${Utils.currency(cart.shipping())}</strong></p>
      <p>Tax: <strong>${Utils.currency(cart.tax())}</strong></p>
      <p style="font-size:1.2rem">Total: <strong>${Utils.currency(cart.total())}</strong></p>
    `;
  }

  function setStep(step) {
    currentStep = Utils.clamp(step, 1, totalSteps);

    stepElements.forEach((item) => {
      item.classList.toggle("active", Number(item.dataset.step) === currentStep);
    });

    sectionElements.forEach((panel) => {
      panel.style.display = Number(panel.dataset.stepPanel) === currentStep ? "block" : "none";
    });

    if (currentStep === totalSteps) {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      placeBtn.style.display = "none";
      return;
    }

    prevBtn.style.display = currentStep === 1 ? "none" : "inline-flex";
    nextBtn.style.display = currentStep < totalSteps - 1 ? "inline-flex" : "none";
    placeBtn.style.display = currentStep === totalSteps - 1 ? "inline-flex" : "none";

    clearRedirectTimer();
    if (redirectHint) {
      redirectHint.textContent = "";
    }
  }

  function validateShipping() {
    const fields = document.querySelectorAll("#shippingForm [required]");
    let valid = true;
    fields.forEach((field) => {
      const value = field.value.trim();
      const error = field.closest("label")?.querySelector(".form-error");
      if (!value) {
        valid = false;
        if (error) error.textContent = "Required";
      } else if (field.name === "email" && !/^\S+@\S+\.\S+$/.test(value)) {
        valid = false;
        if (error) error.textContent = "Invalid email";
      } else if (field.name === "phone" && value.replace(/\D/g, "").length < 10) {
        valid = false;
        if (error) error.textContent = "Enter at least 10 digits";
      } else if (error) {
        error.textContent = "";
      }
    });
    return valid;
  }

  function validatePayment() {
    const method = document.querySelector("#paymentMethod").value;
    if (method !== "CARD") {
      document.querySelector("#cardError").textContent = "";
      document.querySelector("#expiryError").textContent = "";
      document.querySelector("#cvvError").textContent = "";
      return true;
    }

    const cardNumber = document.querySelector("#cardNumber").value;
    const expiry = document.querySelector("#cardExpiry").value;
    const cvv = document.querySelector("#cardCvv").value;

    const result = paymentProcessor.validateCard(cardNumber, expiry, cvv);

    document.querySelector("#cardError").textContent = result.cardValid ? "" : "Invalid card number";
    document.querySelector("#expiryError").textContent = result.expiryValid ? "" : "Invalid expiry";
    document.querySelector("#cvvError").textContent = result.cvvValid ? "" : "Invalid CVV";

    return result.valid;
  }

  async function finalizeOrder() {
    if (!cart.getAll().length) {
      UI.showToast("Your cart is empty", "error");
      return;
    }

    UI.showLoader("Processing payment");

    try {
      const shippingPayload = Object.fromEntries(new FormData(document.querySelector("#shippingForm")).entries());
      const paymentPayload = buildPaymentPayload(shippingPayload);

      const paymentResult = await paymentProcessor.processPayment(paymentPayload);
      const order = await api.createOrder({
        items: cart.getAll(),
        shippingAddress: shippingPayload,
        totalAmount: cart.total(),
        paymentMethod: paymentPayload.method,
        paymentId: paymentResult.paymentId,
        paymentStatus: paymentResult.status,
        paymentCurrency: paymentPayload.currency
      });

      cart.clear();
      Storage.remove("checkoutDraft");
      document.querySelector("#confirmationOrderId").textContent = order.id || `GLW-${Date.now()}`;
      setStep(4);
      scheduleHomeRedirect(5);
      UI.showToast("Order placed successfully", "success");
    } catch (error) {
      UI.showToast(`Payment failed: ${error.message}`, "error");
    } finally {
      UI.hideLoader();
    }
  }

  window.addEventListener("payment:webhook", (event) => {
    const eventType = event?.detail?.eventType;
    if (eventType === "payment.retry.scheduled") {
      UI.showToast("Payment failed, retrying...", "error");
    }
    if (eventType === "payment.succeeded") {
      UI.showToast("Payment confirmed", "success");
    }
  });

  nextBtn?.addEventListener("click", () => {
    if (currentStep === 1 && !validateShipping()) {
      UI.showToast("Please fix shipping form errors", "error");
      return;
    }

    if (currentStep === 2 && !validatePayment()) {
      UI.showToast("Please fix payment details", "error");
      return;
    }

    if (currentStep < 3) {
      setStep(currentStep + 1);
    }
  });

  prevBtn?.addEventListener("click", () => setStep(currentStep - 1));

  placeBtn?.addEventListener("click", async () => {
    await finalizeOrder();
  });

  syncSummary();
  setStep(1);
}
