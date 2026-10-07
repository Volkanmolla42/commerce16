# Legal checkout and e-invoice setup

## Checkout documents

In **Admin → Pages**, create the two checkout documents with **Yasal taslakları oluştur** if they are missing:

- `distance-sales-agreement` — Mesafeli Satış Sözleşmesi
- `pre-information-form` — Ön Bilgilendirme Formu

Replace every bracketed placeholder with the store's actual legal identity, contact, delivery, pricing, withdrawal, return, and complaint details. Review the final text with qualified counsel before publishing. Checkout stays unavailable until both pages are complete. The checkout links to both documents and requires separate, unchecked acceptance controls. The server verifies the current document versions and stores the accepted versions, exact text snapshots, and timestamp on the order.

The templates are drafting aids, not legal advice. Product-specific prices, quantities, and delivery costs are shown in the checkout summary; keep those values consistent with the published documents and actual order.

The verified checkout IP is stored on the order as AES-GCM ciphertext using a key derived from the server-only `CHECKOUT_RISK_CONTEXT_SECRET` and a per-order nonce. Customer order queries omit this field; the admin order view reports whether an encrypted IP was captured without exposing the address. IP capture depends on the signed checkout risk context being configured and valid. Set the merchant's retention period and access policy for this evidence with qualified counsel.

## Paraşüt v4 or an authorized adapter

Paid orders can be sent directly to Paraşüt v4 or to a merchant adapter connected to a GİB-authorized integrator. Set `EINVOICE_PROVIDER=parasut` or `EINVOICE_PROVIDER=adapter` in the Convex deployment. The admin order view shows the provider result and supports retries for failed or incomplete setup.

For direct Paraşüt setup, obtain the OAuth client and company values through Paraşüt onboarding, complete its authorization flow, and set these **server-side Convex environment variables**:

- `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`, and numeric `PARASUT_COMPANY_ID`.
- `PARASUT_INITIAL_REFRESH_TOKEN` from the first successful OAuth authorization.
- `PARASUT_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters.
- `PARASUT_SHIPPING_VAT_RATE` only when an order includes a delivery charge.

Paraşüt rotates the refresh token when issuing a new access token. The app stores access and refresh tokens encrypted with AES-GCM in the `providerTokens` table, refreshes them server-side, and spaces API calls through a shared request queue. Keep the encryption key and OAuth credentials out of browser variables and source control. The initial refresh token is needed only to bootstrap the encrypted token record.

Set each product's correct KDV rate in **Admin → Products** before accepting orders. The rate and the selected variant SKU are snapshotted on the order line. Storefront prices are treated as tax-inclusive; invoice lines convert them to the net unit price and apply the stored KDV rate. Coupon discounts are applied proportionally across product lines. A shipping line is included only when the order has a positive `shippingCostKurus` and `PARASUT_SHIPPING_VAT_RATE` is set.

The integration finds or creates Paraşüt contacts and products using the recipient tax number/email and product SKU. For business recipients it checks the e-Fatura inbox and selects e-Fatura when registered, otherwise e-Arşiv. Paraşüt creates e-documents asynchronously; the app polls its trackable job and marks the record issued only after the sales invoice shows the active e-document. Temporary PDF URLs are not stored. If a remote create call has an ambiguous result, the record is marked `review` and automatic retry is blocked until the merchant checks Paraşüt, which prevents duplicate invoices.

This checkout stores business title, VKN, and tax office, but does not store an individual's TCKN. Confirm Paraşüt/GİB requirements for e-Arşiv recipients with the merchant's accountant before production use. If the provider requires individual identity data, add a separately reviewed, purpose-limited collection and retention flow. Older orders do not have SKU/KDV snapshots and need an accountant-approved reconciliation before they can be invoiced through Paraşüt.

### Adapter alternative

For `EINVOICE_PROVIDER=adapter`, set `EINVOICE_ADAPTER_URL` to an HTTPS endpoint and `EINVOICE_ADAPTER_TOKEN` to its bearer credential. The adapter receives `schemaVersion: 1`, `currency: "TRY"`, an order payload, and a stable `Idempotency-Key` (`commerce-order-<orderId>`). It must treat repeated keys as the same invoice operation and return `documentType` (`e_fatura` or `e_arsiv`), a non-empty `providerReference`, and optionally an HTTPS `documentUrl`.

The integration does not replace Paraşüt onboarding, merchant tax settings, qualified legal/accounting review, or production reconciliation.
