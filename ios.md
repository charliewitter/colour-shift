# Colour Shift: iOS build handoff

Written 2026-10-05. Synthesises all nine reports in [docs/research](docs/research/), the current web implementation, [PROJECT-MAP.md](PROJECT-MAP.md), and [CLAUDE.md](CLAUDE.md). This is context for a **new native Swift and SwiftUI repository**, not an instruction to start implementation or change the deployed website.

## 1. How to use this document

Read this alongside PROJECT-MAP and CLAUDE.md. The map explains the existing product and its exact behaviour; CLAUDE.md records working conventions and web implementation constraints; this document explains their native equivalents, recommended changes, exclusions and remaining decisions. Detailed formulas, source investigations and experiments remain in the linked research reports.

**Status language throughout:**

- **Carry over:** established product behaviour or invariant to preserve.
- **Recommended:** the synthesis of the research for the first native build; not an owner-approved decision merely because it appears here.
- **Open:** needs an owner choice, licence clarification, contract agreement or device verification.
- **Not building:** outside the proposed first release, unless scope is explicitly changed.

Source precedence: current code describes what the web app actually does; the map's invariants and ADRs describe what it must preserve. Raise contradictions rather than silently correcting product behaviour in the port. Figma wins over the web style guide for existing visuals; its contrast values are illustrative. Native adaptations below need their own approved spec and, where useful, iOS Figma frames.

This is a synthesis of research gathered on 2026-10-05, **not a fresh verification of external documentation**. Version numbers, Apple toolchain claims, API availability, vendor pricing and service limits in those reports are dated evidence. Check the installed Xcode/SDK and primary sources at implementation time. Research snippets are sketches, not tested production code; do not paste their force unwraps, isolation assumptions or availability checks without review.

### Research index

| Report | What it informs here |
| --- | --- |
| [SwiftUI architecture](docs/research/swiftui-architecture.md) | State ownership, Observation, actor isolation, lifecycle, packages and tests |
| [Colour science](docs/research/colour-science-swift.md) | Conversions, gamut, contrast, formatting, numeric parity and APCA licence |
| [Palette extraction](docs/research/palette-extraction-ios.md) | MMCQ port, pixel pipeline, image loader, cache and preview |
| [Unsplash](docs/research/unsplash-ios.md) | Proxy, hotlinking, credit, download tracking, quota and production access |
| [Backend for native client](docs/research/backend-for-native-client.md) | Stable API, errors, retries, caching, firewall and build configuration |
| [Fonts](docs/research/fonts-ios.md) | Bundling, PostScript names, licence corrections and Dynamic Type |
| [Sharing and links](docs/research/sharing-and-links-ios.md) | Native share sheet, Markdown, clipboard, universal links and web fallback |
| [Liquid Glass](docs/research/liquid-glass.md) | Where glass belongs, colour fidelity, native menus and accessibility |
| [Motion and interaction](docs/research/motion-and-interaction-ios.md) | Animation, sliders, text editing, keyboard, focus and VoiceOver |

## 2. The product carries over

Colour Shift is a tool for finding a **pair**: a text colour and a background colour. A stream of varied Unsplash photos suggests pairs; the user edits either colour, checks contrast, experiments with sample text and a specimen font, then keeps the result as a share link or Markdown file.

The native app remains one main working screen. Its flow stays:

```text
photo → photo colours → photo's pair → pair on screen → score / edit → share link / Markdown
```

Keep the glossary in [CONTEXT.md](CONTEXT.md): pair, text colour, background colour, active colour, anchor colour, contrast method, score, grade, level, passing level, photo stream, preview, stage, colour panel, photo panel, dock, bottom bar, channel readout and specimen font. A photo's extracted colours are not a saved collection or a new palette-generation feature.

Keep British **colour** in product text and documentation. ADR 0003 uses American **color** in code; follow it in the new repo unless the owner chooses a new convention. Research examples named `ColourEngine` and `ColourShiftModel` are illustrative; proposed code names here are `ColorEngine` and `ColorShiftModel`. Avoid ambiguity with `SwiftUI.Color` by using a qualified engine type or a name such as `EditableColor`.

### Carry-over behaviour

| Feature | Native behaviour to preserve |
| --- | --- |
| Photo stream | Previous and next move through an ordered session stream. Previous stops at the beginning. Next fetches when the buffer is exhausted. |
| New random photo | The web's Space action takes the first unseen photo after the current one, or inserts a new batch there. Previous still returns to the photo just left. Preserve the action; its touch entry point is open. |
| Pair selection | Prefer vivid, dramatic combinations over muted averages. The darker colour becomes the background. |
| Colour picker | Tap the same role to close the slider panel; tap the other role to switch it while keeping the panel open. |
| Swap | Exchange displayed colours and anchors. The active colour follows its value into its new role. |
| Colour modes | OKLCH, HSB and RGB. Changing mode changes the controls, never the stored colour. Default mode is HSB. |
| Levels | Tapping the score toggles levels. A level moves the active colour, or text colour if none is active. Highlight the highest level actually passed. |
| Unreachable level | Move to the strongest available endpoint; show the actual score and passing level. Do not pretend the requested level was reached. |
| Sample text | Default and empty-state display are `Aa`; editable, centred, fitted to the panel, capped at 100 by the existing share contract. |
| Specimen font | Default Departure Mono. Changing it affects sample text, not colours or contrast. |
| Keeping a pair | Link and Markdown describe the pair on screen, including photo credit where present. |
| Shared state | Restore photo, explicit colours, method, font and sample text. The shared photo goes first; random buffering follows. |
| Independent panels | Sliders and levels may be open together. Native sharing is modal, rather than the web's inline export row. |

**Navigation is not edit history.** Returning to a photo restores its original extracted pair, not edits made while viewing it. A shared photo's original pair is the shared pair. Font, sample text and contrast method are not reset on ordinary photo navigation.

### Anchors are essential

`colors` is the displayed pair; `anchors` is each colour as last set by the user or a photo. A slider edit updates the edited role in both. A new photo pair or fallback updates both pairs. A shared pair initializes both. Swap exchanges each pair independently; it does not replace anchors with a level-adjusted displayed pair.

A level action constructs its input from the **current opposite colour and the edited role's anchor**, calls `reachLevel`, then writes only the displayed edited colour. Anchors remain unchanged. This prevents repeated level clicks from compounding chroma loss near black and white. Preserve [ADR 0005](docs/adr/0005-levels-move-from-anchor-colour.md).

### Startup and failure behaviour

