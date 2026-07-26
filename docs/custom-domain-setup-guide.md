# Custom Domain Setup Guide (Cloudflare + Firebase Hosting)

## Why are we doing this?

### The problem in plain English

Right now, the Starium Rafa ERP app can be opened by anyone on the internet at this address:

```
https://starium-rafa-app.web.app/
```

The app works. It's deployed. There's nothing broken about it. But there's a problem:

> **Some internet service providers (ISPs/carriers) block the IP addresses used by Firebase Hosting.**

That means users on those carriers see "This site can't be reached — `ERR_CONNECTION_REFUSED`" even though the site is perfectly live for everyone else on the planet. We confirmed this on our end:

- GitHub Pages (`engrdammie.github.io`, which uses Fastly's IPs `185.199.108–111.x`) — recently started being blocked on the carrier too.
- Firebase Hosting (`*.web.app` and `*.firebaseapp.com`, which uses `199.36.158.100`) — also blocked on the carrier.

So both free hosting providers are blocked on the carrier. A VPN works around it (we tested with Proton VPN), but: (1) it's slow, (2) we can't expect every user to install a VPN just to open the app, and (3) free VPNs have data limits.

### The solution

Buy a custom domain (like `starium.app` or `rafaerp.com`) and route it through **Cloudflare**.

Cloudflare is a CDN (Content Delivery Network). When you use Cloudflare, visitors actually connect to Cloudflare's servers first (which use a different set of IP addresses than Firebase and GitHub Pages), and then Cloudflare fetches the content from your real Firebase site.

Here's the key insight: **Cloudflare uses a different IP range that carriers generally do not block.** So even on a carrier that blocks Firebase directly, the custom domain via Cloudflare will load.

It's a bit like asking a friend (Cloudflare) who lives in a different neighborhood (uses different IPs) to walk over to the blocked building (Firebase) and bring your package (your website) to you. You never have to enter the blocked building yourself.

### What you'll get at the end

- A professional web address, e.g. `https://app.starium.app/` or `https://starium-rafa-app.rafaerp.com/`
- Loads for anyone, on any carrier (including the carrier that blocks Firebase)
- HTTPS is automatic (Cloudflare handles the SSL certificate for free)
- Everyone who already uses `https://starium-rafa-app.web.app/` is unaffected — they keep working

---

## What you'll need before starting

1. **A credit/debit card** or local equivalent, to buy a domain name (about $10 to $15 per year for a `.com`, or less for other endings like `.app` or `.io`).
2. **30–60 minutes of time.** Most of this is clicking through dashboards. No code changes needed.
3. **Patience.** DNS changes can take 5 minutes to 24 hours to propagate worldwide. Usually fast, but not instant.

---

## Step-by-step setup

### Step 1: Pick and buy a domain name

You can buy a domain from any registrar — Namecheap, Porkbun, GoDaddy, Google Domains (now handled by Squarespace), etc. Any of them work fine.

1. Go to a domain registrar (for example, `https://www.namecheap.com`).
2. Search for a name you like — for example `starium-app` or `rafa-erp` or anything memorable.
3. Pick an ending: `.com` is most universally recognized, `.app` is fine for an app. Avoid anything too unusual.
4. Add to cart and check out. The registrar will ask you for your contact details. Use the "WHOIS privacy" option if available (it's free on most registrars) — this hides your personal email and phone from public records.
5. Once payment is done, you own the domain for one year. You'll renew annually (the registrar will email reminders).

You now own something like `starium-app.com`. You'll point it at Cloudflare next.

### Step 2: Create a free Cloudflare account

1. Go to `https://dash.cloudflare.com/sign-up`.
2. Enter your email and pick a password.
3. Verify your email (Cloudflare sends a confirmation link — click it).

That's it. Cloudflare's free tier is enough for our use case. You never need to pay for Cloudflare for this to work.

### Step 3: Add your domain to Cloudflare

1. Once logged in, click **Add a site** (usually a big blue button on the dashboard).
2. Type in the domain you just bought (for example: `starium-app.com`), then click **Continue**.
3. Cloudflare scans your domain's current DNS records. Click **Continue** when prompted. You don't need to change anything here.
4. Cloudflare shows you a plan selection page. Pick the **Free** plan (the leftmost option). Click **Continue**.
5. Cloudflare shows you two **nameservers** — they look like this:
   ```
   Nameserver 1: alice.ns.cloudflare.com
   Nameserver 2: bob.ns.cloudflare.com
   ```
   The exact names will be different for you. **Copy both of them somewhere safe.** You'll need them in the next step.

### Step 4: Point your domain's nameservers at Cloudflare

This step is done at the **registrar where you bought the domain** (Namecheap, Porkbun, GoDaddy, etc.). You're going to tell your registrar: "From now on, Cloudflare is in charge of my domain's DNS settings."

1. Log back into your domain registrar's dashboard.
2. Find your domain in the list, click it, then look for a button or section called **DNS**, **Nameservers**, or **Domain DNS Settings**.
3. The registrar will show you its current "default" nameservers (something like `dns1.namecheaphosting.com`). Find the option to change them — sometimes it's a dropdown labeled "Nameservers" → change it to "**Custom DNS**" or "**Custom Nameservers**".
4. Replace the existing nameservers with the **two Cloudflare nameservers** from Step 3. There's usually room for 2 to 4 nameservers. Leave any extra slots empty.
5. Save.

Cloudflare will detect this change automatically — usually within 30 minutes, sometimes a few hours. Keep the Cloudflare dashboard open in a tab; once Cloudflare sees the nameserver change, you'll get an email saying "**Your domain is active on Cloudflare**". You can keep going through the next steps while this propagates.

### Step 5: Tell Firebase about your custom domain

Now we need to tell Firebase to accept traffic for the new domain and to serve the Firebase Hosting site when someone visits it.

1. Go to `https://console.firebase.google.com` and open the **starium-rafa-app** project.
2. In the left sidebar, click **Hosting**.
3. At the top of the Hosting page, click **Add custom domain** (sometimes it's labeled "+ Add custom domain" or appears under a "Domains" tab — the exact wording changes with Firebase Console updates).
4. Type your new domain. You have two reasonable choices here:
   - **Option A (apex domain):** `starium-app.com` (the bare domain)
   - **Option B (subdomain):** `app.starium-app.com` (a subdomain like "app")
   
   Subdomains are cleaner for keeping future services separate (you could later have `api.starium-app.com`, `docs.starium-app.com`, etc.), but either works.
5. Click **Continue**. Firebase will show you one or two **DNS records** to add. They look something like:
   ```
   Type: A     Name: app.starium-app.com.     Value: 199.36.158.100
   Type: TXT   Name: _acme-challenge.app...   Value: abc123longstring...
   ```
   Or sometimes a single `CNAME` record pointing to Firebase. **Copy these values** — you'll add them in Cloudflare in the next step.
6. Firebase then waits and checks periodically. If the DNS propagation succeeds, you'll see a green "Connected" status in this page.

### Step 6: Add those DNS records in Cloudflare

Now we tell Cloudflare to publish those records so the rest of the internet can find them.

1. Go back to the Cloudflare dashboard and click on your domain (e.g., `starium-app.com`).
2. In the left sidebar, click **DNS** → **Records**.
3. For each record Firebase gave you:
   - Click **Add record**
   - Set the **Type** (A, TXT, or CNAME — whatever Firebase showed)
   - Set the **Name** (the part of the domain — for an apex record use `@`, for a subdomain use `app`)
   - Set the **Content/Value** (the value Firebase gave you)
   - **Crucial:** look for a toggle labeled **Proxied** or a cloud icon. It should show an **orange cloud** (proxied). This is what makes traffic actually flow through Cloudflare's IPs (the whole point of this exercise). If it's grey (DNS only), click it to turn it orange (proxied).
   - Click **Save**
4. Repeat for each record Firebase gave you.

After saving, go back to the Firebase Hosting page after 5–10 minutes and refresh. Firebase should connect and start the SSL certificate provisioning.

### Step 7: Wait for SSL certificate (automated, no work for you)

Once the DNS records are correct, Firebase automatically requests an SSL certificate (so people connect via `https://`, not `http://`). Cloudflare also automatically signs a cert for free. Together, you get end-to-end HTTPS without touching anything.

This part takes anywhere from 10 minutes to a few hours. Firebase Console will show a "Provisioning SSL certificate" status. Once it says "Connected", you're done with Firebase's side.

### Step 8: Verify Cloudflare SSL mode is correct

1. In Cloudflare dashboard, go to **SSL/TLS** → **Overview**.
2. Set the encryption mode to **Full** (not "Flexible", not "Full (strict)" — just **Full**). This is the recommended setting for Firebase Hosting.
3. Save if there's a save button.

"Flexible" mode can cause redirect loops. "Full (strict)" mode requires both Cloudflare and Firebase certs to match exactly (which usually also works, but Full is safer for this setup).

### Step 9: Test the new domain

Wait for DNS to propagate. To check propagation, you can use a free site like `https://whatsmydns.net` — type your domain and watch the map turn green worldwide. Usually 5 minutes to 1 hour.

Then open `https://app.starium-app.com/` (or whatever your domain is) in your browser.

On the carrier that was blocking the app before, the site should now load — because the request goes to Cloudflare's IPs (`104.x.x.x`, `172.x.x.x`) which are typically not blocked.

---

## Recap (the short version)

For your future reference, the entire flow is:

1. **Registtration:** Buy domain at Namecheap (or any registrar).
2. **DNS hosting:** Move the nameservers to Cloudflare (free).
3. **Firebase link:** In Firebase Console → Hosting → Add custom domain. Firebase gives you DNS records.
4. **Cloudflare publish:** Add those records in Cloudflare with the orange cloud **proxied** on.
5. **SSL:** Automatic. Wait 10 minutes to a few hours.
6. **Done.** Open `https://your-domain.com/` from any network — including the carrier that was blocking the app — and it loads.

---

## Why each piece matters

### Why do we need a custom domain at all?
The free Firebase URLs (`*.web.app` and `*.firebaseapp.com`) all share a single set of Firebase IP addresses. Carrier-level IP blocks hit every customer on that IP — there's no way to work around it while using the free domain. Owning a custom domain gives you your own address on the internet that you can route through whatever CDN you want.

### Why Cloudflare specifically?
Cloudflare is a CDN with a massive global IP footprint (`104.16.0.0/12`, `172.64.0.0/13`, etc.). Carriers very rarely block these IP ranges because Cloudflare carries an enormous percentage of all internet traffic — blocking Cloudflare would break thousands of legitimate sites for the carrier's customers. So routing your site through Cloudflare is a safe, reliable way to dodge carrier-level IP blocks targeting Firebase's smaller IP range.

Cloudflare's free tier is enough for this use case. You don't need the paid plan. Everything we're doing here is on the free tier.

### Why "proxied" (orange cloud) and not "DNS only" (grey cloud)?
The orange cloud (proxied) means visitors hit Cloudflare's servers first, Cloudflare fetches the content from Firebase, and sends it back to the visitor with Cloudflare's IP. **This is the entire point of the exercise** — visitors never connect to Firebase's blocked IP directly.

If you leave it as grey cloud (DNS only), Cloudflare simply tells visitors "the site is at 199.36.158.100" — and the visitor tries to connect to Firebase directly — and gets blocked, exactly like before. So always keep the orange cloud on.

### Why is HTTPS automatic?
Letting Cloudflare terminate TLS (the encryption) means the visitor's browser sees a valid SSL certificate from Cloudflare, then Cloudflare uses its own secure connection to Firebase behind the scenes. Both Cloudflare and Firebase issue free SSL certificates via Let's Encrypt — there's no cost or setup beyond ticking a few boxes.

### Why does GitHub Pages get blocked too?
GitHub Pages uses Fastly's IP range (`185.199.108–111.x`). Carriers that do broad content-infrastructure blocking will sometimes block Fastly's IPs too — which is why the GitHub Pages URL (`https://engrdammie.github.io/starium-app/`) started failing on the carrier recently, even though it previously worked. The Cloudflare custom domain approach solves this case too, because Cloudflare has its own IP range that's typically untouched.

---

## What about the existing Firebase `*.web.app` URL?

It keeps working. Nothing breaks. People on **unblocked** networks can keep using `https://starium-rafa-app.web.app/` — it's the same site. The custom domain is just an additional path to reach the same content.

So you end up with three working URLs:

1. `https://engrdammie.github.io/starium-app/` — works on networks that don't block Fastly
2. `https://starium-rafa-app.web.app/` — works on networks that don't block Firebase
3. `https://app.starium-app.com/` — your new custom domain, works on basically every network (because Cloudflare IPs are rarely blocked)

You can share whichever you prefer. For professional sharing (clients, management team, CEO), the custom domain looks more polished than a github.io or web.app URL.

---

## What changes in the code? Almost nothing.

Your GitHub Actions workflow and Vite config are already set up correctly. The custom domain doesn't require any code change — Firebase Hosting automatically serves the same `dist/` build at the custom domain that it serves at `*.web.app`.

The only build/setup specifics worth noting:

- **No changes to `vite.config.js`**. Custom domains on Firebase Hosting are treated as root deployments, so the existing `VITE_BASE_PATH='/'` build for Firebase Hosting will work as-is.
- **No changes to `.github/workflows/deploy.yml`**. The workflow already builds for Firebase Hosting and deploys via GitHub Actions — it'll just work.
- **No changes to `.firebaserc` or `firebase.json`**. The rewrites already serve from root. Custom domains don't need anything extra in those files.

So once you do the Cloudflare/Firebase setup above, the next push to `main` will already be served at the new domain. Nothing else needs updating.

---

## Troubleshooting

**"I set up everything but my domain still loads a Cloudflare error page"**
→ Wait 30 minutes for DNS/SSL propagation. Cloudflare shows a "Pending" status for SSL until the cert is issued. Then refresh.

**"The site loads but I get a redirect loop"**
→ In Cloudflare dashboard → SSL/TLS → Overview, change the encryption mode to **Full** (not "Flexible"). Flexible causes redirect loops with Firebase.

**"My subdomain `app.starium-app.com` serves Cloudflare's parking page"**
→ The DNS record's "Proxied" status (orange cloud) is likely not enabled. Toggle it to orange (proxied).

**"Firebase Console says my domain isn't connected"**
→ DNS hasn't propagated yet. Verify your records on Cloudflare are correct, then wait. Use `https://whatsmydns.net` to check which DNS records the world is seeing — they should match what Firebase gave you.

**"My carrier STILL blocks the custom domain"**
→ Extremely rare, but if it happens, this means your carrier is blocking Cloudflare too (some carriers in restrictive regions do this). At that point, your only realistic options are: a VPN, hosting on a different carrier's network, or running your own VPS on a cloud provider like DigitalOcean.

**"GitHub Pages still works on some networks but not mine"**
→ This is expected — the GitHub Pages URL (`engrdammie.github.io/starium-app/`) is unaffected by anything we do here. It still works for users whose ISP doesn't block Fastly.

---

## Summary

- The app is live and working. Nothing is broken with the build.
- The issue is that some carriers block Firebase's and GitHub Pages' IP ranges at the network level.
- Buying a custom domain and putting it behind Cloudflare (proxied mode) routes visitors through Cloudflare's IP range, which is almost never blocked.
- Setup takes about 30–60 minutes plus DNS/SSL propagation time.
- Cost is about $10–$15/year for the domain registration. Cloudflare is free.
- It's a one-time setup. After this, every push to `main` automatically appears at the custom domain — no extra work.
