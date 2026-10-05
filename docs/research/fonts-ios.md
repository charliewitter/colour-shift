# Fonts and font licensing for the iOS app

Researched 2026-10-05

## Summary for Colour Shift

- **Big finding: five of the seven specimen fonts are free to bundle, not just three.** Alpha Lyrae and Ghost Byte are both under the SIL Open Font License (OFL), the same as Departure Mono, Geist, Geist Mono and Instrument Serif. Alpha Lyrae: [vegaprotocol/alpha-lyrae LICENSE.md](https://github.com/vegaprotocol/alpha-lyrae/blob/main/LICENSE.md). Ghost Byte: [ghost-byte.netlify.app/OFL.txt](https://ghost-byte.netlify.app/OFL.txt). ADR 0002 lists them as licensed; that is out of date (see open questions).
- **Ship six fonts in v1:** Departure Mono, Geist, Geist Mono, Instrument Serif, Alpha Lyrae and Ghost Byte. Use the original TTF/OTF files from each official repo, not the web `.woff2`. Add each file's licence text to the app, and add an "Acknowledgements" screen ([OFL FAQ 1.20](https://openfontlicense.org/ofl-faq/)).
- **Input Mono is the only font that needs paying for.** Its free licence covers personal use "on your own computer" for coding. It lists "Embedding in Applications ('Apps')" as needing a separate licence ([input.djr.com/license](https://input.djr.com/license/)). That rules out a TestFlight build, even one just for the owner.
- **The fix for Input Mono is cheap.** DJR's standard licence is one-off and covers desktop, web and apps together. The "Mini" tier allows 3 workstations, 15,000 monthly web visitors and **1 app** ([djr.com/license](https://djr.com/license)). Input styles cost "$5/style" at Mini on [djr.com/input](https://djr.com/input), so Regular + Bold is about $10 (checked from the page source; confirm at checkout). One Mini licence would also cover the web app (ADR 0002).
- **Until Input Mono is bought:** use Geist Mono for the UI (as the web app already does) and leave Input Mono out of the iOS specimen list. A "show it if installed" option is technically possible but not worth it in v1 (see Q3).
- **Bundle with `UIAppFonts`, not runtime registration.** Apple documents TTF, OTF (and TTC) only ([Adding a custom font](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app), [Configuring custom fonts](https://developer.apple.com/documentation/xcode/configuring-custom-fonts.md)). Refer to fonts by PostScript name in `Font.custom` ([Applying custom fonts to text](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)).
- **Sample text: don't use Dynamic Type.** It is sized to fill the colour panel, so use `Font.custom(_:fixedSize:)` and fit it with layout ([docs](https://developer.apple.com/documentation/swiftui/font/custom(_:fixedsize:))).
- **UI labels: use Dynamic Type, with a cap.** Use `Font.custom(_:size:relativeTo:)` with `.caption`/`.footnote`, and cap the dock with `.dynamicTypeSize(...)` ([docs](https://developer.apple.com/documentation/swiftui/view/dynamictypesize(_:)-26aj0)). The UI font is monospaced, so the scores already have equal-width digits. Add `.monospacedDigit()` anyway: it does nothing in a mono font and helps if the font changes ([docs](https://developer.apple.com/documentation/swiftui/view/monospaceddigit())).

## Findings

### 1. Bundling custom fonts in an iOS app

**Steps (Apple):**

1. Drag the font files into the Xcode project. Make sure each file's target membership includes the app target. Otherwise "the project will not distribute the font file as part of your app" ([Adding a custom font to your app](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app)).
2. Add the `UIAppFonts` key ("Fonts provided by application") to Info.plist. Its value is an array of file names, including the extension ([UIAppFonts](https://developer.apple.com/documentation/bundleresources/information-property-list/uiappfonts)). Files in a subfolder use a relative path, e.g. `project_fonts/MyFont.ttf` ([Applying custom fonts to text](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)). "Include each font file you add to your project in this array; otherwise, the font will not be available to your app" ([Apple](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app)).
3. Use the font in SwiftUI with `Font.custom("PostScriptName", size: 18)`. "Match the name of the font with the font's PostScript name." If SwiftUI can't find the font, it silently uses the system font ([Applying custom fonts to text](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)).

**Formats.** Apple says: "You can add True Type Font (.ttf) and Open Type Font (.otf) files" ([Apple](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app)). The installable-fonts guide says "TTF, OTF, or TTC formats or any of their modern variants" ([Configuring custom fonts](https://developer.apple.com/documentation/xcode/configuring-custom-fonts.md)). Neither page lists WOFF or WOFF2. I found no Apple page saying WOFF/WOFF2 works in an app bundle, so treat them as unsupported.

**Getting TTF/OTF files.** Better than converting: every OFL font here ships TTF or OTF in its official repo.

| Font | Official TTF/OTF |
|---|---|
| Departure Mono | `public/assets/DepartureMono-Regular.otf` and release `DepartureMono-1.500.zip` ([repo](https://github.com/rektdeckard/departure-mono), [releases](https://github.com/rektdeckard/departure-mono/releases/latest)) |
| Geist, Geist Mono | `fonts/Geist/{otf,ttf,variable}/`, `fonts/GeistMono/{otf,ttf,variable}/`; latest release v1.7.2 ([repo](https://github.com/vercel/geist-font), [releases](https://github.com/vercel/geist-font/releases/latest)) |
| Instrument Serif | `fonts/ttf/InstrumentSerif-Regular.ttf`, `-Italic.ttf` ([repo](https://github.com/Instrument/instrument-serif)) |
| Alpha Lyrae | `AlphaLyrae-Medium.ttf`, `.otf` ([repo](https://github.com/vegaprotocol/alpha-lyrae)) |
| Ghost Byte | `GhostByte.zip` (OTF, TTF, WOFF, WOFF2 + OFL.txt) ([site](https://ghost-byte.netlify.app/), [release](https://github.com/mattyow/ghostbyte/releases/latest)) |

If you ever do need to convert, fontTools has a command for it: `fonttools ttLib.woff2 decompress` ("Decompress a WOFF2 font to OTF"; [fontTools source](https://github.com/fonttools/fonttools/blob/main/Lib/fontTools/ttLib/woff2.py), [docs](https://fonttools.readthedocs.io/en/latest/ttLib/woff2.html)). Under the OFL a format change "normally is considered modification", so the font couldn't keep a Reserved Font Name ([OFL FAQ 2.2](https://openfontlicense.org/ofl-faq/)). That matters for Alpha Lyrae and Ghost Byte, which have RFNs. Using the original files avoids the question.

**PostScript names.** Apple suggests Font Book's Font Info tab ([Apple](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)), or printing `UIFont.familyNames` / `UIFont.fontNames(forFamilyName:)` at runtime ([Apple](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app)). I read the `name` tables (ID 6) of the official files and the owner's installed copies:

| Font | PostScript name | Source checked |
|---|---|---|
| Departure Mono | `DepartureMono-Regular` | repo OTF |
| Geist | `Geist-Regular` (static OTF; the variable TTF also reports `Geist-Regular`) | repo OTF / variable TTF |
| Geist Mono | `GeistMono-Regular` | repo OTF |
| Instrument Serif | `InstrumentSerif-Regular` | [Google Fonts METADATA.pb](https://github.com/google/fonts/blob/main/ofl/instrumentserif/METADATA.pb) |
| Alpha Lyrae | `AlphaLyrae-Medium` | owner's installed TTF |
| Ghost Byte | `GhostByte-Regular` | owner's installed TTF |
| Input Mono | `InputMono-Regular`, `InputMono-Bold` | owner's TTFs |

Check these again in the built app with the `UIFont.familyNames` loop.

**Variable fonts.** The Geist repo has variable TTFs (`Geist[wght].ttf`). Apple says SwiftUI "doesn't synthesize bold or italic styling". If the font has the weights, use `.weight(_:)` / `.italic()` ([Apple](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)). For v1, the simplest route is to bundle only the static weights the app uses (Regular, maybe Bold). That matches the web app, which uses one weight per specimen font.

**Runtime registration (alternative).** `CTFontManagerRegisterFontsForURL(_:_:_:)` "Registers fonts from the specified font URL with the Font Manager" ([Apple](https://developer.apple.com/documentation/coretext/ctfontmanagerregisterfontsforurl(_:_:_:))). `CTFontManagerRegisterFontURLs` registers several at once and makes them discoverable "in the calling process" ([Apple](https://developer.apple.com/documentation/coretext/ctfontmanagerregisterfonturls(_:_:_:_:))). This is useful for fonts that arrive after install, for example by download or On-Demand Resources ([Configuring custom fonts](https://developer.apple.com/documentation/xcode/configuring-custom-fonts.md)). Colour Shift's fonts are fixed and small, so `UIAppFonts` is simpler. A downloaded font is still a redistributed font, so this does not get round any licence.

### 2. Licences, font by font

| Font | Licence | Official text | Reserved Font Name | Bundle in iOS app (incl. TestFlight)? | What's required |
|---|---|---|---|---|---|
| **Departure Mono** (Helena Zhang) | SIL OFL 1.1 (font). The repo's root MIT licence covers only the website ([README "Licenses"](https://github.com/rektdeckard/departure-mono#licenses)) | [public/assets/LICENSE](https://github.com/rektdeckard/departure-mono/blob/main/public/assets/LICENSE) | None in the copyright line | **Yes** | Include copyright + OFL text. Already in this repo as `public/fonts/DepartureMono-LICENSE.txt` |
| **Geist** (Vercel / basement.studio) | SIL OFL 1.1 | [OFL.txt](https://github.com/vercel/geist-font/blob/main/OFL.txt), [LICENSE.txt](https://github.com/vercel/geist-font/blob/main/LICENSE.txt) | None | **Yes** | Include copyright + OFL text |
| **Geist Mono** | SIL OFL 1.1 (same repo) | as above | None | **Yes** | as above |
| **Instrument Serif** (Rodrigo Fuenzalida, Jordan Egstad) | SIL OFL 1.1 | [OFL.txt](https://github.com/Instrument/instrument-serif/blob/main/OFL.txt); Google Fonts lists `license: "OFL"` ([METADATA.pb](https://github.com/google/fonts/blob/main/ofl/instrumentserif/METADATA.pb)) | None | **Yes** | Include copyright + OFL text |
| **Alpha Lyrae** (Fontfabric, custom-made for Vega Protocol) | SIL OFL 1.1 ("1.1-update6") | [LICENSE.md](https://github.com/vegaprotocol/alpha-lyrae/blob/main/LICENSE.md). The owner's installed TTF also carries the OFL notice in its name table | **"Alpha Lyrae"** | **Yes**, unmodified | Include copyright + OFL text. Don't modify, subset or convert while keeping the name "Alpha Lyrae" |
| **Ghost Byte** (Matt Yow, with Matthew Smith) | SIL OFL 1.1 | [OFL.txt](https://ghost-byte.netlify.app/OFL.txt); GitHub reports `OFL-1.1` for [mattyow/ghostbyte](https://github.com/mattyow/ghostbyte) | **"Ghost Byte"** | **Yes**, unmodified | Include copyright + OFL text. The owner's installed TTF has no copyright or licence fields, so ship the OFL.txt from the official download next to it |
| **Input Mono** (David Jonathan Ross / Font Bureau) | Proprietary. Free only for "Personal Use", defined as "any use on your own computer that involves computer programming, software development, or the composition of plaintext documents" | [input.djr.com/license](https://input.djr.com/license/) | n/a ("Input is a trademark of The Font Bureau, Inc.", from the font's name table) | **No, not without buying a licence.** The free licence lists "Embedding in Applications ('Apps')" as needing a separate licence. It also says "you are not permitted to embed the Font Software or otherwise bundle the Font Software with another file". A TestFlight build is uploaded to Apple and installed on devices, so it counts | Buy a DJR licence (below) |

**Input Mono app licence: where and roughly how much.**

- DJR sells Input under its standard licence: "You can serve the fonts on websites… And you can embed the fonts in mobile apps and e-books too!" It is "pay once… no time limit" ([djr.com/license](https://djr.com/license)).
- Tiers ([djr.com/license](https://djr.com/license)):
  - **Mini:** 3 workstations, 15,000 monthly unique web visitors, **1 app or e-book**.
  - Small: 8 / 100,000 / 2 apps.
  - Medium: 15 / 500,000 / 6.
  - Large: 30 / 1 million / 10.
  - Extra Large: 60 / … / 16 apps.
  - There is also a half-price "Discounted Mini" for "individuals for whom a full license would cause financial hardship".
- App terms: you may embed the font "in a limited number of apps, mobile apps, or e-book/epub formats"; "You must make a reasonable effort to secure the font"; "Platform-specific versions of your app… with the same title and functionality may be counted together as a single use" ([djr.com/license](https://djr.com/license)). So the iOS app is one use.
- Prices on [djr.com/input](https://djr.com/input) at Mini tier: individual styles "$5/style", Input Mono Normal Width (14 styles) $40, Input Mono family (56 styles) $100, full series $200. The page's tier multipliers are Small ×2, Medium ×3, Large ×5, Extra Large ×8, Discounted Mini ×0.5. I read these from the page's HTML; confirm them at checkout. **Regular + Bold at Mini ≈ $10.**
- The same page offers a $0 "Testing" licence: "only for evaluation and internal testing". The licence says that without an order summary, or with "For testing purposes only", "you must use the font only for internal testing purposes" ([djr.com/license](https://djr.com/license), [djr.com/input](https://djr.com/input)). Whether a TestFlight build used only by the owner is "internal testing" is not stated. Ask DJR before relying on it.
- Input is also sold through Type Network. [input.djr.com/buy](https://input.djr.com/buy) says "Input is available for desktop, web, app, and e-book licensing at Type Network". Type Network licenses apps per title, one licence covering the same app on several operating systems ([typenetwork.com/support](https://typenetwork.com/support)). **I couldn't find Type Network's app price**: the store pages need JavaScript and showed no prices.
- Adobe Fonts includes Input Mono for desktop and web only. Its page says that for "Mobile Apps: Embed fonts in your app UI" you must "Visit DJR to purchase additional licensing" ([fonts.adobe.com/fonts/input-mono](https://fonts.adobe.com/fonts/input-mono)).

**What the OFL requires when bundling.**

- Bundling is allowed: fonts "may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license". The notice can be "stand-alone text files, human-readable headers or… machine-readable metadata fields… as long as those fields can be easily viewed by the user" (OFL 1.1, condition 2; [official text](https://openfontlicense.org/open-font-license-official-text/)).
- For mobile apps: "At a minimum you must include the copyright statement, the license notice and the license text." "A mention of this information in your About box or Changelog, with a link to where the font package is from, is good practice." You only need the fonts you use, not the whole package ([OFL FAQ 1.20](https://openfontlicense.org/ofl-faq/)).
- Practical reading: ship each `OFL.txt` / `LICENSE` file in the bundle and show them on an in-app Acknowledgements screen. Name, copyright holder and link per font. Font-metadata fields are not "easily viewed" on iOS.
- The app itself can be sold or free. Only selling the fonts "by itself" is barred (condition 1; [OFL FAQ 1.4](https://openfontlicense.org/ofl-faq/)).
- Reserved Font Names: a Modified Version may not use the RFN (condition 3). The rule "only applies to the primary font name as presented to the users", which is the font menu name ([OFL FAQ 5.3](https://openfontlicense.org/ofl-faq/)). Subsetting counts as modification ([OFL FAQ 2.6](https://openfontlicense.org/ofl-faq/)), and so does a format change, usually ([FAQ 2.2](https://openfontlicense.org/ofl-faq/)). So for Alpha Lyrae and Ghost Byte: bundle the original files unchanged and the names can appear in the specimen menu as is.
- Condition 5: the font stays under the OFL. That doesn't affect the app's own licence ([official text](https://openfontlicense.org/open-font-license-official-text/)).

### 3. If a licensed font can't be bundled

Only Input Mono is in this position.

- **iOS does have user-installed fonts, but only through apps.** Since iOS 13, an app can install fonts system-wide with the user's permission. They appear in Settings > General > Fonts. Other apps can use them if they have the Fonts capability with "Use Installed Fonts". That capability adds the `com.apple.developer.user-fonts` entitlement ([Configuring custom fonts](https://developer.apple.com/documentation/xcode/configuring-custom-fonts.md), [WWDC19 227](https://developer.apple.com/videos/play/wwdc2019/227/)).
- **Using them is not automatic.** "Fonts registered by font provider apps in the persistent scope aren't automatically available to other apps. Other apps must call [`CTFontManagerRequestFonts`] to make the fonts available." If a font can't be found, iOS shows the user a dialog ([CTFontManagerRequestFonts](https://developer.apple.com/documentation/coretext/ctfontmanagerrequestfonts(_:_:))).
- **The font picker also works.** `UIFontPickerViewController` shows "all the fonts on their device", and "When the user selects one of these nonsystem fonts in the font picker, the system grants your app access to the font" ([UIFontPickerViewController](https://developer.apple.com/documentation/uikit/uifontpickerviewcontroller)).
- **Configuration profiles / MDM** can also install TrueType and OpenType fonts "so that apps can use the fonts" ([Fonts payload settings](https://support.apple.com/guide/deployment/fonts-payload-settings-depeba084b8/web)). Apple's page doesn't say whether every third-party app sees them without `CTFontManagerRequestFonts`. Not verified.
- **Practical problem:** Input Mono would have to get onto the iPhone through a font-provider app or a profile. That would be a second copy of the font on the phone, which is itself "distribution" under the Input licence. I didn't verify whether any font-provider app (e.g. Adobe's) can install Input Mono on iOS. Adobe Fonts' licence for Input excludes app embedding ([Adobe](https://fonts.adobe.com/fonts/input-mono)), but a user-installed font isn't embedded, so that case is unclear.
- **Recommendation:** drop Input Mono from the iOS specimen list and use Geist Mono for the UI until a DJR licence is bought. The "use if installed" route costs an entitlement, a request flow and a system dialog, and would only ever work on the owner's phone.

### 4. Dynamic Type with custom fonts

**APIs.**

- `Font.custom(_:size:)` "scales with the body text style" ([Apple](https://developer.apple.com/documentation/swiftui/font/custom(_:size:))).
- `Font.custom(_:size:relativeTo:)` "scales relative to the given `textStyle`" ([Apple](https://developer.apple.com/documentation/swiftui/font/custom(_:size:relativeto:))).
- `Font.custom(_:fixedSize:)` "does not scale with Dynamic Type" ([Apple](https://developer.apple.com/documentation/swiftui/font/custom(_:fixedsize:))).
- In UIKit, `UIFontMetrics(forTextStyle:).scaledFont(for:)` plus `adjustsFontForContentSizeCategory = true` ([UIFontMetrics](https://developer.apple.com/documentation/uikit/uifontmetrics), [Scaling fonts automatically](https://developer.apple.com/documentation/uikit/scaling-fonts-automatically)).
- `@ScaledMetric` scales spacing to match ([Apple](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)).

**Matching the web sizes.** At the default "Large" setting, iOS text styles are:

| Text style | Size |
|---|---|
| Caption 1 | 12 pt |
| Footnote | 13 pt |
| Subhead | 15 pt |
| Body | 17 pt |

Source: [HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography). The web UI is 12px (14px on mobile; PROJECT-MAP §14.1). So:

- `Font.custom("GeistMono-Regular", size: 12, relativeTo: .caption)`, or
- `size: 14, relativeTo: .footnote`.

Either one starts at the web size and grows with the user's setting.

**Should the UI labels scale?** Yes, within limits.

- App Store "Larger Text" support means text can reach "at least 200%". Apple accepts that some controls "can't reasonably increase in size" and says tab bars need not grow ([Larger Text evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/)).
- The dock / bottom bar is a dense one-line control bar, so cap it, e.g. `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)`. "Consider if adding a large content view with `accessibilityShowsLargeContentViewer()` would be appropriate" ([Apple](https://developer.apple.com/documentation/swiftui/view/dynamictypesize(_:)-26aj0)).
- Menus and sheets (font picker, export) can scale fully.

**Should the sample text scale?** No.

- "Aa" is a specimen sized to the colour panel, so it is display art, not reading text. Use `Font.custom(name, fixedSize:)` and compute the size from the panel's geometry, as the web app's fit does.
- `.minimumScaleFactor(_:)` only shrinks text that doesn't fit ([Apple](https://developer.apple.com/documentation/swiftui/view/minimumscalefactor(_:))). It could be a simple fallback (big fixed size + `.lineLimit(1)` + low scale factor). A measured fit gives more control.
- Re-fit when the specimen font changes, as the web app does on `loadingdone` (PROJECT-MAP §14.2).

**Tabular digits for scores.**

- `.monospacedDigit()` "Modifies the fonts of all child views to use fixed-width digits, if possible". "If a child view's base font doesn't support fixed-width digits, the font remains unchanged" ([View.monospacedDigit](https://developer.apple.com/documentation/swiftui/view/monospaceddigit()), [Font.monospacedDigit](https://developer.apple.com/documentation/swiftui/font/monospaceddigit())).
- Input Mono and Geist Mono are monospaced, so `AA 5.21:1` and `Lc -64.3` won't jitter during the roll anyway. Keep `.monospacedDigit()` on the score as a safety net in case the UI font changes.

**Pixel fonts.** Departure Mono's author says "For pixel-perfect results, set the font size to increments of 11px" ([README](https://github.com/rektdeckard/departure-mono)). On iOS that means points × screen scale. A fitted sample size will rarely land on a multiple. That is fine at large sizes; just note it.

### 5. Recommendation for v1

**Ship (all OFL, original files, licence texts bundled + Acknowledgements screen):**

| Role | Font | Files |
|---|---|---|
| Specimen (default) | Departure Mono | `DepartureMono-Regular.otf` |
| Specimen | Geist | `Geist-Regular.otf` |
| Specimen + UI font | Geist Mono | `GeistMono-Regular.otf`, plus Bold if the UI uses bold |
| Specimen | Instrument Serif | `InstrumentSerif-Regular.ttf` |
| Specimen | Alpha Lyrae | `AlphaLyrae-Medium.ttf` (from the Vega repo) |
| Specimen | Ghost Byte | `GhostByte-Regular.ttf` or `.otf` (from the official release) |

**Leave out for now:** Input Mono, in both roles (UI font and specimen).

**Owner must buy or check:**

1. Decide whether to buy **Input Mono Regular + Bold, DJR Mini licence (about $10 total, one-off; confirm at checkout)** from [djr.com/input](https://djr.com/input). That one licence would cover the iOS app (1 app), the website (up to 15,000 monthly visitors) and 3 computers ([djr.com/license](https://djr.com/license)). After buying, Input Mono can become the UI font again and go back in the specimen list.
2. Ask DJR (david@djr.com, listed on [input.djr.com/license](https://input.djr.com/license/)) what "reasonable effort to secure the font" means for an iOS app. Standard `UIAppFonts` bundling leaves the file readable inside the `.ipa`.
3. Re-download Alpha Lyrae and Ghost Byte from their official sources. That way the bundled files and licence texts match what the licences cover. The installed Ghost Byte copy has no licence metadata.

## Open questions / decisions for the owner

- **ADR 0002 is out of date for Alpha Lyrae and Ghost Byte.** Both are OFL. They could be committed and served on the web, as Departure Mono now is. Decide whether to update the ADR and the web app. This report changes no other file.
- **Buy Input Mono (DJR Mini) or not?** About $10 covers web + iOS + desktop. If not, Geist Mono is the UI font on iOS.
- **Does a TestFlight-only build count as "internal testing" under DJR's free Testing licence?** Not stated anywhere I found. Ask DJR; don't assume.
- **Type Network's app-licence price for Input** was not found (JavaScript-only store). This only matters if buying there instead of from djr.com.
- **Bold weights:** which UI elements on the web use Input Mono Bold? That decides whether to bundle `GeistMono-Bold`.
- **Dynamic Type cap for the bottom bar:** pick the largest size that still fits the swatch row and score at iPhone SE width, then test.
- **Acknowledgements screen:** where it lives (settings sheet, about link in the font menu?).
- **Variable vs static Geist:** static is simpler. Variable only if the iOS app wants several weights.

## Sources

Apple (primary):
- Adding a custom font to your app: https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app
- UIAppFonts: https://developer.apple.com/documentation/bundleresources/information-property-list/uiappfonts
- Applying custom fonts to text (SwiftUI): https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text
- Font.custom(_:size:): https://developer.apple.com/documentation/swiftui/font/custom(_:size:)
- Font.custom(_:size:relativeTo:): https://developer.apple.com/documentation/swiftui/font/custom(_:size:relativeto:)
- Font.custom(_:fixedSize:): https://developer.apple.com/documentation/swiftui/font/custom(_:fixedsize:)
- View.monospacedDigit(): https://developer.apple.com/documentation/swiftui/view/monospaceddigit()
- Font.monospacedDigit(): https://developer.apple.com/documentation/swiftui/font/monospaceddigit()
- View.dynamicTypeSize(_:) (range): https://developer.apple.com/documentation/swiftui/view/dynamictypesize(_:)-26aj0
- View.minimumScaleFactor(_:): https://developer.apple.com/documentation/swiftui/view/minimumscalefactor(_:)
- UIFontMetrics: https://developer.apple.com/documentation/uikit/uifontmetrics
- Scaling fonts automatically: https://developer.apple.com/documentation/uikit/scaling-fonts-automatically
- CTFontManagerRegisterFontsForURL: https://developer.apple.com/documentation/coretext/ctfontmanagerregisterfontsforurl(_:_:_:)
- CTFontManagerRegisterFontURLs: https://developer.apple.com/documentation/coretext/ctfontmanagerregisterfonturls(_:_:_:_:)
- CTFontManagerRequestFonts: https://developer.apple.com/documentation/coretext/ctfontmanagerrequestfonts(_:_:)
- UIFontPickerViewController: https://developer.apple.com/documentation/uikit/uifontpickerviewcontroller
- Configuring custom fonts (Fonts capability, user-fonts entitlement): https://developer.apple.com/documentation/xcode/configuring-custom-fonts.md
- WWDC19 session 227, Font Management and Text Scaling: https://developer.apple.com/videos/play/wwdc2019/227/
- HIG Typography (text style sizes): https://developer.apple.com/design/human-interface-guidelines/typography
- Larger Text evaluation criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/
- Fonts payload settings (Apple Platform Deployment): https://support.apple.com/guide/deployment/fonts-payload-settings-depeba084b8/web

OFL (primary):
- OFL 1.1 official text: https://openfontlicense.org/open-font-license-official-text/
- OFL FAQ (1.4, 1.20, 2.2, 2.6, 5.3): https://openfontlicense.org/ofl-faq/
- scripts.sil.org/OFL (redirects to the above): https://scripts.sil.org/OFL

Fonts (primary):
- Departure Mono repo and README: https://github.com/rektdeckard/departure-mono
- Departure Mono font licence: https://github.com/rektdeckard/departure-mono/blob/main/public/assets/LICENSE
- Geist repo, OFL.txt, LICENSE.txt: https://github.com/vercel/geist-font
- Instrument Serif repo, OFL.txt: https://github.com/Instrument/instrument-serif
- Instrument Serif on Google Fonts: https://fonts.google.com/specimen/Instrument+Serif and https://github.com/google/fonts/blob/main/ofl/instrumentserif/METADATA.pb
- Alpha Lyrae repo, LICENSE.md, README: https://github.com/vegaprotocol/alpha-lyrae
- Ghost Byte site and OFL.txt: https://ghost-byte.netlify.app/ and https://ghost-byte.netlify.app/OFL.txt
- Ghost Byte repo: https://github.com/mattyow/ghostbyte
- Input licence: https://input.djr.com/license/
- Input purchasing options: https://input.djr.com/buy
- DJR licence and tiers: https://djr.com/license
- DJR Input page (prices, tiers): https://djr.com/input
- Type Network support (app licences): https://typenetwork.com/support
- Adobe Fonts, Input Mono: https://fonts.adobe.com/fonts/input-mono

Tools:
- fontTools WOFF2 module: https://fonttools.readthedocs.io/en/latest/ttLib/woff2.html and https://github.com/fonttools/fonttools/blob/main/Lib/fontTools/ttLib/woff2.py

Local evidence (not web sources): `name` tables of the owner's installed `~/Library/Fonts/AlphaLyrae-Medium.ttf` (OFL notice, Fontfabric), `GhostByte-Regular.ttf` (no copyright or licence fields) and `public/fonts/InputMono-*.ttf` (Font Bureau copyright, licence URL `http://input.fontbureau.com/license`).