- Unshared startup uses text and background `#1a1718`, so sample text is invisible until a pair arrives. If the initial photo request fails before anything sets the colours, use text `#a39f9f` on background `#1a1718` and update anchors too.
- A later network failure preserves the current pair. Colour editing, scoring, swap and export still work without a photo.
- Failed extraction does not invent a successful pair or replace existing colours. Keep the photo usable and the editor responsive.
- Shared colours appear immediately, before network work. Fetch the shared photo first; do not extract over explicitly shared colours. If that photo fails, the shared colours survive the first random photo's pair once.
- Cancellation is distinct from failure. Cancelled work must not set fallback colours or show an error.

The web currently has minimal visible error handling. A native retry or unavailable state is a recommended adaptation; its copy and placement remain a design choice. Avoid blocking the editor behind photo failures.

## 3. Stack and repository boundaries

| Web implementation | Native replacement / treatment |
| --- | --- |
| Next.js, React, TypeScript, Tailwind, pnpm | Swift, SwiftUI and an Xcode app target |
| Top-level `ColorShift` client component | One main-actor `@Observable` model owned by the root view |
| Props and callbacks | Plain values and action closures for leaves; model access in a few containers |
| `useState`, refs, effects | `@State`, observed model properties, `@ObservationIgnored`, explicit async actions and `.task` |
| culori and apca-w3 | Faithful Swift engine, subject to APCA permission |
| node-vibrant/browser | Swift histogram, MMCQ and default-generator port |
| `<img>`, canvas and preload refs | URLSession, ImageIO/Core Graphics, loader actor and prepared-photo cache |
| CSS tokens and keyframes | Central Swift design tokens and motion policy |
| `contentEditable` | Native text field with focus and measured fitting |
| Browser clipboard / Blob download / Web Share | UIPasteboard, temporary Markdown file and system share sheet |
| Server page parsing `searchParams` | Swift URL parser and `.onOpenURL` |
| `/api/photos`, Vercel and Unsplash key | Remain in this web repo; iOS is another client |

**Recommended baseline:** iOS 26 deployment target, Swift 6 language mode, a supported installed Xcode with the required SDK, and a SwiftUI app target. The architecture and glass reports favour 26; the motion report's 17/18 floors describe what its isolated features require, not a reason to lower the whole app's target. iOS 27-only conveniences are not required for this product. The owner must confirm deployment target and device coverage.

Recommended shape, with names adjustable in the new spec:

```text
ColorShift.xcodeproj
ColorShift/
  App/                 app entry, configuration, link handling
  Model/               ColorShiftModel and actions
  Views/               stage, panels, bottom bar, reusable controls
  Services/            PhotoAPI, PhotoLoader, share-sheet bridge
  Resources/           fonts, licences, assets
Packages/ColorEngine/
  Package.swift
  Sources/ColorEngine/  colour types, conversions, contrast, levels,
                        pair picking, formatting, Markdown, palette algorithm
  Tests/ColorEngineTests/Vectors/
docs/                  native spec, map, ADRs, progress log, research
```

Keep the engine independent of SwiftUI/UIKit, using `Double` and `Sendable` value types. ImageIO decoding belongs in the app's service layer; the pure extractor takes RGBA bytes. Enable a macOS test platform for the package so `swift test` needs no simulator. Keep the API client in the app initially; no package-per-feature architecture is needed.

The native repo needs its own CLAUDE.md, AGENTS.md and project map. Preserve the owner's step-by-step workflow, plan-before-code approval, small commits, concise teaching notes and current documentation. Replace browser checkpoints with simulator/device checkpoints. Do not copy Next.js agent rules, `pnpm` checks or Vercel deployment instructions into the native app's rules.

## 4. State, actions and concurrency

Source detail: PROJECT-MAP §§4–5 and [architecture research](docs/research/swiftui-architecture.md).

One `@MainActor @Observable final class ColorShiftModel` owns product state. The root owns its lifetime with `@State`. Use `@Bindable` where a container needs bindings; route edits that must update anchors through action methods rather than unrestricted bindings to `colors`.

| State category | Native owner |
| --- | --- |
| Displayed pair, anchors, active role, colour mode, method, levels open, text and font | Observed model properties |
| Ordered photos, index, original pairs keyed by id, shared-load coordination, pair synchronization | Model |
| Current photo, hex values, score, grade, passing level, channel ranges | Derived values or a consistently updated presentation snapshot |
| Request guard, task handles, prepared/shown sets, request generation | Private bookkeeping; `@ObservationIgnored` where stored on the model |
| Outgoing visual layer, rolling values, grip drag state, channel readout timer, copy confirmation | Leaf `@State` / view-local tasks |
| Font menu and native share-sheet presentation | System presentation and minimal container state; no web dropdown state machine |

Never mutate the model inside SwiftUI `body`. React's render-time `pairFor` synchronization becomes a model method called after navigation, shared-load completion and extraction completion. Commit the new photo selection and its ready pair/anchors in one main-actor update. An extraction finishing for a non-current photo populates its cache without changing the displayed pair.

Use a root `.task` to start loading, with an idempotent `start()` method. Actions explicitly top up the three-ahead buffer; do not restart the global buffer request every time the current-photo view changes identity. `.task(id:)` suits work genuinely tied to one value, such as a view-specific image request, not shared stream ownership.

Keep one random-photo request in flight. Use bounded concurrent preparation for individual photos, with handles for cancellation. A bare `Task {}` is unstructured and does not become a cancellable child just because it is created inside another task; use a task group or manage its lifetime explicitly.

Use main-actor defaults for UI code where supported by the selected toolchain; keep the package's pure functions nonisolated. URLSession async calls suspend rather than blocking the UI. An actor protects loader state but does not automatically move synchronous decoding off the main actor: verify isolation and use an appropriate background execution boundary (`@concurrent` where supported) for decoding and extraction. Transfer validated `Sendable` data; do not suppress concurrency diagnostics with blanket `@unchecked Sendable`.

On backgrounding, pause unnecessary prefetch; on return to active, resume/top up without resetting the pair. Preserve session state across ordinary interruptions. Opening a new link while running needs a native action that applies it, cancels or invalidates old stream work, and prevents stale completions overwriting the incoming pair. A request generation/id is a useful guard. This extends the web's page-load-only handling and needs tests.

During slider drags keep view bodies cheap, avoid broad environment dependencies, and compute a score snapshot once per colour change if profiling shows repeated work. Profile with Instruments before splitting state into multiple models.

## 5. Colour engine: what must match

Source detail: [colour-science research](docs/research/colour-science-swift.md), `src/lib/color-engine.ts`, PROJECT-MAP §6. Baseline versions in the gathered research are culori **4.0.2** and apca-w3 **0.1.9**. Record exact versions and source revision with fixtures; these are parity baselines, not automatic upgrade instructions.

