# Colour science for the Swift port

Researched 2026-10-05

Scope: how to rebuild `src/lib/color-engine.ts` in Swift so it gives the same numbers as culori 4.0.2 and apca-w3 0.1.9. Both are the latest versions on npm today (`npm view culori version` → 4.0.2; `npm view apca-w3 version` → 0.1.9). The culori files in `node_modules` are byte-identical to the GitHub tag `v4.0.2`. The apca-w3 `src/apca-w3.js` in `node_modules` is byte-identical to GitHub `master` (the file was last changed on 2022-07-04, commit `da50930`).

## Summary for Colour Shift

- **Write the engine by hand in Swift. Don't use a library.** No Swift package uses culori's constants or its algorithms (§7). The engine is about 200 lines. A quick port (in the scratchpad, not committed) already matched culori and apca-w3 **exactly** on 40,000+ test vectors for hex output, `maxChroma`, `clampChroma`, HSV, WCAG and APCA (§Parity risks).
- **Copy culori's constants, not Ottosson's.** culori uses 16-digit constants that differ from the 10-digit `float` constants in Ottosson's post (§1). Use `cbrt` for the forward transform and `pow(x, 3)` for the inverse, as culori does.
- **Use `Double` everywhere, and Foundation `pow`/`cbrt`/`atan2`/`sin`/`cos`.** Never do engine maths in `Float` or through `Color.Resolved` (it stores linear `Float`; §6).
- **Port the algorithms, not just the formulas.** Copy `clampChroma`'s bisection exactly: resolution `0.4 / 2^13`, the "last good chroma" fallback, and the RGB clip when even chroma 0 is out of gamut (§3). Copy the app's own `maxChroma` (20 iterations on `[0, 0.4]`). Don't swap in CSS Color 4's gamut mapping: it gives different colours.
- **Model "no hue" as `Double?` (`nil`).** culori leaves `h` undefined for greys, in HSV and OKLCH (§2). The app reads a missing hue as 0.
- **Paint from the 8-bit hex.** Build `Color(.sRGB, red: r/255, green: g/255, blue: b/255)` from the same bytes you scored. SwiftUI keeps `.sRGB` extended (it does not clamp), so clamp first, as `formatHex` does (§6, §8). Stay sRGB-only, like the web app. Don't add P3.
- **Re-implement JS `toFixed` for readouts and export.** `String(format: "%.1f")` rounds exact ties differently (`0.25` → `"0.2"` in Swift, `"0.3"` in JS) and prints `-0.0` where JS prints `0.0` (§Parity risks).
- **APCA licence: decide before shipping.** apca-w3 is under a "Limited W3 License": web content only, commercial use needs a written licence, and the name "APCA" may be used only by compliant, up-to-date implementations. A port is allowed "unmodified except as needed for porting to a given language", but a native iOS app is not clearly "web content" (§5). Ask Myndex, or ship WCAG only on iOS.
- **Parity tests:** generate JSON vectors from the TS engine, as planned. Compare hex strings, grades and display strings exactly. Compare raw doubles with a small tolerance (1e-9 relative). OKLCH `l/c/h` can differ in the last bit or two (§Parity risks).

## Findings

### 1. OKLab / OKLCH

**Pipeline in culori.** `rgb → lrgb → oklab → oklch` and back. The `oklch` mode reaches `rgb` through `oklab` ([oklch/definition.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklch/definition.js)). HSV to OKLCH goes through RGB, because culori routes any pair without a direct converter via `rgb` ([converter.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/converter.js)).

**sRGB → linear** ([lrgb/convertRgbToLrgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lrgb/convertRgbToLrgb.js)):

```js
const fn = (c = 0) => {
	const abs = Math.abs(c);
	if (abs <= 0.04045) {
		return c / 12.92;
	}
	return (Math.sign(c) || 1) * Math.pow((abs + 0.055) / 1.055, 2.4);
};
```

**linear → sRGB** ([lrgb/convertLrgbToRgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lrgb/convertLrgbToRgb.js)):

```js
const fn = (c = 0) => {
	const abs = Math.abs(c);
	if (abs > 0.0031308) {
		return (Math.sign(c) || 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
	}
	return c * 12.92;
};
```

Both mirror negative values (sign × curve). So out-of-gamut values stay out of range, and `displayable` can see them.

**linear sRGB → OKLab** ([oklab/convertLrgbToOklab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertLrgbToOklab.js)):

```js
let L = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
let M = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
let S = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
l: 0.210454268309314 * L + 0.7936177747023054 * M - 0.0040720430116193 * S,
a: 1.9779985324311684 * L - 2.4285922420485799 * M + 0.450593709617411 * S,
b: 0.0259040424655478 * L + 0.7827717124575296 * M - 0.8086757549230774 * S
```

**OKLab → linear sRGB** ([oklab/convertOklabToLrgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertOklabToLrgb.js)):

```js
let L = Math.pow(l + 0.3963377773761749 * a + 0.2158037573099136 * b, 3);
let M = Math.pow(l - 0.1055613458156586 * a - 0.0638541728258133 * b, 3);
let S = Math.pow(l - 0.0894841775298119 * a - 1.2914855480194092 * b, 3);
r:  4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S,
g: -1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S,
b: -0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S
```

**Grey special case.** `convertRgbToOklab` forces `a = b = 0` when `r === b && b === g` ([oklab/convertRgbToOklab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertRgbToOklab.js)). So a grey gets chroma exactly 0 and no hue.

