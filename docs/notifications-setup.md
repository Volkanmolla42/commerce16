# Transactional order email setup

Order email uses Resend from Convex. Set the server-side `RESEND_API_KEY` and `ORDER_FROM_EMAIL` variables in the deployment. The sender must be verified in the Resend account.

The app queues a payment confirmation when an order first becomes paid. It queues a shipping update after the order is marked shipped and a purchased shipment has a tracking number. The email includes the order summary and, for shipping, the carrier, tracking number, and HTTPS tracking link when available.

Each order and event has a stable `orderEmailEvents` record and Resend idempotency key. Sent events are not sent again. Failed or unconfigured events can be retried from **Admin → Orders → Details** after correcting setup or recipient data. If a request times out or Resend returns an ambiguous server result, the event is marked for review; check the Resend dashboard before any manual resend. This avoids duplicate customer messages.

These are transactional order messages only. They do not use marketing consent or add customers to a mailing list.