### Representation and conversion

- Store colours in the mode last edited, at full precision: RGB, HSV (shown as HSB) or OKLCH. Use a Swift enum/struct representation, not one canonical hex or a `SwiftUI.Color` as engine state.
- Preserve optional hue (`Double?`) and explicit hue on achromatic edited colours. A missing hue reads as zero for controls; copying a colour already in the selected mode must not unnecessarily reconvert it.
- Port culori's constants, operation order, grey shortcut, sign-preserving sRGB transfer curves, HSV branches and hue normalization. Use Foundation scalar `pow`, `cbrt`, `atan2`, `sin` and `cos`; avoid Float or SIMD/FMA substitutions that change arithmetic.
- All output remains **sRGB**. Clamp/gamut-map, then derive lowercase `#rrggbb`. Paint opaque sRGB colours from those same 8-bit bytes; score, grade, share and export from those bytes too. SwiftUI's extended range does not perform the required clamp for us.
- Do not use `Color.Resolved` for engine math; its linear Float representation differs from the engine contract.

### Gamut and channels

Two distinct algorithms must remain distinct: app `maxChroma` uses 20 bisections on `[0, 0.4]`; culori `clampChroma` uses resolution `0.4 / 8192`, a last-good-chroma fallback and RGB clipping if even zero chroma is out of gamut. Preserve their different midpoint formulas and strict `[0,1]` gamut checks. Do not substitute CSS Color 4 perceptual gamut mapping.

| Mode | Channel ranges / increments / displayed decimals |
| --- | --- |
| HSB | Hue 0–360 / 0.1 / 1; saturation and brightness 0–100 / 0.1 / 1 |
| OKLCH | Lightness 0–100 / 0.1 / 1; chroma 0–dynamic sRGB maximum (absolute ceiling 0.4) / 0.001 / 3; hue 0–360 / 0.1 / 1 |
| RGB | Red, green, blue 0–255 / 1 / 0 |

RGB and percentage controls scale internal 0–1 values. Channel edits cap OKLCH chroma at the current lightness/hue limit. Each track has 13 hex stops from channel sweeps; return colour-stop data in Swift rather than a CSS gradient string. Gradient rendering is visual fidelity, not numeric parity.

### Contrast and levels

| Method | Thresholds → labels |
| --- | --- |
| WCAG 2 | 1.5 → Incidental; 3.0 → AA Large; 4.5 → AA; 7.0 → AAA; below 1.5 → Fail |
| APCA, conditional on licence | 30 → Spot; 45 → Headline; 60 → Content; 75 → Body; 90 → Preferred Body; below 30 → Fail |

Incidental is a product convenience, **not a WCAG passing level**; preserve ADR 0004. WCAG uses the piecewise sRGB curve and luminance weights 0.2126/0.7152/0.0722. APCA uses its own pure 2.4-power input conversion and pinned constants; do not feed it WCAG luminance. Retain signed Lc in display, absolute Lc for grades and level search.

Score display truncates toward zero: WCAG two decimals and `:1`, APCA one decimal and `Lc`. Grades use the raw value. Preserve examples such as `AA 5.21:1` and `Content Lc -64.3`. Ordinary Swift `String(format:)` is not a drop-in for JS `toFixed`: cover decimal ties, binary representation, negative zero and locale explicitly. A generic decimal rounding helper is insufficient unless vectors prove parity. The web's floating-point truncation can under-report one last digit; changing that is a coordinated bug fix, not an incidental port change.

`reachLevel` sweeps 101 lightness samples (0 through 1), locates passing/non-passing crossings, bisects each 24 times keeping the passing side, and chooses the crossing nearest the anchor's lightness. It caps chroma at each step. With no crossing, choose the stronger black/white endpoint, including the web's deterministic tie handling. Score quantization creates steps; preserve the actual algorithm rather than replacing it with a simple luminance formula.

`pickPair` ignores population-zero photo colours, considers every remaining pair, and scores `log(WCAG ratio) + 2 × (chromaA + chromaB)`. Prefer candidates with ratio ≥1.5, falling back to all candidates if none passes. Preserve first-winner ties, single-colour black/white fallback, empty-input `nil`, and lower-OKLCH-lightness background assignment. Pair picking always uses WCAG, regardless of the currently selected contrast method.

### APCA is a release decision, including hidden use

The research flags apca-w3's Limited W3 License and native-use ambiguity. Obtain clarification/permission from Myndex before treating APCA as shippable; otherwise define an approved WCAG-only native scope. This document does not settle licence interpretation. Preserve required notices and compliance text if permission is obtained. See the [research licence section](docs/research/colour-science-swift.md) and [upstream licence](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md).

**Removing the APCA switch alone is insufficient:** web `readableOn` chooses black/white swatch labels using absolute APCA contrast. A WCAG-only build needs an approved alternative there too, plus defined handling of `algo=apca` incoming links. Keep the pair intact even if the method falls back to WCAG; do not claim complete method parity. APCA permission is not needed merely to draft this handoff.

## 6. Photo pipeline and pair extraction

Source detail: [palette research](docs/research/palette-extraction-ios.md), [Unsplash research](docs/research/unsplash-ios.md), PROJECT-MAP §§7–8.

### Recommended loader

Use an app-owned `PhotoLoader` actor over URLSession and URLCache. The more detailed palette report supersedes the Unsplash report's initial `AsyncImage` suggestion: we need request headers, raw extraction data, prefetch, cancellation and decoded images. No image-library dependency initially; Nuke is a researched fallback if that service later needs richer cache/prefetch features. Kingfisher and SDWebImage were surveyed but do not justify extra dependencies for this small stream.

Preserve three photos ahead, fetching batches of three. Retain original pairs by photo id for backwards navigation; bound the **decoded image** cache separately from stream metadata, and reload evicted images without reselecting a different original pair. Do not hold every full image forever. Preparation is idempotent per id, with retryable failures rather than permanently cached failed tasks.

For display URLs, retain `rawUrl` query parameters, especially `ixid`, and add supported imgix sizing, `q=80`, `auto=format`, `fit=max`. Recommended native sizing is panel width in points with `dpr=displayScale`; do not multiply width by scale and also set `dpr`. Account for panel height/aspect ratio when needed to avoid undersized fill images. The research's fixed 1600px snippets illustrate the web baseline, not a mandatory native size.

For extraction request the web's **200px-wide copy with effective DPR 1**, independently of Retina display sizing. It is then reduced by node-vibrant's quality factor of five: 200×133 becomes 40×26. Do not interpret “200px extraction” as quantizing all 200px pixels, or accidentally use a 600px extraction copy on a 3× phone.

