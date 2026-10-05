# Admin setup

Admin login and data operations require `ADMIN_PIN` and a private `ADMIN_API_SECRET`. `ADMIN_PIN` must be exactly six digits. Login allows five attempts per client IP in each 15-minute window. Set the same random `ADMIN_API_SECRET` in the Next.js runtime and the Convex deployment. Keep both values out of `NEXT_PUBLIC_*` variables.

In PowerShell, generate a 32-byte value:

```powershell
$adminPin = "{0:D6}" -f [Security.Cryptography.RandomNumberGenerator]::GetInt32(0, 1000000)
$adminSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Set `$adminPin` as `ADMIN_PIN` and `$adminSecret` as `ADMIN_API_SECRET` in `.env.local`, then set the same secret on the selected Convex deployment:

```powershell
npx.cmd convex env set ADMIN_API_SECRET "<same generated value>"
```

The Convex secret is checked by the data functions and is only sent from server-side admin routes. The admin login stays unavailable until the PIN, secret, and `NEXT_PUBLIC_CONVEX_URL` are configured. Convex's rate-limiter component is mounted by `convex/convex.config.ts` and is installed when the development deployment is updated.
