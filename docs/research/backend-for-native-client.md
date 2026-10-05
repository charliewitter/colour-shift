# `/api/photos` as an API for the iOS app

Researched 2026-10-05

Scope: getting the one server route (`src/app/api/photos/route.ts`, PROJECT-MAP §7) ready to be called by a native SwiftUI app, plus how the iOS side should call it. Unless marked **(secondary)**, every source is a primary source.

---

## Summary for Colour Shift

1. **Apply for Unsplash production access before the app ships.** Nothing below changes the fact that 50 requests/hour is shared by every web visitor and every phone. Production access raises it to 1,000/hour ([Unsplash docs](https://unsplash.com/documentation)). This is the change that matters most.
2. **Add one Vercel WAF rate-limit rule on `/api/photos`, keyed by IP.** Hobby gets exactly 1 rate-limit rule per project, fixed window, 10 s–10 min, with 1,000,000 allowed requests included ([Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)). It needs no code and no deploy. Start with the **Log** action, then switch to **429**.
3. **Never use "Challenge" or Attack Mode on the API path.** A native app can't solve a browser challenge ([Vercel Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode)). The same goes for BotID: it needs browser JavaScript, so it can't protect calls from a Swift app ([BotID get started](https://vercel.com/docs/botid/get-started)).
4. **Cache `?id=` on Vercel's CDN; never cache `?count=` or `?download=`.** Send `Cache-Control: public, max-age=3600` and `CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800` on a successful id lookup ([Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache)). Random photos must stay random. A cached download ping would skip Unsplash's required tracking.
5. **Freeze the contract under `/api/v1/photos` and only ever add fields.** Keep `/api/photos` working for the web app (it can share the same code). Add `width`, `height`, `color` and `blurHash` from the Unsplash photo object ([Unsplash docs](https://unsplash.com/documentation)). Return one error shape: `{ "error": { "code", "message" } }`.
6. **Point the app only at the production domain, `https://colour-shift.vercel.app`.** Previews and per-deployment URLs sit behind Vercel login under Standard Protection ([Deployment Protection](https://vercel.com/docs/deployment-protection)). Every push to `main` changes what the app talks to, so a breaking API change has to be a new version path.
7. **Skip App Attest and DeviceCheck for now.** Both need server-side state, Apple signing keys and real work. App Attest also doesn't run on Macs ([`isSupported`](https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported)). For a personal app with a free, low-value endpoint, a rate limit and Unsplash production access do more. Revisit only if abuse shows up in the Firewall logs.
8. **Don't bother with a shared-secret header.** Anyone can pull it out of the app binary. At best it's a speed bump that also has to be sent by the web app's public JavaScript.
9. **iOS: one small `APIClient` built on `URLSession` async/await.** It has a 15 s request timeout, `Codable` models that tolerate unknown fields, one retry with backoff on 5xx and network errors (none on 4xx; honour `Retry-After` on 429), and cancellation through SwiftUI's `.task(id:)`. Set the base URL per build configuration in an `.xcconfig` ([Apple: build configuration files](https://developer.apple.com/documentation/xcode/adding-a-build-configuration-file-to-your-project)). Debug builds may get a local-network ATS exception; Release builds get none.

---

## Findings

### 1. Risks of a public proxy, and the ways to limit it

**The risk.** `/api/photos` runs with the owner's Unsplash key for anyone who calls it. A script calling `?count=10` five times in a row uses the whole demo hour: each call makes up to 10 Unsplash requests (PROJECT-MAP §7.1, §7.6). When the quota runs out, Unsplash returns 403 and both the site and the app fall back to the default pair. Unsplash also says excessive requests can get access ended ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). The terms forbid trying to "exceed or circumvent automated use or quota restrictions" ([API terms](https://unsplash.com/api-terms)). An iOS app doesn't create this risk; the route has been public all along. It does make the URL easier to find, though, and it adds steady traffic.

Checked live: the route currently returns `cache-control: public, max-age=0, must-revalidate` and `x-vercel-cache: MISS`, with the function in `iad1` (a `curl -I` on `?id=` for a missing id, 2026-10-05). That matches Vercel's default ([Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers)).

**Options compared**

| Option | Stops | Works for a native app? | Cost / effort | Verdict |
|---|---|---|---|---|
| **Vercel WAF rate-limit rule** (dashboard) | One IP hammering the route | Yes: it's keyed by IP or JA4, with no client code | Hobby: 1 rule, fixed window 10 s–10 min, 1M allowed requests included ([source](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)) | **Do this** |
| `@vercel/firewall` `checkRateLimit()` in code | Same, with custom keys or conditions | Yes | Needs a dashboard rule with a "Rate limit ID". On Hobby that uses up the single rate-limit rule ([Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk)) | Only if the dashboard rule is too coarse |
| Per-IP limit in plain code (in-memory `Map`) | Little | Yes | Counters live in one function instance and region. Vercel's own counters are "tracked on a per-region basis" too ([source](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)). A shared counter needs Redis or similar. | Not worth it |
| **Vercel BotID** | Browser automation (Playwright and the like) | **No.** "Client-side challenge… sent to the browser"; `checkBotId()` fails unless the browser-side `initBotId` attached its headers; `curl` gets blocked ([BotID](https://vercel.com/docs/botid), [get started](https://vercel.com/docs/botid/get-started)) | Basic is free on all plans; Deep Analysis is Pro only, $1 per 1,000 checks | Web-only; would break the app |
| WAF **Challenge** action / **Attack Mode** | Floods | **No.** "Standalone APIs… may not be able to pass challenges and could be blocked" ([Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode)) | Free | Leave `/api/*` out of any challenge |
| **Apple App Attest** | Calls that don't come from the real app on a real Apple device | Yes (iOS only) | High: server issues one-time challenges, verifies a CBOR attestation and certificate chain, stores a public key and counter per device, verifies an assertion per request ([Apple: validating apps](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)) | Overkill for now |
| **Apple DeviceCheck** | Gives 2 bits of state per device; Apple can validate a device token | Yes | Server calls Apple with an ES256 JWT signed by an Apple key ([Apple: per-device data](https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data)) | Doesn't fit; it's built for "has this device had the free trial" |
| **Shared secret header** (`X-Client-Key`) | Casual scanners only | Yes | Trivial | Weak; see below |

**Hobby limits worth knowing.** On Hobby, rate limiting counts only by IP or JA4 digest, not by header. The window tops out at 10 minutes, and there is 1 rate-limit rule out of 3 custom rules in total ([source](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)). Rules apply as soon as they're published, with no redeploy ([custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)). The recommended routine is to start on **Log**, watch live traffic, then switch the action ([custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)).

A starting rule (owner to tune): *If path starts with `/api/photos` → Rate limit, 30 requests / 60 s per IP → 429.* A normal session makes a few calls a minute (§7.6). Phones on mobile data often share an IP behind carrier NAT, so a very tight limit could block real users. That last point is general networking knowledge, not from a cited source.

**How App Attest works server-side, in short** ([Apple: validating apps](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server); [Apple: establishing integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)):

1. The app asks the server for a one-time random challenge (at least 16 bytes).
2. The app calls `generateKey()`, then `attestKey(_:clientDataHash:)` with the challenge's hash, and sends the attestation object and key id to the server.
3. The server checks the `x5c` certificate chain against Apple's App Attest root CA and rebuilds `nonce = SHA256(authData ‖ SHA256(challenge))`. It checks the nonce against the certificate extension (OID `1.2.840.113635.100.8.2`), the `RP ID` against `SHA256(TeamID.bundleID)`, `counter == 0` and the `aaguid` (development or production). Then it **stores** the public key.
4. Later requests carry an assertion (a signature over the challenge plus request). The server checks the signature and that the counter has gone up.
5. Optionally, the server asks Apple for a risk metric (attested keys per device over 30 days) ([Apple: assessing fraud risk](https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk)).

Caveats from Apple: keys don't survive a reinstall or a restore from backup ([establishing integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)). `isSupported` is false on Macs, including iOS apps running on Apple silicon ([isSupported](https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported)). Development keys use a separate sandbox ([preparing to use App Attest](https://developer.apple.com/documentation/devicecheck/preparing-to-use-the-app-attest-service)). Colour Shift has no database (PROJECT-MAP §3), so step 3's "store" alone means adding one. **Not worth it for a personal app** unless abuse is actually seen.

**Why a shared secret is weak.** Anything compiled into an app can be read from the binary or seen in a proxy such as Charles. It only filters out people who never look. Two more problems here: the web app calls the same route from public JavaScript, so it would have to ship the "secret" too, or be exempt. And Hobby can't rate-limit by header ([source](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)), so the header buys nothing at the WAF. Unsplash's own rule is the same idea from the other side: the access key "must remain confidential", which is why the proxy exists ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). **The Unsplash key must never go into the iOS app.**

### 2. Caching to save Unsplash calls

**What Unsplash allows.** The guidelines require four things: hotlinking the `photo.urls` image URLs, triggering the download endpoint (`links.download_location`) on a download-like event, attribution with UTM links, and keeping the key secret ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). The terms repeat hotlinking and download notice ([API terms](https://unsplash.com/api-terms)). **I found no clause in the guidelines or terms that forbids caching API JSON responses.** The docs say public (Client-ID) requests are "generally cacheable by our system" ([Unsplash docs](https://unsplash.com/documentation)). That's about Unsplash's own cache, not permission for ours, so treat this as "not forbidden as far as I could find", not as explicitly allowed. Caching photo metadata still hotlinks images from Unsplash's CDN, so view tracking still works.

What to cache:

| Request | Cache? | Why |
|---|---|---|
| `?id=X` | **Yes.** A photo's URLs, credit and alt rarely change | Share links and the iOS app reopening a photo hit the same id again and again |
| `?count=N` | **No** | It's meant to be random. A cached batch would give everyone the same photos |
| `?download=X` | **Never** | Each call is a required tracking event. A cache hit would silently break the rules |
| errors (502 etc.) | No | Except a short 404 cache for `?id=`, so a bad id can't burn quota on repeat |

**How on Vercel.** Function responses are cached on the CDN when they send `s-maxage` ([CDN cache](https://vercel.com/docs/caching/cdn-cache)). They're cacheable only for `GET`/`HEAD` with no `Authorization` request header and no `set-cookie`, with status 200/404/410/30x and size under 10 MB (same page). The cache is per region and best-effort (same page). `Vercel-CDN-Cache-Control` beats `CDN-Cache-Control`, which beats `Cache-Control`. If only `Cache-Control` is sent, Vercel strips `s-maxage` before it reaches the client ([Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers)). `stale-if-error` is supported, so a cached photo keeps being served if Unsplash fails (same page). I didn't confirm whether the query string is part of the CDN cache key. The cache key is described on [Purging Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache/purge), which I didn't open. **Check `x-vercel-cache: HIT` on two different ids before relying on it.**

**Next.js 16.** Route handlers are not cached by default ([local guide](../../node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md), "Caching"). The handler reads `request.url`, so it runs per request anyway, and the response headers it sets pass through. Next lets you set `Cache-Control` on any response except its hashed immutable assets ([local guide: headers](../../node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md)). `cacheComponents` is off in this project (`next.config.ts`), so `'use cache'` is out unless it's turned on. CDN headers alone are enough for a single lookup.

```ts
// ?id= success: browser 1 h, Vercel CDN 1 day, serve stale for a week while refreshing
return Response.json(toPhoto(photo), {
  headers: {
    "Cache-Control": "public, max-age=3600",
    "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800",
  },
});
// ?count= and ?download=: be explicit
return Response.json(photos, { headers: { "Cache-Control": "no-store" } });
```

The per-region detail means a cached id in London is still a miss in Sydney. Vercel's Runtime Cache (`getCache()` from `@vercel/functions`) is also regional. On Hobby it's shared across all of the team's projects ([Runtime Cache](https://vercel.com/docs/caching/runtime-cache)). It adds little over the CDN here.

**iOS side.** `URLSession`'s default `URLCache` honours `Cache-Control: max-age` (standard HTTP caching). This means the app won't refetch the same id within the hour. I didn't separately confirm this on Apple's site.

### 3. API shape for a native client

**Versioning.** The app can't be force-updated, so old builds will call the API for months. Add `src/app/api/v1/photos/route.ts`. The old `/api/photos` keeps working for the web app and can re-export the same handler. Rule for v1: **only add fields, never rename, remove or change the type of one.** A breaking change becomes `/api/v2/...`, and v1 stays until old builds are gone. This is a design suggestion, not from a cited source.

**Stable JSON.** Today's `Photo` is a good base (PROJECT-MAP §7.4). Two warts are worth fixing in v1 only:

- `?count=` returns a bare array and `?id=` returns a bare object. Wrapping (`{ "photos": [...] }`) leaves room to add fields like `rateLimitRemaining` later without breaking anything.
- `?download=` returns `{ ok }` with 200/502. For the app, a `204` or `{ "ok": true }` is fine. Keep it, and treat it as fire-and-forget.

Fields iOS will want, all present on the Unsplash photo object ([Unsplash docs](https://unsplash.com/documentation)):

| Field | From Unsplash | Why iOS wants it |
|---|---|---|
| `width`, `height` | `width`, `height` | Lay out the photo panel before the image loads (aspect ratio) |
| `color` | `color` (hex) | Instant placeholder; maybe a first-guess pair before palette extraction |
| `blurHash` | `blur_hash` | Blurred placeholder while the 1600px image streams in |
| `downloadLocation` | `links.download_location` | The guidelines name this URL for download tracking. The route currently builds `/photos/:id/download` itself ([guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). Keeping the tracking server-side through `?download=` is still right; the app needs no key. |

```ts
// v1 Photo (additive over today's Photo)
type PhotoV1 = Photo & {
  width: number;
  height: number;
  color: string | null;     // "#c0c0c0"
  blurHash: string | null;  // nullable: not every photo has one (assumption, not verified)
};
```

`rawUrl`, `photoUrl` and `photographerUrl` are already absolute (Unsplash URLs). Keep every URL absolute, so the app never has to resolve a path against the base URL.

**Error format.** One shape for every non-2xx answer, with a stable machine-readable `code`:

```json
{ "error": { "code": "upstream_unavailable", "message": "Unsplash returned no photos" } }
```

Suggested codes: `not_found` (404), `rate_limited` (429, plus `Retry-After`), `upstream_unavailable` (502), `misconfigured` (500), `bad_request` (400). [RFC 9457 "Problem Details"](https://www.rfc-editor.org/rfc/rfc9457) is the standard alternative (`application/problem+json`). It's heavier than this app needs. Map Unsplash's 403 quota response to 429 or 503 with `Retry-After`, so the app knows to back off instead of retrying. `Retry-After` is defined in [RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3).

**Keeping the web app working.** Ship in this order: (1) add fields to the existing response (additive, so the web app ignores them); (2) add `/api/v1/photos` sharing the code; (3) optionally move the web app to v1; (4) never remove `/api/photos` while old web tabs might be open. The web app updates on every deploy, so (4) matters little. Old app builds are what make v1 permanent.

### 4. Deployment details that affect the app

- **Use the production domain only.** Under **Standard Protection** (available on all plans), every URL except production domains is protected, including the production deployment's generated URL ([Deployment Protection](https://vercel.com/docs/deployment-protection)). Unique deployment URLs also expire under the retention policy ([Generated URLs](https://vercel.com/docs/deployments/generated-urls)). So the only safe base URL is `https://colour-shift.vercel.app`, or a custom domain added later. If a custom domain is added, keep the `vercel.app` one working, because shipped builds have it baked in. I didn't check the project's current protection setting; PROJECT-MAP §17.2 says previews need a Vercel login.
- **Don't put the Protection Bypass secret in the app.** `x-vercel-protection-bypass` works on all plans and also skips some firewall and bot checks ([Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)). Inside an app binary it would leak and open every preview. To test a preview API, use `vercel curl` from the Mac (PROJECT-MAP §17.2), not the app.
- **Every push to `main` deploys to production** (PROJECT-MAP §17.2). For the site that's fine. The installed app can't change that fast, so any deploy can break every installed copy at once. Guardrails: the additive-only v1 rule above; a tiny contract check in CI (decode a fixture with the v1 types); and Vercel **Instant Rollback** if something slips through. I didn't research rollback here; see [Deployments docs](https://vercel.com/docs/deployments).
- **Firewall changes don't need a deploy** ([custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)). The rate limit can be tuned live while watching app traffic.

### 5. iOS side

**URLSession + async/await + Codable.** `data(for:)` suspends without blocking and throws on failure ([Apple: data(for:delegate:)](https://developer.apple.com/documentation/foundation/urlsession/data(for:delegate:)); [WWDC21 "Use async/await with URLSession"](https://developer.apple.com/videos/play/wwdc2021/10095/)). A non-2xx status does **not** throw; check `HTTPURLResponse.statusCode` yourself (same session).

```swift
struct Photo: Decodable, Identifiable, Hashable {
    let id: String
    let rawUrl: URL
    let alt: String
    let photographer: String
    let photographerUrl: URL
    let photoUrl: URL
    let width: Int?          // optional: older server builds may not send it
    let height: Int?
    let color: String?
    let blurHash: String?
}
struct APIErrorBody: Decodable { struct E: Decodable { let code: String; let message: String }; let error: E }

enum APIError: Error { case http(Int, code: String?, retryAfter: TimeInterval?), transport(URLError) }

final class APIClient {
    let baseURL: URL
    private let session: URLSession
    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15    // default 60 s; resets whenever data arrives
        config.timeoutIntervalForResource = 30   // default 7 days
        config.waitsForConnectivity = false      // fail fast; the UI shows a retry
        session = URLSession(configuration: config)
    }

    func randomPhotos(count: Int) async throws -> [Photo] {
        var url = baseURL.appending(path: "api/v1/photos")
        url.append(queryItems: [URLQueryItem(name: "count", value: String(count))])
        return try await withRetry { try await self.get(url, as: [Photo].self) }  // or the v1 wrapper
    }

    private func get<T: Decodable>(_ url: URL, as: T.Type) async throws -> T {
        let (data, response) = try await session.data(for: URLRequest(url: url))
        let http = response as! HTTPURLResponse
        guard (200..<300).contains(http.statusCode) else {
            let body = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            let retry = http.value(forHTTPHeaderField: "Retry-After").flatMap(TimeInterval.init)
            throw APIError.http(http.statusCode, code: body?.error.code, retryAfter: retry)
        }
        return try JSONDecoder().decode(T.self, from: data)   // unknown keys are ignored by default
    }
}
```

Timeout defaults and meaning: `timeoutIntervalForRequest` is the idle wait for more data, default 60 s ([Apple](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/timeoutintervalforrequest)). `timeoutIntervalForResource` is the whole transfer, default 7 days ([Apple](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/timeoutintervalforresource)). `waitsForConnectivity` only affects setting up the connection ([Apple](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/waitsforconnectivity)). `JSONDecoder` ignoring unknown keys is what lets the server add fields safely. That is standard `Decodable` behaviour, but I didn't find a single Apple page that states it.

**Retries and backoff.** Retry at most once or twice, only on `URLError` timeouts and connection losses and on 502/503. Wait about 0.5 s × 2ⁿ with jitter, or `Retry-After` if present ([RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3)). **Never retry 4xx, and never retry 429 automatically on the demo key**: each retry of `?count=3` costs 3 more Unsplash calls. Don't retry `?download=`; it's fire-and-forget. The retry policy is general practice; no single primary source.

```swift
func withRetry<T>(max: Int = 1, _ op: () async throws -> T) async throws -> T {
    var attempt = 0
    while true {
        do { return try await op() }
        catch let e as URLError where [.timedOut, .networkConnectionLost, .notConnectedToInternet].contains(e.code) && attempt < max {}
        catch APIError.http(let s, _, _) where (s == 502 || s == 503) && attempt < max {}
        try Task.checkCancellation()
        try await Task.sleep(for: .milliseconds(Int(500 * pow(2, Double(attempt))) + Int.random(in: 0...250)))
        attempt += 1
    }
}
```

**Cancellation on fast swipes.** Swift `Task` cancellation cancels the `URLSession` async call in flight ([WWDC21 10095](https://developer.apple.com/videos/play/wwdc2021/10095/)), which then throws `URLError(.cancelled)` ([Apple](https://developer.apple.com/documentation/foundation/urlerror/code/cancelled)) or `CancellationError`. In SwiftUI, `.task(id: currentPhoto.id) { ... }` cancels the previous task when the id changes. Treat both errors as "ignore", not as failures to show. Two points of judgement: don't cancel a download ping (send it from a detached, untracked task once the photo is shown, matching the web rule in PROJECT-MAP §7.5); and don't cancel a buffer top-up just because the user swiped.

**App Transport Security.** ATS requires TLS for `URLSession` loads. `https://` URLs need no configuration ([Apple: preventing insecure connections](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)). Vercel serves HTTPS with HSTS (live headers above), so production is fine. Images on `images.unsplash.com` are HTTPS too.

**Dev against `pnpm dev` on the LAN (HTTP).**

- Since iOS 17, ATS no longer allows plain IP addresses by default. `NSAllowsLocalNetworking` allows unqualified names, `.local` names and IP addresses. `NSExceptionDomains` can also list a specific IP or CIDR range ([NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking); [NSExceptionDomains](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsexceptiondomains)).
- Any app using the local network should include `NSLocalNetworkUsageDescription` ([Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocalnetworkusagedescription)). Expect a permission prompt on a real device.
- Simplest set-up: call the Mac by its Bonjour name (`http://<mac-name>.local:3000`). Put `NSAllowsLocalNetworking = YES` in a **Debug-only** Info.plist (or one set by the build configuration), so Release builds carry no exception. The Simulator can use `http://localhost:3000`, which also falls under local networking.
- Next's `allowedDevOrigins` (PROJECT-MAP §17.1) is about browser pages loading dev resources across origins. I didn't verify whether it affects plain API calls from a native app. Test it.

**Base URL per configuration.** Use `.xcconfig` files mapped to Debug and Release ([Apple](https://developer.apple.com/documentation/xcode/adding-a-build-configuration-file-to-your-project)). Expose the value through an Info.plist key:

```
// Debug.xcconfig   (// starts a comment in xcconfig, so escape the slashes)
API_BASE_URL = http:/$()/chips-macbook.local:3000
// Release.xcconfig
API_BASE_URL = https:/$()/colour-shift.vercel.app
```
```swift
let baseURL = URL(string: Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as! String)!
```

(The `/$()/` trick for `//` in xcconfig is common practice; the Apple page above doesn't show it. **(secondary / unverified)**)

**The app must follow the Unsplash rules too:** hotlink `rawUrl` with imgix size parameters, show photographer plus Unsplash credit with the UTM links, and trigger `?download=` when a photo is shown ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). Note the usage guideline against replicating "the core user experience of Unsplash (unofficial clients, wallpaper applications, etc.)" (same page). Colour Shift is a contrast tool, so it should be fine. Describe it that way in the production-access application.

### 6. Minimum changes to `/api/photos` before the iOS app ships

In order of value:

1. **Unsplash production access** (not code). Apply with the live URL and screenshots ([when to apply](https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit)). The limit goes from 50 to 1,000 requests/hour ([Unsplash docs](https://unsplash.com/documentation)). Mention the iOS app in the application.
2. **WAF rate-limit rule** on `/api/photos*` (and `/api/v1/*`) by IP. Start on Log, then 429. No code.
3. **CDN caching for `?id=`**, with explicit `no-store` on `?count=` and `?download=` (snippet in §2).
4. **Additive fields:** `width`, `height`, `color`, `blurHash`.
5. **A consistent error body with a `code`**, and Unsplash's 403 mapped to 429/503 with `Retry-After`.
6. **`/api/v1/photos`** as the path the app uses, sharing code with `/api/photos`, with a written "additive only" rule (a line in PROJECT-MAP §7 or an ADR).

Not needed for launch: App Attest, DeviceCheck, BotID, a shared secret, a database, authentication.

---

## Open questions / decisions for the owner

1. **Rate-limit numbers.** How many requests per minute per IP? 30/60 s is a guess. Watch the Log action for a few days first.
2. **One rate-limit rule on Hobby.** A plain dashboard rule, or keep it for `checkRateLimit()` in code? It can't be both without upgrading to Pro.
3. **Response wrapper in v1.** Bare array as today, or `{ "photos": [...] }`? Changing it later means v2.
4. **Custom domain?** If one is planned, add it before the first App Store build, so the app never depends on `colour-shift.vercel.app`. Or keep both forever.
5. **Cache lengths for `?id=`.** One day fresh plus a week stale is a guess. Does a photographer renaming themselves or Unsplash taking a photo down need to show up faster?
6. **Is 1,000/hour enough?** If the app gets real users, the next step is caching or pre-fetching a pool of random photos server-side. That needs storage and a careful read of Unsplash's terms; I didn't research it.
7. **Should the web app move to v1 too,** or stay on `/api/photos` forever?
8. **To verify by hand:** whether the query string is part of Vercel's CDN cache key (look for `x-vercel-cache: HIT` on repeat `?id=` calls); the project's current Deployment Protection setting; whether `blur_hash` can be null.

---

## Sources

**Vercel**
- WAF Rate Limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Rate Limiting SDK: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk
- WAF Custom Rules: https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- Attack Mode: https://vercel.com/docs/vercel-firewall/attack-mode
- BotID: https://vercel.com/docs/botid
- BotID, get started: https://vercel.com/docs/botid/get-started
- Deployment Protection: https://vercel.com/docs/deployment-protection
- Protection Bypass for Automation: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- Generated URLs: https://vercel.com/docs/deployments/generated-urls
- CDN Cache: https://vercel.com/docs/caching/cdn-cache
- Cache-Control headers: https://vercel.com/docs/caching/cache-control-headers
- Runtime Cache: https://vercel.com/docs/caching/runtime-cache
- Purging CDN cache (cache keys; not read): https://vercel.com/docs/caching/cdn-cache/purge

**Next.js 16 (local docs, `next@16.3.7`)**
- Route handlers, caching: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `headers` config, Cache-Control: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
- CDN caching guide: `node_modules/next/dist/docs/01-app/02-guides/cdn-caching.md`
- Backend for frontend (rate limiting note): `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`

**Unsplash**
- API documentation (rate limits, photo object, download endpoint): https://unsplash.com/documentation
- API guidelines: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- API terms: https://unsplash.com/api-terms
- When to apply for a higher rate limit: https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit

**Apple**
- Validating apps that connect to your server (App Attest, server side): https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
- Establishing your app's integrity: https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
- Preparing to use the App Attest service: https://developer.apple.com/documentation/devicecheck/preparing-to-use-the-app-attest-service
- Assessing fraud risk: https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk
- `DCAppAttestService.isSupported`: https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported
- Accessing and modifying per-device data (DeviceCheck): https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data
- `URLSession.data(for:delegate:)`: https://developer.apple.com/documentation/foundation/urlsession/data(for:delegate:)
- `timeoutIntervalForRequest`: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/timeoutintervalforrequest
- `timeoutIntervalForResource`: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/timeoutintervalforresource
- `waitsForConnectivity`: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/waitsforconnectivity
- `URLError.Code.cancelled`: https://developer.apple.com/documentation/foundation/urlerror/code/cancelled
- WWDC21 "Use async/await with URLSession": https://developer.apple.com/videos/play/wwdc2021/10095/
- Preventing insecure network connections (ATS): https://developer.apple.com/documentation/security/preventing-insecure-network-connections
- `NSAllowsLocalNetworking`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking
- `NSExceptionDomains`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsexceptiondomains
- `NSLocalNetworkUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nslocalnetworkusagedescription
- Adding a build configuration file: https://developer.apple.com/documentation/xcode/adding-a-build-configuration-file-to-your-project

**Standards**
- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457
- RFC 9110 §10.2.3, Retry-After: https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3

**Secondary (not relied on)**
- A third-party blog claimed Unsplash production is 5,000 requests/hour. Unsplash's own docs say 1,000/hour, and this file uses that figure. (Found through search; not linked.)
- The xcconfig `/$()/` escaping trick is common community practice, not shown on the Apple page.