Image format affects extracted pairs materially. The reports tested JPEG versus AVIF and found different pairs, but did not verify iOS decoding on the minimum target. Send an explicit supported Accept header after testing ImageIO decoding; the proposed header is `image/avif,image/webp,*/*`. Do not assume it guarantees the same codec as every browser. Pinning `fm` on both platforms is a separate coordinated decision because it changes existing web output.

Downsample display images with ImageIO, apply orientation and decode away from the main actor. For extraction, draw into exact truncated dimensions in an 8-bit **sRGB RGBA** Core Graphics context; avoid DeviceRGB or unexamined provider bytes. Match alpha handling, byte order, image orientation and the opaque-photo assumptions. Guard zero sizes and malformed image data.

Use a modest HTTP disk cache (the report suggests 20–50 MB; at least around 10 MB for its measured response sizes). HTTP bytes and decoded-image memory are different budgets: one 1600×1067 RGBA image is roughly 6.8 MB. Respond to memory pressure by releasing distant decoded images. Respect HTTP caching; ordinary hotlinked caching was not explicitly confirmed by Unsplash's terms in the research, so do not infer permission to build a durable photo archive.

### Extractor contract

Hand-port the node-vibrant **4.0.4** histogram, MMCQ quantizer and default generator, retaining applicable MIT notices. Avoid outdated Swift Vibrant ports, Android Palette, dominant-average extraction or Core Image k-means: they use different rules.

Important quirks from the research to carry into tests:

- Filter retains alpha ≥125 and rejects pixels whose RGB channels are all >250.
- Histogram uses 5 bits per channel, 32,768 bins; preserve min/max and population counts.
- Quantization requests 64 colours; phase one targets 48 boxes by population. Preserve the phase-two target/count quirk rather than “fixing” it to always produce 64.
- Preserve longest-axis tie order, split formulas, empty-slice handling, bin-centre averaging/truncation and stable priority order. Swift needs explicit bounds handling where JS reads `undefined`.
- Generator target order is Vibrant, LightVibrant, DarkVibrant, Muted, LightMuted, DarkMuted. Copy the exact saturation/lightness ranges from the report.
- Generator weights are saturation 3, lightness 6.5, population 0.5. Zero-valued weighted terms are skipped from numerator and denominator. Preserve first-eligible/first-best tie behaviour.
- Synthetic gap-filling swatches have population zero and never enter `pickPair`. They may be omitted for pair output. If golden tests require all six named swatches, normalize these away or port gap filling too; do not promise full-palette identity while omitting it.

**Two distinct parity promises:** identical RGBA input should yield identical real swatches/populations and pair selection; independently decoded photos should yield pairs of comparable quality under the same rules. Exact pairs across iOS and browsers are not guaranteed because codecs and resampling differ. Shared pairs remain exact because links provide both hex colours. Server-side pair computation is not part of this build.

### Preview and readiness

Keep the blurred 200px copy as the main preview: it is already needed for extraction and matches the web. BlurHash can be an optional earlier layer on cold/shared startup once the proxy provides it; metadata `color` can provide a flat underlay. The palette report refines the Unsplash report's BlurHash-first recommendation, rather than eliminating the extraction copy.

Publish preview/pair readiness separately from full-image readiness so a slow display download does not prevent the preview being useful. Future photos should normally be prepared before navigation; late completion must be checked against current selection. Keep the first photo's quick fade from a dark panel. Subsequent full images fade over the preview; tune native blur by eye rather than assuming CSS pixels and SwiftUI blur radius are equivalent.

## 7. Backend work remains in the web repo

Source detail: [backend research](docs/research/backend-for-native-client.md). **None of the following changes has been implemented by this document.** iOS must not assume a proposed route or field exists already.

### Existing contract

Production origin is `https://colour-shift.vercel.app`. `/api/photos?count=N` returns an array; `?id=X` returns one photo; `?download=X` sends tracking. Current photo fields are `id`, `rawUrl`, `alt`, `photographer`, `photographerUrl`, `photoUrl`. URLs are absolute; credit URLs already contain referral tags. The proxy chooses diverse search terms and currently makes separate upstream random requests per photo.

### Recommended native contract before release

| Change | Reason / condition |
| --- | --- |
| Introduce `/api/v1/photos` | Shipped app builds cannot be updated with every web deployment. Freeze types/names; additive-only changes within v1, breaking changes require v2. Keep `/api/photos` working. |
| Add `width`, `height`, nullable `color` and `blurHash` | Layout and early previews without additional upstream calls. Optional decoding accommodates older responses. |
| Use exact `links.download_location` | Preserve its query parameters, including `ixid`, instead of reconstructing an incomplete tracking URL. Prefer server-owned/validated locations; never accept arbitrary upstream destinations. |
| Stable errors | `{ "error": { "code": "…", "message": "…" } }`; agree codes/statuses before freezing v1. Handle firewall responses that do not use this JSON. |
| Quota mapping | Identify upstream quota exhaustion and return an agreed 429/503 with sensible `Retry-After`; do not mislabel all upstream 403s as quota. |
| Cache id metadata | Cache successful id lookups separately; random batches and tracking explicitly `no-store`. Error caching is a separate decision. |
| IP rate limit | Cover both legacy and v1 routes; start in logging mode, tune from real use, then return 429. Shared carrier IPs make overly tight limits harmful. |

The report proposes a wrapped v1 response such as `{ "photos": [...] }`, while the current route is unwrapped. **Choose the envelope and lookup shape before coding `Codable` models or releasing v1.** Also choose how the app identifies tracking locations (server lookup versus a validated location in a request). `downloadLocation` need not be exposed merely to support tracking if the server retains it.

Suggested metadata cache timings (one hour client, one day CDN, a week stale) and rate limit (30 requests/minute/IP) are research starting points, not established requirements. Verify query-aware cache separation with two ids and repeated requests, actual cache headers/HIT behaviour, removal/credit freshness, and current Vercel plan allowances. Never cache tracking; a cached success would skip an event.

### Native API client

Use a small injectable URLSession client with validated URL construction and tolerant `Decodable` models. Treat optional new fields gracefully, but do not silently fabricate required ids/image URLs. Distinguish cancelled, offline, not found, rate limited, malformed response and upstream failure.

Recommended policy: approximately 15 seconds request idle timeout, a bounded overall resource timeout, at most one retry with short jittered backoff for transient network loss/timeouts and selected 5xx responses. No retries for decoding failures, cancellation or ordinary 4xx. A 429 establishes a cooldown using `Retry-After`; **do not immediately auto-retry it**, especially against the demo quota. Parse both delta seconds and HTTP-date forms. Tracking is a nonblocking best-effort event, without automatic retries that could double count.

