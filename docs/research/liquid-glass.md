# Liquid Glass on iOS: research for the Colour Shift SwiftUI port

Researched 2026-10-05

Current releases are iOS 26 (Liquid Glass shipped) and iOS 27 (WWDC26, refinements). Apple's documentation pages were read through their JSON data endpoints (`developer.apple.com/tutorials/data/documentation/...json`), which return the same text as the web pages. Links below point at the normal page URLs.

---

## Summary for Colour Shift

- **Glass goes in the control layer only, and only where it earns its place.** Apple says not to use Liquid Glass in the content layer and to use it sparingly on custom controls ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). For us the content is the colour panel, the photo panel and the colour swatches. These stay solid, never glass.
- **Never tint glass with the user's colour.** Tinted glass "generates a range of tones" and changes "hue, brightness and saturation depending on what's behind" ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)). A tinted swatch would lie about the colour. Show colours as opaque fills in the content layer.
- **Bottom bar (mobile) and dock: keep them flat and opaque, laid out *below* the stage, as on the web.** If the bar doesn't sit over the colour or photo, glass has nothing to refract, and it would bring colour casts and light/dark flipping into chrome that is meant to be quiet. Revisit only if the owner wants a floating bar over the photo (see open questions).
- **Slider grip: use glass, but only while dragging.** This is exactly what Apple's own sliders do: "the knob transforms into Liquid Glass during interaction" ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)), and the HIG names sliders as the allowed exception in the content layer ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Our gradient track means a custom slider (image tracks on `UISlider` lose the dynamic effects, see Q6), so build the grip in SwiftUI: an 8pt dot at rest, a 24pt `glassEffect(.regular.interactive(), in: .circle)` while dragging.
- **Font menu: use a standard SwiftUI `Menu`.** Menus adopt Liquid Glass automatically ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)). It floats over the colour panel, which is the case glass is designed for. No custom styling.
- **Share/export: use the system share sheet and sheets.** They adopt glass for free ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)). Don't add custom backgrounds to sheets ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).
- **Photo arrows (on the photo): the one good candidate for custom glass buttons.** They float over a photo, which is the case Apple gives for glass on media. Use `.buttonStyle(.glass)` (regular). Only use `.clear` with a dimming layer behind it ([Glass.clear](https://developer.apple.com/documentation/swiftui/glass/clear)).
- **Small dock buttons (swap, WCAG|APCA, levels, score): flat.** Putting glass on each would be "overusing this material in multiple custom controls" ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)), and it would sit on a flat dark bar where it has nothing to refract.
- **Set the deployment target to iOS 26.** All glass APIs are iOS 26.0+ (see Q1). With iOS 27 out, a new personal app gains little from supporting iOS 18, and it avoids two code paths.
- **Test with Reduce Transparency, Increase Contrast, Reduce Motion, and the Liquid Glass Clear↔Tinted slider.** System glass adapts by itself. Our own custom code (the grip, any overlays, the colour fades) must be checked by hand ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).

---

## Findings

### 1. What Liquid Glass is, and the SwiftUI API

**What it is.** A material that "blurs background content, reflects color and light of surrounding content, and reacts to touch and pointer interactions in real time" ([Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)). It "forms a distinct functional layer for controls and navigation elements" that floats above content ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). It shipped with iOS 26 ([Apple Newsroom, June 2025](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)).

**What changed in iOS 27.** No new glass APIs were named in WWDC26's "What's new in SwiftUI". The look is refined and "automatically responds to the new Liquid Glass slider to adjust its tint" ([WWDC26 269](https://developer.apple.com/videos/play/wwdc2026/269/)). Apple "tuned Liquid Glass so it more effectively diffuses complex content behind it", added "a darkened edge along with brighter specular highlights", and apps get this "without even needing to recompile" ([WWDC26 102, Platforms State of the Union](https://developer.apple.com/videos/play/wwdc2026/102/)). The API surface below is the same in the current docs.

All of the following are available on iOS 26.0+, iPadOS 26.0+, Mac Catalyst 26.0+, macOS 26.0+, tvOS 26.0+ and watchOS 26.0+ (from each page's availability data).

**`glassEffect(_:in:)`** ([docs](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)))

```swift
nonisolated func glassEffect(
    _ glass: Glass = .regular,
    in shape: some Shape = DefaultGlassEffectShape()
) -> some View
```

