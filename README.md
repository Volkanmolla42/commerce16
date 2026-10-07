# Commerce16

## Stoğa gelince haber ver

Bu özellik için değişkenleri `.env.local` yerine Convex deployment ayarlarında tanımlayın:

- E-posta: `RESEND_API_KEY`, `RESTOCK_FROM_EMAIL`
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Her iki kanal: `RESTOCK_SITE_URL` (mağazanın HTTPS adresi)

Her başvuru, seçilen varyant yeniden satışa açıldığında tek mesaj alır. Bir sağlayıcının ayarları eksikse o kanal için kayıt oluşturulmaz.
