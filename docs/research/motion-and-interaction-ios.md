# Motion, gestures, input and accessibility in SwiftUI

Researched 2026-10-05

Scope: how to rebuild Colour Shift's motion and interaction (PROJECT-MAP §11, §12, §13, §16; style guide "Motion") in SwiftUI on iOS/iPadOS 26. Facts come from Apple's documentation (read through its JSON data feed), the Human Interface Guidelines (HIG) and WWDC session pages. Secondary sources are labelled. Where something could not be checked, it says so.

A note on availability: some Apple pages list older first versions than the WWDC sessions that introduced the API (for example, the spring presets list iOS 13, but WWDC23 introduced them). This is likely back-deployment metadata. Where it matters, both are given.

---

## Summary for Colour Shift

1. **Animate at the call site, not with blanket implicit animations.** Wrap each discrete change in `withAnimation(kind.animation) { … }`, where `kind` is the colour fade (`photo`, `step`, `none`). Slider drags set state with no animation. This mirrors `COLOR_FADE_MS` directly. ([withAnimation](https://developer.apple.com/documentation/swiftui/withanimation(_:_:)), [Transaction](https://developer.apple.com/documentation/swiftui/transaction))
2. **Keep the web's curves.** The default 200ms ease-out becomes `.timingCurve(0.33, 1, 0.68, 1, duration: 0.2)`; the export pop becomes `.timingCurve(0.34, 1.56, 0.64, 1, duration: 0.4)`. Use springs only where you want gesture velocity carried over (none of today's motions need it). ([timingCurve](https://developer.apple.com/documentation/swiftui/animation/timingcurve(_:_:_:_:duration:)))
3. **Rolling values: build a small `RollText` view.** `.contentTransition(.numericText(value:))` is a good fit for the score number, but it is "intended" for numeric text, so hex codes and EXPORT ⇄ CLOSE need a custom per-character transition. In both cases "instant while dragging" is easy: content transitions only run inside an animated transaction, so pass no animation for fast changes. ([ContentTransition](https://developer.apple.com/documentation/swiftui/contenttransition))
4. **Sliders: draw your own, drive it with `DragGesture(minimumDistance: 0)`, and give VoiceOver a real `Slider` through `accessibilityRepresentation`.** Track = `Capsule` filled with a `LinearGradient`; grip grows 8 → 24pt; the hit area is at least 44pt tall. ([accessibilityRepresentation](https://developer.apple.com/documentation/swiftui/view/accessibilityrepresentation(representation:)), [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility))
5. **Photo change:** crossfade on all iPhone layouts with `.id(photo.id)` + `.transition(.opacity)`; slide on iPad if you want the desktop look, falling back to a fade when Reduce Motion is on.
6. **Sample text:** a vertical `TextField` with `.multilineTextAlignment(.center)`. Compute the font size yourself (binary search 96 → 16pt with `NSString.boundingRect`) rather than relying on `minimumScaleFactor`, which is documented for `Text`. Trim to 100 characters in `onChange`.
7. **Keyboard:** put hidden `Button`s with `.keyboardShortcut(.leftArrow, modifiers: [])` etc. at the root for ← → Space Esc. They work anywhere in the scene, show up in the iPad shortcut overlay, and need no focus plumbing. Verify on device that a focused text field still gets its own arrows.
8. **Reduced motion:** read `@Environment(\.accessibilityReduceMotion)` once and map every motion to a fade or nothing. On iOS 26.4+, also read `accessibilityPrefersCrossFadeTransitions` for the photo change. Reduce Transparency swaps the glass grip for a solid fill.
9. **VoiceOver:** post `AccessibilityNotification.Announcement` for the score only on discrete changes (level, swap, new photo, method switch), not on every drag tick.
10. **Minimum target: iOS 18** (for `TextRenderer` if you want a glyph-level roll and the `isEnabled:` accessibility modifiers). iOS 17 covers everything else in this document. See open questions.

---

## Findings

### 1. Animation APIs and the timing table

**Explicit vs implicit.** `withAnimation(_:_:)` "sets the given Animation as the animation property of the thread's current Transaction", so every view that changes because of that state change animates with it ([withAnimation](https://developer.apple.com/documentation/swiftui/withanimation(_:_:))). `.animation(_:value:)` "applies the given animation to this view when the specified value changes"; passing `nil` means no animation ([animation(_:value:)](https://developer.apple.com/documentation/swiftui/view/animation(_:value:))). iOS 17 added `.animation(_:body:)`, which "narrowly scopes the animation to the animatable attributes specified in its body closure" ([animation(_:body:)](https://developer.apple.com/documentation/swiftui/view/animation(_:body:)); [WWDC23 Explore SwiftUI animation](https://developer.apple.com/videos/play/wwdc2023/10156/)).

For Colour Shift, the fade speed depends on *what caused* the change, not on which view shows it (style guide: "The fade depends on what changed the colour, not on where it shows"). That is exactly what an explicit `withAnimation` at the call site gives. An implicit `.animation(.x, value: bgColour)` on the panel cannot know the cause, and would also animate drags.

**Completion.** `withAnimation(_:completionCriteria:_:completion:)` (iOS 17) runs a closure once when the animations finish; "If no animations are created … the callback will be called immediately" ([docs](https://developer.apple.com/documentation/swiftui/withanimation(_:completioncriteria:_:completion:))). This replaces the web's `animationend` listeners (leaving photo, roll layers), and it avoids the web's "1ms not none" trick under reduced motion.

**Timing curves.** `Animation.timingCurve(_ p1x:, _ p1y:, _ p2x:, _ p2y:, duration:)` takes the same four control points as CSS `cubic-bezier()`; the curve runs from (0,0) to (1,1), duration in seconds, default 0.35 ([timingCurve](https://developer.apple.com/documentation/swiftui/animation/timingcurve(_:_:_:_:duration:))). iOS 17 also has `UnitCurve.bezier(startControlPoint:endControlPoint:)` and `.timingCurve(_ curve: UnitCurve, duration:)` ([UnitCurve](https://developer.apple.com/documentation/swiftui/unitcurve), [timingCurve(_:duration:)](https://developer.apple.com/documentation/swiftui/animation/timingcurve(_:duration:))). Delays use `.delay(_:)` in seconds ([delay](https://developer.apple.com/documentation/swiftui/animation/delay(_:))).

Overshoot: the docs do not say whether control-point y values outside 0…1 (the export pop's `1.56`) are supported. Core Animation-style Bézier timing usually allows it, but **not verified**; test it, or use `.spring(duration: 0.4, bounce: 0.2)` instead.

```swift
enum Motion {
    static let easeOut = Animation.timingCurve(0.33, 1, 0.68, 1, duration: 0.2)   // default
    static let pop     = Animation.timingCurve(0.34, 1.56, 0.64, 1, duration: 0.4) // export options
    static let photo   = Animation.timingCurve(0.33, 1, 0.68, 1, duration: 0.6)    // slide / crossfade
}

enum ColourFade {
    case photo, step, none
    var animation: Animation? {
        switch self {
        case .photo: Animation.timingCurve(0.33, 1, 0.68, 1, duration: 0.7).delay(0.1)
        case .step:  Motion.easeOut
        case .none:  nil
        }
    }
}
// call site
withAnimation(ColourFade.photo.animation) { pair = photo.pair }
```

Note: every "ease-out" on the web is the same curve, `cubic-bezier(0.33, 1, 0.68, 1)`. `globals.css` uses it for the default transition, the photo slide and fade, and the roll keyframes; the pop uses `cubic-bezier(0.34, 1.56, 0.64, 1)`. So one `timingCurve` constant covers everything except the pop. Do not use SwiftUI's `.easeOut`, which is a different curve.

**Springs.** `spring(duration:bounce:blendDuration:)`: duration is "the perceptual duration … approximately equal to the settling duration"; bounce 0 is critically damped, up to 1.0 is undamped, negative is overdamped ([spring](https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:))). Presets: `.smooth` ("no bounce"), `.snappy` ("small amount of bounce"), `.bouncy` ("higher amount of bounce") ([smooth](https://developer.apple.com/documentation/swiftui/animation/smooth), [snappy](https://developer.apple.com/documentation/swiftui/animation/snappy), [bouncy](https://developer.apple.com/documentation/swiftui/animation/bouncy)). Apple did not publish the preset values ([WWDC23 Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)). Since iOS 17 a bare `withAnimation` uses "a smooth spring", not ease-in-out ([WWDC23 10156](https://developer.apple.com/videos/play/wwdc2023/10156/)). So always pass an explicit animation if you want the web curves.

Springs keep velocity when retargeted, and "a spring can start with any initial velocity", which timing curves cannot ([WWDC23 10158](https://developer.apple.com/videos/play/wwdc2023/10158/)). That matters only for motion that follows a finger and then lets go. Colour Shift has none today; the colour fades and panel opens are fine as Bézier curves.

**Transactions and live drags.** A `Transaction` carries the animation for one update ([Transaction.animation](https://developer.apple.com/documentation/swiftui/transaction/animation)). Tools:

- `withTransaction(_:_:)` runs a closure with a given transaction ([docs](https://developer.apple.com/documentation/swiftui/withtransaction(_:_:))).
- `Transaction.disablesAnimations` stops `.animation(_:)` modifiers adding animations ([docs](https://developer.apple.com/documentation/swiftui/transaction/disablesanimations)).
- `Transaction.isContinuous` is true for "dragging a slider or pressing and holding a stepper" ([docs](https://developer.apple.com/documentation/swiftui/transaction/iscontinuous)).
- `Transaction.tracksVelocity` (iOS 17); gesture `onChanged` sets it automatically ([docs](https://developer.apple.com/documentation/swiftui/transaction/tracksvelocity)).
- `.transaction { $0.animation = nil }` on a leaf view strips animation there; Apple advises leaf views, not containers ([transaction(_:)](https://developer.apple.com/documentation/swiftui/view/transaction(_:))).

```swift
// Slider drag: no animation, whatever an ancestor asked for.
var t = Transaction(animation: nil)
t.disablesAnimations = true
withTransaction(t) { model.setChannel(key, to: v) }
```

`@Animatable` macro (synthesises `animatableData`) is documented ([Animatable()](https://developer.apple.com/documentation/swiftui/animatable())). It is handy if you write a custom `Shape` for the grip. Its page lists iOS 13 because it is a compile-time macro; it needs the Xcode 26 toolchain (unverified exact version).

### 2. Rolling numbers and text

**`contentTransition(.numericText(...))`.** `numericText(countsDown:)` (iOS 16) gives "a nonstandard transition tailored to numeric characters that count up or down", in "certain environments" ([docs](https://developer.apple.com/documentation/swiftui/contenttransition/numerictext(countsdown:))). `numericText(value:)` (iOS 17) uses the old and new value "to determine the animation direction" ([docs](https://developer.apple.com/documentation/swiftui/contenttransition/numerictext(value:))). Crucially: "Content transitions only take effect within transactions that apply an Animation" ([ContentTransition](https://developer.apple.com/documentation/swiftui/contenttransition); [contentTransition(_:)](https://developer.apple.com/documentation/swiftui/view/contenttransition(_:))).

That last rule gives the web's "animate single changes, update instantly during fast changes" for free: animate the change for a level click or swap; set it with no animation during a drag. You do not need the web's "< 300ms apart" timer if you already know the source (drag vs tap). Keep a timer only as a fallback for key-repeat on sliders.

Limits:
- Apple says it is "intended to be used with `Text` views displaying numeric text". Behaviour on letters (`AA`, `Content`, hex `A–F`, `EXPORT`) is not documented. Secondary: [Create with Swift](https://www.createwithswift.com/animating-numeric-text-in-swiftui-with-the-content-transition-modifier/) and [Swift with Majid](https://swiftwithmajid.com/2022/08/02/content-transition-in-swiftui/) show it on numbers only. **Unverified for text.**
- You cannot tune it: no stagger, travel distance or blur. It will not match the web's 12ms stagger, 55% travel, 0.5px blur exactly.
- Whether it respects Reduce Motion by itself is **not documented**. Gate it yourself.

```swift
Text(score.formatted)                      // e.g. "5.21:1"
    .monospacedDigit()
    .contentTransition(.numericText(value: score.ratio))
// discrete:  withAnimation(Motion.easeOut) { model.applyLevel(l) }
// drag:      model.setChannel(...)   // no animation → instant
```

**Custom per-character roll** (closest to the web). One view per character, keyed by index + character, so only changed characters leave and enter. Each gets an asymmetric offset + opacity (+ blur) transition with a per-index delay:

```swift
struct RollText: View {
    let value: String
    var animated: Bool                         // false while dragging
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(value.enumerated()), id: \.offset) { i, ch in
                Text(String(ch))
                    .id("\(i)-\(ch)")         // new identity when the character changes
                    .transition(.asymmetric(
                        insertion: .offset(y: 8).combined(with: .opacity),
                        removal:   .offset(y: -8).combined(with: .opacity)))
                    .animation(animated && !reduceMotion
                               ? .timingCurve(0.33, 1, 0.68, 1, duration: 0.3).delay(0.012 * Double(i))
                               : nil, value: value)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(value)             // the web's sr-only copy
    }
}
```

(`offset(y:)`, `opacity`, `asymmetric`, `combined(with:)` are built-in transitions: [Transition](https://developer.apple.com/documentation/swiftui/transition). `accessibilityElement(children:)`: [docs](https://developer.apple.com/documentation/swiftui/view/accessibilityelement(children:)).) Width snaps to the new value because removed views do not take layout space in an `HStack` once removed; check this visually, since removal transitions keep the old view on screen while it animates. Use a fixed-width digit font (`.monospacedDigit()`) to stop jitter.

**Glyph-level option (iOS 18).** `TextRenderer` lets you draw each glyph slice yourself and animate it; `Text.Layout` is "a Collection of lines … Runs … RunSlices" and WWDC24 builds exactly this kind of per-glyph appearing transition with a custom `Transition` ([WWDC24 Create custom visual effects](https://developer.apple.com/videos/play/wwdc2024/10151/); [textRenderer(_:)](https://developer.apple.com/documentation/swiftui/view/textrenderer(_:)), iOS 18). More work, but it gives true per-glyph blur and offset with one `Text`. Use only if the simple version above looks wrong.

### 3. Transitions: photos, panels, matched geometry, phase/keyframe animators

**Photo crossfade.** Changing `.id` gives a view a new identity, which "resets" it ([id(_:)](https://developer.apple.com/documentation/swiftui/view/id(_:))), so SwiftUI removes the old view and inserts a new one; with `.transition(.opacity)` inside `withAnimation`, that is a crossfade ([Transition](https://developer.apple.com/documentation/swiftui/transition), [opacity](https://developer.apple.com/documentation/swiftui/anytransition/opacity)). The leaving view stays on screen until its transition ends, so the web's "leaving" layer and `animate-hold` are not needed.

```swift
ZStack {
    PhotoLayer(photo: photo)
        .id(photo.id)
        .transition(isCompact || reduceMotion ? .opacity
                    : .asymmetric(insertion: .move(edge: forward ? .trailing : .leading),
                                  removal:   .move(edge: forward ? .leading : .trailing)))
}
.clipped()
// withAnimation(Motion.photo) { index += 1 }
// withAnimation(ColourFade.photo.animation) { pair = newPhoto.pair }  // trails by 100ms
```

Built-in transitions include `blurReplace`, `move(edge:)`, `offset`, `opacity`, `push(from:)`, `scale`, `slide`; custom ones conform to `Transition` (iOS 17) with `body(content:phase:)` ([Transition](https://developer.apple.com/documentation/swiftui/transition), [transition(_:)](https://developer.apple.com/documentation/swiftui/view/transition(_:))). `blurReplace` could stand in for the blurred-preview-to-full fade, but the web's approach (preview image under, full image fades in over 400ms when loaded) ports more literally: two stacked images, the full one's opacity animated on load.

**Panels that grow in height.** Insert/remove the panel inside a `VStack` within `withAnimation`; the stack's height animates and the panel uses a fade + 4pt offset:

```swift
VStack(spacing: 0) {
    Stage()
    if activeRole != nil {
        SliderPanel(colour: lastShownColour)
            .transition(.opacity.combined(with: .offset(y: 4)))
    }
    BottomBar()
}
// withAnimation(Motion.easeOut) { activeRole = .text }
```

Because removed views animate out with their last state, "the slider panel keeps showing the last colour while it closes" mostly comes for free, as long as `SliderPanel` is passed the last colour rather than reading `activeRole`. If content must stay mounted (as the web's `inert` panel does), use `.frame(height: open ? nil : 0, alignment: .top).clipped()` plus `.accessibilityHidden(!open)` and `.disabled(!open)`. Animating to and from a `nil` height can look uneven; **test both**. If children animate separately from the container, `geometryGroup()` (iOS 17) makes the parent resolve position and size first ([docs](https://developer.apple.com/documentation/swiftui/view/geometrygroup())).

**`matchedGeometryEffect`** links frames of views with the same id so "it appear[s] that there is a single view moving" ([docs](https://developer.apple.com/documentation/swiftui/view/matchedgeometryeffect(id:in:properties:anchor:issource:))). Useful for the selected tab in the WCAG | APCA switch and the mode tabs (a raised pill that slides). Not needed elsewhere. Note the web snaps those today; adding a slide would be a design change.

**`PhaseAnimator` / `KeyframeAnimator`** (iOS 17) cycle through phases or keyframes ([PhaseAnimator](https://developer.apple.com/documentation/swiftui/phaseanimator), [KeyframeAnimator](https://developer.apple.com/documentation/swiftui/keyframeanimator)). Only one web motion is multi-step: the button press (scale 0.95, pop back). That is better done with a `ButtonStyle` reading `configuration.isPressed` and an ease-out animation. Not needed otherwise.

### 4. Custom sliders

**System `Slider`.** iOS has no `SliderStyle`; Apple's topics list initialisers only ([Slider](https://developer.apple.com/documentation/swiftui/slider)). iOS 26 adds ticks (`SliderTick`) and new initialisers with `neutralValue`, `enabledBounds` and `currentValueLabel` ([SliderTick](https://developer.apple.com/documentation/swiftui/slidertick), [init(value:in:neutralValue:…)](https://developer.apple.com/documentation/swiftui/slider/init(value:in:neutralvalue:enabledbounds:label:currentvaluelabel:minimumvaluelabel:maximumvaluelabel:oneditingchanged:))). None of these let you draw a gradient track or a glass grip. So: custom view.

**Custom slider shape.** HIG allows it: "Customize a slider's appearance if it adds value", keep minimum on the leading side ([HIG Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders)).

```swift
struct ChannelSlider: View {
    @Binding var value: Double            // 0…1
    let stops: [Color]                    // live gradient for this channel
    var onEditingChanged: (Bool) -> Void = { _ in }
    @State private var dragging = false
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        GeometryReader { geo in
            let inset = 12.0                                  // grip centre travels 12pt in from each end
            let usable = geo.size.width - inset * 2
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(LinearGradient(colors: stops, startPoint: .leading, endPoint: .trailing))
                    .overlay(Capsule().strokeBorder(.trackEdge, lineWidth: 1))
                    .frame(height: 6)
                Circle()
                    .fill(reduceTransparency ? AnyShapeStyle(.white) : AnyShapeStyle(.ultraThinMaterial))
                    .frame(width: dragging ? 24 : 8, height: dragging ? 24 : 8)
                    .position(x: inset + usable * value, y: geo.size.height / 2)
                    .animation(Motion.easeOut, value: dragging)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())                        // whole 44pt row is touchable
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { g in
                    if !dragging { dragging = true; onEditingChanged(true) }
                    value = min(max((g.location.x - inset) / usable, 0), 1)
                }
                .onEnded { _ in dragging = false; onEditingChanged(false) })
        }
        .frame(height: 44)
    }
}
```

- `DragGesture(minimumDistance:)` defaults to 10pt; use 0 so a tap jumps the grip, like a native range input ([init(minimumDistance:coordinateSpace:)](https://developer.apple.com/documentation/swiftui/draggesture/init(minimumdistance:coordinatespace:)), [DragGesture](https://developer.apple.com/documentation/swiftui/draggesture)).
- `contentShape(_:)` sets the hit-test shape ([docs](https://developer.apple.com/documentation/swiftui/view/contentshape(_:eofill:))), so the 6pt track gets a 44pt touch row. HIG: iOS default control size 44×44pt, minimum 28×28pt ([HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). The web's mobile sliders are 28px tall: that meets the minimum but not the default. Three stacked 44pt rows make the panel taller; see open questions.
- In a vertical layout, a horizontal drag can fight a parent scroll view. The app has no scroll view in the stage, so this should not arise; **not tested**.
- Glass grip: `.ultraThinMaterial` ([Material.ultraThin](https://developer.apple.com/documentation/swiftui/material/ultrathin)) or the iOS 26 Liquid Glass `glassEffect(_:in:)` ([docs](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))). Liquid Glass on a 24pt dot may look heavier than the web's 3px blur; prototype both.

**Haptics.** `sensoryFeedback(_:trigger:)` plays feedback "when the provided trigger value changes" (iOS 17); variants take a `condition` closure or return feedback from a closure ([sensoryFeedback(_:trigger:)](https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(_:trigger:)), [condition variant](https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(_:trigger:condition:)), [closure variant](https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(trigger:_:))). Kinds include `selection`, `increase`, `decrease`, `levelChange`, `impact`, `success`, `warning`, `error` ([SensoryFeedback](https://developer.apple.com/documentation/swiftui/sensoryfeedback)). HIG: system sliders already play haptics; "Avoid overusing haptics"; prefer "short haptics that complement discrete events"; "Make haptics optional" ([HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)).

Suggestion: `.selection` when a slider hits 0 or max, or crosses a whole step; `.levelChange` when the passing level changes; nothing per drag tick.

```swift
.sensoryFeedback(.levelChange, trigger: passingLevel)
.sensoryFeedback(.selection, trigger: value) { old, new in (new == 0 || new == 1) && old != new }
```

**Accessibility for the custom slider.** Two documented routes:

1. `accessibilityRepresentation { Slider(...) }`: SwiftUI "hides the view that you provide … and makes it non-interactive. The framework uses it only to generate accessibility elements." Apple's own example is a custom slider track ([docs](https://developer.apple.com/documentation/swiftui/view/accessibilityrepresentation(representation:))). This gives VoiceOver the standard adjustable slider, swipe up/down, and the value. This is the direct equivalent of the web's invisible native `<input type="range">`.
2. Manual: `.accessibilityElement()`, `.accessibilityLabel("Lightness")`, `.accessibilityValue("62 percent")` ([accessibilityValue](https://developer.apple.com/documentation/swiftui/view/accessibilityvalue(_:))), `.accessibilityAdjustableAction { direction in … }` with `.increment` / `.decrement` ([accessibilityAdjustableAction](https://developer.apple.com/documentation/swiftui/view/accessibilityadjustableaction(_:))).

Prefer route 1, and set a step on the represented `Slider` that matches the web's keyboard step per channel.

### 5. Editable text that shrinks to fit

**What the built-ins do.**
- `TextField(_:text:axis: .vertical)` (iOS 16) grows vertically and scrolls when it does not fit ([init(_:text:axis:)](https://developer.apple.com/documentation/swiftui/textfield/init(_:text:axis:))). `lineLimit(_:reservesSpace:)` caps lines; past the cap "a TextField becomes scrollable" ([docs](https://developer.apple.com/documentation/swiftui/view/linelimit(_:reservesspace:))).
- `multilineTextAlignment(.center)` also sets content alignment for `TextField` and `TextEditor`, "even when the view contains only a single line" ([docs](https://developer.apple.com/documentation/swiftui/view/multilinetextalignment(_:))).
- `minimumScaleFactor(_:)` is documented with `Text` ("text in this view scales down to fit") ([docs](https://developer.apple.com/documentation/swiftui/view/minimumscalefactor(_:))). Its effect on an editable `TextField` is **not documented**; do not rely on it. It also scales rather than reflowing, so line breaks would differ from the web's binary search.
- `ViewThatFits` picks "the first child whose ideal size … fits" ([docs](https://developer.apple.com/documentation/swiftui/viewthatfits)). Choosing among ~80 font sizes this way would mean 80 candidate views; and swapping the field would lose focus and caret. Not suitable.
- `TextEditor` (iOS 14) is for "long-form text" ([docs](https://developer.apple.com/documentation/swiftui/texteditor)); it brings its own scrolling and insets. A vertical `TextField` is closer to the web's centred `contentEditable`.

**Recommended.** Measure the panel with `onGeometryChange(for:of:action:)` ([docs](https://developer.apple.com/documentation/swiftui/view/ongeometrychange(for:of:action:))), then binary-search a whole-point size from 96 down to 16 with `NSString.boundingRect(with:options:attributes:context:)` ([docs](https://developer.apple.com/documentation/foundation/nsstring/boundingrect(with:options:attributes:context:))) using the specimen `UIFont`. Re-run on text, font, size and Dynamic Type changes. Trim in `onChange` ([onChange(of:initial:_:)](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:))).

```swift
@State private var fontSize: CGFloat = 96
@State private var box: CGSize = .zero
@FocusState private var editing: Bool

TextField("Aa", text: $sample, axis: .vertical)
    .font(.custom(specimen.postScriptName, fixedSize: fontSize))   // fixedSize: our own fit, not Dynamic Type
    .multilineTextAlignment(.center)
    .focused($editing)
    .onSubmit { editing = false }                                  // Enter stops editing (see note)
    .onChange(of: sample) { _, new in
        if new.count > 100 { sample = String(new.prefix(100)) }
    }
    .onGeometryChange(for: CGSize.self) { $0.size } action: { box = $0 }
    .onChange(of: [sample, specimen.id, "\(box)"]) { fontSize = fit(sample, specimen, in: box) }
    .opacity(editing ? 1 : 0.65)  // hover dim only makes sense with a pointer on iPad; see open questions

func fit(_ s: String, _ f: Specimen, in box: CGSize) -> CGFloat {
    var lo = 16, hi = 96
    while lo < hi {
        let mid = (lo + hi + 1) / 2
        let r = (s.isEmpty ? "Aa" : s).boundingRect(
            with: CGSize(width: box.width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: UIFont(name: f.postScriptName, size: CGFloat(mid))!], context: nil)
        if r.height <= box.height && r.width <= box.width { lo = mid } else { hi = mid - 1 }
    }
    return CGFloat(lo)
}
```

Notes:
- With `axis: .vertical`, Return inserts a newline rather than submitting; whether `onSubmit` fires is **not verified** for vertical fields. If not, intercept `"\n"` in `onChange` and drop focus.
- Trimming in `onChange` may move the caret; the web forces it to the end. **Not verified** what SwiftUI does; test.
- A too-long word at 16pt: `boundingRect` wraps by character only if you configure that; the web lets it "break anywhere". Check that the field and the measurement wrap the same way.
- The selection tint (text colour at 20%) maps to `.tint(textColour)`; exact alpha control is **not verified**.

### 6. Hardware keyboard shortcuts and focus

**`keyboardShortcut(_:modifiers:)`** (iOS 14) binds a key to a control. "Pressing the control's shortcut while the control is anywhere in the frontmost window or scene … is equivalent to direct interaction with the control." The default modifier is `.command`, so pass `modifiers: []` for bare keys ([docs](https://developer.apple.com/documentation/swiftui/view/keyboardshortcut(_:modifiers:))). `KeyEquivalent` has `.leftArrow`, `.rightArrow`, `.space`, `.escape` ([escape](https://developer.apple.com/documentation/swiftui/keyequivalent/escape)).

**`onKeyPress`** (iOS 17) fires "if the user presses a key on a hardware keyboard **while the view has focus**", for key-down and key-repeat; return `.handled` or `.ignored` ([onKeyPress(_:action:)](https://developer.apple.com/documentation/swiftui/view/onkeypress(_:action:)), [keys:phases:](https://developer.apple.com/documentation/swiftui/view/onkeypress(keys:phases:action:)), [KeyPress](https://developer.apple.com/documentation/swiftui/keypress)). Needs a focused view, e.g. with `.focusable()` ([focusable(_:interactions:)](https://developer.apple.com/documentation/swiftui/view/focusable(_:interactions:))) and `defaultFocus` ([docs](https://developer.apple.com/documentation/swiftui/view/defaultfocus(_:_:priority:))).

Recommendation: use `keyboardShortcut` on buttons for the app-wide keys (works without focus), and `onKeyPress` only where a focused view needs to handle arrows itself (a focused slider). The web skips ← → Space while typing; on iOS, check whether a focused `TextField` consumes arrows before the shortcut fires. This ordering is **not documented**; secondary sources ([Sarunw](https://sarunw.com/posts/swiftui-keyboard-shortcuts/), [Swift with Majid](https://swiftwithmajid.com/2020/11/17/keyboard-shortcuts-in-swiftui/)) cover only the basics. If needed, disable the arrow/Space buttons while the sample text is focused: `.disabled(editing)`.

```swift
// At the root, invisible but in the hierarchy:
Group {
    Button("Previous photo") { model.previous() }.keyboardShortcut(.leftArrow, modifiers: [])
    Button("Next photo")     { model.next() }    .keyboardShortcut(.rightArrow, modifiers: [])
    Button("New photo")      { model.jump() }    .keyboardShortcut(.space, modifiers: [])
}
.disabled(editingSample)
Button("Close") { model.closeAll() }.keyboardShortcut(.escape, modifiers: [])
// hide with .opacity(0).accessibilityHidden(true).allowsHitTesting(false)
```

HIG: "Respect standard keyboard shortcuts"; prefer Command as the main modifier for custom shortcuts ([HIG Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)). Bare arrows and Space are not in Apple's standard table for these actions (Command-Space is Spotlight; Command-arrows are text navigation), so bare keys do not clash. HIG also says iPadOS prefers Full Keyboard Access for moving between controls, rather than custom keyboard navigation of buttons ([same page](https://developer.apple.com/design/human-interface-guidelines/keyboards)).

**Focus.** `@FocusState` with `.focused(_:equals:)` reads and sets focus; set to `nil`/`false` to dismiss the keyboard ([FocusState](https://developer.apple.com/documentation/swiftui/focusstate)). Use it for: Enter/Esc leaving the sample text, and moving focus to COPY URL when export opens. `focusEffectDisabled()` hides the system focus ring ([docs](https://developer.apple.com/documentation/swiftui/view/focuseffectdisabled(_:))), matching the web's "caret is the focus state" for the sample text. `onExitCommand` is macOS/tvOS only ([docs](https://developer.apple.com/documentation/swiftui/view/onexitcommand(perform:))); use the Escape shortcut on iOS. VoiceOver's two-finger scrub maps to `.accessibilityAction(.escape)` ([escape action](https://developer.apple.com/documentation/swiftui/accessibilityactionkind/escape)); add it to the slider panel and levels so VoiceOver users can close them.

### 7. Accessibility settings

**Reduce Motion.** `accessibilityReduceMotion`: when true, "UI should avoid large animations, especially those that simulate the third dimension" ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion)). HIG: reduce "automatic and repetitive animations, including zooming, scaling, and peripheral motion", tighten springs, track gestures directly, and replace x/y/z transitions with fades ([HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). New in iOS 26.4: `accessibilityPrefersCrossFadeTransitions`, true when Reduce Motion **and** Prefer Cross-Fade Transitions are on; "UI should avoid Slide animations and prefer Cross-Fade transitions instead" ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityPrefersCrossFadeTransitions)).

The web snaps everything (0ms). HIG suggests fades are acceptable under Reduce Motion. Two options for the owner: snap everything (matches the web) or keep short fades and drop movement (matches HIG). Either way, SwiftUI has no global switch like the CSS media query; gate the shared `Motion` constants:

```swift
extension Animation {
    static func motion(_ a: Animation?, reduce: Bool) -> Animation? { reduce ? nil : a }
}
```

**Reduce Transparency.** `accessibilityReduceTransparency`: backgrounds "should not be semi-transparent; they should be opaque" ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducetransparency)). Applies to the glass grip and the blurred photo preview.

**Dynamic Type.** HIG: let people enlarge text "by at least 200 percent" ([HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). Read `dynamicTypeSize` ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/dynamictypesize)); it is settable to clamp a range, and Apple suggests the large content viewer when you limit it ([accessibilityShowsLargeContentViewer()](https://developer.apple.com/documentation/swiftui/view/accessibilityshowslargecontentviewer())). For Colour Shift: chrome text (12/14px on web) should use text styles that scale; the dock is dense, so cap at an accessibility size and add the large content viewer to icon buttons. The sample text is the user's content with its own fit logic; keep it out of Dynamic Type (`fixedSize:` font).

**Differentiate Without Colour.** `accessibilityDifferentiateWithoutColor` ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilitydifferentiatewithoutcolor)). The passing level is shown by the "selected look"; make sure it has a non-colour cue (outline, weight).

**VoiceOver announcements.** `AccessibilityNotification.Announcement(…).post()` (iOS 17) sends a string or `AttributedString`; priority via `accessibilitySpeechAnnouncementPriority` (Apple's example uses `.high`, which "interrupts other speech") ([docs](https://developer.apple.com/documentation/accessibility/accessibilitynotification/announcement)). The web's `aria-live="polite"` maps to a default or low priority. Post only on discrete changes; during a drag, the represented `Slider` already speaks its own value. `accessibilityVoiceOverEnabled` tells you if VoiceOver is on ([docs](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityvoiceoverenabled)), if you want to skip work. iOS 18 accessibility modifiers take an `isEnabled:` parameter for conditional labels ([WWDC24 Catch up on accessibility in SwiftUI](https://developer.apple.com/videos/play/wwdc2024/10073/)).

```swift
.onChange(of: model.scoreChangeID) {                // bumped only by discrete actions
    var s = AttributedString(model.score.spoken)    // "AA, 5.21 to 1"
    s.accessibilitySpeechAnnouncementPriority = .low
    AccessibilityNotification.Announcement(s).post()
}
```

Toggle states: the web's `aria-pressed` / `aria-expanded` map to `.accessibilityAddTraits(.isSelected)` ([accessibilityAddTraits](https://developer.apple.com/documentation/swiftui/view/accessibilityaddtraits(_:))) and an `accessibilityValue("expanded"/"collapsed")`. Closed panels (`inert`) map to removing the view, or `.accessibilityHidden(true)` + `.disabled(true)` if kept mounted.

**HIG on motion in general.** "In apps, generally avoid adding motion to UI interactions that occur frequently"; "Let people cancel motion … don't make people wait for an animation to complete" ([HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)). Colour Shift's rules (live input instant, small distances, close instantly) already fit.

---

## Web → SwiftUI mapping table

| Web motion / interaction | Web timing | SwiftUI equivalent |
|---|---|---|
| Default (hover, press, fades, panels) | 200ms `cubic-bezier(0.33,1,0.68,1)` | `Animation.timingCurve(0.33, 1, 0.68, 1, duration: 0.2)` |
| Colour fade: photo | 100ms delay + 700ms | `withAnimation(.timingCurve(0.33,1,0.68,1, duration: 0.7).delay(0.1)) { pair = … }` |
| Colour fade: step (swap, level) | 200ms | `withAnimation(Motion.easeOut) { … }` |
| Colour fade: slider drag | instant | set state with no animation; `withTransaction(Transaction(animation: nil))` if an ancestor animates |
| Photo slide (desktop) | 600ms ease-out | `.id(photo.id)` + `.transition(.asymmetric(.move(edge:)…))` (iPad regular width only) |
| Photo crossfade (mobile) | 600ms | `.id(photo.id)` + `.transition(.opacity)` in `withAnimation(duration 0.6)` |
| Full photo over blurred preview | 400ms (first photo 200ms) | two stacked images; full image `.opacity(loaded ? 1 : 0).animation(…, value: loaded)` |
| `animationend` cleanup | — | `withAnimation(…, completion:)`; removed views clean themselves up |
| Rolling score | 300ms, 12ms stagger, instant if < 300ms apart | `.contentTransition(.numericText(value:))` with animation only for discrete changes, or custom `RollText` |
| Rolling hex, EXPORT ⇄ CLOSE | same | custom per-character `RollText` (offset + opacity transitions, `.delay(0.012 * i)`); `TextRenderer` (iOS 18) if needed |
| Export options pop | 400ms, overshoot `cubic-bezier(0.34,1.56,0.64,1)`; close instantly | insert with `.transition(.asymmetric(insertion: .offset(x: 16).combined(with: .opacity), removal: .identity))` + `.timingCurve(0.34,1.56,0.64,1, duration: 0.4)` (overshoot unverified) or `.spring(duration: 0.4, bounce: 0.2)` |
| Panels (slider panel, mobile levels) both ways | 200ms, 0fr↔1fr + fade + 4px | `if open { … .transition(.opacity.combined(with: .offset(y: 4))) }` inside a `VStack`, `withAnimation(Motion.easeOut)` |
| Font menu, desktop levels: open softly, close instantly | fade + 4px / 8px | `.transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: -4)), removal: .identity))`; or use a system `Menu` (own motion) |
| Font menu ↑ ↓ wrap, focus to checked item | — | system `Menu` / `Picker(.menu)` gives this for free; custom needs `@FocusState` |
| Button press | scale 0.95 | `ButtonStyle` with `.scaleEffect(configuration.isPressed ? 0.95 : 1)` |
| Mode tabs, WCAG/APCA switch | snap | `Picker(.segmented)` or custom; optional `matchedGeometryEffect` slide |
| Slider (native range input under drawn track) | — | custom view + `DragGesture(minimumDistance: 0)` + `.accessibilityRepresentation { Slider(...) }` |
| Live gradient track | 6px, round, 1px edge | `Capsule().fill(LinearGradient(...)).overlay(Capsule().strokeBorder(...))` |
| Grip 8 → 24px glass on hover/drag | 200ms | `.frame(width: dragging ? 24 : 8)` animated on `dragging`; `.ultraThinMaterial` or `glassEffect`; solid if Reduce Transparency |
| Touch area +8px | 28px mobile | `.frame(height: 44).contentShape(Rectangle())` (HIG 44pt) |
| Channel readout fades 1s after release | 200ms after 1s | `Task { try await Task.sleep(for: .seconds(1)); withAnimation(Motion.easeOut) { visible = false } }`, cancel on new drag |
| Mobile swatch row 1fr/2fr | 200ms | custom `Layout` or widths from `onGeometryChange`, animated with `Motion.easeOut` |
| Sample text shrink to fit 96 → 16 | before paint | `TextField(axis: .vertical)` + binary search with `boundingRect`; font `.custom(_, fixedSize:)` |
| Sample text max 100 chars | trim, caret to end | `onChange(of: text)` → `String(text.prefix(100))` (caret behaviour unverified) |
| Sample text hover 65% | hover | `.onHover` on iPad with pointer; on iPhone, no hover state (decide) |
| Enter / Esc stop editing | — | `@FocusState` set to `false`; `onSubmit`; Escape shortcut |
| ← → / Space / Esc | window keydown | hidden `Button`s with `.keyboardShortcut(_, modifiers: [])`; `.disabled(editing)` for arrows and Space |
| Focus ring 1px | — | system focus effect (Full Keyboard Access); `focusEffectDisabled()` on the sample text |
| `aria-live="polite"` score | — | `AccessibilityNotification.Announcement` (low priority), discrete changes only |
| `aria-pressed` / `aria-expanded` | — | `.accessibilityAddTraits(.isSelected)` / `accessibilityValue` |
| `inert` closed panels | — | remove view, or `.accessibilityHidden(true).disabled(true)` |
| sr-only copy of rolling text | — | `.accessibilityElement(children: .ignore).accessibilityLabel(value)` |
| `prefers-reduced-motion` → 0ms / 1ms | global | `@Environment(\.accessibilityReduceMotion)` gating `Motion`; `accessibilityPrefersCrossFadeTransitions` (26.4) for photos |
| Haptics | none on web | `sensoryFeedback(.levelChange, trigger:)`, `.selection` at slider ends |

---

## Open questions / decisions for the owner

1. **Deployment target.** iOS 17 covers almost everything here. iOS 18 adds `TextRenderer` and `isEnabled:` accessibility modifiers. iOS 26 adds Liquid Glass (`glassEffect`) and slider ticks; 26.4 adds `accessibilityPrefersCrossFadeTransitions`. Which floor?
2. **Rolling style.** Accept the system `numericText` look for the score (cheap, native, not exactly the web), or build `RollText` for everything so score and hex match?
3. **Reduce Motion.** Snap everything (like the web), or keep short fades and drop only movement (as HIG suggests)?
4. **Slider row height.** The web uses 28px touch rows on mobile (HIG minimum). HIG's default is 44pt. Three 44pt rows make the panel ~40pt taller. Which?
5. **iPad layout.** The web gives ≥ 640px the desktop layout. On iPad, use size classes: regular width → desktop dock + photo slide; compact → bottom bar + crossfade? Landscape iPhone?
6. **Hover states on iPad.** Grip-on-hover, sample-text 65% dim and photo arrows on hover only make sense with a pointer. Keep them behind `.onHover` (iPad with trackpad) and show arrows always on touch, like the web's `pointer-coarse`?
7. **Haptics.** The web has none. Add `.levelChange` on passing-level change and `.selection` at slider ends, or keep silent?
8. **Font menu.** Use the system `Menu` (native look and motion, free keyboard and VoiceOver support) or rebuild the custom dropdown?
9. **Glass grip.** `.ultraThinMaterial` (closest to the web's 3px blur) or iOS 26 Liquid Glass?
10. **Things to test on device** (not verifiable from docs): Bézier y > 1 overshoot; `numericText` on letters; whether a focused `TextField` swallows arrow shortcuts; `onSubmit` with vertical `TextField`; caret position after trimming; `nil`-height panel animation.

---

## Sources

Apple documentation (SwiftUI unless noted)
- withAnimation(_:_:) — https://developer.apple.com/documentation/swiftui/withanimation(_:_:)
- withAnimation(_:completionCriteria:_:completion:) — https://developer.apple.com/documentation/swiftui/withanimation(_:completioncriteria:_:completion:)
- animation(_:value:) — https://developer.apple.com/documentation/swiftui/view/animation(_:value:)
- animation(_:body:) — https://developer.apple.com/documentation/swiftui/view/animation(_:body:)
- Animation.timingCurve(_:_:_:_:duration:) — https://developer.apple.com/documentation/swiftui/animation/timingcurve(_:_:_:_:duration:)
- Animation.timingCurve(_:duration:) — https://developer.apple.com/documentation/swiftui/animation/timingcurve(_:duration:)
- UnitCurve — https://developer.apple.com/documentation/swiftui/unitcurve
- Animation.delay(_:) — https://developer.apple.com/documentation/swiftui/animation/delay(_:)
- Animation.spring(duration:bounce:blendDuration:) — https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:)
- Animation.smooth / snappy / bouncy — https://developer.apple.com/documentation/swiftui/animation/smooth, https://developer.apple.com/documentation/swiftui/animation/snappy, https://developer.apple.com/documentation/swiftui/animation/bouncy
- Transaction.animation — https://developer.apple.com/documentation/swiftui/transaction/animation
- Transaction.disablesAnimations — https://developer.apple.com/documentation/swiftui/transaction/disablesanimations
- Transaction.isContinuous — https://developer.apple.com/documentation/swiftui/transaction/iscontinuous
- Transaction.tracksVelocity — https://developer.apple.com/documentation/swiftui/transaction/tracksvelocity
- transaction(_:) — https://developer.apple.com/documentation/swiftui/view/transaction(_:)
- withTransaction(_:_:) — https://developer.apple.com/documentation/swiftui/withtransaction(_:_:)
- Animatable() macro — https://developer.apple.com/documentation/swiftui/animatable()
- ContentTransition — https://developer.apple.com/documentation/swiftui/contenttransition
- contentTransition(_:) — https://developer.apple.com/documentation/swiftui/view/contenttransition(_:)
- numericText(countsDown:) — https://developer.apple.com/documentation/swiftui/contenttransition/numerictext(countsdown:)
- numericText(value:) — https://developer.apple.com/documentation/swiftui/contenttransition/numerictext(value:)
- TextRenderer — https://developer.apple.com/documentation/swiftui/textrenderer
- textRenderer(_:) — https://developer.apple.com/documentation/swiftui/view/textrenderer(_:)
- Transition — https://developer.apple.com/documentation/swiftui/transition
- transition(_:) — https://developer.apple.com/documentation/swiftui/view/transition(_:)
- AnyTransition.opacity — https://developer.apple.com/documentation/swiftui/anytransition/opacity
- id(_:) — https://developer.apple.com/documentation/swiftui/view/id(_:)
- matchedGeometryEffect — https://developer.apple.com/documentation/swiftui/view/matchedgeometryeffect(id:in:properties:anchor:issource:)
- geometryGroup() — https://developer.apple.com/documentation/swiftui/view/geometrygroup()
- PhaseAnimator — https://developer.apple.com/documentation/swiftui/phaseanimator
- KeyframeAnimator — https://developer.apple.com/documentation/swiftui/keyframeanimator
- Slider — https://developer.apple.com/documentation/swiftui/slider
- SliderTick — https://developer.apple.com/documentation/swiftui/slidertick
- Slider init with neutralValue — https://developer.apple.com/documentation/swiftui/slider/init(value:in:neutralvalue:enabledbounds:label:currentvaluelabel:minimumvaluelabel:maximumvaluelabel:oneditingchanged:)
- DragGesture — https://developer.apple.com/documentation/swiftui/draggesture
- DragGesture init(minimumDistance:coordinateSpace:) — https://developer.apple.com/documentation/swiftui/draggesture/init(minimumdistance:coordinatespace:)
- contentShape(_:eoFill:) — https://developer.apple.com/documentation/swiftui/view/contentshape(_:eofill:)
- Material.ultraThin — https://developer.apple.com/documentation/swiftui/material/ultrathin
- glassEffect(_:in:) — https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)
- sensoryFeedback(_:trigger:) — https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(_:trigger:)
- sensoryFeedback(_:trigger:condition:) — https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(_:trigger:condition:)
- sensoryFeedback(trigger:_:) — https://developer.apple.com/documentation/swiftui/view/sensoryfeedback(trigger:_:)
- SensoryFeedback — https://developer.apple.com/documentation/swiftui/sensoryfeedback
- accessibilityRepresentation(representation:) — https://developer.apple.com/documentation/swiftui/view/accessibilityrepresentation(representation:)
- accessibilityAdjustableAction(_:) — https://developer.apple.com/documentation/swiftui/view/accessibilityadjustableaction(_:)
- accessibilityValue(_:) — https://developer.apple.com/documentation/swiftui/view/accessibilityvalue(_:)
- accessibilityElement(children:) — https://developer.apple.com/documentation/swiftui/view/accessibilityelement(children:)
- accessibilityAddTraits(_:) — https://developer.apple.com/documentation/swiftui/view/accessibilityaddtraits(_:)
- accessibilityAction(_:_:) — https://developer.apple.com/documentation/swiftui/view/accessibilityaction(_:_:)
- AccessibilityActionKind.escape — https://developer.apple.com/documentation/swiftui/accessibilityactionkind/escape
- minimumScaleFactor(_:) — https://developer.apple.com/documentation/swiftui/view/minimumscalefactor(_:)
- ViewThatFits — https://developer.apple.com/documentation/swiftui/viewthatfits
- onGeometryChange(for:of:action:) — https://developer.apple.com/documentation/swiftui/view/ongeometrychange(for:of:action:)
- TextField init(_:text:axis:) — https://developer.apple.com/documentation/swiftui/textfield/init(_:text:axis:)
- TextEditor — https://developer.apple.com/documentation/swiftui/texteditor
- lineLimit(_:reservesSpace:) — https://developer.apple.com/documentation/swiftui/view/linelimit(_:reservesspace:)
- multilineTextAlignment(_:) — https://developer.apple.com/documentation/swiftui/view/multilinetextalignment(_:)
- onChange(of:initial:_:) — https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)
- NSString.boundingRect(with:options:attributes:context:) (Foundation) — https://developer.apple.com/documentation/foundation/nsstring/boundingrect(with:options:attributes:context:)
- keyboardShortcut(_:modifiers:) — https://developer.apple.com/documentation/swiftui/view/keyboardshortcut(_:modifiers:)
- KeyEquivalent.escape — https://developer.apple.com/documentation/swiftui/keyequivalent/escape
- onKeyPress(_:action:) — https://developer.apple.com/documentation/swiftui/view/onkeypress(_:action:)
- onKeyPress(keys:phases:action:) — https://developer.apple.com/documentation/swiftui/view/onkeypress(keys:phases:action:)
- KeyPress — https://developer.apple.com/documentation/swiftui/keypress
- focusable(_:interactions:) — https://developer.apple.com/documentation/swiftui/view/focusable(_:interactions:)
- defaultFocus(_:_:priority:) — https://developer.apple.com/documentation/swiftui/view/defaultfocus(_:_:priority:)
- FocusState — https://developer.apple.com/documentation/swiftui/focusstate
- focusEffectDisabled(_:) — https://developer.apple.com/documentation/swiftui/view/focuseffectdisabled(_:)
- onExitCommand(perform:) — https://developer.apple.com/documentation/swiftui/view/onexitcommand(perform:)
- accessibilityReduceMotion — https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion
- accessibilityPrefersCrossFadeTransitions — https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityPrefersCrossFadeTransitions
- accessibilityReduceTransparency — https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducetransparency
- accessibilityDifferentiateWithoutColor — https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilitydifferentiatewithoutcolor
- accessibilityVoiceOverEnabled — https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityvoiceoverenabled
- dynamicTypeSize — https://developer.apple.com/documentation/swiftui/environmentvalues/dynamictypesize
- accessibilityShowsLargeContentViewer() — https://developer.apple.com/documentation/swiftui/view/accessibilityshowslargecontentviewer()
- AccessibilityNotification.Announcement (Accessibility framework) — https://developer.apple.com/documentation/accessibility/accessibilitynotification/announcement

Human Interface Guidelines
- Motion — https://developer.apple.com/design/human-interface-guidelines/motion
- Sliders — https://developer.apple.com/design/human-interface-guidelines/sliders
- Accessibility (control sizes, Reduce Motion, text size) — https://developer.apple.com/design/human-interface-guidelines/accessibility
- Keyboards — https://developer.apple.com/design/human-interface-guidelines/keyboards
- Playing haptics — https://developer.apple.com/design/human-interface-guidelines/playing-haptics

WWDC sessions
- WWDC23 Explore SwiftUI animation — https://developer.apple.com/videos/play/wwdc2023/10156/
- WWDC23 Animate with springs — https://developer.apple.com/videos/play/wwdc2023/10158/
- WWDC24 Create custom visual effects with SwiftUI — https://developer.apple.com/videos/play/wwdc2024/10151/
- WWDC24 Catch up on accessibility in SwiftUI — https://developer.apple.com/videos/play/wwdc2024/10073/

Secondary (labelled where used)
- Create with Swift, "Animating numeric text in SwiftUI with the Content Transition modifier" — https://www.createwithswift.com/animating-numeric-text-in-swiftui-with-the-content-transition-modifier/
- Swift with Majid, "Content transition in SwiftUI" — https://swiftwithmajid.com/2022/08/02/content-transition-in-swiftui/
- Sarunw, "How to add Keyboard Shortcuts in SwiftUI" — https://sarunw.com/posts/swiftui-keyboard-shortcuts/
- Swift with Majid, "Keyboard shortcuts in SwiftUI" — https://swiftwithmajid.com/2020/11/17/keyboard-shortcuts-in-swiftui/

Project
- PROJECT-MAP.md "Before you start", §11, §12, §13, §16; COLOUR-SHIFT-STYLE-GUIDE.md "Motion"
