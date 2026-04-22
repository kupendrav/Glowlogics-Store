import { api } from "./api.js";
import { Storage } from "./storage.js";
import { Utils } from "./utils.js";

const SUCCESS_STATUSES = new Set(["success", "succeeded", "paid", "completed", "authorized"]);
const FAILURE_STATUSES = new Set(["failed", "failure", "declined", "cancelled", "canceled", "error"]);

function normalizeNumericOption(value, fallback, min = 1) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate) || candidate < min) {
    return fallback;
  }
  return Math.floor(candidate);
}

class PaymentProcessor {
  validateCard(cardNumber, expiry, cvv) {
    const [monthText, yearText] = (expiry || "").split("/");
    const month = Number(monthText);
    const year = Number(yearText);
    const now = new Date();
    const currentYear = Number(String(now.getFullYear()).slice(-2));
    const currentMonth = now.getMonth() + 1;

    const cardValid = Utils.luhnCheck(cardNumber || "");
    const expiryValid =
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12 &&
      (year > currentYear || (year === currentYear && month >= currentMonth));
    const cvvValid = /^\d{3,4}$/.test(cvv || "");

    return { cardValid, expiryValid, cvvValid, valid: cardValid && expiryValid && cvvValid };
  }

  async processPayment(payload) {
    return this.processPaymentWithRetry(payload);
  }

  normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  isSuccess(status) {
    return SUCCESS_STATUSES.has(this.normalizeStatus(status));
  }

  isFailure(status) {
    return FAILURE_STATUSES.has(this.normalizeStatus(status));
  }

  extractPaymentId(response = {}) {
    return response.payment_id || response.paymentId || response.id || response?.data?.payment_id || null;
  }

  extractStatus(response = {}) {
    return this.normalizeStatus(response.status || response.payment_status || response?.data?.status || "");
  }

  async delay(ms = 0) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    });
  }

  dispatchMockWebhook(eventType, payload = {}) {
    const detail = {
      eventType,
      eventId: Utils.uid("evt"),
      createdAt: new Date().toISOString(),
      payload
    };

    window.dispatchEvent(new CustomEvent("payment:webhook", { detail }));

    const relayUrl = String(Storage.get("paymentWebhookRelayUrl", "")).trim();
    if (!relayUrl) {
      return;
    }

    fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detail)
    }).catch(() => {});
  }

  async awaitFinalPaymentStatus(paymentId, initialStatus, options = {}) {
    const pollAttempts = normalizeNumericOption(options.pollAttempts, 6, 1);
    const pollIntervalMs = normalizeNumericOption(options.pollIntervalMs, 1200, 200);

    let status = this.normalizeStatus(initialStatus);
    let lastResponse = {
      payment_id: paymentId,
      status
    };

    if (this.isSuccess(status) || this.isFailure(status)) {
      return {
        status,
        response: lastResponse
      };
    }

    for (let index = 0; index < pollAttempts; index += 1) {
      if (index > 0) {
        await this.delay(pollIntervalMs);
      }

      const response = await api.checkPaymentStatus(paymentId);
      status = this.extractStatus(response);
      lastResponse = response;

      this.dispatchMockWebhook("payment.status.updated", {
        payment_id: paymentId,
        status,
        attempt: index + 1,
        raw: response
      });

      if (this.isSuccess(status) || this.isFailure(status)) {
        break;
      }
    }

    return {
      status,
      response: lastResponse
    };
  }

  async processPaymentWithRetry(payload = {}, options = {}) {
    const maxAttempts = normalizeNumericOption(options.maxAttempts || Storage.get("paymentMaxAttempts", 3), 3, 1);
    const retryDelayMs = normalizeNumericOption(
      options.retryDelayMs || Storage.get("paymentRetryDelayMs", 1200),
      1200,
      200
    );

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const createResponse = await api.createPayment({
          ...payload,
          retryAttempt: attempt
        });

        const paymentId = this.extractPaymentId(createResponse);
        if (!paymentId) {
          throw new Error("Payment gateway did not return payment_id");
        }

        const initialStatus = this.extractStatus(createResponse);
        const finalState = await this.awaitFinalPaymentStatus(paymentId, initialStatus, options);

        if (this.isSuccess(finalState.status)) {
          const result = {
            paymentId,
            status: finalState.status,
            attempt,
            amount: payload.amount,
            currency: payload.currency,
            raw: finalState.response
          };

          this.dispatchMockWebhook("payment.succeeded", result);
          return result;
        }

        if (this.isFailure(finalState.status)) {
          lastError = new Error(`Payment ${paymentId} failed with status ${finalState.status}`);
          this.dispatchMockWebhook("payment.failed", {
            paymentId,
            status: finalState.status,
            attempt,
            raw: finalState.response
          });
        } else {
          lastError = new Error(`Payment ${paymentId} did not reach terminal status`);
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < maxAttempts) {
        this.dispatchMockWebhook("payment.retry.scheduled", {
          attempt,
          nextAttempt: attempt + 1,
          delayMs: retryDelayMs,
          reason: lastError?.message || "retry"
        });
        await this.delay(retryDelayMs);
      }
    }

    throw new Error(lastError?.message || "Payment failed after all retry attempts");
  }

  async refundPayment(paymentId, reason = "manual-refund") {
    const response = await api.refundPayment(paymentId, { reason });
    this.dispatchMockWebhook("payment.refunded", {
      paymentId,
      reason,
      raw: response
    });
    return response;
  }
}

export const paymentProcessor = new PaymentProcessor();