**Lab ↔ LCh** ([lch/convertLabToLch.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lch/convertLabToLch.js), [lch/convertLchToLab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lch/convertLchToLab.js)):

```js
// lab → lch
let c = Math.sqrt(a * a + b * b);
let res = { mode, l, c };
if (c) res.h = normalizeHue((Math.atan2(b, a) * 180) / Math.PI);
// lch → lab
if (h === undefined) h = 0;
a: c ? c * Math.cos((h / 180) * Math.PI) : 0,
b: c ? c * Math.sin((h / 180) * Math.PI) : 0
```

`normalizeHue = hue => ((hue = hue % 360) < 0 ? hue + 360 : hue)` ([util/normalizeHue.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/util/normalizeHue.js)). JS `%` is Swift's `truncatingRemainder(dividingBy:)`.

OKLCH ranges in culori: `l: [0, 1]`, `c: [0, 0.4]`, `h: [0, 360]` ([oklch/definition.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklch/definition.js)). The `c` range matters: `clampChroma` uses it for its resolution (§3).

**Ottosson's original.** The [Oklab post](https://bottosson.github.io/posts/oklab/) gives 10-digit `float` constants, for example `0.4122214708f`, `0.5363325363f`, `0.0514459929f` in the first row. It says "The matrices were updated 2021-01-25. The new matrices have been derived using a higher precision sRGB matrix and with exactly matching D65 values." Its inverse uses `l_*l_*l_`. culori's 16-digit values agree with these to about 8 digits but are not the same numbers. **For parity, use culori's.** The post's code is public domain, or MIT if you prefer ([same post](https://bottosson.github.io/posts/oklab/)).

**Swift sketch** (it matched culori byte for byte on every hex output tested; see Parity risks):

```swift
import Foundation

@inline(__always) func toLinear(_ c: Double) -> Double {
    let a = abs(c)
    if a <= 0.04045 { return c / 12.92 }
    return (c < 0 ? -1 : 1) * pow((a + 0.055) / 1.055, 2.4)
}
@inline(__always) func fromLinear(_ c: Double) -> Double {
    let a = abs(c)
    if a > 0.0031308 { return (c < 0 ? -1 : 1) * (1.055 * pow(a, 1 / 2.4) - 0.055) }
    return c * 12.92
}

struct OKLCH { var l: Double; var c: Double; var h: Double? }   // h == nil: no hue (grey)

func oklch(r: Double, g: Double, b: Double) -> OKLCH {
    let lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
    let L = cbrt(0.412221469470763 * lr + 0.5363325372617348 * lg + 0.0514459932675022 * lb)
    let M = cbrt(0.2119034958178252 * lr + 0.6806995506452344 * lg + 0.1073969535369406 * lb)
    let S = cbrt(0.0883024591900564 * lr + 0.2817188391361215 * lg + 0.6299787016738222 * lb)
    let l = 0.210454268309314 * L + 0.7936177747023054 * M - 0.0040720430116193 * S
    var a = 1.9779985324311684 * L - 2.4285922420485799 * M + 0.450593709617411 * S
    var bb = 0.0259040424655478 * L + 0.7827717124575296 * M - 0.8086757549230774 * S
    if r == b && b == g { a = 0; bb = 0 }                       // culori's grey rule
    let c = (a * a + bb * bb).squareRoot()
    guard c != 0, !c.isNaN else { return OKLCH(l: l, c: c, h: nil) } // JS `if (c)`
    var h = (atan2(bb, a) * 180 / .pi).truncatingRemainder(dividingBy: 360)
    if h < 0 { h += 360 }
    return OKLCH(l: l, c: c, h: h)
}

func rgb(_ o: OKLCH) -> (r: Double, g: Double, b: Double) {
    let h = o.h ?? 0
    let useC = o.c != 0 && !o.c.isNaN                           // JS `c ? … : 0`
    let a = useC ? o.c * cos(h / 180 * .pi) : 0
    let b = useC ? o.c * sin(h / 180 * .pi) : 0
    let L = pow(o.l + 0.3963377773761749 * a + 0.2158037573099136 * b, 3)
    let M = pow(o.l - 0.1055613458156586 * a - 0.0638541728258133 * b, 3)
    let S = pow(o.l - 0.0894841775298119 * a - 1.2914855480194092 * b, 3)
    return (fromLinear( 4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S),
            fromLinear(-1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S),
            fromLinear(-0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S))
}
```

Keep the order of operations as written, as the JS evaluates left to right. Don't let a refactor turn the sums into `simd` dot products or fused multiply-adds. That can change the last bit (§Parity risks).

### 2. HSV (HSB) ↔ RGB

**RGB → HSV** ([hsv/convertRgbToHsv.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/hsv/convertRgbToHsv.js)):

```js
let M = Math.max(r, g, b), m = Math.min(r, g, b);
let res = { mode: 'hsv', s: M === 0 ? 0 : 1 - m / M, v: M };
if (M - m !== 0)
	res.h = (M === r ? (g - b) / (M - m) + (g < b) * 6
	      : M === g ? (b - r) / (M - m) + 2
	      : (r - g) / (M - m) + 4) * 60;
```

- Greys (`M === m`) get **no `h` key at all**. The hue is undefined, not 0 ([same file](https://github.com/Evercoder/culori/blob/v4.0.2/src/hsv/convertRgbToHsv.js)). Probe: `hsv("#808080")` → `{ mode: 'hsv', s: 0, v: 0.5019607843137255 }`.
- `(g < b) * 6` adds 6 (a boolean coerced to a number). In Swift: `(g < b ? 6 : 0)`.
- Hue is not normalised here. It falls in `[0, 360)` for in-range input.

**HSV → RGB** ([hsv/convertHsvToRgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/hsv/convertHsvToRgb.js)):

```js
h = normalizeHue(h !== undefined ? h : 0);
if (s === undefined) s = 0;
if (v === undefined) v = 0;
let f = Math.abs(((h / 60) % 2) - 1);
switch (Math.floor(h / 60)) {
	case 0: res = { r: v, g: v * (1 - s * f), b: v * (1 - s) }; break;
	case 1: res = { r: v * (1 - s * f), g: v, b: v * (1 - s) }; break;
	case 2: res = { r: v * (1 - s), g: v, b: v * (1 - s * f) }; break;
	case 3: res = { r: v * (1 - s), g: v * (1 - s * f), b: v }; break;
	case 4: res = { r: v * (1 - s * f), g: v * (1 - s), b: v }; break;
	case 5: res = { r: v, g: v * (1 - s), b: v * (1 - s * f) }; break;
	default: res = { r: v * (1 - s), g: v * (1 - s), b: v * (1 - s) };
}
```

Swift trap: `Int(floor(h / 60))` crashes if `h` is NaN. JS falls into `default`. Guard with `h.isFinite`, or switch on the `Double` ranges.

**How the app uses it.** `getChannel` reads a missing hue as 0. `setChannel` writes `h ??= 0` once a channel is set ([color-engine.ts](../../src/lib/color-engine.ts)). So in Swift, keep `h: Double?` on stored colours and copy those two rules. Colours are stored in the mode last edited, at full precision (PROJECT-MAP §6.2). The Swift model should be an enum like `.rgb(r,g,b)`, `.hsv(h?,s,v)`, `.oklch(l,c,h?)`, not a single canonical space.

### 3. Gamut: `displayable`, `clampChroma`, CSS Color 4

**`displayable`** ([clamp.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/clamp.js)): convert to `rgb`, then check each channel is in `[0, 1]`. **No tolerance.**

```js
const inrange_rgb = c => c !== undefined &&
	(c.r === undefined || (c.r >= 0 && c.r <= 1)) &&
	(c.g === undefined || (c.g >= 0 && c.g <= 1)) &&
	(c.b === undefined || (c.b >= 0 && c.b <= 1));
export function displayable(color) { return inrange_rgb(rgb(color)); }
```

With no tolerance, float noise matters at the edges. Probe results: `#ffffff` → OKLCH gives `l: 1.0000000000000002`. Converting that back gives `r: 1.0000000000000004`, which is **not displayable**. `oklch(1 0 0)` gives `0.9999999999999999…` and is displayable. Swift must reproduce this to the bit for `maxChroma` to agree at the edges. It does in testing (§Parity risks).

**`clampChroma(color, mode = 'lch', rgbGamut = 'rgb')`** ([clamp.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/clamp.js)). The app calls it as `clampChroma(color, "oklch")`.

```js
if (color === undefined || inDestinationGamut(color)) return color;
let conv = converter(color.mode);
color = converter(mode)(color);
let clamped = { ...color, c: 0 };
if (!inDestinationGamut(clamped)) {
	return conv(clipToGamut(clamped));          // RGB clip of the chroma-0 colour
}
let start = 0;
let end = color.c !== undefined ? color.c : 0;
let range = getMode(mode).ranges.c;            // [0, 0.4] for oklch
let resolution = (range[1] - range[0]) / Math.pow(2, 13);
let _last_good_c = clamped.c;
while (end - start > resolution) {
	clamped.c = start + (end - start) * 0.5;
	if (inDestinationGamut(clamped)) { _last_good_c = clamped.c; start = clamped.c; }
	else { end = clamped.c; }
}
return conv(inDestinationGamut(clamped) ? clamped : { ...clamped, c: _last_good_c });
```

- Bisection on chroma, holding `l` and `h`. Resolution `0.4 / 8192 ≈ 4.88e-5`, so at most 13 steps for `c ≤ 0.4`. No fixed iteration count.
- The midpoint is `start + (end - start) * 0.5`, **not** `(start + end) / 2`. Copy it exactly: the two can differ in the last bit.
- The result is the last *tested* chroma if it was in gamut, otherwise the last good one. So it is always displayable.
- `clipToGamut` here is `to_displayable_srgb`: convert to rgb, then `Math.max(0, Math.min(x ?? 0, 1))` per channel. In practice it is reached only when `l > 1` or `l < 0`.
- Probe: `clampChroma({mode:"oklch", l:0.7, c:0.4, h:150}, "oklch")` → `c: 0.19277343750000003` → `#00be58`.

**The app's own `maxChroma(l, h)`** ([color-engine.ts](../../src/lib/color-engine.ts)) is separate: 20 iterations on `[0, 0.4]` with `mid = (low + high) / 2`, keeping the displayable side. Port both. They give different answers to the same question, and each is used in a different place: `setChannel` caps with `maxChroma`; `toHex` uses `clampChroma`.

**CSS Color 4, for comparison** ([§14.2 CSS Gamut Mapping](https://www.w3.org/TR/css-color-4/#css-gamut-mapping), Candidate Recommendation Draft dated 30 September 2026). It allows three algorithms (Binary Search with Local MINDE, EdgeSeeker, Ray Trace). All of them aim at "constant-lightness, constant-hue chroma reduction in the OkLCh color space". It returns white for `L ≥ 1` and black for `L ≤ 0`. The binary-search version uses deltaEOK with `JND = 0.02` and `epsilon = 0.0001`, and returns the *clipped* colour once it is within one JND ([§14.2.2](https://www.w3.org/TR/css-color-4/#binary-search-gamut-map-with-local-minde)). culori implements that as `toGamut()` ([clamp.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/clamp.js)), but the app does **not** use it. CSS mapping keeps more chroma near concave gamut edges, so it gives different hexes from `clampChroma`. Don't use it in the port.

### 4. WCAG 2 contrast

**culori** ([wcag.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/wcag.js)), exported as `wcagLuminance` and `wcagContrast`:

```js
export function luminance(color) {
	let c = converter('lrgb')(color);
	return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
export function contrast(a, b) {
	let L1 = luminance(a);
	let L2 = luminance(b);
	return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
```

The linearisation is culori's `lrgb` (§1), so the threshold is **0.04045**.

**WCAG 2.2** ([relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance)): "L = 0.2126 * R + 0.7152 * G + 0.0722 * B" with "if RsRGB <= 0.04045 then R = RsRGB/12.92 else R = ((RsRGB+0.055)/1.055) ^ 2.4". Note 2: "Before May 2021 the value of 0.04045 in the definition was different (0.03928)… It has no practical effect." Contrast ratio = "(L1 + 0.05) / (L2 + 0.05)", L1 the lighter ([contrast ratio](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio)).

For 8-bit inputs the two thresholds give identical results. No byte value falls between them (10/255 = 0.0392…, 11/255 = 0.0431…). The app always scores the 8-bit hex. Black on white = exactly `21`.

One quirk: `pickPair` calls `wcagContrast` on parsed photo colours, not on hex strings. Those are also 8-bit RGB, so the result is the same.

```swift
func wcagLuminance(_ r: Double, _ g: Double, _ b: Double) -> Double {
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}
func wcagContrast(_ x: RGB8, _ y: RGB8) -> Double {
    let l1 = wcagLuminance(x.unit), l2 = wcagLuminance(y.unit)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
}
```

### 5. APCA (apca-w3 0.1.9)

**Sources.** Package: [npm apca-w3 0.1.9](https://www.npmjs.com/package/apca-w3/v/0.1.9) (published 2022-07-04). Source: [`src/apca-w3.js` at commit da50930](https://github.com/Myndex/apca-w3/blob/da50930ba8cf8a5ef85d1b269aeba3d83ad91a5a/src/apca-w3.js), the last change to that file. The repo has no tags. Header: "Beta 0.1.9 W3 • contrast function only… Revision date: July 3, 2022". Main APCA repo: [Myndex/SAPC-APCA](https://github.com/Myndex/SAPC-APCA). W3 repo: [Myndex/apca-w3](https://github.com/Myndex/apca-w3).

**Constants** (`SA98G`, "APCA 0.0.98G - 4g - W3 Compatible Constants"; [source](https://github.com/Myndex/apca-w3/blob/da50930ba8cf8a5ef85d1b269aeba3d83ad91a5a/src/apca-w3.js)):

```js
mainTRC: 2.4,
sRco: 0.2126729, sGco: 0.7151522, sBco: 0.0721750,
normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
blkThrs: 0.022, blkClmp: 1.414,
scaleBoW: 1.14, scaleWoB: 1.14,
loBoWoffset: 0.027, loWoBoffset: 0.027,
deltaYmin: 0.0005, loClip: 0.1,
```

**`sRGBtoY(rgb)`.** It expects 0–255 numbers. It uses a **plain power 2.4 with no linear segment**, which is not the sRGB curve:

```js
function simpleExp (chan) { return Math.pow(chan/255.0, SA98G.mainTRC); };
return SA98G.sRco * simpleExp(rgb[0]) + SA98G.sGco * simpleExp(rgb[1]) + SA98G.sBco * simpleExp(rgb[2]);
```

**`APCAcontrast(txtY, bgY, places = -1)`:**

```js
const icp = [0.0,1.1];
if(isNaN(txtY)||isNaN(bgY)||Math.min(txtY,bgY)<icp[0]||Math.max(txtY,bgY)>icp[1]){ return 0.0; }
txtY = (txtY > SA98G.blkThrs) ? txtY : txtY + Math.pow(SA98G.blkThrs - txtY, SA98G.blkClmp);
bgY  = (bgY  > SA98G.blkThrs) ? bgY  : bgY  + Math.pow(SA98G.blkThrs - bgY,  SA98G.blkClmp);
if ( Math.abs(bgY - txtY) < SA98G.deltaYmin ) { return 0.0; }
if ( bgY > txtY ) {   // BoW
  SAPC = ( Math.pow(bgY, SA98G.normBG) - Math.pow(txtY, SA98G.normTXT) ) * SA98G.scaleBoW;
  outputContrast = (SAPC < SA98G.loClip) ? 0.0 : SAPC - SA98G.loBoWoffset;
} else {              // WoB
  SAPC = ( Math.pow(bgY, SA98G.revBG) - Math.pow(txtY, SA98G.revTXT) ) * SA98G.scaleWoB;
  outputContrast = (SAPC > -SA98G.loClip) ? 0.0 : SAPC + SA98G.loWoBoffset;
}
if(places < 0 ){ return  outputContrast * 100.0; }
```

- Soft clamp: `>` (strict) against `blkThrs`. One Swift library uses `>=` (§7). Keep `>`.
- Low clip: `|SAPC| < 0.1` → 0. Otherwise subtract/add 0.027. So any non-zero `|Lc|` is at least 7.3.
- Output is a signed float (×100). Positive = dark text on light (BoW).
- Probe values: black on white `106.04067321268862`; white on black `-107.88473318309848` (PROJECT-MAP §6.5 agrees).

```swift
func apcaY(_ c: RGB8) -> Double {
    func e(_ v: UInt8) -> Double { pow(Double(v) / 255.0, 2.4) }
    return 0.2126729 * e(c.r) + 0.7151522 * e(c.g) + 0.0721750 * e(c.b)
}
func apcaContrast(textY: Double, bgY: Double) -> Double {
    if textY.isNaN || bgY.isNaN || min(textY, bgY) < 0 || max(textY, bgY) > 1.1 { return 0 }
    let t = textY > 0.022 ? textY : textY + pow(0.022 - textY, 1.414)
    let b = bgY   > 0.022 ? bgY   : bgY   + pow(0.022 - bgY,   1.414)
    if abs(b - t) < 0.0005 { return 0 }
    if b > t {
        let s = (pow(b, 0.56) - pow(t, 0.57)) * 1.14
        return (s < 0.1 ? 0 : s - 0.027) * 100
    } else {
        let s = (pow(b, 0.65) - pow(t, 0.62)) * 1.14
        return (s > -0.1 ? 0 : s + 0.027) * 100
    }
}
```

**Licence.** The [LICENSE.md in the npm 0.1.9 package](https://github.com/Myndex/apca-w3/blob/da50930ba8cf8a5ef85d1b269aeba3d83ad91a5a/LICENSE.md) and the [current LICENSE.md](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md) (updated 2023-04-27) both say:

- "licensed to the W3/AGWG under their cooperative agreement for use with WCAG accessibility guidelines for web-delivered and web-based content only, and not for any other use." package.json: `"license": "Limited W3 License"`.
- "Commercial use is prohibited without a written and signed commercial license agreement, except as provided by the W3 cooperative agreement for web content only. Non-commercial use is permitted only for predicting contrast for web content".
- Porting is allowed: "without modification to the essential elements of the code or specific approved constants, except as required to port to a given language". Developers "have a duty to ensure that the most recent version of this code is used".
- The current licence adds: "Current base reference algorithm is 0.0.98G-4g WITH an output clamp at approximately ±Lc10 (for reference, this is the underlying algorithm for apca-w3 versions 0.1.9)". It also adds a "RIGHT TO AUDIT CODE" clause for commercial or paywalled apps.
- Naming: "APCA" may be used only for code "properly implementing the APCA algorithm, and maintaining sync with the current version". The logos need written consent.
- The [W3C Software and Document Notice](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md#w3c-software-and-document-notice-and-license) text must be included "on ALL copies of the work or portions thereof".

The [minimum compliance page](https://git.apcacontrast.com/documentation/minimum_compliance) (linked from the licence) allows "code … unmodified except as needed for porting to a given language and/or use case". It asks displays to write "Lc -60", with a space between "Lc" and the minus. The app already does this. It also asks implementations to show this statement: "APCA is a method for predicting text contrast on self-illuminated displays for web-based content. Some use-cases are prohibited by license, including the following: use in medical, clinical evaluation, human safety related, aerospace, transportation, automotive, military applications, are strictly prohibited without a specific license in writing granting such use."

My reading, which is not legal advice: a faithful Swift port is allowed *as a port*. But a native iOS app is arguably not "web-based content", so the use case is the doubtful part. A free personal app is lower risk; selling it would need the written commercial licence.

### 6. Apple platform colour

- **`Color(_:red:green:blue:opacity:)`** defaults to `.sRGB`. "SwiftUI colors use an extended sRGB color space, so you can use component values outside that range" ([docs](https://developer.apple.com/documentation/swiftui/color/init(_:red:green:blue:opacity:))). **It does not clamp.** Tested on macOS 26: `Color(.sRGB, red: 1.2, green: -0.1, …).resolve(in:)` kept `1.2` and `-0.1`. So always pass clamped 0–1 values from the hex bytes.
- **`Color.Resolved`** (iOS 17+): "The values are stored in the Linear sRGB color space, using extended range" ([docs](https://developer.apple.com/documentation/swiftui/color/resolved)). Its components are `Float` ([linearRed](https://developer.apple.com/documentation/swiftui/color/resolved/linearred), [init](https://developer.apple.com/documentation/swiftui/color/resolved/init(colorspace:red:green:blue:opacity:))). Test: all 256 sRGB byte values round-trip through `Color.Resolved.red` (max error 2.1e-5 of a step). So it is safe for display, but **not for engine maths** (`Float`, and a different linearisation).
- **UIKit:** `UIColor(red:green:blue:alpha:)` is "specified in an extended range sRGB color space" on iOS 10+ ([docs](https://developer.apple.com/documentation/uikit/uicolor/init(red:green:blue:alpha:))). `UIColor(displayP3Red:…)` is the P3 variant ([docs](https://developer.apple.com/documentation/uikit/uicolor/init(displayp3red:green:blue:alpha:))).
- **Core Graphics:** `CGColor(srgbRed:green:blue:alpha:)` "Creates a color in the sRGB color space" ([docs](https://developer.apple.com/documentation/coregraphics/cgcolor/init(srgbred:green:blue:alpha:))). `CGColorSpace.sRGB` follows IEC 61966-2-1 ([docs](https://developer.apple.com/documentation/coregraphics/cgcolorspace/srgb)). `extendedSRGB` allows values outside 0–1 ([docs](https://developer.apple.com/documentation/coregraphics/cgcolorspace/extendedsrgb)).
- **What reaches the screen.** iOS is colour-managed. An sRGB colour on a P3 iPhone is converted so it *looks* like that sRGB colour; the panel's raw P3 numbers will differ. That is correct and matches what browsers do with sRGB CSS colours. "Exactly the hex" therefore means: tag every colour as sRGB (`Color(.sRGB, …)` or `CGColor(srgbRed:…)`), and never use `Color(red:…)` on a `.displayP3` or device space. A screenshot sampled with a picker may show P3-tagged numbers. That is not a bug.
- **Photos:** Unsplash JPEGs may carry ICC profiles. If palette extraction draws into a bitmap, create the context with `CGColorSpace(name: CGColorSpace.sRGB)`. That way the extracted bytes match what the browser's canvas gives (canvas is sRGB by default). This needs checking in the photo-pipeline research.
- **P3: don't support it.** The web app, its share links, its hex export and both contrast formulas are sRGB-only. P3 would break parity and make share links mean different things on different devices. `UITraitCollection.displayGamut` ([docs](https://developer.apple.com/documentation/uikit/uitraitcollection/displaygamut)) exists if this ever changes.

```swift
extension RGB8 {   // the same bytes that were scored
    var swiftUIColor: Color {
        Color(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: 1)
    }
}
```

Slider-track gradients: the web uses 13 hex stops in a CSS `linear-gradient`, which browsers interpolate in sRGB (gamma-encoded) by default ([CSS Images 4 / Color 4 interpolation defaults](https://www.w3.org/TR/css-color-4/#interpolation)). SwiftUI `LinearGradient` with sRGB stops looks close. Its exact interpolation space is not documented. This is visual only, not part of parity.

### 7. Existing Swift libraries

Checked on GitHub and Swift Package Index today. I searched Swift code on GitHub for culori's `0.412221469470763`: **no results.** Every Swift Oklab code I found uses Ottosson's 10-digit constants (`0.4122214708`) or an XYZ route.

| Library | What | Licence | Activity | Matches culori? |
|---|---|---|---|---|
| [soren-creates/oklch-swiftui](https://github.com/soren-creates/oklch-swiftui) | OKLCH, CSS 4 gamut mapping, APCA + WCAG | MIT | Created 2026-07-27, 1 star | No. Converts through XYZ with different matrices, uses `pow(x, 1/3)` not `cbrt`, has a "powerless" hue threshold, and its APCA soft clamp uses `>=` ([Conversions.swift](https://github.com/soren-creates/oklch-swiftui/blob/main/Sources/OklchCore/Conversions.swift), [Contrast.swift](https://github.com/soren-creates/oklch-swiftui/blob/main/Sources/OklchCore/Contrast.swift)) |
| [eliseyOzerov/okcolor-swift](https://github.com/eliseyOzerov/okcolor-swift) | Oklab/OkLch | not stated | Created 2026-07-25, 1 star | Not checked in depth. No licence, so unusable |
| [swift-standards/swift-color-standard](https://swiftpackageindex.com/swift-standards/swift-color-standard) | Lab/LCH/Oklab/Oklch | Apache-2.0 | 0 stars | Generic. No culori gamut or contrast |
| [importRyan/Oklab](https://github.com/importRyan/Oklab) | Ottosson's Oklab | none | Last push 2021 | Ottosson's constants |
| [robb/APCA-Color](https://github.com/robb/APCA-Color) | APCA on `Color.Resolved` | none | 12 stars | `Float` maths. Linearises from `Color.Resolved`, not 8-bit bytes. Won't match |
| [markbattistella/ContrastKit](https://github.com/markbattistella/ContrastKit) | WCAG shades | MIT | 62 stars, active | WCAG only. Different purpose |
| [metasidd/ColorTokensKit-Swift](https://github.com/metasidd/ColorTokensKit-Swift) | Colour system + WCAG | MIT | 225 stars, active | A design-token system, not a parity engine |

**Recommendation: write the engine by hand.** Reasons:

- None of these libraries reproduces culori's constants, grey rule, undefined hue, `clampChroma` bisection, or `formatHex`.
- The licences are missing or mixed.
- The licence for APCA is the same whoever writes the code.
- The hand port is small and already proven exact (§Parity risks).

### 8. Hex formatting and rounding

`formatHex = c => serializeHex(rgb(c))` ([formatter.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/formatter.js)):

```js
const clamp = value => Math.max(0, Math.min(1, value || 0));
const fixup = value => Math.round(clamp(value) * 255);
return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
```

- **Clamp, then round.** `value || 0` turns `undefined`, `NaN` and `0` into 0. Probe: `formatHex({r:0.5, g:NaN, b:1.2})` → `#8000ff`.
- `Math.round` rounds half **up**, towards +∞ ([ECMAScript Math.round](https://tc39.es/ecma262/#sec-math.round)). After clamping, values are ≥ 0, so Swift's `.rounded()` (`.toNearestOrAwayFromZero`) gives the same result.
- Output is lowercase `#rrggbb`. The app upper-cases it only in the Markdown export.
- `toRgb255` in the app repeats the same clamp-and-round.
- Parsing ([rgb/parseHex.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/rgb/parseHex.js), [rgb/parseNumber.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/rgb/parseNumber.js)): `/^#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i`, channel = `byte / 255`. So `#` is optional, case is ignored, and 3/4/8-digit forms are accepted.

```swift
struct RGB8: Equatable { var r, g, b: UInt8 }
func byte(_ v: Double) -> UInt8 {
    let c = v.isNaN ? 0 : max(0, min(1, v))
    return UInt8((c * 255).rounded(.toNearestOrAwayFromZero))
}
func formatHex(_ c: RGB8) -> String { String(format: "#%02x%02x%02x", c.r, c.g, c.b) }
```

## Parity risks

**Measured.** I compared a throwaway Swift port (Swift 6.3.2, macOS 26, `-O`, scratchpad only) with culori 4.0.2 and apca-w3 0.1.9 under Node:

| Check | Cases | Bit-identical | Max difference |
|---|---|---|---|
| hex → HSV `h, s, v` | 16,828 | all | 0 |
| hex → OKLCH `l` | 16,828 | 15,059 | 2.2e-16 |
| hex → OKLCH `c` | 16,828 | 12,012 | 7.5e-16 |
| hex → OKLCH `h` | 16,828 | 11,863 | 8.8e-12 degrees |
| random OKLCH → `clampChroma` → `formatHex` | 20,000 | all hexes equal | — |
| app `maxChroma(l, h)` (random + every hex's l/h + l = 0, 1, 1+ε) | 24,097 | all | 0 |
| WCAG ratio, hex pairs | 3,357 | all | 0 |
| APCA Lc, hex pairs | 3,357 | all | 0 |

The OKLCH drift comes from `cbrt` and `atan2`. V8 uses its own fdlibm-derived maths ([V8 ieee754](https://github.com/v8/v8/blob/main/src/base/ieee754.cc)); Apple's libm is different code. `pow` agreed in every case tested.

Risks and how to avoid them:

1. **Last-bit drift in OKLCH.** It matters only when a value is compared to a threshold or printed at an exact tie. Hex and `maxChroma` were immune in testing. Make parity tests exact on hexes, grades and strings, and tolerant (1e-9) on raw doubles. If exact OKLCH doubles are ever needed, port fdlibm's `cbrt`/`atan2` (as V8 does).
2. **`toFixed` vs `String(format:)`.** JS `toFixed` rounds exact decimal ties away from zero. C `printf` rounds them to even. Measured: `(0.25).toFixed(1)` = `"0.3"` but Swift gives `"0.2"`; `(2.5).toFixed(0)` = `"3"` but Swift gives `"2"`; `(0.125).toFixed(2)` = `"0.13"` but Swift gives `"0.12"`. Also `(-0).toFixed(1)` = `"0.0"`, but Swift `"%.1f"` of `-0.0` = `"-0.0"`. `truncate()` can produce `-0` (`Math.trunc(-0.4)/10`). Write a `toFixed(_:_:)` helper that follows the [ECMAScript Number.prototype.toFixed](https://tc39.es/ecma262/#sec-number.prototype.tofixed) steps, or use `Decimal` with `.plain` rounding, and normalise `-0` to `0`. Cover ties in the vectors.
3. **Operation order and FMA.** The Swift compiler doesn't contract `a*b + c` into FMA by default, but `simd` or Accelerate rewrites can. Keep the scalar expressions in culori's order.
4. **Midpoint formulas.** `clampChroma` uses `start + (end - start) * 0.5`. `maxChroma` and `reachLevel` use `(a + b) / 2`. Don't unify them.
5. **Undefined hue.** Using `0` instead of `nil` changes nothing numerically, but it breaks "a grey keeps its hue". It also changes which branch `convertLchToLab` takes (`c ? … : 0`). Model it as `Double?`, and treat `c == 0 || c.isNaN` as "no hue".
6. **Grey shortcut.** Forget `r == g == b → a = b = 0` and greys get chroma around 1e-17 and a random hue.
7. **NaN.** JS falls through quietly: `Math.round(NaN || 0)`, and `switch` lands in `default`. Swift `Int(Double.nan)` traps. Guard every `Double → Int`.
8. **APCA input.** apca-w3's `sRGBtoY` takes 0–255 integers and uses a pure 2.4 power. Don't feed it `Color.Resolved` linear values or culori's piecewise curve.
9. **Scoring source.** Score and export from the hex bytes, as the web does (PROJECT-MAP §1.2). Never from the stored colour or from `Color.Resolved`.
10. **Float vs Double.** SwiftUI's `Color.Resolved` and some APIs use `Float`. Keep engine types `Double` and convert only at the view edge.
11. **Library upgrades.** Pin the vectors to culori 4.0.2 and apca-w3 0.1.9. Regenerate them whenever the web app bumps either one.

## Open questions / decisions for the owner

1. **APCA on iOS.** The licence limits APCA to "web-based content". Options: (a) ask Myndex in the [apca-w3 discussions](https://github.com/Myndex/apca-w3/discussions) whether a free native app may use a faithful port; (b) ship WCAG only on iOS; (c) ship it and accept the risk. Will the app be paid or free? A paid app clearly needs a written licence.
2. **APCA attribution.** If APCA ships: add an About/credits screen with the W3C notice, the copyright line and the compliance statement (§5).
3. **sRGB only?** This research recommends yes (no P3). Confirm.
4. **Tolerance for OKLCH readouts.** Accept last-bit drift (only exact `.x5` ties could differ in display), or port fdlibm `cbrt`/`atan2` for bit-exact OKLCH?
5. **Vector generator.** Which functions get vectors: `toHex`, `getChannel`/`setChannel`, `channelMax`, `getContrast`, `reachLevel`, `formatScore`, `exportMarkdown`, `pickPair`? Suggest all public functions in `color-engine.ts`, plus tie cases for `toFixed`.
6. **Photo colour space.** Confirm the iOS palette extraction decodes photos into sRGB, so `pickPair` gets the same bytes as the browser (for the photo-pipeline research).

## Sources

Primary:

- culori 4.0.2 source (tag `v4.0.2`): [converter.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/converter.js), [clamp.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/clamp.js), [wcag.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/wcag.js), [formatter.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/formatter.js), [lrgb/convertRgbToLrgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lrgb/convertRgbToLrgb.js), [lrgb/convertLrgbToRgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lrgb/convertLrgbToRgb.js), [oklab/convertLrgbToOklab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertLrgbToOklab.js), [oklab/convertOklabToLrgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertOklabToLrgb.js), [oklab/convertRgbToOklab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklab/convertRgbToOklab.js), [oklch/definition.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/oklch/definition.js), [lch/convertLabToLch.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lch/convertLabToLch.js), [lch/convertLchToLab.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/lch/convertLchToLab.js), [hsv/convertRgbToHsv.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/hsv/convertRgbToHsv.js), [hsv/convertHsvToRgb.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/hsv/convertHsvToRgb.js), [util/normalizeHue.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/util/normalizeHue.js), [rgb/parseHex.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/rgb/parseHex.js), [rgb/parseNumber.js](https://github.com/Evercoder/culori/blob/v4.0.2/src/rgb/parseNumber.js)
- apca-w3 0.1.9: [npm](https://www.npmjs.com/package/apca-w3/v/0.1.9); [src/apca-w3.js @ da50930](https://github.com/Myndex/apca-w3/blob/da50930ba8cf8a5ef85d1b269aeba3d83ad91a5a/src/apca-w3.js); [LICENSE.md (current)](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md); [Myndex/SAPC-APCA](https://github.com/Myndex/SAPC-APCA); [APCA minimum compliance](https://git.apcacontrast.com/documentation/minimum_compliance)
- Björn Ottosson, [A perceptual color space for image processing](https://bottosson.github.io/posts/oklab/)
- W3C [WCAG 2.2: relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance), [contrast ratio](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio)
- W3C [CSS Color 4 §14.2 gamut mapping](https://www.w3.org/TR/css-color-4/#css-gamut-mapping) (CRD 30 September 2026)
- ECMAScript: [Math.round](https://tc39.es/ecma262/#sec-math.round), [Number.prototype.toFixed](https://tc39.es/ecma262/#sec-number.prototype.tofixed)
- Apple: [Color.init(_:red:green:blue:opacity:)](https://developer.apple.com/documentation/swiftui/color/init(_:red:green:blue:opacity:)), [Color.Resolved](https://developer.apple.com/documentation/swiftui/color/resolved), [Color.Resolved.linearRed](https://developer.apple.com/documentation/swiftui/color/resolved/linearred), [Color.RGBColorSpace.sRGB](https://developer.apple.com/documentation/swiftui/color/rgbcolorspace/srgb), [UIColor init(red:…)](https://developer.apple.com/documentation/uikit/uicolor/init(red:green:blue:alpha:)), [UIColor init(displayP3Red:…)](https://developer.apple.com/documentation/uikit/uicolor/init(displayp3red:green:blue:alpha:)), [CGColor init(srgbRed:…)](https://developer.apple.com/documentation/coregraphics/cgcolor/init(srgbred:green:blue:alpha:)), [CGColorSpace.sRGB](https://developer.apple.com/documentation/coregraphics/cgcolorspace/srgb), [CGColorSpace.extendedSRGB](https://developer.apple.com/documentation/coregraphics/cgcolorspace/extendedsrgb), [UITraitCollection.displayGamut](https://developer.apple.com/documentation/uikit/uitraitcollection/displaygamut)
- [V8 ieee754.cc](https://github.com/v8/v8/blob/main/src/base/ieee754.cc) (fdlibm-derived maths behind JS `Math`)
- Local: `src/lib/color-engine.ts`; `PROJECT-MAP.md` §1.2, §6; probes run against `node_modules/culori` 4.0.2 and `node_modules/apca-w3` 0.1.9

Secondary (library survey, not authoritative on maths): [soren-creates/oklch-swiftui](https://github.com/soren-creates/oklch-swiftui), [eliseyOzerov/okcolor-swift](https://github.com/eliseyOzerov/okcolor-swift), [swift-color-standard on Swift Package Index](https://swiftpackageindex.com/swift-standards/swift-color-standard), [importRyan/Oklab](https://github.com/importRyan/Oklab), [robb/APCA-Color](https://github.com/robb/APCA-Color), [markbattistella/ContrastKit](https://github.com/markbattistella/ContrastKit), [metasidd/ColorTokensKit-Swift](https://github.com/metasidd/ColorTokensKit-Swift)
