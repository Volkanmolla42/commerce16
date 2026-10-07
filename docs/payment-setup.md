# Ödeme sağlayıcısı kurulumu

Ödeme bilgileri Convex deployment ortamında tutulur. Bu anahtarları `NEXT_PUBLIC_*` değişkenlerine koymayın.

## iyzico

`IYZICO_API_KEY`, `IYZICO_SECRET_KEY` ve `IYZICO_BASE_URL` değerlerini Convex ortamına ekleyin. Sandbox için `https://sandbox-api.iyzipay.com`, canlı kullanım için `https://api.iyzipay.com` adresini kullanın. `PAYMENT_PROVIDER` belirtilmezse iyzico seçilir.

## PayTR

Convex ortamına `PAYMENT_PROVIDER=paytr`, `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` ve `PAYTR_TEST_MODE=1` değerlerini ekleyin. PayTR mağaza panelindeki bildirim URL'sini şu adrese ayarlayın:

`<CONVEX_SITE_URL>/paytr/callback`

Callback adresi HTTPS olmalı ve PayTR panelindeki URL Convex deployment'ının site alan adını kullanmalıdır. PayTR ödeme dönüş sayfaları ödeme kanıtı sayılmaz; sipariş yalnızca imzası ve tutarı doğrulanmış callback ile ödenmiş duruma geçer. Kurulum ve test tamamlanınca canlı merchant bilgilerini girip `PAYTR_TEST_MODE=0` yapın.

## İade

Admin sipariş ayrıntısında ürün kalemleri ve adetleri seçilerek kısmi veya tam iade başlatılır. İade tutarı kupon indirimleri dağıtıldıktan sonra sunucuda tekrar hesaplanır. Sağlayıcı sonucu belirsiz kalırsa kayıt inceleme durumunda tutulur ve aynı istek otomatik tekrarlanmaz; böylece çift iade riski doğmaz.