Use build configuration for API origin. Production uses the stable production host, never a per-deployment URL or a bundled Vercel bypass token. Debug may use a local server with narrowly scoped local-network ATS settings and a usage-description prompt; Release stays HTTPS without broad ATS exceptions. Verify `.xcconfig` URL escaping and generated Info.plist values rather than trusting the research sketch.

## 8. Unsplash rules and operational decisions

Source detail: [Unsplash research](docs/research/unsplash-ios.md).

- The access key remains server-side. No access key, secret key, OAuth flow, user-supplied developer key or app-binary “secret” is needed on iOS.
- Images load directly from Unsplash's provided CDN URLs; preserve `ixid`. Do not proxy/re-host images or build an offline library.
- Credit every visible photo with tappable photographer and Unsplash links. Recommended native wording is `Photo by Name on Unsplash`, retaining `utm_source=colour_shift&utm_medium=referral`. Include credit in Markdown too.
- The existing product invariant tracks once per id when first **shown**, never during prefetch. Preserve it provisionally. The Unsplash research questions whether display alone is the appropriate download-like event, while backend/architecture reports assume the current rule. Moving tracking to copy/share/export requires owner choice and guideline clarification, coordinated across web and iOS. No decision is implied here.
- Use the exact download location and retain its query parameters. A tracking failure must not prevent navigation/editing; best-effort tracking does not mean caching or retrying indefinitely.
- The researched demo/production budgets are 50/1,000 API requests per hour, shared by both clients behind one key. CDN images do not consume that API budget. Production access is a prerequisite to a public launch; verify approval and current limits.
- Random `count` batching can cut calls, but a batch under one search term changes variety. Topic batching, orientation and `content_filter=high` are choices to evaluate, not new user-facing search controls. Returned content may include illustrations.
- Describe the app as a colour/contrast tool, not an unofficial Unsplash client or wallpaper app. Keep Unsplash branding out of the app name/icon. Publish the required privacy policy. Monetisation/ads and whether Unsplash wants separate platform applications remain questions if those plans arise.

Production access and basic rate limiting are proportionate initial protections. Do not add BotID/browser challenges/Attack Mode to native API paths. App Attest, DeviceCheck, authentication, a database and a shared-secret header are not first-release requirements. Revisit stronger protection only if real abuse warrants it.

## 9. Native design, layout and Liquid Glass

Sources: [glass research](docs/research/liquid-glass.md), style guide, Figma, PROJECT-MAP §§11–16.

Carry over dark, quiet chrome; only the pair and photo carry product colour. Centralize all named tokens from `COLOUR-SHIFT-STYLE-GUIDE.md` in Swift, including opacity. Use opaque sRGB fills for the colour panel and swatches. Selection/pressed borders remain inside controls so layout does not grow.

### Layout recommendation

Start with the `mWeb` composition on iPhone: colour panel, photo panel, optional slider panel, swatch row, optional levels, method/score/share row. Maintain a readable colour-panel minimum (web reference 160px), letting the photo yield first. Native safe areas and the keyboard replace `h-dvh` and CSS safe-area calculations; keep controls clear of the home indicator.

Use available geometry and size classes, not a copied 640px breakpoint. Crossfade photos on all iPhone layouts. An iPad regular-width dock, side-by-side stage and directional slide are a recommended later layout step **if iPad is included**; define scope explicitly before enabling universal device support. Compact iPad windows need compact composition. Landscape phones, keyboard-open layouts and large text need checks; they must not accidentally receive an unusable desktop dock.

Keep the bottom bar and slider panel stacked below content and opaque. A floating glass bar is a redesign, not required to feel native. Native touch targets should default to at least 44pt, including slider rows, while visual tracks/grips can stay small; the web's 28px rows are not the native sizing requirement.

### Glass policy recommended by the research

| Surface/control | Native treatment |
| --- | --- |
| Colour panel, sample text, photo content, swatches | Solid content; never glass or user-colour glass tint |
| Bottom bar/dock, slider panel, swap, method switch, levels, score | Flat token-based chrome |
| Font picker | Standard SwiftUI `Menu`/menu picker with native presentation and accessibility |
| Photo arrows over the photo | Candidate for regular `.glass` buttons, grouped appropriately; keep visible on touch |
| Slider grip | 8pt white dot at rest, 24pt regular interactive glass while dragging; solid fallback if needed |
| Share/export | System share sheet/sheet, retaining its native background |

Never use tinted glass as a colour swatch: its appearance varies with content behind it. System glass may switch light/dark over bright content; forced dark mode is not proven to pin every glass element. Prototype arrows, font trigger and grip over white, black and saturated backgrounds. Check refraction over the gradient and whether the 24pt grip remains clear. Use a flat fallback if it obscures accurate reading.

Do not build custom glass morphing, glass on glass, a tab bar, sidebar, scrolling edge effects or a hero-background extension merely because APIs exist. Avoid copying the research's standalone grip sketch without checking its opacity/layering. Smaller OS-version-specific accessibility APIs still need availability handling even with an iOS 26 floor.

## 10. Fonts and native text editing

Source detail: [fonts research](docs/research/fonts-ios.md) and [motion research](docs/research/motion-and-interaction-ios.md).

The font report corrects earlier web documentation: **Alpha Lyrae and Ghost Byte are OFL**, alongside Departure Mono, Geist, Geist Mono and Instrument Serif. That is six specimen families available for native bundling; the report's “five of seven” summary is inconsistent with its own six-font table. Existing web ADR 0002 and CLAUDE.md still describe Alpha Lyrae/Ghost Byte as local-only. Use the licence evidence for the native recommendation; do not silently rewrite that web deployment policy in this task.

| Stable share id | Font / PostScript name | Recommended native treatment |
| --- | --- | --- |
| `departure-mono` | Departure Mono / `DepartureMono-Regular` | Bundle; specimen default |
| `geist` | Geist / `Geist-Regular` | Bundle |
| `geist-mono` | Geist Mono / `GeistMono-Regular` | Bundle; UI font until Input Mono is licensed |
| `instrument-serif` | Instrument Serif / `InstrumentSerif-Regular` | Bundle |
| `alpha-lyrae` | Alpha Lyrae / `AlphaLyrae-Medium` | Bundle official unmodified file + OFL |
| `ghost-byte` | Ghost Byte / `GhostByte-Regular` | Bundle official unmodified file + OFL |
| `input-mono` | Input Mono / `InputMono-Regular` | Do not bundle until app licence is established; render shared id with Geist Mono fallback |

