# Palette extraction and image loading for the Colour Shift iOS app

Researched 2026-10-05

## Summary for Colour Shift

- **Hand-port node-vibrant 4.0.4 to Swift (about 300 lines). Don't use a library.** You need the histogram, the MMCQ quantiser and the default generator. The algorithm is integer-based and deterministic. A faithful port gives the **same swatches as the web for the same pixels**. The source is small and MIT-licensed ([vbox.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/vbox.ts), [generator-default](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-generator-default/src/index.ts)). The only Swift port, `bd452/swift-vibrant`, was last pushed in 2020, ships only through CocoaPods, and appears not to apply its pixel filter (§2).
- **Aim for "same quality", not "identical pairs".** Identical pixels across browser and iOS can't be guaranteed. The HTML spec "does not define the precise algorithm to use when scaling an image down" on a canvas ([WHATWG canvas](https://html.spec.whatwg.org/multipage/canvas.html#drawing-images)). node-vibrant also shrinks the 200px copy to **40px wide** before quantising (`quality: 5`), so each palette comes from only about 1,000–2,400 pixels. A one-level change in a few pixels can move a box split. Share links already carry `fg`/`bg`, so iOS never has to re-derive a shared pair (PROJECT-MAP §9).
- **Do ask for the same image format as the browser.** imgix's `auto=format` gave Chrome-style Accept headers an AVIF, and `*/*` a JPEG (§3, my test). On three photos, running node-vibrant 4.0.4 + `pickPair` on the JPEG and the AVIF of the *same* 200px photo gave three different pairs. One background was teal in one format and brown in the other (§2). So send `Accept: image/avif,image/webp,*/*` on iOS too, as `unsplash-ios.md` already recommends. Or pin `fm=` on both platforms.
- **Get pixels like this:** decode the 200px copy with ImageIO. Make a thumbnail whose longer side is `floor(longerSide / 5)`. Draw it into an 8-bit RGBA `CGContext` whose colour space is `CGColorSpace.sRGB`, and read the bytes. That copies the browser's steps: decode, convert to sRGB (the default canvas colour space), shrink by 1/5, `getImageData` (§3).
- **Test the port against golden data from the browser.** Dump `getImageData` pixels and the palette for about 20 photos from the web app. Feed the same bytes to the Swift port and require the **same hex and population** for all six swatches. That proves the algorithm. Then compare iOS-decoded pairs with web pairs by eye, or with a ΔE threshold.
- **Image loading: write a small `PhotoLoader` actor on `URLSession` + `URLCache`. Don't use `AsyncImage`.** `AsyncImage` only promises to use the shared `URLSession` ([docs](https://developer.apple.com/documentation/swiftui/asyncimage)). It has no prefetch API and doesn't give you the decoded pixels. For "3 ahead", fetch both sizes, decode off the main actor, extract the pair, and keep a ready `PreparedPhoto` (image + preview + pair) in memory. If you later want a disk cache, prefetch priorities and a SwiftUI view, use **Nuke 13.2.0** (MIT, iOS 15+, `ImagePrefetcher`, `ThumbnailOptions`).
- **Size the `URLCache` to at least ~10 MB of disk.** A 1600px Unsplash JPEG was 190–300 KB in my test, and `URLSession` only caches a response "no larger than about 5% of the disk cache size" ([Apple](https://developer.apple.com/documentation/foundation/urlsessiondatadelegate/urlsession(_:datatask:willcacheresponse:completionhandler:))). Unsplash sends `cache-control: public, max-age=31536000`.
- **Blurred preview: keep the web's approach (blur the 200px copy) as the main path.** It is already downloaded for extraction and matches the web. BlurHash (`blur_hash` is on every Unsplash photo object, per the [API docs](https://unsplash.com/documentation#blurhash-placeholders)) is a good *instant* placeholder before the 200px copy arrives, for example for a shared photo on cold start. It needs `/api/photos` to pass the field through. The decoder is one standalone MIT file ([woltapp/blurhash Swift](https://github.com/woltapp/blurhash/tree/master/Swift)).
- **Don't use Core Image `CIKMeans` for extraction.** It is a different algorithm (k-means, default 8 clusters) and works in linear extended sRGB by default ([kMeans()](https://developer.apple.com/documentation/coreimage/cifilter-swift.class/kmeans()), [workingColorSpace](https://developer.apple.com/documentation/coreimage/cicontextoption/workingcolorspace)). The pairs would differ in kind, not just in detail.

## Findings

### 1. node-vibrant 4.0.4: the algorithm exactly

Version check: the web app pins `node-vibrant ^4.0.4`, and 4.0.4 is installed. 4.0.4 is the latest npm version (published 2026-01-27; `npm view node-vibrant`). I diffed the GitHub tag [`v4.0.4`](https://github.com/Vibrant-Colors/node-vibrant/tree/v4.0.4) against `node_modules` for the generator, `vbox.ts` and core `index.ts`. They are identical. All file links below are at that tag.

**Entry point and defaults.** `node-vibrant/browser` registers the image class, the pipeline and the defaults:

| Setting | Value | Source |
|---|---|---|
| `colorCount` | 64 | [vibrant-core/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-core/src/index.ts) (`DefaultOpts`) |
| `quality` | 5 (shrink factor: ratio = 1/5) | same; used in [vibrant-image/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image/src/index.ts) `scaleDown` |
| `maxDimension` | unset (it would override `quality`) | same file |
| `quantizer` | `"mmcq"` | [node-vibrant/src/configs/config.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/node-vibrant/src/configs/config.ts) |
| `generators` | `["default"]` | same |
| `filters` | `["default"]` | same |
| Default filter | keep a pixel if `a >= 125 && !(r > 250 && g > 250 && b > 250)` | [node-vibrant/src/pipeline/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/node-vibrant/src/pipeline/index.ts) |

**Steps for one `Vibrant.from(url).getPalette()` call in the browser:**

1. **Load.** Creates an `<img>` with `crossOrigin = "anonymous"`. Draws it at natural size on a hidden canvas ([vibrant-image-browser/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image-browser/src/index.ts)).
2. **Shrink.** `scaleDown` sets ratio = `1 / quality` = 0.2. `resize` sets `canvas.width = width * 0.2` and `canvas.height = height * 0.2`, then `context.scale(0.2, 0.2)` and `drawImage(img, 0, 0)`. Canvas `width`/`height` are integer attributes, so fractions are dropped. A 200×133 preview becomes **40×26 = 1,040 pixels**. A 200×300 portrait becomes 40×60 = 2,400. (So PROJECT-MAP's "200px image" is really a 40px image by the time it is quantised.) The resampling filter is up to the browser ([WHATWG canvas](https://html.spec.whatwg.org/multipage/canvas.html#drawing-images)).
3. **Read pixels.** `getImageData` returns 8-bit RGBA in the canvas colour space, which defaults to `"srgb"` (`CanvasRenderingContext2DSettings`, [WHATWG canvas](https://html.spec.whatwg.org/multipage/canvas.html#canvasrenderingcontext2dsettings)).
4. **Filter.** Each pixel that fails the default filter gets alpha set to 0 ([vibrant-image/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image/src/index.ts) `applyFilters`).
5. **Histogram** ([vibrant-image/src/histogram.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image/src/histogram.ts)). `sigBits = 5`, so each channel is shifted right by 3. That gives 32×32×32 = 32,768 bins with index `(r << 10) + (g << 5) + b`. Pixels with alpha 0 are skipped. It also records the min/max of r, g and b.
6. **MMCQ, modified median cut** ([vibrant-quantizer-mmcq/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/index.ts), [vbox.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/vbox.ts), [pqueue.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/pqueue.ts)):
   - It starts with one box around the min/max. The queue is an array that is re-sorted (ascending) before each pop; `pop()` takes the last item, so the largest goes first.
   - **Phase 1:** sort by pixel `count`. Split the biggest box until there are `0.75 × 64 = 48` boxes, or until nothing changes.
   - **Phase 2:** re-sort by `count × volume` and call `_splitBoxes(pq2, colorCount - pq2.size())`. **Quirk:** the target is `64 − 48 = 16`, and the queue already has 48, so phase 2 normally does **nothing**. You usually get at most 48 swatches, not 64. Phase 2 only splits when phase 1 stopped early, because the image has few colours.
   - **Split:** cut along the longest axis. Ties go to r, then g, then b. Build cumulative sums along that axis. `splitPoint` is the first index where the running sum is more than `total / 2`. Then the cut is set: if `left <= right`, `d2 = min(d2 − 1, trunc(splitPoint + right / 2))`, otherwise `d2 = max(d1, trunc(splitPoint − 1 − left / 2))`. After that it walks `d2` past empty slices (`while (!accSum[d2]) d2++`, then a reverse-sum check). Copy this exactly. JS reads past the end of an array as `undefined`, but Swift would crash, so the port needs bounds checks that act the same way.
   - **Swatch colour:** the population-weighted mean of bin centres, `(bin + 0.5) × 8`, truncated with `~~`. **Population** is the box's pixel count.
   - **Order:** swatches come out popped from the phase-2 queue, so in descending `count × volume`. The generator keeps the *first* best match (`value > maxValue`), so this order breaks ties. JS `Array.prototype.sort` is stable ([ECMA-262](https://tc39.es/ecma262/#sec-array.prototype.sort)), and so is Swift's `sort` ("guaranteed to be stable", [Apple](https://developer.apple.com/documentation/swift/mutablecollection/sort(by:))). A port that uses the same comparator therefore keeps ties in the same order.
7. **Default generator** ([vibrant-generator-default/src/index.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-generator-default/src/index.ts)). Each swatch has HSL from `rgbToHsl` (all values 0–1, [vibrant-color/src/converter.ts](https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-color/src/converter.ts)). The targets are chosen in this order, and a swatch already picked can't be picked again:

| Target | L range (target) | S range (target) |
|---|---|---|
| Vibrant | 0.30–0.70 (0.50) | 0.35–1 (1.0) |
| LightVibrant | 0.55–1 (0.74) | 0.35–1 (1.0) |
| DarkVibrant | 0–0.45 (0.26) | 0.35–1 (1.0) |
| Muted | 0.30–0.70 (0.50) | 0–0.40 (0.30) |
| LightMuted | 0.55–1 (0.74) | 0–0.40 (0.30) |
| DarkMuted | 0–0.45 (0.26) | 0–0.40 (0.30) |

   Score = `weightedMean(1−|S−tS|, 3, 1−|L−tL|, 6.5, population/maxPopulation, 0.5)`, and the highest wins. **Quirk:** `weightedMean` skips any term whose *value* is 0 (`if (!value || !weight) continue`), so it is left out of both sums. Copy that.
8. **Filling gaps** (`_generateEmptySwatches`). Missing targets are made up from others by changing HSL lightness, with **population 0**. This code has copy-paste bugs: the LightMuted branch writes `DarkVibrant`, and the Muted targets set *lightness* to `targetMutesSaturation`. **Colour Shift can skip all of this.** `pickPair` drops population-0 colours (`color-engine.ts` line 285), so made-up swatches never reach a pair.

**How it differs from Android Palette.** node-vibrant's targets come from Android's support-library Palette, by way of Vibrant.js:

| | node-vibrant 4.0.4 | Android Palette, original (support lib, Android 5/6) | Android Palette, current (androidx) |
|---|---|---|---|
| Quantiser | MMCQ, 5-bit, 64 colours (≤48 in practice) | `ColorCutQuantizer`, 5-bit, 16 colours | same, 16 colours, volume-first queue ([ColorCutQuantizer.java](https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/ColorCutQuantizer.java)) |
| Downscale | ×1/5 | min dimension 100 | area 112×112 ([Palette.java](https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/Palette.java)) |
| Pixel filter | drop transparent and near-white | n/a | drop L≤0.05, L≥0.95 and the "red I-line" (same file, `DEFAULT_FILTER`) |
| Luma/sat targets | as table above | same values | same values ([Target.java](https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/Target.java)) |
| Weights sat/luma/pop | 3 / 6.5 / 0.5 (weighted mean) | 3 / 6 / 1 ([DefaultGenerator.java, android-6.0.0_r1](https://github.com/aosp-mirror/platform_frameworks_support/blob/android-6.0.0_r1/v7/palette/src/main/java/android/support/v7/graphics/DefaultGenerator.java)) | 0.24 / 0.52 / 0.24, summed; population relative to the dominant swatch (Target.java, Palette.java `generateScore`) |
| Made-up missing swatches | yes (population 0) | yes | no |

Vibrant.js, the CoffeeScript port that node-vibrant grew from, also used 3 / 6 / 1 ([Vibrant.coffee](https://github.com/jariz/vibrant.js/blob/master/src/Vibrant.coffee); archived). I couldn't find where 6.5 / 0.5 came from.

### 2. Swift options and how exact it must be

**Existing Swift ports and nearby libraries** (GitHub API, checked 2026-10-05):

| Repo | What | Last push | Licence | Fidelity to node-vibrant 4.0.4 |
|---|---|---|---|---|
| [bd452/swift-vibrant](https://github.com/bd452/swift-vibrant) | port of node-vibrant 3.x | 2020-05-14 | MIT | Same generator constants (3 / 6.5 / 0.5) and `colorCount 64`, `quality 5`. But: the MMCQ is borrowed from ColorThiefSwift; `weightedMean` doesn't skip zero terms; `applyFilter` changes a copy `pixels` and returns the unfiltered `imageData`, so as far as I can read the filter **is never applied** ([Image.swift](https://github.com/bd452/swift-vibrant/blob/master/swiftVibrant/Image.swift)); it reads pixels in `DeviceRGB` with `byteOrder32Little` while indexing bytes as RGBA; it filters swatches again after quantising. It is CocoaPods-only, and CocoaPods trunk goes read-only on 2 December 2026 ([CocoaPods blog](https://blog.cocoapods.org/CocoaPods-Specs-Repo/)). I read this code but didn't run it. |
| [shnhrrsn/ImagePalette](https://github.com/shnhrrsn/ImagePalette) | port of old Android Palette | 2020-11-27 | Apache-2.0 | Android, not node-vibrant |
| [jonathanzong/SwiftMaterialPalette](https://github.com/jonathanzong/SwiftMaterialPalette) | Android-style palette | 2015-11-06 | MIT | Android-style |
| [yamoridon/ColorThiefSwift](https://github.com/yamoridon/ColorThiefSwift) | Color Thief MMCQ | 2024-01-27 | MIT | MMCQ only, no Vibrant targets |
| [jathu/UIImageColors](https://github.com/jathu/UIImageColors) | its own method | 2021, **archived** | MIT | different |
| [indragiek/DominantColor](https://github.com/indragiek/DominantColor), [DenDmitriev/DominantColors](https://github.com/DenDmitriev/DominantColors) | k-means / other | 2023 / 2025 | MIT | different |
| [2dubu/PaletteKit](https://github.com/2dubu/PaletteKit) | OKLCH dominant colours | 2026-09-19 | MIT | different, and very new (27 stars) |

None is a maintained, faithful port of 4.0.4. I found nothing on the Swift Package Index under "vibrant" either; GitHub search found only swift-vibrant.

**Core Image.**
- `CIFilter.kMeans()` (iOS 14+) outputs a `count × 1` image. Each pixel is a cluster centre, with alpha as its weight. `count` defaults to 8 (max 128), `passes` to 5 (max 20), and there's a `perceptual` flag ([docs](https://developer.apple.com/documentation/coreimage/cifilter-swift.class/kmeans())). You could feed its centres and weights into the node-vibrant generator, but the swatches would be k-means centres, not MMCQ boxes. Core Image also works in linear extended sRGB unless told otherwise ([workingColorSpace](https://developer.apple.com/documentation/coreimage/cicontextoption/workingcolorspace)).
- `areaAverage()` gives one average colour ([docs](https://developer.apple.com/documentation/coreimage/cifilter-swift.class/areaaverage())). `areaHistogram()` gives per-channel histograms with 1–2048 bins, not a 3-D colour histogram ([docs](https://developer.apple.com/documentation/coreimage/cifilter-swift.class/areahistogram())). Neither replaces MMCQ.
- The images are tiny (≤2,400 pixels), so the GPU brings no speed gain. A plain Swift loop over 2,400 pixels takes well under a millisecond (my estimate, not measured).

**A hand port is the right choice.** The code is about 300 lines of integer maths with no dependencies. Copy the quirks listed in §1. The algorithm is deterministic, so **same pixels in, same swatches out** is achievable and testable.

**How exact must it be?** It helps to separate two layers:

1. **Algorithm fidelity (can be exact).** Given identical RGBA bytes, the Swift port must give identical swatches (hex + population). Prove it with golden tests: in the web app, log `getImageData` from node-vibrant's canvas and the resulting palette for about 20 photos. Commit them as fixtures and run the Swift port on the same bytes.
2. **Pixel fidelity (can't be exact).** The browser picks the canvas downscale filter, and it isn't specified ([WHATWG](https://html.spec.whatwg.org/multipage/canvas.html#drawing-images)). It differs between Chrome, Safari and Firefox, and so does image decoding. So **the web app already gives different pairs for the same photo in different browsers**. I infer this from the spec; I didn't test it across browsers.

   The input is so small (about 1,000–2,400 pixels, 48 boxes) that small pixel changes can flip a box split or a target choice. My test shows how much. I ran the installed node-vibrant 4.0.4 (Node build) + the app's `pickPair` on the JPEG and the AVIF of the same `w=200` Unsplash URL. Both were decoded by macOS `sips` to PNG, so the only difference was the codec.

| Photo | JPEG pair (bg / text) | AVIF pair (bg / text) |
|---|---|---|
| `photo-1461988320302-91bde64fc8e4` | `#3c3c3c` / `#bab9b4` | `#443c42` / `#bebcbc` |
| `photo-1506744038136-46273834b3fb` | `#2c4754` / `#d4b4a4` | `#39494b` / `#d6b5a4` |
| `photo-1501594907352-04cda38ebc29` | `#315a5f` / `#a4c4d6` | `#603428` / `#9fc6dc` |

   Two pairs are close; one background changes hue completely. Even within one format, iOS and Chrome will resample differently.

**Recommendation:** promise "a pair of the same quality from the same rules", not "the identical pair". Nothing in the app needs identical pairs, because share links carry `fg`/`bg` (PROJECT-MAP §9). Do remove the *avoidable* differences: same image format (Accept header or `fm`), sRGB pixels, the same ×1/5 shrink with truncated sizes, and the same filter.

**Swift sketch: generator scoring (the part most easily got wrong).**

```swift
struct Swatch { let r, g, b: Int; let population: Int; let h, s, l: Double }

/// node-vibrant's weightedMean: a term whose value is 0 is dropped from both sums.
func weightedMean(_ pairs: [(value: Double, weight: Double)]) -> Double {
    var sum = 0.0, weightSum = 0.0
    for (v, w) in pairs where v != 0 && w != 0 { sum += v * w; weightSum += w }
    return sum / weightSum   // NaN if every term is 0, as in JS; NaN > x is false, so the swatch is never chosen
}

func score(_ s: Swatch, tS: Double, tL: Double, maxPop: Int) -> Double {
    weightedMean([
        (1 - abs(s.s - tS), 3),
        (1 - abs(s.l - tL), 6.5),
        (Double(s.population) / Double(maxPop), 0.5),
    ])
}

/// Swatches must be in quantiser output order (descending count × volume) so ties resolve as on the web.
func find(_ swatches: [Swatch], taken: Set<Int>, maxPop: Int,
          l: ClosedRange<Double>, tL: Double, sat: ClosedRange<Double>, tS: Double) -> Int? {
    var best: Int?; var bestValue = 0.0
    for (i, sw) in swatches.enumerated()
    where sat.contains(sw.s) && l.contains(sw.l) && !taken.contains(i) {
        let v = score(sw, tS: tS, tL: tL, maxPop: maxPop)
        if best == nil || v > bestValue { best = i; bestValue = v }
    }
    return best
}
```

Note: JS's `if (max === null || value > maxValue)` means the first eligible swatch is always taken, even if its score is NaN. The sketch keeps that.

### 3. Decoding, downsampling and reading sRGB pixels on iOS

**ImageIO thumbnailing.** `CGImageSourceCreateThumbnailAtIndex` makes a scaled image straight from the encoded data ([docs](https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:))). The options that matter:
- `kCGImageSourceThumbnailMaxPixelSize`: the maximum width *and* height ([docs](https://developer.apple.com/documentation/imageio/kcgimagesourcethumbnailmaxpixelsize)).
- `kCGImageSourceCreateThumbnailFromImageAlways`: build it from the full image, not an embedded thumbnail ([docs](https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailfromimagealways)).
- `kCGImageSourceCreateThumbnailWithTransform`: apply EXIF orientation ([docs](https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailwithtransform)).
- `kCGImageSourceShouldCacheImmediately`: decode now rather than at first render ([docs](https://developer.apple.com/documentation/imageio/kcgimagesourceshouldcacheimmediately)).

WWDC18 session 219, *Image and Graphics Best Practices*, recommends this pattern: create the source with `kCGImageSourceShouldCache: false`, then make the thumbnail with the options above ([WWDC18 219](https://developer.apple.com/videos/play/wwdc2018/219/)). The video page didn't render for me; the details come from transcripts at [nonstrict.eu WWDC index](https://nonstrict.eu/wwdcindex/wwdc2018/219/) and [NSHipster](https://nshipster.com/image-resizing/), both secondary.

**Matching the web's 40px step.** The web scales both sides by 0.2 and truncates. With `maxPixelSize`, ImageIO scales the *longer* side to that value. So pass `floor(longerSide / 5)`, then check that the result is `floor(w/5) × floor(h/5)`. If it is off by a pixel because of rounding, draw into a context of exactly that size instead. ImageIO's resampling filter isn't documented, and neither is the browser's, so this matches the size, not the exact pixels.

**Colour space.** Unsplash's 200px JPEG and AVIF both carry an `sRGB IEC61966-2.1` profile (checked with `sips`). Browsers draw into an sRGB canvas by default ([WHATWG](https://html.spec.whatwg.org/multipage/canvas.html#canvasrenderingcontext2dsettings)). On iOS, draw the `CGImage` into a bitmap context created with `CGColorSpace(name: CGColorSpace.sRGB)` ([docs](https://developer.apple.com/documentation/coregraphics/cgcolorspace/srgb)). Core Graphics then colour-matches any other profile (for example Display P3) into sRGB, as the browser does. Don't use `DeviceRGB`, and don't read `dataProvider` bytes directly: the format and colour space vary. Use `premultipliedLast` with big-endian byte order, so the bytes are R, G, B, A and alpha is 255 for opaque photos. The filter needs `a >= 125`, so a "skip" alpha byte of unknown value would be a bug.

```swift
import ImageIO
import CoreGraphics

/// RGBA bytes in sRGB, shrunk ×1/5 like node-vibrant's `quality: 5`.
func vibrantPixels(from data: Data) -> (bytes: [UInt8], width: Int, height: Int)? {
    let srcOpts = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let src = CGImageSourceCreateWithData(data as CFData, srcOpts),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
          let w0 = props[kCGImagePropertyPixelWidth] as? Int,
          let h0 = props[kCGImagePropertyPixelHeight] as? Int else { return nil }

    let w = Int(Double(w0) * 0.2), h = Int(Double(h0) * 0.2)   // canvas truncation
    let thumbOpts = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceThumbnailMaxPixelSize: max(w, h),
    ] as CFDictionary
    guard let thumb = CGImageSourceCreateThumbnailAtIndex(src, 0, thumbOpts),
          let space = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }

    var bytes = [UInt8](repeating: 0, count: w * h * 4)
    let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    let ok = bytes.withUnsafeMutableBytes { buf -> Bool in
        guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: space, bitmapInfo: info) else { return false }
        ctx.interpolationQuality = .medium     // tune against browser fixtures; not specified on either side
        ctx.draw(thumb, in: CGRect(x: 0, y: 0, width: w, height: h))  // exact size, even if thumb is off by 1
        return true
    }
    return ok ? (bytes, w, h) : nil
}
```

Row order doesn't matter: the histogram ignores pixel position. AVIF decodes in ImageIO here: `public.avif` is in `CGImageSourceCopyTypeIdentifiers()` on this Mac (macOS 26), and `sips` decoded the AVIF. I didn't test iOS, but the sibling research suggests an iOS 26 deployment target (`liquid-glass.md`).

### 4. Image loading and caching

**`AsyncImage`.** The docs say only that it "uses the shared `URLSession` instance to load an image" ([docs](https://developer.apple.com/documentation/swiftui/asyncimage)). So its only caching is whatever `URLCache.shared` does. It has no prefetch API, no way to set request headers (so no Accept header for AVIF), and it doesn't expose the bytes or the `CGImage`. It also restarts when the view's identity changes. It doesn't fit "preloaded so they show instantly".

**`URLCache` / `URLSession`.**
- `URLCache` is a thread-safe memory + disk cache. You can set the capacities with `init(memoryCapacity:diskCapacity:directory:)`. Apple says "a disk cache measured in the tens of megabytes is acceptable in most cases" ([URLCache](https://developer.apple.com/documentation/foundation/urlcache), [init](https://developer.apple.com/documentation/foundation/urlcache/init(memorycapacity:diskcapacity:directory:))).
- A default session uses `URLCache.shared`, and an ephemeral session uses a memory-only private cache ([urlCache](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/urlcache)).
- A response is cached only if it is "no larger than about 5% of the disk cache size" ([willCacheResponse](https://developer.apple.com/documentation/foundation/urlsessiondatadelegate/urlsession(_:datatask:willcacheresponse:completionhandler:))).
- Measured on 2026-10-05: 1600px copies were 190–297 KB as JPEG and 91–214 KB as AVIF. 200px copies were 7–10 KB. All had `cache-control: public, max-age=31536000` and `vary: Accept, User-Agent`. So a 20–50 MB disk cache is plenty.

**Libraries** (versions from GitHub releases, 2026-10-05):

| Library | Latest | Licence | Prefetch API | Notes |
|---|---|---|---|---|
| [Nuke](https://github.com/kean/Nuke) | 13.2.0 (2026-08-15) | MIT | `ImagePrefetcher(pipeline:destination:maxConcurrentRequestCount:)`, `startPrefetching(with:)`, `stopPrefetching`, `isPaused`, `priority` ([ImagePrefetcher.swift](https://github.com/kean/Nuke/blob/13.2.0/Sources/Nuke/Prefetching/ImagePrefetcher.swift), [guide](https://github.com/kean/Nuke/blob/13.2.0/Documentation/Nuke.docc/Performance/prefetching.md)) | Nuke 13 moved fully to Swift Concurrency with "full Data Race Safety"; it needs iOS 15 and Xcode 26 ([13.0.0 notes](https://github.com/kean/Nuke/releases/tag/13.0.0)). Per-request `ImageRequest.ThumbnailOptions(maxPixelSize:)` ([ImageRequest.swift](https://github.com/kean/Nuke/blob/13.2.0/Sources/Nuke/ImageRequest.swift)). NukeUI has `LazyImage` for SwiftUI. |
| [Kingfisher](https://github.com/onevcat/Kingfisher) | 8.13.0 (2026-09-23) | MIT | `ImagePrefetcher(urls:…)`, `start()`, `stop()`, `maxConcurrentDownloads = 5` ([ImagePrefetcher.swift](https://github.com/onevcat/Kingfisher/blob/8.13.0/Sources/Networking/ImagePrefetcher.swift)) | iOS 15+; `DownsamplingImageProcessor`; `KFImage` for SwiftUI |
| [SDWebImage](https://github.com/SDWebImage/SDWebImage) + [SDWebImageSwiftUI](https://github.com/SDWebImage/SDWebImageSwiftUI) | 5.21.7 (2026-02-26) / 3.1.4 (2025-11-03) | MIT | `SDWebImagePrefetcher prefetchURLs:`, `maxConcurrentPrefetchCount` ([header](https://github.com/SDWebImage/SDWebImage/blob/5.21.7/SDWebImage/Core/SDWebImagePrefetcher.h)) | Objective-C core; the slowest release pace of the three |

**Recommendation for "keep 3 ahead, with their 200px copies".** The web app's buffer is a short, ordered list that the app owns, not a scrolling grid. A small actor is simpler than a library and gives you the raw bytes the extractor needs:

```swift
struct PreparedPhoto: Sendable { let photo: Photo; let display: CGImage; let preview: CGImage; let pair: Pair? }

actor PhotoLoader {
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = URLCache(memoryCapacity: 8 << 20, diskCapacity: 50 << 20)
        c.httpAdditionalHeaders = ["Accept": "image/avif,image/webp,*/*"]   // same format as browsers
        return URLSession(configuration: c)
    }()
    private var tasks: [Photo.ID: Task<PreparedPhoto, Error>] = [:]

    /// Called for each photo in the buffer (current + 3 ahead). Idempotent, like the web's `prepared` ref.
    func prepare(_ photo: Photo) -> Task<PreparedPhoto, Error> {
        if let t = tasks[photo.id] { return t }
        let t = Task {
            async let small = session.data(from: photo.url(width: 200)).0
            async let large = session.data(from: photo.url(width: 1600)).0
            let previewData = try await small
            let pair = vibrantPixels(from: previewData).flatMap { extractPair($0) }   // ported MMCQ + pickPair
            let preview = try decode(previewData, maxPixel: 200)
            let display = try decode(try await large, maxPixel: 1600)               // ShouldCacheImmediately
            return PreparedPhoto(photo: photo, display: display, preview: preview, pair: pair)
        }
        tasks[photo.id] = t
        return t
    }
    func forget(_ id: Photo.ID) { tasks[id]?.cancel(); tasks[id] = nil }
}
```

- Decoded 1600×1067 RGBA is about 6.8 MB, so 4–5 held photos use about 30 MB. That's fine. If you want less, decode the display copy at screen pixel size: `maxPixel` = panel width × `displayScale`.
- Show with `Image(decorative: cgImage, scale: 1)`.
- If you later want a disk cache that survives launches, priorities and cancellation for free, swap the body for Nuke: `ImagePipeline` with a `DataCache`, and `ImagePrefetcher` for the 3 ahead. Keep the extractor working on the 200px `Data`, from `pipeline.data(for:)`.

### 5. Blurred preview

**What the web does:** an `<img>` of the 200px copy with Tailwind `blur-xl scale-110 object-cover`, under the full photo until it loads (`src/components/photo-panel.tsx` line 108).

**SwiftUI `.blur(radius:opaque:)`** applies a Gaussian blur to the rendered view ([docs](https://developer.apple.com/documentation/swiftui/view/blur(radius:opaque:))):

```swift
Image(decorative: prepared.preview, scale: 1)
    .resizable().scaledToFill()
    .blur(radius: 24, opaque: true)   // opaque avoids see-through edges; tune radius by eye
    .scaleEffect(1.1)
    .clipped()
```

Apple doesn't say how `radius` relates to CSS's `blur()` value, so match the look on a device rather than copying the number. It costs nothing extra: the 200px copy is already downloaded for extraction.

**Unsplash `blur_hash`.** "All photo objects returned by the Unsplash API include a `blur_hash` string … a very compact representation of an image placeholder" ([API docs](https://unsplash.com/documentation#blurhash-placeholders)). Example: `"LoC%a7IoIVxZ_NM|M{s:%hRjWAo0"`.
- The Swift decoder is a standalone file that adds `UIImage(blurHash:size:punch:)`. Its README says "32 pixels wide is plenty" and to let UIKit scale it up ([Swift README](https://github.com/woltapp/blurhash/tree/master/Swift), [BlurHashDecode.swift](https://github.com/woltapp/blurhash/blob/master/Swift/BlurHashDecode.swift); MIT, [License.md](https://github.com/woltapp/blurhash/blob/master/License.md)).
- The repo was last pushed in 2024-07. That's fine for a finished algorithm.
- The decoder builds its `CGImage` with `CGColorSpaceCreateDeviceRGB()`. I didn't verify how iOS treats DeviceRGB, so check the colours visually against the web.

**Compared:**

| | Blurred 200px copy | BlurHash |
|---|---|---|
| Network | one ~7–10 KB request (needed anyway for extraction) | none; it comes with the photo JSON |
| Available | after the 200px download | immediately |
| Look | the real photo, blurred; matches the web | smooth 4×3-ish colour field; softer than the web |
| Work needed | none beyond extraction | `/api/photos` must pass `blur_hash` through (today's `Photo` type drops it) |

Use the blurred 200px copy for parity. With the 3-ahead buffer it is almost always ready before the photo is shown. Add BlurHash only as the first layer, for the cases where nothing is buffered: cold start and opening a shared photo. `unsplash-ios.md` already recommends adding `blurHash` to the proxy response.

### 6. Concrete recommendation for Colour Shift iOS

1. **Image fetch:** an app-owned `PhotoLoader` actor. One `URLSession` with a 50 MB-disk `URLCache` and `Accept: image/avif,image/webp,*/*`. URLs as on the web: `w=200` / `w=1600`, `q=80&auto=format&fit=max`.
2. **Buffer:** same as the web: current photo + 3 ahead (`PHOTOS_AHEAD`). `prepare(photo)` runs once per id and returns a `PreparedPhoto`: display `CGImage` decoded off the main actor, preview `CGImage`, and the pair.
3. **Extraction:** a Swift port of node-vibrant 4.0.4: filter → 5-bit histogram → MMCQ (48/64 quirk included) → default generator (skip the gap-filling step) → the ported `pickPair`. Input is sRGB RGBA bytes from the 200px copy, shrunk ×1/5 with truncated sizes.
4. **Tests:** golden fixtures exported from the web (pixels → palette) must match exactly. A second suite compares iOS-decoded pairs with web pairs within a tolerance; agree that tolerance with the owner.
5. **Preview:** blurred 200px copy (`.blur(radius:opaque: true)`, scaled 1.1, clipped). Optionally a BlurHash layer underneath once the proxy sends `blurHash`.
6. **No third-party dependency at first.** If disk persistence or richer prefetching is needed later, adopt Nuke 13.2.x.

## Open questions / decisions for the owner

- **How close must iOS pairs be to web pairs?** Options: (a) "same rules, similar quality". This document recommends (a). (b) A numeric tolerance, for example ΔE OK < 0.05 on both colours for 90% of a test set. (c) Exact. Exact isn't reachable without computing pairs on the server.
- **Compute pairs on the server instead?** `/api/photos` could run node-vibrant (Node build) and return the pair, so web and iOS get the *same* pair. That costs server CPU and an image fetch per photo. It also changes the web's result slightly: the Node build resizes with Jimp, not the browser canvas. It's a back-end change, so it's out of scope here, but it is the only route to identical pairs.
- **Pin the format?** Today the format depends on each client's Accept header. Pinning `fm=avif` (or `fm=jpg`) for the 200px copy on both platforms removes one source of difference. Note that it would also change the web's current output.
- **Pass `blur_hash` through `/api/photos`?** It's cheap, and it helps cold start and share links.
- **Is the "200px" in PROJECT-MAP §8 worth correcting?** Extraction really runs on a 40px-wide image (`quality: 5`). You could raise it with `Vibrant.from(src).quality(1)` or `maxDimension` on both platforms. That would make results steadier, and probably closer between platforms, but it changes today's pairs. Not tested.
- **Not verified:** how iOS treats `DeviceRGB` in the BlurHash decoder; the browsers' canvas downscale filters; how `.blur` radius maps to CSS `blur()`; swift-vibrant's behaviour at run time (I only read its code); AVIF decoding on iOS itself (verified on macOS 26 only); the default Accept header `URLSession` sends (my test used curl with explicit headers).

## Sources

node-vibrant 4.0.4 (tag `v4.0.4`, diffed against the installed package):
- https://github.com/Vibrant-Colors/node-vibrant/tree/v4.0.4
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-core/src/index.ts : `DefaultOpts` (colorCount 64, quality 5)
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/node-vibrant/src/configs/config.ts : quantizer/generator/filter names
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/node-vibrant/src/pipeline/index.ts : default filter
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image/src/index.ts : `scaleDown`, `applyFilters`
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image/src/histogram.ts : 5-bit histogram
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-image-browser/src/index.ts : canvas load/resize/getImageData
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/index.ts : MMCQ phases
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/vbox.ts : box split/average
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-quantizer-mmcq/src/pqueue.ts : sorted-array queue
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-generator-default/src/index.ts : targets, weights, gap filling
- https://github.com/Vibrant-Colors/node-vibrant/blob/v4.0.4/packages/vibrant-color/src/converter.ts : `rgbToHsl`

Android Palette and Vibrant.js:
- https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/Target.java
- https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/Palette.java
- https://github.com/androidx/androidx/blob/androidx-main/palette/palette/src/main/java/androidx/palette/graphics/ColorCutQuantizer.java
- https://github.com/aosp-mirror/platform_frameworks_support/blob/android-6.0.0_r1/v7/palette/src/main/java/android/support/v7/graphics/DefaultGenerator.java : original 3 / 6 / 1 weights
- https://github.com/jariz/vibrant.js/blob/master/src/Vibrant.coffee : Vibrant.js 3 / 6 / 1

Web platform:
- https://html.spec.whatwg.org/multipage/canvas.html#drawing-images : downscale algorithm not defined
- https://html.spec.whatwg.org/multipage/canvas.html#canvasrenderingcontext2dsettings : `colorSpace = "srgb"` default
- https://tc39.es/ecma262/#sec-array.prototype.sort : stable sort

Apple:
- https://developer.apple.com/documentation/coreimage/cifilter-swift.class/kmeans()
- https://developer.apple.com/documentation/coreimage/cifilter-swift.class/areaaverage()
- https://developer.apple.com/documentation/coreimage/cifilter-swift.class/areahistogram()
- https://developer.apple.com/documentation/coreimage/cicontextoption/workingcolorspace
- https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:)
- https://developer.apple.com/documentation/imageio/kcgimagesourcethumbnailmaxpixelsize
- https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailfromimagealways
- https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailwithtransform
- https://developer.apple.com/documentation/imageio/kcgimagesourceshouldcacheimmediately
- https://developer.apple.com/documentation/coregraphics/cgcolorspace/srgb
- https://developer.apple.com/documentation/swift/mutablecollection/sort(by:) : stable sort
- https://developer.apple.com/videos/play/wwdc2018/219/ : Image and Graphics Best Practices
- https://developer.apple.com/documentation/swiftui/asyncimage
- https://developer.apple.com/documentation/swiftui/view/blur(radius:opaque:)
- https://developer.apple.com/documentation/foundation/urlcache
- https://developer.apple.com/documentation/foundation/urlcache/init(memorycapacity:diskcapacity:directory:)
- https://developer.apple.com/documentation/foundation/urlsessionconfiguration/urlcache
- https://developer.apple.com/documentation/foundation/urlsessiondatadelegate/urlsession(_:datatask:willcacheresponse:completionhandler:) : 5% rule

Libraries:
- https://github.com/bd452/swift-vibrant (and https://github.com/bd452/swift-vibrant/blob/master/swiftVibrant/Image.swift)
- https://github.com/shnhrrsn/ImagePalette, https://github.com/jonathanzong/SwiftMaterialPalette, https://github.com/yamoridon/ColorThiefSwift, https://github.com/jathu/UIImageColors, https://github.com/indragiek/DominantColor, https://github.com/DenDmitriev/DominantColors, https://github.com/2dubu/PaletteKit
- https://github.com/kean/Nuke/releases/tag/13.0.0, https://github.com/kean/Nuke/blob/13.2.0/Sources/Nuke/Prefetching/ImagePrefetcher.swift, https://github.com/kean/Nuke/blob/13.2.0/Sources/Nuke/ImageRequest.swift, https://github.com/kean/Nuke/blob/13.2.0/Documentation/Nuke.docc/Performance/prefetching.md
- https://github.com/onevcat/Kingfisher/blob/8.13.0/Sources/Networking/ImagePrefetcher.swift
- https://github.com/SDWebImage/SDWebImage/blob/5.21.7/SDWebImage/Core/SDWebImagePrefetcher.h, https://github.com/SDWebImage/SDWebImageSwiftUI
- https://github.com/woltapp/blurhash/tree/master/Swift, https://github.com/woltapp/blurhash/blob/master/Swift/BlurHashDecode.swift, https://github.com/woltapp/blurhash/blob/master/License.md
- https://blog.cocoapods.org/CocoaPods-Specs-Repo/ : trunk read-only on 2 December 2026

Unsplash / imgix:
- https://unsplash.com/documentation#blurhash-placeholders
- https://unsplash.com/documentation#dynamically-resizable-images
- https://docs.imgix.com/en-US/apis/rendering/auto/auto : `auto=format` (AVIF, then WebP, then JPEG/PNG)

Secondary (labelled where used):
- https://nonstrict.eu/wwdcindex/wwdc2018/219/ and https://nshipster.com/image-resizing/ : WWDC18 219 downsampling details

Own tests (2026-10-05, curl + `sips` + node-vibrant 4.0.4 Node build + the app's `pickPair`): format negotiation by Accept header, image sizes and cache headers, embedded sRGB profiles, and the JPEG-vs-AVIF pair comparison in §2.
