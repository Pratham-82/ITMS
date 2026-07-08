const crypto = require('crypto');
const WebhookSubscription = require('../models/WebhookSubscription');

/**
 * Service to dispatch event payloads asynchronously to registered HTTPS webhook endpoints.
 */
class WebhookService {
  /**
   * Triggers webhooks registered for a specific lifecycle event.
   * @param {String} eventType - The trigger event type (e.g. 'ticket.created')
   * @param {Object} data - The primary data object for the event payload
   * @param {String} tenantId - The active tenant context ID
   */
  async triggerWebhook(eventType, data, tenantId = 'default-tenant') {
    try {
      const tenantLocalStorage = require('../middleware/tenantContext');
      
      // Run inside the tenant storage context to query matching tenant database subscriptions
      await tenantLocalStorage.run(tenantId, async () => {
        // Query active webhooks that are subscribed to this specific event or a wildcard '*'
        const subscriptions = await WebhookSubscription.find({
          isActive: true,
          events: { $in: [eventType, '*'] }
        });

        if (!subscriptions || subscriptions.length === 0) {
          return;
        }

        console.log(`[WebhookService] Found ${subscriptions.length} active subscription(s) for event "${eventType}" in tenant "${tenantId}".`);

        // Prepare request body
        const payload = {
          event: eventType,
          tenantId,
          timestamp: new Date().toISOString(),
          data
        };

        const payloadString = JSON.stringify(payload);

        // Fire-and-forget dispatches asynchronously
        subscriptions.forEach(sub => {
          this.dispatch(sub, eventType, payloadString)
            .catch(err => {
              console.error(`[WebhookService] Asynchronous dispatch failed for subscription "${sub.name}" (${sub.url}):`, err.message);
            });
        });
      });
    } catch (err) {
      console.error('[WebhookService] Error triggering webhooks:', err);
    }
  }

  /**
   * Helper to perform HTTP POST dispatch
   */
  async dispatch(subscription, eventType, payloadString) {
    const headers = {
      'Content-Type': 'application/json',
      'X-ApexResolve-Event': eventType,
      'User-Agent': 'ApexResolve-Webhook-Engine/1.0'
    };

    // Calculate HMAC SHA-256 signature if secret exists
    if (subscription.secret) {
      try {
        const signature = crypto
          .createHmac('sha256', subscription.secret)
          .update(payloadString)
          .digest('hex');
        headers['X-ApexResolve-Signature'] = signature;
      } catch (cryptoErr) {
        console.error(`[WebhookService] HMAC signature calculation failed for "${subscription.name}":`, cryptoErr);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout limit

    try {
      console.log(`[WebhookService] Posting event payload to endpoint "${subscription.name}" -> ${subscription.url}`);
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Endpoint returned HTTP status ${response.status}`);
      }

      console.log(`[WebhookService] Webhook "${subscription.name}" dispatched successfully (HTTP ${response.status}).`);
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      let errMsg = err.message;
      if (err.name === 'AbortError') {
        errMsg = 'Request timed out after 10000ms';
      }
      throw new Error(errMsg);
    }
  }
}

module.exports = new WebhookService();