Use original TTF/OTF files from official distributions, target membership and `UIAppFonts`; verify PostScript names in the built app. Avoid WOFF2 conversion/subsetting, particularly fonts with Reserved Font Names. Bundle copyright/licence texts and make them accessible through a small Acknowledgements/About presentation. This necessary ancillary presentation does not turn the product into a settings-heavy app.

Input Mono's personal desktop licence does not establish app embedding rights, including TestFlight. The report found a DJR Mini app licence and approximate pricing; verify current terms/price before purchase. No purchase or licence inquiry is authorized by this document. Skip user-installed font entitlements, runtime font downloads and font-provider flows for v1.

Preserve valid web font ids when parsing links independently of availability. Recommended fallback: a link specifying Input Mono keeps that id in shared state but displays Geist Mono until licensed, so re-sharing does not discard intent. Whether the unavailable font appears disabled in the menu is open; do not quietly change the default to Input Mono.

### Text and Dynamic Type

Use a centred vertical native text field as the starting implementation, with `@FocusState`. Fit the chosen font by measuring within the actual panel and binary-searching approximately 96→16pt, re-running for text/font/geometry changes. Use a fixed-size specimen font; it is display content governed by fitting. Match 1.05 line-height and -0.02em tracking intent where feasible, recognizing native font metrics differ. Do not recreate DOM caret synchronization.

The native field needs tests for Return-to-end-editing, Esc, empty `Aa`, paste, long unbroken words, keyboard safe areas and caret preservation. `minimumScaleFactor` and `onSubmit` on a vertical field are not proven equivalents. Measurement and rendered wrapping must agree. Keep full opacity on touch; the web's 65% hover dim only applies where a pointer exists.

**The 100-character contract needs special care:** web `slice(0, 100)` counts UTF-16 code units, while Swift `String.count`/`prefix(100)` count grapheme clusters. Do not claim parser parity using the research's Swift sketch. Define safe UTF-16-compatible truncation (without splitting surrogate pairs), test emoji/combining sequences, or approve a coordinated contract change. Also test URL percent encoding, spaces, `+`, `&`, `#` and non-ASCII text.

UI labels use a Dynamic Type-aware custom mono font, with tabular digits. Use the web's mobile 14px as a visual starting point, not a fixed accessibility rule. Menus/sheets should scale fully. A dense bottom-bar cap is a recommendation requiring a tested large-content/reflow strategy; do not claim Larger Text support just because a cap fits. Keep score case as data and labels uppercase.

## 11. Motion, input and accessibility

Source detail: [motion report](docs/research/motion-and-interaction-ios.md).

Carry over action-specific motion: discrete changes animate, continuous slider input updates instantly. Use explicit, narrowly scoped transactions; a delayed colour animation must not delay photo navigation, animate slider input or apply its timing to the entire layout.

| Motion | Native starting point |
| --- | --- |
| Default panels/press | 200ms, timing curve `(0.33, 1, 0.68, 1)` |
| Photo | 600ms crossfade on iPhone; optional directional slide on included iPad layout |
| Photo-derived colours | 100ms animation delay + 700ms fade |
| Swap/level colours | 200ms fade |
| Slider colours and fast readouts | Instant |
| Full image over preview | 400ms; initial dark-panel photo fade 200ms |
| Rolling value | 300ms, 12ms per-character stagger; disable for drags/repeated rapid updates |
| Readout | Visible during use; cancel/restart timer, then hide after about 1s with 200ms fade |
| Copy confirmation | About 1.5s, stable label width |

System menus and share sheets use system motion. The web export pop (400ms overshoot) and EXPORT/CLOSE roll are not required where there is no inline export menu. `.numericText` is a simpler score-number option; a custom `RollText` is needed to match hex and grade strings. Choose style during polish; do not misuse numeric transition on arbitrary letters or build glyph rendering before a simpler version is tested.

Use SwiftUI transitions/completion cleanup for outgoing content. The web's CSS `animationend` and 1ms reduced-motion workaround do not carry over. Ensure quick navigation and zero-animation updates always remove old layers and stale timers.

### Sliders and keys

Draw live gradients and an 8→24pt grip, using a zero-minimum-distance drag for tap/drag control. Clamp position to the usable track, whose grip centre starts/ends 12pt in from the edge; guard narrow/zero geometry and zero chroma range. Animate grip expansion separately from instantaneous value changes.

Provide a real adjustable accessibility representation, preferably `accessibilityRepresentation { Slider(...) }`, with channel names, values and appropriate steps. An accessible representation does not alone prove physical keyboard control; test or implement focused arrow adjustment. Show readout on focus/adjustment as well as drag.

Hardware keyboard support should preserve ←/→ navigation, Space new-photo action and Esc closing/dismissing where included. System focus and editing take precedence: do not steal arrows/Space from text or sliders, Space from a focused button, or modified navigation commands. The research's global hidden-button shortcuts need explicit focus guards and device testing. Use accessible Escape actions for panels, and preserve Full Keyboard Access.

Touch swipe navigation and haptics are optional native additions, not carry-over requirements. If added, keep arrows available, distinguish navigation from slider/text gestures, and use sparse haptics for discrete events rather than every drag tick.

### Accessibility acceptance

- Label icon-only controls and role pickers; expose hex, selected role, method and expanded levels. Use outline/selection semantics, not colour alone.
- Expose one complete spoken score/hex for rolling text; hide decorative leaving characters. Announce score on discrete actions at low priority, not each drag tick.
- Closed panels leave the accessibility/focus tree, or are both hidden and disabled if retained for animation.
- Read Reduce Motion; recommended initial policy is to snap custom animations as the web does, with a short fade alternative requiring a design decision. Cleanup must work with no animation.
- Test Reduce Transparency, Increase Contrast, Show Borders, Differentiate Without Colour and supported glass appearance settings. Let system glass adapt; provide opaque fallbacks for custom translucency and stronger token borders where needed.
- Keep accessibility changes to chrome; never silently alter the user's low-contrast pair to make it “accessible”. That pair is the tool's subject.
- Check VoiceOver, large text, Full Keyboard Access, pointer and smallest supported screen with the keyboard open. Accessibility API availability for 26.x additions needs verification against the chosen floor.

## 12. Share links, Markdown and universal links

Sources: [sharing report](docs/research/sharing-and-links-ios.md), PROJECT-MAP §§9–10, `src/lib/share.ts`, ADR 0006.

### Portable link contract

Keep HTTPS links that work in both clients:

```text
https://colour-shift.vercel.app/?photo=<id>&fg=<rrggbb>&bg=<rrggbb>&algo=apca&font=<id>&text=<text>
```

