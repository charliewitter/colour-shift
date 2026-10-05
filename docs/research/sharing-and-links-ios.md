# Sharing, export and links on iOS

Researched 2026-10-05

Scope: how the iOS (SwiftUI) port of Colour Shift should share a share link and the `.md` export, copy to the clipboard, and open share links (`https://colour-shift.vercel.app/?photo=…&fg=…&bg=…&algo=…&font=…&text=…`) in the app when it's installed. Web behaviour today: PROJECT-MAP §9 and §10, ADR 0006, `src/lib/share.ts`.

Apple's documentation pages render with JavaScript. Their text was read from Apple's own JSON data endpoints (`developer.apple.com/tutorials/data/documentation/….json`), which hold the same content as the pages cited.

---

## Summary for Colour Shift

- **Share button: use `UIActivityViewController` with two items, the share link `URL` and a temporary `.md` file URL.** This matches the web's `navigator.share({ url, files })`. SwiftUI's `ShareLink(items:)` takes a collection of a *single* `Transferable` type ([ShareLink declaration](https://developer.apple.com/documentation/swiftui/sharelink)), so it can't directly mix a URL and a file. `UIActivityViewController` accepts an array of objects of different types ([init(activityItems:applicationActivities:)](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller/init(activityitems:applicationactivities:))).
- **If you want pure SwiftUI**, use `ShareLink(item: url, preview: SharePreview(...))` for the link and offer the `.md` as a second action, or a `Transferable` type with `FileRepresentation` then `ProxyRepresentation(url)`. In that second case each destination gets *one* of the two, not both. Test "Save to Files" on a device, because developers report it misbehaving with `FileRepresentation` (secondary sources below).
- **Markdown type:** `UTType.markdown` (`net.daringfireball.markdown`) exists only from iOS 27 ([UTType.markdown](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/markdown)). For an earlier deployment target, use `UTType(importedAs: "net.daringfireball.markdown", conformingTo: .plainText)` and add an imported type declaration. Keep the filename `colour-shift-<fg>-<bg>.md`.
- **Copy URL:** write with `UIPasteboard.general.url = url` (or `setItems` with URL and plain-text forms). The iOS paste prompt is about *reading* another app's pasteboard content, so writing doesn't trigger it ([UIPasteboard](https://developer.apple.com/documentation/uikit/uipasteboard), [UIPasteControl](https://developer.apple.com/documentation/uikit/uipastecontrol)). Colour Shift never needs to read the pasteboard.
- **Universal links: keep the current URLs.** The AASA `components` format can match path `/` plus query items by name ([Components](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary), [Query](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary/query)). Match `"/": "/"` with `"?": { "fg": "?*", "bg": "?*" }`, so only share links open the app and the bare home page stays in the browser. Confirm with `sudo swcutil verify` before release (I couldn't run it, because it needs root).
- **Web change 1 (needed):** serve `/.well-known/apple-app-site-association` from the Next.js app as JSON over HTTPS, with no redirect. Use a route handler at `src/app/.well-known/apple-app-site-association/route.ts`, which sets `Content-Type: application/json` explicitly. This is the same folder pattern Vercel's own Flags SDK uses for `/.well-known/vercel/flags`.
- **Web change 2 (optional, after App Store release):** add the Smart App Banner through Next.js `metadata.itunes` (`appId`, `appArgument` = the full share link) in `generateMetadata` ([Next.js generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)).
- **App side:** add the Associated Domains capability with `applinks:colour-shift.vercel.app`, and handle links with `.onOpenURL`. SwiftUI delivers universal links there as a plain `URL` ([onOpenURL](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))). Port `parseShare` to Swift with the same per-field validation (Apple says to treat every incoming parameter as untrusted: [Supporting universal links in your app](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)).
- **No fallback work is needed.** If the app isn't installed, a universal link opens in the browser and the website handles it as it does now ([Allowing apps and websites to link to your content](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)).
- **Test with** long-press in Notes, Settings → Developer → Universal Links → Diagnostics, `swcutil`, and `?mode=developer` during development ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).

---

## Findings

### 1. `ShareLink`, `Transferable`, and sharing a URL plus a `.md` file

**ShareLink basics.** `ShareLink` (iOS 16+) presents the share sheet for any `Transferable` value, and `URL` already conforms ([ShareLink](https://developer.apple.com/documentation/swiftui/sharelink)). It has `item:` and `items:` initialisers, with optional `subject:`, `message:` and `preview:` (same page, Topics). Its generic declaration is `ShareLink<Data, …> where Data : RandomAccessCollection, Data.Element : Transferable`. So `items:` is a collection of **one** element type (same page).

**Previews.** A preview isn't required for URLs or plain strings. Without one, the sheet first shows a placeholder link icon while it fetches the page's metadata over the network. If you pass a `SharePreview`, it appears immediately ([ShareLink](https://developer.apple.com/documentation/swiftui/sharelink), [SharePreview](https://developer.apple.com/documentation/swiftui/sharepreview)). For Colour Shift, a preview titled with the pair (`#1A2B3C on #F0E0D0`) avoids a network round trip.

```swift
ShareLink(item: shareURL,
          subject: Text("Colour Shift pair"),
          preview: SharePreview("\(fgHex) on \(bgHex)", image: Image("ShareIcon")))
```

**Which services appear.** Apple says some services (Mail, Notes, Messages, AirDrop) offer themselves for files rather than for a wide range of data types. "If you don't see a particular sharing service … try adding a `FileRepresentation`." The sheet shows services based on the content types you provide ([ShareLink](https://developer.apple.com/documentation/swiftui/sharelink)). I didn't find an Apple page that lists exactly which actions (Copy, Save to Files and so on) appear for a given type. Check on a device.

**The three representations** (all iOS 16+):

| Representation | Use when | Source |
|---|---|---|
| `DataRepresentation(contentType:)` | The value is in memory and you can produce `Data`. Avoid `.data`; pick the most specific type. | [DataRepresentation](https://developer.apple.com/documentation/coretransferable/datarepresentation) |
| `FileRepresentation(contentType:)` | The value is a file on disk (`SentTransferredFile(url)`). The receiver gets a temporary sandbox extension. Use a specific content type, not `.fileURL`. | [FileRepresentation](https://developer.apple.com/documentation/coretransferable/filerepresentation), [WWDC22 Meet Transferable](https://developer.apple.com/videos/play/wwdc2022/10062/) |
| `ProxyRepresentation` | Reuse another type's conformance (`String`, `URL`). Cheap work only: no network or file I/O. A proxied `URL` is treated like any value, with no file access. | [ProxyRepresentation](https://developer.apple.com/documentation/coretransferable/proxyrepresentation), [WWDC22 Meet Transferable](https://developer.apple.com/videos/play/wwdc2022/10062/) |

**Order matters.** List representations from most to least preferred. "The receiver will use the first representation with the content type they support" ([WWDC22 Meet Transferable](https://developer.apple.com/videos/play/wwdc2022/10062/), [ProxyRepresentation](https://developer.apple.com/documentation/coretransferable/proxyrepresentation)). `.exportingCondition { … }` can switch a representation off for a given value ([exportingCondition(_:)](https://developer.apple.com/documentation/coretransferable/transferrepresentation/exportingcondition(_:))).

**Suggested filename.** `.suggestedFileName("…")` (iOS 16+) or `.suggestedFileName { item in … }` (iOS 17+) on any representation names the file when the receiver writes it to disk ([suggestedFileName(_:) iOS 16](https://developer.apple.com/documentation/coretransferable/transferrepresentation/suggestedfilename(_:)-2yln2), [suggestedFileName(_:) iOS 17](https://developer.apple.com/documentation/coretransferable/transferrepresentation/suggestedfilename(_:)-47rg0)).

**Markdown `UTType`.** `UTType.markdown` has identifier `net.daringfireball.markdown` and conforms to `utf8PlainText`. It's **available from iOS 27.0** ([UTType.markdown](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/markdown)). Before iOS 27, declare it yourself with `UTType(importedAs:conformingTo:)` (iOS 14+), "when you're supporting a type that another app owns" ([init(importedAs:conformingTo:)](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/init(importedas:conformingto:))). Custom or imported types also need `Info.plist` entries ([Transferable](https://developer.apple.com/documentation/coretransferable/transferable)).

```swift
extension UTType {
    static var colourShiftMarkdown: UTType {
        if #available(iOS 27, *) { return .markdown }
        return UTType(importedAs: "net.daringfireball.markdown", conformingTo: .plainText)
    }
}
```

`Info.plist` → `UTImportedTypeDeclarations`: identifier `net.daringfireball.markdown`, conforms to `public.plain-text`, filename extension `md`, MIME type `text/markdown`. (These are standard keys. Exact plist shape: [Defining file and data types for your app](https://developer.apple.com/documentation/uniformtypeidentifiers/defining-file-and-data-types-for-your-app). I didn't re-read that page this session.)

**URL and file together.** Because `ShareLink(items:)` is single-typed, there are three options:

1. **`UIActivityViewController` (recommended).** `activityItems` is an array whose "type of objects … is variable" ([init(activityItems:applicationActivities:)](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller/init(activityitems:applicationactivities:))). Pass `[shareURL, mdFileURL]`. Write the file to `FileManager.default.temporaryDirectory` first, with the final filename. Wrap the controller in `UIViewControllerRepresentable`, or present it from the root view controller. On iPad it must be shown in a popover ([UIActivityViewController](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller)). This is the closest match to the web's sheet (ADR 0006). For a rich, instant preview of the link, use `UIActivityItemSource` with `LPLinkMetadata` ([LPLinkMetadata](https://developer.apple.com/documentation/linkpresentation/lplinkmetadata)).
2. **One `Transferable` wrapper with both representations.** `FileRepresentation(.colourShiftMarkdown)` first, then `ProxyRepresentation { $0.url }`. Each destination picks *one*: Messages and AirDrop probably get the file, link-only targets get the URL. The Markdown already contains the share link (PROJECT-MAP §6.8), so nothing is lost. But it isn't "both", and the behaviour per destination is unverified.
3. **Two buttons:** `ShareLink(item: url)` for the link, and a separate "Export .md" (`ShareLink(item: mdFile, preview: …)` or `.fileExporter`).

**Known issues (secondary).** Developers report that "Save to Files" is missing when sharing a custom `Transferable` with `FileRepresentation` (Apple Developer Forums thread, no Apple answer, still open on iPadOS 18 beta: [forum 719429](https://developer.apple.com/forums/thread/719429), *secondary*). Another report: Save to Files fails on iOS 17 with `FileRepresentation` alone, and adding a `ProxyRepresentation` of the file URL fixes it ([juniperphoton, Substack](https://juniperphoton.substack.com/p/addressing-and-solving-transferable), *secondary*). Neither is confirmed for iOS 26 or 27. This is one more reason to prefer option 1, where you pass a real file URL.

### 2. Copying to the clipboard

- `UIPasteboard.general` is the system-wide pasteboard. `url` and `string` setters replace all current items with one new item ([UIPasteboard](https://developer.apple.com/documentation/uikit/uipasteboard), [url](https://developer.apple.com/documentation/uikit/uipasteboard/url), [string](https://developer.apple.com/documentation/uikit/uipasteboard/string)). One item can carry several representations, for example URL and plain text (same page, "Pasteboard items and representation types").

```swift
UIPasteboard.general.setItems([[
    UTType.url.identifier: shareURL,
    UTType.utf8PlainText.identifier: shareURL.absoluteString
]])
```

- **Prompts apply to reading, not writing.** From iOS 14, "the system notifies the user when an app gets general pasteboard content that originates in a different app without user intent" ([UIPasteboard](https://developer.apple.com/documentation/uikit/uipasteboard)). From iOS 16, "programmatic pasting raises a user alert that prompts the user for approval before the app gains access to pasteboard contents"; `UIPasteControl` or SwiftUI `PasteButton` read without a prompt ([UIPasteControl](https://developer.apple.com/documentation/uikit/uipastecontrol), [PasteButton](https://developer.apple.com/documentation/swiftui/pastebutton)). Neither page mentions a prompt for writing. Colour Shift only writes, so expect no prompt. I found no Apple statement that says this outright; it follows from the docs only describing reads.
- **SwiftUI alternatives.** There's no SwiftUI "copy" API for iOS before 27. `.copyable(_:)` (Transferable items for the system Copy command) is macOS 13+ and **iOS 27+** ([copyable(_:)](https://developer.apple.com/documentation/swiftui/view/copyable(_:))). It serves the Edit → Copy command or ⌘C, not a "COPY URL" button. Calling `UIPasteboard` from a SwiftUI `Button` is the practical route. The share sheet's own Copy action also covers copying.

### 3. Universal links

**The AASA file.**
- Name it `apple-app-site-association` with no extension. Serve it at `https://<fully qualified domain>/.well-known/apple-app-site-association` over `https://`, "with a valid certificate and with no redirects" ([Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). A 301 or 302 isn't supported. A 403 or 404 means the CDN was refused. The file must be reachable from any IP address and any user agent ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).
- **Content type:** the current pages don't state one. The archived App Search guide says it must be `application/json`, and that the uncompressed file must be ≤ 128 KB ([archived Universal Links guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html), *archived Apple doc*). Send `application/json` to be safe.
- **Format:** `applinks.details[]` holds `appIDs` (`<Team ID>.<bundle ID>`) and `components[]`. Each component may have `/` (path), `?` (a query string **or a dictionary** of query items), `#` (fragment), `exclude`, `comment`, `caseSensitive` (default `true`) and `percentEncoded` (default `true`). Unspecified keys default to `*`. The first matching component wins. Wildcards: `*` (zero or more), `?` (exactly one), `?*` (one or more). These keys are iOS 13+ ([Components](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary), [applinks](https://developer.apple.com/documentation/bundleresources/applinks), [Details](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary)). Don't mix in the legacy `appID`/`paths` format ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).

**Entitlement.** Add the Associated Domains capability in Xcode with entries like `applinks:colour-shift.vercel.app`. Use the host only: no path, query or trailing slash. Each subdomain needs its own entry and its own AASA file ([Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). For development, `applinks:host?mode=developer` bypasses Apple's CDN on devices in Developer Mode, with development-signed builds only ([com.apple.developer.associated-domains](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.associated-domains), [WWDC20 10098](https://developer.apple.com/videos/play/wwdc2020/10098/)).

**Apple's CDN.**
- From iOS 14, devices fetch the AASA from an Apple-managed CDN, not from your server ([Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). The CDN requests the file "within 24 hours". Devices check for updates "approximately once per week after app installation" (same page).
- There's "no direct CDN invalidation option". To pick up a new file on a test device, reinstall the app ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).
- So publish the AASA **well before** the app ships, and keep its patterns broad enough that you won't need to change them often.
- Today `https://colour-shift.vercel.app/.well-known/apple-app-site-association` returns **404** (checked with `curl -I`, 2026-10-05).

**Serving it from Next.js 16 on Vercel.** The Next.js docs fetched are for 16.3.8; the project is on 16.3.7.

- **Route handler (recommended):** `src/app/.well-known/apple-app-site-association/route.ts`. Route handlers can return non-UI responses with explicit headers ([route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route)). A dot-folder works under `app/`: the Next.js guide lists `.well-known` among the custom non-UI routes you can define with a route handler ([Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend); same text in the installed 16.3.7 docs at `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`). Vercel's Flags SDK also documents its endpoint at `/.well-known/vercel/flags` as an App Router `route` file ([Vercel Flags Explorer getting started](https://vercel.com/docs/flags/flags-explorer/getting-started)). Paths under `.well-known/` are exempt from `trailingSlash` redirects ([trailingSlash](https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash)). GET handlers are dynamic by default since v15 ([route.js, version history](https://nextjs.org/docs/app/api-reference/file-conventions/route)). That's fine here, or add `export const dynamic = "force-static"`.

```ts
// src/app/.well-known/apple-app-site-association/route.ts
const AASA = {
  applinks: {
    details: [{
      appIDs: ["TEAMID1234.app.colourshift"], // fill in
      components: [
        { "/": "/", "?": { fg: "?*", bg: "?*" }, comment: "Share links: /?fg=…&bg=…" },
        { "/": "/p", comment: "Reserved: dedicated share path, if ever needed" },
      ],
    }],
  },
};
export function GET() {
  return Response.json(AASA); // Response.json sets Content-Type: application/json
}
```

- **`public/.well-known/apple-app-site-association` (alternative):** files in `public/` are served from `/` with `Cache-Control: public, max-age=0` ([public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder)). The docs don't say which content type an extensionless file gets. You can force one with `headers()` in `next.config.ts`, which "are checked before the filesystem which includes pages and `/public` files" ([headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)). This is more moving parts than the route handler.
- **Vercel:** only the production domain matters, because preview deployments may sit behind Deployment Protection, and the CDN can't get past it. Check with `curl -v` and `curl -A "MyAgent-Bot/*"` against production ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).

**Handling the URL in SwiftUI.** "SwiftUI passes a Universal Link to your app directly as a URL, which you receive using" `onOpenURL`. `onContinueUserActivity` is for other activities such as Handoff ([onOpenURL(perform:)](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))). Validate everything: "make sure to validate all URL parameters and discard any malformed URLs" ([Supporting universal links in your app](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)).

```swift
WindowGroup {
    ContentView()
        .onOpenURL { url in
            guard let items = URLComponents(url: url, resolvingAgainstBaseURL: true)?.queryItems
            else { return }
            model.open(SharedParams(queryItems: items)) // Swift port of parseShare
        }
}
```

**Behaviour to expect.**
- Tapping a universal link to the **same domain** inside Safari stays in Safari ([Allowing apps and websites to link to your content](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)). Typing the URL into the address bar never opens the app ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).
- Links opened by your *own* app through `openURL` don't open in your app ([Allowing apps and websites…](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)).
- A long-press choice ("Open in app" or "Open in Safari") becomes the device's default for the domain ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).
- Third-party browsers may not support universal links (same page).

**Testing and debugging** ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)):
- Paste a link into Notes and long-press it: both "open in app" and "open in browser" should show.
- Settings → Developer → Universal Links → turn on Associated Domains Development → Diagnostics, then enter a full URL.
- `sudo swcutil dl -d <domain>` downloads the file. `sudo swcutil verify -d <domain> -j aasa.json -u <URL>` checks a URL against your JSON.
- A sysdiagnose's `swcutil_show.txt` shows "Site/Fmwk Approval" and the last and next check.

### 4. Can a universal link match the root path with query parameters only?

**Yes, as documented.** `/` "is the pattern to match with the URL path component", and `?` can be a dictionary keyed by query item name ([Components](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary), [Query](https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary/query)). Apple's own example uses `"/": "/help/*", "?": { "articleNumber": "????" }` ([Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). Apple's components example also shows that a pattern for path `abc` doesn't match `https://www.example.com?def`, so the path pattern must match the actual path. Our links always include the `/` (`origin + "/?" + …`, PROJECT-MAP §9.1), so `"/": "/"` is the right pattern.

**How the query dictionary behaves** (WWDC19 "What's New in Universal Links", as summarised from the transcript, [WWDC19 717](https://developer.apple.com/videos/play/wwdc2019/717/)):
- Query items can come in any order.
- Items you don't list are ignored.
- If a name repeats, every instance must match.
- Absent items count as the empty string. So `"fg": "?*"` (one or more characters) means `fg` must be present.

That fits our links: `fg` and `bg` are always present, and `photo`, `algo`, `font` and `text` are optional (PROJECT-MAP §9.1).

**Not verified on a device.** I couldn't run `swcutil verify` here (it needs root). Before shipping, run:

```
sudo swcutil verify -d colour-shift.vercel.app -j aasa.json \
  -u "https://colour-shift.vercel.app/?photo=abc&fg=112233&bg=ffeedd"
```

and the bare `https://colour-shift.vercel.app/`. The first should match and the second shouldn't.

**If root matching turns out unreliable:**
- Make the web app build share links as `/p?…` (or `/s?…`) and match `"/": "/p"`.
- Keep `/` parsing share params on the website, so old links still open in the browser.
- Implement `/p` as a Next.js page that renders the same `Home` (not a redirect). An HTTP redirect from `/` to `/p` would *not* open the app directly: "if the link tapped on by the user is not a universal link but redirects to one, the user will be routed through the web browser to the app" ([TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)).
- Old `/?…` links would then open the website, and the Smart App Banner (below) can carry them into the app.
- Keeping `/p` in the AASA from day one (as in the snippet) costs nothing and avoids waiting on the CDN's weekly refresh later.

### 5. When the app isn't installed

- **Universal links fall back by themselves.** "If the person hasn't installed your app, the system opens the URL in their default web browser, allowing your website to handle it" ([Allowing apps and websites to link to your content](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)). The website already handles share links (PROJECT-MAP §9.3), so nothing changes for people without the app.
- **Smart App Banner.** Add `<meta name="apple-itunes-app" content="app-id=…, app-argument=…">`. If the app is installed, the banner opens it. If it isn't, the banner links to the App Store. Once dismissed, it doesn't reappear. It doesn't show in frames or in the Simulator ([Promoting apps with Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)). In Next.js, `metadata.itunes: { appId, appArgument }` outputs that tag ([generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)). `page.tsx` already reads `searchParams` per request, so a `generateMetadata` there can set `appArgument` to the full share link.
- **`app-argument` delivery.** Apple's banner page describes it arriving via the app delegate's `open url` method, written for custom URL handling ([Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)). With universal links set up, the app receives an `https` URL. I didn't verify whether SwiftUI's `onOpenURL` receives it in this case. Test it on a device.
- **The banner needs an App Store app ID**, so add it only after the app is live.

### 6. Recommendation for Colour Shift iOS

**App**
1. Share button: `UIActivityViewController` with `[shareURL, mdFileURL]`. Write the Markdown to `temporaryDirectory/colour-shift-<fg>-<bg>.md` just before presenting it. Add an `LPLinkMetadata` item source for an instant link preview.
2. Copy URL: `UIPasteboard.general.setItems` with URL and plain-text representations. Show the same 1.5 s "COPIED" confirmation as the web.
3. Markdown type: `UTType.markdown` on iOS 27+, otherwise the imported `net.daringfireball.markdown` declaration.
4. Associated Domains: `applinks:colour-shift.vercel.app`. Add `?mode=developer` in Debug builds only.
5. Use `.onOpenURL` on the root view, feeding a Swift port of `parseShare`. Keep the same regexes, the 100-character text cap and the "both colours or neither" rule (`src/lib/share.ts`). Reuse the web's opening order (PROJECT-MAP §9.3): shared photo first, shared colours kept.
6. Build share links exactly as the web does (`https://colour-shift.vercel.app/?` + same params, defaults left out), so links are interchangeable.

**Web**
1. Add `src/app/.well-known/apple-app-site-association/route.ts` (snippet in §3), with the real Team ID and bundle ID. Deploy it to production before the first TestFlight build.
2. After App Store release, add `itunes` metadata (Smart App Banner) through `generateMetadata` in `page.tsx`.
3. No change to the share link format for now. Revisit only if `swcutil` or device tests show root-path matching fails (§4).

---

## Open questions / decisions for the owner

- **Deployment target.** iOS 27 gives `UTType.markdown` and `.copyable` for free. An earlier target needs the imported type declaration. Which minimum iOS?
- **Team ID and bundle ID** for `appIDs` (for example `TEAMID.app.colourshift`).
- **Domain.** Stay on `colour-shift.vercel.app`, or move to a custom domain before launch? Universal links tie the app to the exact host, and changing it later means a new AASA, a new entitlement and an app update.
- **Share sheet: both or one?** `UIActivityViewController` with link and file (closest to the web) or pure-SwiftUI `ShareLink` (simpler, but one representation per destination)?
- **Should the bare home page open the app?** The proposed AASA only matches links with `fg` and `bg`. Matching `/` alone would also send plain links to the site into the app.
- **Escape hatch.** Add an `exclude` component (for example fragment `#web`) so a link can force the website? Long-press already lets people choose.
- **Not verified here:** `swcutil verify` on the proposed AASA, Save to Files with `FileRepresentation` on iOS 26/27, and whether a Smart App Banner `app-argument` reaches `onOpenURL`. All need a device or a Mac with root.

---

## Sources

Apple (primary)
- ShareLink: https://developer.apple.com/documentation/swiftui/sharelink
- ShareLink init(items:subject:message:preview:): https://developer.apple.com/documentation/swiftui/sharelink/init(items:subject:message:preview:)
- SharePreview: https://developer.apple.com/documentation/swiftui/sharepreview
- Transferable: https://developer.apple.com/documentation/coretransferable/transferable
- FileRepresentation: https://developer.apple.com/documentation/coretransferable/filerepresentation
- DataRepresentation: https://developer.apple.com/documentation/coretransferable/datarepresentation
- ProxyRepresentation: https://developer.apple.com/documentation/coretransferable/proxyrepresentation
- suggestedFileName(_:) (iOS 16): https://developer.apple.com/documentation/coretransferable/transferrepresentation/suggestedfilename(_:)-2yln2
- suggestedFileName(_:) (iOS 17): https://developer.apple.com/documentation/coretransferable/transferrepresentation/suggestedfilename(_:)-47rg0
- exportingCondition(_:): https://developer.apple.com/documentation/coretransferable/transferrepresentation/exportingcondition(_:)
- UTType.markdown: https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/markdown
- UTType init(importedAs:conformingTo:): https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/init(importedas:conformingto:)
- Defining file and data types for your app: https://developer.apple.com/documentation/uniformtypeidentifiers/defining-file-and-data-types-for-your-app
- UIActivityViewController: https://developer.apple.com/documentation/uikit/uiactivityviewcontroller
- UIActivityViewController init(activityItems:applicationActivities:): https://developer.apple.com/documentation/uikit/uiactivityviewcontroller/init(activityitems:applicationactivities:)
- LPLinkMetadata: https://developer.apple.com/documentation/linkpresentation/lplinkmetadata
- UIPasteboard: https://developer.apple.com/documentation/uikit/uipasteboard
- UIPasteboard.url: https://developer.apple.com/documentation/uikit/uipasteboard/url
- UIPasteboard.string: https://developer.apple.com/documentation/uikit/uipasteboard/string
- UIPasteControl: https://developer.apple.com/documentation/uikit/uipastecontrol
- PasteButton: https://developer.apple.com/documentation/swiftui/pastebutton
- copyable(_:): https://developer.apple.com/documentation/swiftui/view/copyable(_:)
- Supporting associated domains: https://developer.apple.com/documentation/xcode/supporting-associated-domains
- Allowing apps and websites to link to your content: https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content
- Supporting universal links in your app: https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
- applinks: https://developer.apple.com/documentation/bundleresources/applinks
- applinks Details: https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary
- applinks Components: https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary
- applinks Components Query: https://developer.apple.com/documentation/bundleresources/applinks/details-swift.dictionary/components-swift.dictionary/query
- Associated Domains entitlement: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.associated-domains
- TN3155 Debugging universal links: https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links
- onOpenURL(perform:): https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:)
- Promoting apps with Smart App Banners: https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners
- WWDC22 Meet Transferable: https://developer.apple.com/videos/play/wwdc2022/10062/
- WWDC19 What's New in Universal Links: https://developer.apple.com/videos/play/wwdc2019/717/
- WWDC20 What's new in app clips / associated domains (10098): https://developer.apple.com/videos/play/wwdc2020/10098/
- Archived App Search Programming Guide, Universal Links (archived Apple doc): https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html

Next.js / Vercel (primary)
- route.js (Next.js 16.3.8 docs): https://nextjs.org/docs/app/api-reference/file-conventions/route
- Backend for Frontend guide (custom `.well-known` routes): https://nextjs.org/docs/app/guides/backend-for-frontend
- trailingSlash (`.well-known` exemption): https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash
- public folder: https://nextjs.org/docs/app/api-reference/file-conventions/public-folder
- headers: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
- generateMetadata (`itunes`): https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Vercel Flags Explorer getting started (`.well-known` route in App Router): https://vercel.com/docs/flags/flags-explorer/getting-started

Secondary
- Apple Developer Forums, "ShareLink does not offer save to files when sharing Transferable items": https://developer.apple.com/forums/thread/719429
- juniperphoton, "Addressing and solving Transferable" (Substack): https://juniperphoton.substack.com/p/addressing-and-solving-transferable
