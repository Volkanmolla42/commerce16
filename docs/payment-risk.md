# Payment risk controls

## Signals and decisions

The store does not receive or store card number or CVC data. iyzico's server-verified `fraudStatus` remains the card-fraud signal:

- `1`: provider approved. The order becomes paid only when the local score is below the review threshold and basket/amount checks match.
- `0`: keep the order pending for provider review.
- `-1`: mark the payment failed, cancel the pending order, and restore reserved stock.
- Missing or unknown status, provider verification errors, or basket/amount mismatches stay in review.

The local score is an explainable heuristic, capped at 100. It adds 8 points for guest checkout, 20 for an account younger than 24 hours, 10 points for at least two recent attempts (25 at four or more), 15 for at least two recent payment failures, 25 per previous provider fraud rejection (capped at 35), and 15/25 for orders of at least 25,000/50,000 TRY. A score of 45 or more requires human review even if iyzico approved the payment. The score is a review aid, not a claim that a customer or card is fraudulent.

Order creation and payment initialization also use transactional rate limits: 4 per email-and-IP pair per hour when signed IP context is present (email only otherwise), 6 per authenticated account per hour, and 10 per verified client IP per hour. Email hashes used to compare recent payment attempts are removed after 24 hours. IP and email values are not stored in orders or payment records; rate-limit keys use keyed HMAC hashes when the shared secret is configured, with SHA-256 fallback for email/account-only local development. Payment risk details are returned only through the admin-protected orders API.

## Trusted client IP on Vercel

The checkout server layout reads `x-vercel-forwarded-for` only in a Vercel runtime and signs the IP plus issue time with HMAC. Convex verifies the signature and 30-minute expiry before using the IP as an iyzico buyer field or rate-limit key. The raw IP is not written to the app database.

For IP-based controls, set the same strong, random value (at least 32 characters) as `CHECKOUT_RISK_CONTEXT_SECRET` in the Next.js server environment and the Convex deployment. Set Convex `CHECKOUT_RISK_CONTEXT_REQUIRED=true` to reject unsigned checkout calls. Keep both variables server-side. Without these settings, email/account limits and the iyzico result still apply, but IP-based limits and buyer IP forwarding are disabled.

Before enabling IP forwarding, update the store's privacy notice to disclose that the verified client IP is shared with iyzico for payment security and fraud prevention. The checkout displays that disclosure when signed IP context is active.

The payment status and local risk score appear in **Admin → Orders → Detay**. `İncelemede` payments remain pending and do not trigger invoice issuance. Confirm the provider outcome and order details before manually advancing a held order.