Always include both colour hexes without `#`; omit absent photo and defaults (WCAG, Departure Mono, `Aa`). Swap exchanges colours; there is no swap flag. Do not serialize slider mode, anchors, panels, stream, editing history or UI focus. Generate from an action-time snapshot of displayed state; do not add automatic URL/state syncing.

Parser rules: validate fields independently; photo id matches ASCII word characters/hyphens, length 1–64; colours are exactly six hex digits and accepted only together; method is WCAG/APCA; font is a known stable id; text is optional and length-limited, with empty text distinct from missing. Reject repeated values for a field, matching the web's array-valued parameter rejection. Use explicit ASCII validation rather than assuming Swift regex `\w` has JavaScript semantics. Unknown fields do not invalidate valid ones.

Native entry additionally validates scheme, allowed host and supported path. Do not accept arbitrary incoming URLs as API origins, image URLs or photographer links. Restoring unsupported licensed-font/APCA choices follows the explicit fallback policies above.

On cold and warm link opening: apply validated fields and shared colours immediately, initialize anchors, fetch shared photo before random photos, seed that photo's original pair from shared colours, then buffer. Preserve shared colours once if no shared photo can load. Warm-link races need an explicit reset/generation policy; original web page initializers are insufficient.

### Sharing and export recommendation

Use a minimal SwiftUI bridge to `UIActivityViewController`, offering the HTTPS URL and a temporary UTF-8 `.md` file together. Provide an action-time snapshot so both describe the same pair. Each destination can choose what it accepts; two supplied items do not guarantee two delivered representations. Anchor iPad popover presentation if iPad is included.

Pure `ShareLink` is simpler for a link-only action, but its representation selection is not the same as URL plus file. The sharing report recommends the UIKit bridge for current behaviour. Keep a file alive until sharing completes/cancels, then clean up safely; cancellation is not a failure. No browser unsupported-share cascade or clipboard `execCommand` fallback is needed.

Retain filename `colour-shift-<texthex>-<backgroundhex>.md`. Markdown includes the Text/Background table (uppercase hex, RGB, OKLCH derived from displayed bytes), active-method grade/score, share URL and linked photographer/Unsplash credit. Preserve headings, precision and trailing newline with fixtures. The file does not need embedded photos, rendered social previews or font files.

Use the standard Markdown UTType where available; otherwise import `net.daringfireball.markdown` with appropriate plain-text conformance, extension and MIME declaration. The report claims a newer SDK adds `UTType.markdown`; verify availability before using it. Test Save to Files and AirDrop with a real file. Copy URL uses UIPasteboard URL/plain-text representations, without reading the clipboard. A separate Save Markdown/Copy action is optional if the system sheet fails the desired workflow, not a required clone of the web export row.

### Universal links require both repos

The app adds Associated Domains for `applinks:colour-shift.vercel.app` and handles URLs with `.onOpenURL`. The website serves `/.well-known/apple-app-site-association` as publicly reachable HTTPS JSON without redirects, using the real Team ID and bundle ID. This file does not exist merely because this handoff recommends it.

Recommended AASA match: root `/` with nonempty `fg` and `bg` query items. The bare website remains in the browser. AASA matching routes the URL; app validation still decides whether parameters are valid. Confirm root/query matching with `swcutil` and device tests before release. Reserve a dedicated share path only if approved; implementing `/p` and changing URL generation is not automatic scope.

Publish AASA early for Apple CDN propagation. Test Notes links, long press, installed/uninstalled behaviour and warm/cold opening. Same-domain Safari navigation and user preference can keep a link in the browser; universal links do not guarantee every tap opens the app. Debug developer-mode association is for development-signed testing, not a Release entitlement or production bypass token.

If the app is absent, the website already restores the link. No custom fallback landing page or URL-scheme routing service is needed. A Smart App Banner is optional web work after obtaining an App Store app id; verify delivery of its full share URL on device.

## 13. What we are not building

Carry forward the web exclusions: embed mode, locked display/showcase mode, social preview image generation, user photo uploads, user-facing theme search, generated palettes, saved collections and persistent edit history. Session backwards navigation remains included.

The proposed native first release also excludes:

- A web view wrapper, React Native bridge, JavaScript engine, DOM/CSS port or copied MDS implementation.
- A replacement backend, direct keyed Unsplash client, Unsplash search picker SDK or OAuth/user accounts.
- SwiftData/Core Data, CloudKit/iCloud sync, login, analytics infrastructure, background refresh or durable photo downloads.
- Display P3/HDR editing, wide-gamut links, alpha-colour editing or a new contrast standard. Photos remain colour-managed input, not a wide-gamut editor feature.
- Exact freshly extracted pairs across different decoders, server-side palette computation, fdlibm ports for bit-identical raw OKLCH or an unapproved gamut/quality change.
- Font installation/provider capabilities, downloaded fonts, unlicensed Input Mono embedding or a new font-library browser.
- A custom share destination, share extension, widget, App Clip, Watch app, macOS/Catalyst release or multiwindow workflow.
- Floating-bar redesign, custom glass morph systems, tab navigation, blanket glass styling, animation dependencies, developer controls or tuning tools in the product UI.
- App Attest/DeviceCheck, custom authentication/secrets, Redis or other database infrastructure without demonstrated need.
- Monetisation, ads, wallpaper/download features, an App Store marketing site or a real app-icon design as part of this documentation task.

Scope exceptions that remain necessary: a small Acknowledgements presentation, privacy-policy access for release, signing/configuration, native sharing and associated-domain/backend changes. These support the core product; they do not imply a full settings system. iPad/device orientations and optional gestures/haptics must be decided explicitly rather than silently excluded or added.

## 14. Decision register and unresolved evidence

These are the choices to resolve in the new spec; **no owner approval is inferred** from this handoff.