The default shape is a capsule ([DefaultGlassEffectShape](https://developer.apple.com/documentation/swiftui/defaultglasseffectshape)). Glass is anchored to the view's bounds, including padding. Apply it *after* other modifiers that affect appearance ([Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)).

**`Glass`** ([docs](https://developer.apple.com/documentation/swiftui/glass)): `struct Glass`, `Equatable`, `Sendable`.

| Member | Signature | Notes |
|---|---|---|
| `regular` | `static var regular: Glass` | Default. Adaptive, legible over anything. |
| `clear` | `static var clear: Glass` | More transparent. Needs a dimming layer for legibility ([Glass.clear](https://developer.apple.com/documentation/swiftui/glass/clear)). |
| `identity` | `static var identity: Glass` | No glass, "as if no glass effect was applied". Useful for toggling it off without changing the view tree. |
| `tint(_:)` | `func tint(_ color: Color?) -> Glass` | Coloured glass ([docs](https://developer.apple.com/documentation/swiftui/glass/tint(_:))). |
| `interactive(_:)` | `func interactive(_ isEnabled: Bool = true) -> Glass` | Reacts to touch: "scaling, bouncing, and shimmering" ([docs](https://developer.apple.com/documentation/swiftui/glass/interactive(_:)); [WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)). |

```swift
Text("Hello")
    .padding()
    .glassEffect(.regular.tint(.orange).interactive(), in: .rect(cornerRadius: 16))
```

Note: one summary tool returned an example `Glass(effect: .shadow)`. That does not exist in Apple's docs; I checked the raw page. Ignore it if you see it elsewhere.

**`GlassEffectContainer`** ([docs](https://developer.apple.com/documentation/swiftui/glasseffectcontainer))

```swift
@MainActor struct GlassEffectContainer<Content> where Content : View
init(spacing: CGFloat?, content: () -> Content)
```

It renders several glass shapes together. This "improves rendering performance" and lets the shapes morph into each other. Bigger `spacing` means shapes blend sooner. If container spacing is larger than the stack's spacing, the shapes blend even at rest ([Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)). It also matters for how glass looks: "glass can not sample other glass, so having nearby glass elements in different containers will result in inconsistent behavior" ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)).

**`glassEffectID(_:in:)`** ([docs](https://developer.apple.com/documentation/swiftui/view/glasseffectid(_:in:)))

```swift
nonisolated func glassEffectID(_ id: (some Hashable & Sendable)?, in namespace: Namespace.ID) -> some View
```

Used with a `@Namespace` inside a `GlassEffectContainer`, so shapes morph into each other when views appear or disappear.

**`glassEffectTransition(_:)`** ([docs](https://developer.apple.com/documentation/swiftui/view/glasseffecttransition(_:))) takes a `GlassEffectTransition` ([docs](https://developer.apple.com/documentation/swiftui/glasseffecttransition)): `.matchedGeometry` (morph to the nearest shape), `.materialize` (fade in content and animate the glass in or out without matching geometry) or `.identity` (no change).

```swift
@Namespace private var ns
GlassEffectContainer(spacing: 40) {
    HStack(spacing: 40) {
        icon("scribble").glassEffect().glassEffectID("pencil", in: ns)
        if isExpanded {
            icon("eraser").glassEffect().glassEffectID("eraser", in: ns)
        }
    }
}
```

**`glassEffectUnion(id:namespace:)`** ([docs](https://developer.apple.com/documentation/swiftui/view/glasseffectunion(id:namespace:))). This joins several views into one glass shape even at rest. "All Liquid Glass effects with the same shape and Liquid Glass variant will be combined into a single shape."

**Button styles.**
- `.buttonStyle(.glass)`: `static var glass: GlassButtonStyle` ([docs](https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glass)).
- `.buttonStyle(.glass(.clear))`: `static func glass(_ glass: Glass) -> Self`, a configurable variant ([docs](https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glass(_:))).
- `.buttonStyle(.glassProminent)`: `static var glassProminent: GlassProminentButtonStyle`, "similar to the `borderedProminent` style", tinted with the accent colour ([docs](https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glassprominent)).

Apple prefers these over hand-built glass buttons ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).

**What adopts glass automatically.** "Standard components like bars, sheets, popovers, and controls automatically adopt this material" ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)). In detail:
- Toolbar items sit "on a Liquid Glass surface that floats above your app's content" ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- The iPhone tab bar floats and can minimise on scroll: `.tabBarMinimizeBehavior(.onScrollDown)` ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- Partial-height sheets are inset with a glass background. At full height they turn opaque and anchor to the screen edge ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- Menus adopt glass ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).
- The slider and toggle knobs turn into glass during interaction ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).

**`backgroundExtensionEffect()`** ([docs](https://developer.apple.com/documentation/swiftui/view/backgroundextensioneffect())). `@MainActor func backgroundExtensionEffect() -> some View`, with a variant `backgroundExtensionEffect(isEnabled:)`. It mirrors the view into the safe areas and blurs the copies, mainly so a hero image extends under a sidebar or inspector. Apple: "Apply this modifier with discretion", "often … with only a single instance". It clips the view. Relevance for us: low. At most, the photo could extend under the status bar.

**Scroll edge effects.** `scrollEdgeEffectStyle(_ style: ScrollEdgeEffectStyle?, for edges: Edge.Set)` ([docs](https://developer.apple.com/documentation/swiftui/view/scrolledgeeffectstyle(_:for:))). Styles are `.automatic`, `.hard` ("more opaque, clearly defined") and `.soft` ("subtle blurred") ([ScrollEdgeEffectStyle](https://developer.apple.com/documentation/swiftui/scrolledgeeffectstyle)). Also available: `scrollEdgeEffectHidden(_:for:)`, and `safeAreaBar(...)` to register a custom bar so scroll views under it get the edge effect ([docs](https://developer.apple.com/documentation/swiftui/view/safeareabar(edge:alignment:spacing:content:))). Relevance for us: low. Colour Shift's main screen doesn't scroll.

### 2. When to use glass (HIG), and an app whose content is colour

From the HIG ([Materials](https://developer.apple.com/design/human-interface-guidelines/materials)):
- "Don't use Liquid Glass in the content layer." Use standard materials there instead.
- **Exception:** "controls in the content layer with a transient interactive element like sliders and toggles … the element takes on a Liquid Glass appearance to emphasize its interactivity when a person activates it."
- "Use Liquid Glass effects sparingly … Limit these effects to the most important functional elements in your app."
- "Only use clear Liquid Glass for components that appear over visually rich backgrounds." If the content underneath is bright, "consider adding a dark dimming layer of 35% opacity."

From WWDC25 "Meet Liquid Glass" ([219](https://developer.apple.com/videos/play/wwdc2025/219/)):
- "Always avoid glass on glass." For elements on top of glass, "use fills, transparency, and vibrancy" instead.
- Regular and clear "should never be mixed." Clear only when (1) it sits over media-rich content, (2) a dimming layer won't hurt the content, and (3) the content on top is bold and bright.
- "Avoid tinting all your elements … If you want to imbue color into your app, do it in the content layer instead."

From the HIG ([Color, "Liquid Glass color"](https://developer.apple.com/design/human-interface-guidelines/color)):
- "If your app features colorful backgrounds or visually rich content, prefer a monochromatic appearance for toolbars and tab bars."
- "Avoid overlap of similar colors in the content layer and controls when possible."

**Fit with Colour Shift.** Our principle ("the chrome stays dark and quiet; the pair and the photo are the only colour") matches Apple's advice closely: content leads, controls recede, colour lives in the content layer. The difference is that glass *borrows* colour from the content. In a colour-judging tool, any chrome that picks up a cast from the user's colour is noise next to the thing being judged. That argues for glass only where a control has to float over the stage (font menu, photo arrows), and for flat chrome everywhere the layout lets controls sit beside the content instead (dock, bottom bar, slider panel).

### 3. How glass takes colour from what's behind it, and legibility

- "Liquid Glass has no inherent color, and instead takes on colors from the content directly behind it" ([HIG Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Each layer "continuously adapts based on what's behind it … The amount of tint and the dynamic range shift to always ensure buttons remain legible … it can also independently switch between light and dark" ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)).
- Small elements (nav bars, tab bars) "flip from light to dark based on the background". Bigger ones (menus, sidebars) adapt but "don't flip" ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)). The HIG adds that symbols and text on small bars go dark over light content and light over dark content, and that larger elements are "more opaque" ([HIG Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Glass samples "an area larger than itself" ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)). So a control *next to* a colour edge can still pick up that colour.
- Tint: "Selecting a color generates a range of tones that are mapped to content brightness underneath … changing its hue, brightness and saturation depending on what's behind" ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

**What this means for us.**
1. A glass control over a pale user colour may flip to a *light* appearance. That breaks the dark-chrome look. I couldn't find a documented way to pin small glass to dark. Forcing `.preferredColorScheme(.dark)` or `.environment(\.colorScheme, .dark)` may or may not stop the flip. **Unverified: test on device.**
2. Never use `Glass.tint` with a pair colour (point 4 above).
3. The font menu trigger sits on the colour panel, so its glass will take on the background colour. That's acceptable for a transient menu, and arguably right ("controls float over content"). Still, check it against very light, very dark and saturated backgrounds.

### 4. Accessibility

What glass does by itself ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)):
- **Reduce Transparency:** "makes Liquid Glass frostier and obscures more of the content behind it."
- **Increase Contrast:** "makes elements predominantly black or white and highlights them with a contrasting border."
- **Reduce Motion:** "decreases the intensity of some effects and disables any elastic properties."
- "These are available automatically whenever you use the new material."

It is confirmed again for iOS 27: glass "seamlessly adapts to a variety of accessibility settings users may choose, such as reducing transparency or increasing contrast" ([WWDC26 102](https://developer.apple.com/videos/play/wwdc2026/102/)).

**User look setting.** iOS 26.1 added a Clear / Tinted choice (secondary: [9to5Mac](https://9to5mac.com/2025/10/20/ios-26-1-beta-4-adds-new-setting-to-tone-down-liquid-glass-transparency/)). iOS 27 replaces it with "a new slider in Settings … anywhere from ultra-clear to fully tinted" ([Apple Newsroom, June 2026](https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/)). SwiftUI glass responds automatically ([WWDC26 269](https://developer.apple.com/videos/play/wwdc2026/269/)). I found no public API to read this setting. **Unverified.**

**What the app must handle** ("Ensure you test your app's custom elements, colors, and animations": [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)):
- Our own animations (the colour fades, the roll, the photo crossfade, the swatch-row resize): read `@Environment(\.accessibilityReduceMotion)` ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion)). This matches the web app's reduced-motion rules.
- Any custom translucency that *isn't* `glassEffect` (for example a blurred photo preview used as chrome): read `accessibilityReduceTransparency` ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducetransparency)).
- Custom flat controls under Increase Contrast: read `colorSchemeContrast` ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/colorschemecontrast)). Strengthen our `stroke` and `focus` tokens when it is `.increased`.
- `accessibilityShowBorders`: "draw interactive custom controls such as buttons with clearly visible edges" ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityshowborders)). Our dock buttons are borderless at rest, so add an inside outline when this is true. (Declared `@backDeployed(before: iOS 26.1)`.)
- `accessibilityReduceHighlightingEffects` (iOS 26.4+, "Reduce Bright Effects") ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducehighlightingeffects)): consider skipping the grip's shimmer if we draw any highlight of our own.
- Give every icon-only button an accessibility label ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).

### 5. Performance, and older OS versions

**Performance** ([Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)):
- Creating too many `GlassEffectContainer`s hurts performance.
- So does applying many effects outside containers.
- Limit how many glass effects are on screen at once.
- Group custom glass in a `GlassEffectContainer` ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).

For us: at most three or four glass items are on screen (font trigger, two photo arrows, one grip while dragging). The grip moves every frame while dragging, so profile it with Instruments. Apple points to the WWDC sessions on hitches and SwiftUI performance (linked from [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)).

**OS versions.** Every glass API is iOS 26.0+ (see Q1). To support an older iOS you'd write:

```swift
if #available(iOS 26, *) {
    content.glassEffect(.regular.interactive(), in: .circle)
} else {
    content.background(.ultraThinMaterial, in: .circle)  // standard material fallback
}
```

The glass APIs are not back-deployed. Standard materials (`ultraThin`, `thin`, `regular`, `thick`) are the pre-26 equivalent ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).

**Opting out.** `UIDesignRequiresCompatibility` (Info.plist) keeps the pre-26 look, but "The system ignores this key when you build for iOS 27 or later" ([docs](https://developer.apple.com/documentation/bundleresources/information-property-list/uidesignrequirescompatibility)). It's not an option for a new app.

**Devices.** iOS 26 runs on a defined device list. I found no Apple source on whether older iOS 26 devices draw a reduced glass effect. Apple documents a hardware cut-off only for tvOS: "Apple TV 4K (2nd generation) and newer" ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)). **Unverified for iPhone.**

### 6. UIKit equivalents (brief)

- `UIGlassEffect: UIVisualEffect`, created with `init(style: UIGlassEffect.Style)` (`.regular`, `.clear`). It has `isInteractive: Bool` and `tintColor: UIColor?`. Use it inside a `UIVisualEffectView`. iOS 26.0+ ([docs](https://developer.apple.com/documentation/uikit/uiglasseffect)).
- `UIGlassContainerEffect` (with `spacing`) is the counterpart of `GlassEffectContainer`: nest glass `UIVisualEffectView`s in its `contentView` ([docs](https://developer.apple.com/documentation/uikit/uiglasscontainereffect)).
- Buttons: `UIButton.Configuration.glass()`, `.prominentGlass()`, `.clearGlass()`, `.prominentClearGlass()` ([docs](https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct/glass()); list in [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).
- Custom bars over scroll views: `UIScrollEdgeElementContainerInteraction` ([docs](https://developer.apple.com/documentation/uikit/uiscrolledgeelementcontainerinteraction)).
- **`UISlider` and our gradient tracks:** "If you use images to customize the appearance of the track, then the slider doesn't apply the dynamic effects or alter the appearance". Tint colours keep the effects ([UISlider](https://developer.apple.com/documentation/uikit/uislider)). Our track is a live gradient, so a stock `UISlider` with track images would lose the glass knob. SwiftUI's `Slider` has no gradient-track API either; its iOS 26 additions are ticks and `neutralValue` ([Slider](https://developer.apple.com/documentation/swiftui/slider); [WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)). Conclusion: build a custom SwiftUI slider and put the glass on its grip yourself. No UIKit needed.

### 7. Recommendation per control

| Control | Recommendation | Why |
|---|---|---|
| Colour panel, photo panel, sample text | **No glass** (content) | "Don't use Liquid Glass in the content layer" ([HIG](https://developer.apple.com/design/human-interface-guidelines/materials)). |
| Colour swatches / mobile swatch blocks | **No glass, no tint** | Content. Tinted glass shifts hue ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)). |
| Dock (desktop/iPad) and bottom bar (iPhone) | **Flat, opaque `canvas`**, placed below the stage, not floating | Nothing behind it to refract. Keeps the chrome quiet and fixed. Glass would flip light and dark with the content. |
| Dock buttons, WCAG\|APCA, levels, score | **Flat**, current token styles | "Use … sparingly"; avoid glass on many custom controls ([HIG](https://developer.apple.com/design/human-interface-guidelines/materials)). |
| Slider panel | **Flat** `canvas` | It's a panel of controls beside the content, not over it. |
| Slider grip | **Glass while dragging only**: `.regular.interactive()` in `.circle`, 24pt. 8pt white dot at rest. | Matches the system slider ([Adopting](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)) and the web grip. The HIG exception for sliders ([HIG](https://developer.apple.com/design/human-interface-guidelines/materials)). |
| Font menu | **System `Menu`**, default glass | Menus adopt glass automatically. It floats over the colour panel. |
| Photo arrows (on photo) | **`.buttonStyle(.glass)`**, in one `GlassEffectContainer` | They float over a photo, which is the media case. Regular, not clear, so the icon stays legible on bright photos. |
| Share / export | **System share sheet / `.sheet`**, no custom background | Automatic glass ([WWDC25 323](https://developer.apple.com/videos/play/wwdc2025/323/)). |
| Primary action (if any) | `.glassProminent` only if a single call-to-action appears | Apple reserves tint for primary actions ([HIG Color](https://developer.apple.com/design/human-interface-guidelines/color)). |

Grip sketch (unverified on device):

```swift
Circle()
    .fill(.white)
    .frame(width: dragging ? 24 : 8, height: dragging ? 24 : 8)
    .opacity(dragging ? 0 : 1)
    .glassEffect(dragging ? .regular.interactive() : .identity, in: .circle)
    .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: dragging)
```

---

## Open questions / decisions for the owner

1. **Floating or stacked bar on iPhone?** The web stacks the bar under the stage. A native iOS 26 feel would float a glass bar over the photo. That's prettier, but it means chrome tinted by the photo and flipping light and dark. Recommendation: stacked and flat. Your call.
2. **Can small glass be pinned to dark?** It needs a device test with a white background colour: font trigger, photo arrows, grip. If it flips to light and that looks wrong, fall back to flat for that control.
3. **Regular or clear glass for the grip?** Regular is the safe default. Clear is closer to the Figma "white 20%" look, but it needs dimming, and Apple says regular and clear should "never be mixed" ([WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)). Prototype both over very light and very dark gradients.
4. **Should the grip's glass refraction be allowed to distort the gradient under it?** Glass lenses the content. Over a colour track, that slightly shifts the colour you see right at the grip. Is that acceptable in a colour tool?
5. **Minimum iOS: 26 or 27?** iOS 26 is recommended (all glass APIs exist). iOS 27 only changes the look, which the app gets automatically.
6. **Should the Figma file get iOS frames with glass?** It would settle questions 1 to 4 visually before any code.
7. **Unverified items:** whether older iPhones render reduced glass, and whether an API exists to read the user's Clear↔Tinted setting.

---

## Sources

- https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:): `glassEffect` signature, defaults, availability
- https://developer.apple.com/documentation/swiftui/glass: `Glass` struct and members
- https://developer.apple.com/documentation/swiftui/glass/clear: clear variant, dimming-layer example
- https://developer.apple.com/documentation/swiftui/glass/tint(_:): tint signature
- https://developer.apple.com/documentation/swiftui/glass/interactive(_:): interactive signature
- https://developer.apple.com/documentation/swiftui/defaultglasseffectshape: default capsule shape
- https://developer.apple.com/documentation/swiftui/glasseffectcontainer: container signature and behaviour
- https://developer.apple.com/documentation/swiftui/view/glasseffectid(_:in:): morphing IDs
- https://developer.apple.com/documentation/swiftui/view/glasseffectunion(id:namespace:): union of shapes
- https://developer.apple.com/documentation/swiftui/view/glasseffecttransition(_:): transition modifier
- https://developer.apple.com/documentation/swiftui/glasseffecttransition: matchedGeometry / materialize / identity
- https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glass: `.glass` button style
- https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glass(_:): configurable glass button style
- https://developer.apple.com/documentation/swiftui/primitivebuttonstyle/glassprominent: `.glassProminent`
- https://developer.apple.com/documentation/swiftui/view/backgroundextensioneffect(): background extension effect
- https://developer.apple.com/documentation/swiftui/view/scrolledgeeffectstyle(_:for:): scroll edge effect modifier
- https://developer.apple.com/documentation/swiftui/scrolledgeeffectstyle: hard / soft / automatic styles
- https://developer.apple.com/documentation/swiftui/view/safeareabar(edge:alignment:spacing:content:): custom bars and edge effects
- https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views: custom glass guide, containers, performance
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass: adoption overview, automatic components, sliders, accessibility, performance
- https://developer.apple.com/documentation/swiftui/landmarks-building-an-app-with-liquid-glass: Apple sample code
- https://developer.apple.com/documentation/swiftui/slider: SwiftUI Slider (ticks, neutralValue)
- https://developer.apple.com/documentation/uikit/uislider: image tracks disable dynamic effects
- https://developer.apple.com/documentation/uikit/uiglasseffect: UIKit glass effect
- https://developer.apple.com/documentation/uikit/uiglasscontainereffect: UIKit glass container
- https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct/glass(): UIKit glass button configuration
- https://developer.apple.com/documentation/uikit/uiscrolledgeelementcontainerinteraction: UIKit scroll edge for custom bars
- https://developer.apple.com/documentation/bundleresources/information-property-list/uidesignrequirescompatibility: opt-out key, ignored from iOS 27 SDK
- https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducetransparency: Reduce Transparency
- https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion: Reduce Motion
- https://developer.apple.com/documentation/swiftui/environmentvalues/colorschemecontrast: Increase Contrast
- https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityshowborders: Show Borders
- https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducehighlightingeffects: Reduce Bright Effects
- https://developer.apple.com/design/human-interface-guidelines/materials: HIG, when to use glass, regular vs clear
- https://developer.apple.com/design/human-interface-guidelines/color: HIG, Liquid Glass colour and tint
- https://developer.apple.com/videos/play/wwdc2025/219/: Meet Liquid Glass (adaptivity, glass on glass, accessibility)
- https://developer.apple.com/videos/play/wwdc2025/323/: Build a SwiftUI app with the new design (APIs, bars, sheets)
- https://developer.apple.com/videos/play/wwdc2026/269/: What's new in SwiftUI (iOS 27 glass changes)
- https://developer.apple.com/videos/play/wwdc2026/102/: Platforms State of the Union 2026 (refinements, slider, accessibility)
- https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/: Liquid Glass announcement
- https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/: iOS 27 Clear↔Tinted slider
- https://9to5mac.com/2025/10/20/ios-26-1-beta-4-adds-new-setting-to-tone-down-liquid-glass-transparency/: **secondary**, iOS 26.1 Clear/Tinted setting