| Decision | Recommended starting point | Resolve before |
| --- | --- | --- |
| Minimum OS/toolchain | iOS 26; confirm actual SDK/API availability and owner's devices | Project creation |
| Device scope | iPhone first; explicitly choose iPad/orientations | Target/layout setup |
| Model and package | One Observable model; pure ColorEngine package; values/actions in leaves | Architecture step |
| APCA permission | Obtain native-use clarification; WCAG-only fallback if unavailable, including swatch-label implementation | Shipping APCA code/build |
| Input Mono | Omit binary until licence; Geist Mono UI/fallback; preserve incoming id | Font resources |
| Font corrections | Use official OFL Alpha Lyrae/Ghost Byte; web-policy update is separate | Resource bundling |
| API envelope and version | Freeze `/api/v1/photos`; choose wrapper/lookup/error/tracking shape | Native client implementation |
| Tracking trigger | Keep shown-once invariant provisionally; clarify export/use trigger across clients | Public release |
| Unsplash production/key strategy | Shared proxy key; verify approval/platform expectations | Public release |
| Batch/variety/orientation/filter | Preserve variety first; evaluate batching and content filter | Backend release |
| Cache/rate limits | Metadata-only id cache and tuned IP limits; verify query keys/freshness | Backend release |
| Domain and app identity | Existing production host unless explicitly changed; real Team ID/bundle ID | Links/signing |
| Share interface | UIKit system sheet with URL + file | Sharing step |
| Universal-link root matching | `/` plus both colour params, bare home stays web | TestFlight link test |
| Glass and bar placement | Flat stacked bar; selective regular glass | Native design approval |
| Motion/roll/reduced motion | Web timing; snap under Reduce Motion; choose custom versus numeric score roll | Polish |
| Dynamic Type strategy | Scale chrome, test reflow/large-content support before imposing caps | Layout acceptance |
| Text cap/Unicode | Define safe compatible UTF-16 behaviour; do not silently use grapheme count | Share/text parser tests |
| Pair quality tolerance | Exact algorithm fixtures, similar decoded-photo quality; choose visual/numeric criterion | Extraction acceptance |
| New-photo touch action, swipe/haptics | Keep core action; optional gestures/haptics require choice | Interaction acceptance |

Device/operational evidence still missing from the reports: minimum-iOS AVIF/WebP decoding and actual format negotiation; native resampling/blur look; glass adaptation/refraction/performance; fitted editing/caret/Return behaviour; key routing while controls are focused; zero-height panel animation; Save to Files/share destinations; AASA root-query matching and Apple CDN reachability; Smart App Banner delivery; service cache-key/protection behaviour; nullable metadata and caching permissions. Verify these at the relevant build step. Research adoption percentages, exact SDK release claims and vendor prices are not requirements for the app.

## 15. Proposed build order and acceptance checks

Plan and approve each implementation step in the new repo. This document creates neither fixtures nor app/backend code.

1. **Agree scope and scaffold.** Confirm OS/devices, APCA/font policy, code spelling and package boundary. Add native spec/rules/log/map, app target, package and injectable service interfaces. Build/run a minimal simulator app and run package tests on macOS.
2. **Port pure colour engine.** Generate deterministic fixtures from the actual web engine; port conversions, channels, gamut, WCAG, levels, formatting, pair picker and Markdown. Add APCA only under the resolved licence scope. Match fixed vectors before relying on UI inspection.
3. **Build pair editor.** One model, solid stage, swatches/swap, method/score/levels and accessible custom sliders. Check anchors through repeated level sequences, role-following swap, mode changes, unreachable levels and instant dragging.
4. **Prepare backend contract, then photos.** Implement/review necessary web changes separately. Native client uses the shipped contract. Add loader/extractor, current+three-ahead readiness, navigation, credits and agreed tracking. Test offline/quota/errors/cancellation and late extraction. No key reaches native resources.
5. **Fonts and sample text.** Bundle permitted originals/notices, font menu, fitting and focus. Check all six fonts, fallback shared ids, empty/long/Unicode text, keyboard-open layout and acknowledgements.
6. **Sharing and link restoration.** Snapshot-based URL + Markdown export, clipboard, file lifecycle and native sheet. Deploy approved AASA and configure associated domains. Test old web links and new iOS links in both clients, cold/warm opening, missing photos, malformed/repeated fields and defaults.
7. **Layout, motion and accessibility.** Add agreed iPad/landscape treatment, selective glass, roll and preview polish. Verify small screens, Dynamic Type, VoiceOver, keyboard, reduced motion/transparency and memory/performance. Optional haptics/gestures stay optional.
8. **Release preparation.** Production access, stable API/domain, privacy policy, signing/app identity, licences, app icon decision and TestFlight/device verification. App Store release and any marketing work are separate approved steps.

### Meaningful test coverage

Use Swift Testing for pure/unit tests, XCTest where UI automation is useful, and real-device checks for platform behaviour. Commit generated fixtures with web source revision and dependency versions; no live Unsplash calls are needed in deterministic tests.

- **Engine:** exact hex, grades, passing levels, channel/score strings, Markdown; raw doubles with an explicit tight tolerance (research recommends around 1e-9 with sensible absolute/relative handling near zero). Include greys/hue preservation, gamut edges, NaN guards, tie rounding and negative zero.
- **Level/model actions:** edited role's anchor + current opposite role, repeated high→low levels, nearest crossing and impossible target, swap after level adjustment, mode switching, navigation restores original pair.
- **Extraction:** roughly 20 identical RGBA golden inputs, real swatches/populations and picked pair; separately test iOS image decoding/orientation/colour space and chosen quality criterion. Synthetic swatch policy must match fixture expectations.
- **Networking:** fake transport for envelopes/unknown fields/optional metadata, errors, 429 cooldown, retries, cancellation, duplicate requests and stale completions. Verify legacy web compatibility when backend code changes.
- **Links/export:** validation, duplicate fields, omitted defaults, percent encoding/Unicode cap, both-colours rule, unavailable fonts/APCA policy, missing shared photo and warm-link races; Markdown includes the actual displayed colours and credit.
- **Platform checks:** actual share destinations/Files/popover, universal links, key routing/caret, accessibility, memory pressure and high-frequency slider responsiveness.

Do not adopt research scratchpad parity claims as proof of the new implementation. The reports' successful numeric experiments make the approach plausible; the native repo must reproduce that evidence with its own committed tests.

## 16. Context to take into the new repo

Take `ios.md`, PROJECT-MAP, the existing CLAUDE.md as a **web reference**, SPEC, APP-SPEC, CONTEXT, style guide, ADRs and all nine research reports. Preserve their relative paths or update this document's links. Record the web commit used as the baseline so later changes can be reconciled. Carry approved design assets and permitted font sources/licences; create a native map as code is built rather than editing the web map into a misleading hybrid.

Reference the web source for exact engine, share/parser, fonts, actions, API and motion behaviour. Generate/copy parity fixtures deliberately in a later approved step. Do not copy `.env.local`, `.vercel`, node_modules, build output or local proprietary font files. The new app repo has no Unsplash credential to configure.

When a native choice changes behaviour, write it into the native spec/ADR and identify any required web compatibility change. Keep this handoff's recommended/open status honest until those choices are made. Together these documents should let a fresh builder understand the product, its invariants, the SwiftUI approach, what is still uncertain and the limits of the first release without rediscovering the research.
