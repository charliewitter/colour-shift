# SwiftUI architecture and state for the Colour Shift iOS app

Researched 2026-10-05

Scope: how to structure state, concurrency, project layout, tests and lifecycle for a SwiftUI port of Colour Shift. Toolchain at the time of writing: Xcode 27 with Swift 6.4, iOS 27 SDK ([Xcode support table](https://developer.apple.com/support/xcode/), [Swift 6.4 released](https://www.swift.org/blog/swift-6.4-released/)).

## Summary for Colour Shift

- **One `@Observable` model owns all app state.** Port `ColorShift`'s `useState` values into one `@MainActor @Observable final class` (call it `ColourShiftModel`). The root view owns it with `@State private var model = ColourShiftModel()`. This is Apple's documented pattern for a source of truth ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)). Do not use `ObservableObject`.
- **Children get values and closures, not the model.** Mirror the web app: leaf views take plain values (`Colour`, `Score`, `Bool`) plus `(Role) -> Void`-style callbacks. Pass the model itself only to a few container views. Leaf "visual-only" state stays as `@State` inside that leaf, as on the web.
- **React refs become `@ObservationIgnored` private properties** on the model. Derived values become computed properties. The "set state during render" syncs become plain code inside the model's action methods.
- **Use Xcode 26+/27 defaults for concurrency:** Swift 6 language mode, default actor isolation = `MainActor`, Approachable Concurrency = Yes in the app target. Apple recommends this for UI modules ([WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/)). Mark only real background work (palette extraction) `@concurrent`.
- **Minimum iOS: 26.** It gets Liquid Glass APIs and `Observations` without `#available` checks. In June 2026, 79% of all iPhones were already on iOS 26 ([App Store usage](https://developer.apple.com/support/app-store/)). Going lower (17) is possible but means two designs to test.
- **Put the colour engine in a local Swift package** (`ColourEngine`) with no SwiftUI import. Pure value types, `Sendable`, nonisolated. The app target depends on it. Add macOS to the package's platforms so `swift test` runs on the Mac without a simulator.
- **Test with Swift Testing.** Use parameterised `@Test(arguments:)` over JSON vectors generated from `color-engine.ts`. Ship the vectors as a test-target resource (`.copy("Vectors")`) and load them with `Bundle.module` ([Bundling resources](https://developer.apple.com/documentation/xcode/bundling-resources-with-a-swift-package)). Keep XCTest only for UI tests.
- **Effects map to `.task` and model methods.** The photo buffer and preloading go in model methods kicked off from a root `.task`. Use `.task(id:)` only where work must restart when a value changes. SwiftUI cancels these tasks for you when the view goes away ([task(id:)](https://developer.apple.com/documentation/swiftui/view/task(id:name:priority:file:line:_:))).
- **Keep slider updates cheap.** With Observation, a view re-runs `body` only when a property it read changes ([Migrating to Observable](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)). Keep the score maths out of `body`, and never put fast-changing values in the environment ([WWDC25 SwiftUI performance](https://developer.apple.com/videos/play/wwdc2025/306/)).

## Findings

### 1. State management: Observation vs `ObservableObject`

**What Apple recommends now.** Observation (`@Observable`) arrived in iOS 17. It replaces `ObservableObject`, `@Published`, `@StateObject`, `@ObservedObject` and `@EnvironmentObject`. Apple lists three benefits: it tracks optionals and collections, it uses the plain `@State` and `@Environment` wrappers, and views update only for the properties their `body` reads ([Migrating to Observable](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)).

The four pieces:

| Tool | Use in Colour Shift |
|---|---|
| `@Observable` macro | On `ColourShiftModel`. No `@Published` needed ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)). |
| `@State` | In the root view, to own the model. Also for leaf-only visual state. Declare it `private` ([State](https://developer.apple.com/documentation/swiftui/state)). |
| `@Bindable` | When a child needs a `Binding` to a model property, e.g. `$model.sampleText` for a `TextField` ([Bindable](https://developer.apple.com/documentation/swiftui/bindable)). |
| `@Environment(Type.self)` | Optional. Handy for deep trees. Reading a missing type traps unless you declare it optional ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)). Colour Shift's tree is shallow, so explicit passing is clearer. |

**`@State` is now a macro (Xcode 27).** Building with Xcode 27, `@State` becomes a macro, not a property wrapper ([State()](https://developer.apple.com/documentation/swiftui/state())). Its initial value is evaluated once, the first time the view is created. Before, a class in `@State` was re-allocated every time the view struct was re-created ([TN3211](https://developer.apple.com/documentation/technotes/tn3211-resolving-swiftui-source-incompatibilities-for-state-and-contentbuilder)). WWDC26 says this lazy behaviour is back-ported to iOS 17 and aligned releases ([WWDC26 What's new in SwiftUI](https://developer.apple.com/videos/play/wwdc2026/269/)). So `@State private var model = ColourShiftModel()` is now safe and cheap. The old "optional state + create it in `.task`" workaround is no longer needed. One source break to know: in an `init`, set every other stored property before assigning to a `@State` property ([TN3211](https://developer.apple.com/documentation/technotes/tn3211-resolving-swiftui-source-incompatibilities-for-state-and-contentbuilder)).

**Mapping "one owner, children get values + callbacks".** The web app keeps all state in `ColorShift` and passes props down (PROJECT-MAP §4). In SwiftUI:

```swift
import Observation
import ColourEngine

@MainActor @Observable
final class ColourShiftModel {
    // Source of truth (PROJECT-MAP §4.2)
    var colours: Pair = .start
    var anchors: Pair = .start
    var activeRole: Role? = nil
    var colourMode: ColourMode = .hsb
    var contrastMethod: ContrastMethod = .wcag
    var photos: [Photo] = []
    var photoIndex = 0
    var pairs: [Photo.ID: Pair] = [:]
    var colourFade: ColourFade = .none
    // ...

    // Refs (§4.3): not shown on screen, so don't track them
    @ObservationIgnored private var loadingPhotos = false
    @ObservationIgnored private var prepared: Set<Photo.ID> = []
    @ObservationIgnored private var shown: Set<Photo.ID> = []

    // Derived values (§4.4): computed properties
    var photo: Photo? { photos.indices.contains(photoIndex) ? photos[photoIndex] : nil }
    var photosAhead: Int { photos.count - 1 - photoIndex }

    // Actions (§5)
    func selectRole(_ role: Role) { activeRole = (activeRole == role) ? nil : role }
    func editColour(_ role: Role, _ colour: Colour) {
        colourFade = .none
        colours[role] = colour
        anchors[role] = colour        // ADR 0005: a user edit sets the anchor
    }
    // swap(), chooseLevel(_:), nextPhoto() ...
}

struct ColourShiftView: View {
    @State private var model = ColourShiftModel()

    var body: some View {
        VStack {
            ColourPanel(pair: model.colours, sampleText: model.sampleText, font: model.font)
            if let role = model.activeRole {
                SliderPanel(colour: model.colours[role], mode: model.colourMode,
                            onEdit: { model.editColour(role, $0) },
                            onModeChange: { model.colourMode = $0 })
            }
            Dock(pair: model.colours, method: model.contrastMethod,
                 onSwap: model.swap, onSelect: model.selectRole)
        }
    }
}
```

`@ObservationIgnored` is the documented way to keep a property out of tracking ([Migrating to Observable](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)). Observation also tracks computed properties built on observed ones, so `photo` and `photosAhead` update views correctly ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)).

Passing plain values has a second benefit: leaf views are easy to preview and need no model. The trade-off: a leaf that receives a value is re-evaluated when its parent's `body` re-runs and the value changed. Passing the model instead lets SwiftUI skip intermediate views that don't read anything ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)). For a tree this small, plain values are fine.

**Pitfalls.**

- *View identity.* Changing a view's `.id(_:)` resets its state ([id(_:)](https://developer.apple.com/documentation/swiftui/view/id(_:))). It also cancels any `.task` on it, since tasks end when "the view changes identity" ([task](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:))). `if`/`else` branches also give different identities ([WWDC21 Demystify SwiftUI](https://developer.apple.com/videos/play/wwdc2021/10022/)). So: don't put `.id(photo.id)` on a view that owns a long-running task. Use it on purpose to reset a leaf, e.g. the photo layer.
- *Granularity.* A view depends on exactly the properties its `body` reads ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)). If the root `body` reads `model.colours`, the whole root re-runs on every slider tick. Push reads down: let `ColourPanel` and `Dock` read what they need.
- *Collections.* Reading a collection makes the view depend on the whole collection. WWDC25 shows every list row re-running because each read a shared array ([WWDC25 SwiftUI performance](https://developer.apple.com/videos/play/wwdc2025/306/)). For Colour Shift, the photo panel should read `model.photo`, not `model.photos`.
- *Frequent slider updates.* Every drag event writes `colours`, so the colour panel, the score and the slider readout all re-run. Keep those bodies cheap. Apple's advice: "keep your view bodies fast" and move expensive work out of `body` ([WWDC25 SwiftUI performance](https://developer.apple.com/videos/play/wwdc2025/306/)). Apple also says to avoid putting fast-changing values in the environment ([same session](https://developer.apple.com/videos/play/wwdc2025/306/)). My inference (not stated by Apple): a computed property like `score` is recomputed on every read. If several views read it, compute it once in the parent and pass the value down, or store it and update it inside `editColour`.
- *Profiling.* Xcode 26+ has a SwiftUI instrument that flags long body updates and unnecessary updates ([WWDC25 SwiftUI performance](https://developer.apple.com/videos/play/wwdc2025/306/)).

**Newer Observation API.** `Observations` (SE-0475, Swift 6.2) is an `AsyncSequence` of changes to `@Observable` values, for code outside views ([SE-0475](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0475-observed.md)). It needs iOS 26 ([Observations](https://developer.apple.com/documentation/observation/observations)). Colour Shift probably doesn't need it. Swift 6.4 also lists SE-0506, "fine-grained and continuous change notifications" for `@Observable` ([Swift 6.4 released](https://www.swift.org/blog/swift-6.4-released/)). I could not open the proposal text (404 at the guessed URL), so its details are unverified.

### 2. Swift 6 and strict concurrency

**Defaults.** New app projects in Xcode 26 have default actor isolation set to main actor. Apple: "This mode is enabled by default for new app projects created with Xcode 26" ([WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/)). Apple also recommends the Approachable Concurrency setting for all projects ([same session](https://developer.apple.com/videos/play/wwdc2025/268/)). The underlying proposals:

- SE-0466: a module can default to `@MainActor`. Motivation: "Most executables, such as apps … start running on the main actor and stay there" ([SE-0466](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0466-control-default-actor-isolation.md)). In a package: `.defaultIsolation(MainActor.self)` ([SwiftSetting](https://developer.apple.com/documentation/packagedescription/swiftsetting)).
- SE-0461: nonisolated `async` functions run on the caller's actor by default (`NonisolatedNonsendingByDefault`). `@concurrent` opts a function into running in the background ([SE-0461](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md)).

Apple's guidance: "you should only introduce concurrency as you need it" ([WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/)). That fits Colour Shift: almost everything is UI state.

**What this small app needs to get right.**

1. *Model on the main actor.* `ColourShiftModel` is main-actor isolated (implicitly with the default, or write `@MainActor` to be explicit). `View` is itself `@MainActor` ([View](https://developer.apple.com/documentation/swiftui/view)), so views can call the model synchronously.
2. *Network with async/await.* `URLSession.data(from:)` is async and available from iOS 15 ([data(from:delegate:)](https://developer.apple.com/documentation/foundation/urlsession/data(from:delegate:))). Call `/api/photos` from a model method:

   ```swift
   func requestPhotos() async -> [Photo]? {
       guard !loadingPhotos else { return nil }   // same guard as the web's ref
       loadingPhotos = true
       defer { loadingPhotos = false }
       do {
           let (data, _) = try await URLSession.shared.data(from: api.randomURL(count: 3))
           return try JSONDecoder().decode([Photo].self, from: data)
       } catch is CancellationError {
           return nil
       } catch {
           return []                               // failure, as on the web
       }
   }
   ```

   Because the model is main-actor isolated, the state writes after `await` happen back on the main actor. No `DispatchQueue.main` needed.
3. *Cancellation.* Cancellation is a flag. Code must check it, for example with `Task.checkCancellation()`, which throws `CancellationError` ([Task](https://developer.apple.com/documentation/swift/task), [checkCancellation](https://developer.apple.com/documentation/swift/task/checkcancellation())). `.task` cancels its task when the view disappears ([task](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:))). URLSession's async methods stop when their task is cancelled. In my experience they throw `URLError(.cancelled)` rather than `CancellationError`; the `data(from:)` page doesn't say, so treat both as "cancelled" (unverified). Swift 6.4 adds `withTaskCancellationShield` for cleanup that must finish ([Swift 6.4 released](https://www.swift.org/blog/swift-6.4-released/)).
4. *Background work.* Palette extraction (the `node-vibrant` step) is the only CPU-heavy job. Make it a nonisolated `@concurrent` function in the engine package that takes and returns `Sendable` values (pixel data in, `Pair` out) ([SE-0461](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md), [WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/)).
5. *Sendable.* Value types whose stored properties are all `Sendable` are safe to share ([WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/), [Sendable](https://developer.apple.com/documentation/swift/sendable)). Make `Colour`, `Pair`, `Role`, `Photo` and the contrast types structs/enums, and mark public ones `Sendable` explicitly. Keep the engine package's default isolation as nonisolated, so its pure functions can be called from any context, including tests.

Swift's own migration guide covers the background ([Swift 6 migration guide](https://www.swift.org/migration/documentation/migrationguide/)).

### 3. Minimum iOS version

Facts:

- Observation, `@Bindable` and `onChange(of:initial:_:)` need iOS 17 ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app), [onChange](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)-4psgg)).
- `glassEffect(_:in:)` and `Observations` need iOS 26 ([glassEffect](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)), [Observations](https://developer.apple.com/documentation/observation/observations)).
- Standard controls pick up Liquid Glass automatically when built with the latest SDK and run on the latest OS ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)). The opt-out key `UIDesignRequiresCompatibility` is ignored when you build for iOS 27 or later ([UIDesignRequiresCompatibility](https://developer.apple.com/documentation/bundleresources/information-property-list/uidesignrequirescompatibility)). So with Xcode 27 there is no way to keep the old look on iOS 26+.
- Uploads must use Xcode 26+ and the iOS 26 SDK since 28 April 2026 ([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). This limits the SDK, not the deployment target.
- Xcode 27 supports deployment targets iOS 15–27, but on-device debugging only for iOS 17 and later ([Xcode support table](https://developer.apple.com/support/xcode/)).
- Adoption on 7 June 2026: 79% of all iPhones on iOS 26, 14% on iOS 18, 7% earlier ([App Store usage](https://developer.apple.com/support/app-store/)). I found no published iOS 27 share yet.

Trade-offs:

| Minimum | Gains | Loses |
|---|---|---|
| **iOS 17** | Reaches the ~21% not on iOS 26 (June figure). Observation and lazy `@State` still work. | Two looks (pre-glass and glass) to design and test. `#available` checks around `glassEffect`, `Observations` and other iOS 26 APIs. |
| **iOS 26 (recommended)** | One look. All Liquid Glass APIs without checks. ~79% of iPhones in June, higher now. | iOS 17/18 users. |
| **iOS 27** | iOS 27-only APIs (not researched here). | Everyone not yet on 27, a few weeks after release. |

For a personal tool built for one owner, iOS 26 is the simple choice. It matches the device the owner most likely uses (to confirm).

### 4. Project structure

Recommended layout:

```
ColourShift.xcodeproj           ← app target (SwiftUI, default isolation MainActor)
ColourShift/                    ← views, ColourShiftModel, PhotoAPI client
Packages/ColourEngine/          ← local Swift package, no UI imports
  Package.swift
  Sources/ColourEngine/         ← conversions, gamut, WCAG, APCA, reachLevel, pickPair, exportMarkdown
  Tests/ColourEngineTests/
    Vectors/*.json              ← generated from color-engine.ts
    ParityTests.swift
```

- Apple documents this exact pattern: create the package with File > New > Package inside the project, then add its library to the app target ([Organizing your code with local packages](https://developer.apple.com/documentation/xcode/organizing-your-code-with-local-packages)).
- Why a package and not just a folder in the app target: (a) the compiler enforces that the engine can't import SwiftUI or touch the model; (b) `swift test` runs it without the simulator if the package lists macOS; (c) the module boundary matches `color-engine.ts`, which is already UI-free (PROJECT-MAP §1).
- Isolation: leave the engine package nonisolated (the default). Only the app module uses `MainActor` default isolation, as Apple recommends for "modules that are primarily interacting with the UI" ([WWDC25 Embracing Swift concurrency](https://developer.apple.com/videos/play/wwdc2025/268/)).

Example manifest:

```swift
// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ColourEngine",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "ColourEngine", targets: ["ColourEngine"])],
    targets: [
        .target(name: "ColourEngine"),
        .testTarget(
            name: "ColourEngineTests",
            dependencies: ["ColourEngine"],
            resources: [.copy("Vectors")]
        ),
    ]
)
```

The API client (calling `/api/photos`) can live in the app target to start with. Move it to its own package only if it grows.

### 5. Testing

**Swift Testing vs XCTest.** Apple: consider Swift Testing for new unit tests, and "continue to use XCTest for user interface tests and performance tests" ([XCTest](https://developer.apple.com/documentation/xctest)). Swift Testing gives `@Test`, `#expect`/`#require`, parameterised tests, tags and in-process parallel runs ([Swift Testing](https://developer.apple.com/documentation/testing)). Suites can be structs; no `XCTestCase` subclass ([Migrating from XCTest](https://developer.apple.com/documentation/testing/migratingfromxctest)). Since Swift 6.4, XCTest assertions and `#expect` work across both frameworks (ST-0021) ([Swift 6.4 released](https://www.swift.org/blog/swift-6.4-released/), [Migrating from XCTest](https://developer.apple.com/documentation/testing/migratingfromxctest)). Swift 6.2 added exit tests and attachments ([Swift 6.2 released](https://www.swift.org/blog/swift-6.2-released/)).

**Parameterised tests.** Pass a collection to `@Test(arguments:)`. Each element runs as its own test case, so a failure names the input. Cases run in parallel by default ([Parameterized testing](https://developer.apple.com/documentation/testing/parameterizedtesting)). The arguments expression can `try` and `await` ([same page](https://developer.apple.com/documentation/testing/parameterizedtesting)).

**Loading JSON vectors.** Put the files in the test target and declare them with `.copy(...)` (keeps the folder as is) or `.process(...)`. Read them with `Bundle.module`; Apple says "Always use `Bundle.module` when you access resources" ([Bundling resources](https://developer.apple.com/documentation/xcode/bundling-resources-with-a-swift-package)).

```swift
import Foundation
import Testing
@testable import ColourEngine

struct ContrastVector: Decodable, Sendable, CustomTestStringConvertible {
    let fg: String, bg: String
    let wcag: Double, apcaLc: Double
    var testDescription: String { "\(fg) on \(bg)" }
}

func loadVectors<T: Decodable>(_ name: String) throws -> [T] {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json",
                                              subdirectory: "Vectors"))
    return try JSONDecoder().decode([T].self, from: Data(contentsOf: url))
}

@Test("WCAG and APCA match the TypeScript engine",
      arguments: try loadVectors("contrast") as [ContrastVector])
func contrastParity(_ v: ContrastVector) throws {
    let pair = Pair(text: try #require(Colour(hex: v.fg)), bg: try #require(Colour(hex: v.bg)))
    #expect(abs(wcagRatio(pair) - v.wcag) < 1e-6)
    #expect(abs(apcaLc(pair) - v.apcaLc) < 1e-6)
}
```

Notes:

- Using `#require` outside a test body is my assumption; if it doesn't compile there, use `guard … else { throw … }` instead.
- I found no built-in "approximately equal" helper in the Swift Testing docs I read. Use an explicit tolerance as above, and pick it per function (culori and Swift `Double` maths can differ in the last bits).
- `CustomTestStringConvertible` makes each case readable in Xcode's test navigator ([Swift Testing](https://developer.apple.com/documentation/testing)).
- Generate the vectors with a small Node script in the web repo that runs `color-engine.ts` over a fixed list of inputs. Commit the JSON into both repos (or have the iOS repo copy it in).

Background videos: [WWDC24 Meet Swift Testing](https://developer.apple.com/videos/play/wwdc2024/10179/), [WWDC24 Go further with Swift Testing](https://developer.apple.com/videos/play/wwdc2024/10195/).

### 6. Lifecycle equivalents for the web app's effects

| Web (PROJECT-MAP §4.6–4.7) | SwiftUI |
|---|---|
| `useEffect` on mount | `.task { … }`. Runs before the view appears; cancelled if the view is removed or changes identity ([task](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:))). Since Xcode 27 the action starts synchronously until its first `await` ([same page](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:))). |
| `useEffect` with deps | `.task(id: value) { … }`. Cancels and restarts when `value` changes (`Equatable`) ([task(id:)](https://developer.apple.com/documentation/swiftui/view/task(id:name:priority:file:line:_:))). |
| Sync side effect on change | `.onChange(of: value, initial:) { … }` ([onChange](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)-4psgg)). Runs on the main actor, so keep it short ([onChange](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:))). |
| Page visibility | `@Environment(\.scenePhase)` + `.onChange(of: scenePhase)` ([ScenePhase](https://developer.apple.com/documentation/swiftui/scenephase)). |
| Share link on load | `.onOpenURL { url in … }` for opening a shared link in the app ([onOpenURL](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))). Not researched in depth here. |

Proposed mapping for each effect:

- **Shared photo** and **Buffer**: one root `.task { await model.start() }`. `start()` fetches the shared photo first (if any), then fills the buffer. After that, `nextPhoto()` and `jumpPhoto()` call `fillBuffer()` themselves. This avoids an effect that watches `photosAhead`. If you prefer the web's shape, `.task(id: model.photosAhead) { await model.fillBuffer() }` also works, but note that a restart cancels an in-flight request.
- **Prepare** (preload + extract): called from the model right after new photos are appended. Each extraction is its own child task (`Task { … }` or a `TaskGroup`); keep handles so they can be cancelled.
- **Track** (Unsplash download ping): call it inside the method that changes `photoIndex`, guarded by `shown`. No effect needed.
- **Keyboard**: likely not needed on iPhone. Skip unless iPad hardware keyboards matter.
- **scenePhase**: optional. A sensible use is to top up the buffer when the app returns to `.active`.

**"Set state during render" (derived state).** SwiftUI has no equivalent of React's render-time `setState`, and you should not write to the model inside `body`. (It produces a runtime warning about modifying state during a view update. I saw no Apple doc page for that warning, so this is from experience, unverified.) Instead:

- Pure derived values (`photo`, `textHex`, `bgHex`, score) are computed properties ([Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)).
- State that "follows" other state (`pairFor`, `keepSharedColors`) becomes a private method the model calls at the end of every action that can change it:

  ```swift
  private func syncPhotoPair() {
      guard let photo, pairFor != photo.id else { return }
      guard let pair = pairs[photo.id] else { pairFor = nil; return }
      pairFor = photo.id
      if keepSharedColours { keepSharedColours = false; return }
      colourFade = .photo
      colours = pair; anchors = pair
  }
  // called from nextPhoto(), previousPhoto(), jumpPhoto(), and when an extraction finishes
  ```

  All writes happen in the same main-actor turn, so SwiftUI shows them in one update. That matches the web's "same paint" goal (PROJECT-MAP §4.6).
- `panelRole` ("keep the last role while the panel animates closed") is visual-only. Keep it as `@State` in the slider panel, updated with `.onChange(of: activeRole)`.

## Open questions / decisions for the owner

1. **Minimum iOS: 26 or 17?** Recommendation is 26. What iOS version is your own iPhone on?
2. **Model shape:** one `ColourShiftModel`, or split photo stream and colour state into two `@Observable` classes? One matches the web app; two would narrow slider updates further. Start with one.
3. **Child views: values + closures, or pass the model?** Recommendation is values + closures for leaves, matching the web. Confirm you're happy with that.
4. **Vector sharing:** generate JSON in the web repo and copy it over by hand, or with a script? Who owns the generator?
5. **Tolerance for parity tests:** exact match on hex output, and what tolerance on contrast numbers (1e-6? 0.01 to match the displayed precision)?
6. **Palette extraction:** port `node-vibrant` logic to Swift, or use a different on-device method? This affects whether `pickPair` parity tests are possible at all. (Out of scope here.)
7. **Buffer design:** keep the web's effect-style buffer (`.task(id: photosAhead)`) or move to explicit calls from actions? Recommendation: explicit calls.

## Sources

- https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app : Observation in SwiftUI, `@State`, `@Environment`, `@Bindable`, dependency tracking
- https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro : Observation vs `ObservableObject`, `@ObservationIgnored`
- https://developer.apple.com/documentation/swiftui/state : `@State` property wrapper (Xcode 26 and earlier)
- https://developer.apple.com/documentation/swiftui/state() : `@State` macro (Xcode 27), lazy initial value
- https://developer.apple.com/documentation/technotes/tn3211-resolving-swiftui-source-incompatibilities-for-state-and-contentbuilder : why `@State` became a macro; source breaks
- https://developer.apple.com/videos/play/wwdc2026/269/ : WWDC26 What's new in SwiftUI; lazy `@State` back-ported to iOS 17
- https://developer.apple.com/documentation/swiftui/bindable : `@Bindable`
- https://developer.apple.com/documentation/observation/observations : `Observations` availability (iOS 26)
- https://github.com/swiftlang/swift-evolution/blob/main/proposals/0475-observed.md : SE-0475 `Observations`
- https://developer.apple.com/videos/play/wwdc2025/306/ : WWDC25 SwiftUI performance with Instruments; fast bodies, narrow dependencies
- https://developer.apple.com/videos/play/wwdc2021/10022/ : WWDC21 Demystify SwiftUI; view identity
- https://developer.apple.com/documentation/swiftui/view/id(_:) : `.id` resets view identity and state
- https://developer.apple.com/documentation/swiftui/view : `View` is `@MainActor`
- https://developer.apple.com/videos/play/wwdc2025/268/ : WWDC25 Embracing Swift concurrency; Xcode 26 defaults, `@concurrent`, Sendable
- https://github.com/swiftlang/swift-evolution/blob/main/proposals/0466-control-default-actor-isolation.md : SE-0466 default MainActor isolation
- https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md : SE-0461 nonisolated(nonsending), `@concurrent`
- https://developer.apple.com/documentation/packagedescription/swiftsetting : SwiftPM `defaultIsolation`, language mode settings
- https://www.swift.org/migration/documentation/migrationguide/ : Swift 6 migration guide
- https://www.swift.org/blog/swift-6.2-released/ : Swift 6.2 approachable concurrency, exit tests, attachments
- https://www.swift.org/blog/swift-6.4-released/ : Swift 6.4 features (cancellation shield, testing interop, SE-0506)
- https://developer.apple.com/documentation/swift/task : task cancellation model
- https://developer.apple.com/documentation/swift/task/checkcancellation() : `checkCancellation` throws `CancellationError`
- https://developer.apple.com/documentation/swift/sendable : `Sendable`
- https://developer.apple.com/documentation/foundation/urlsession/data(from:delegate:) : async URLSession API
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass : Liquid Glass adoption
- https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:) : `glassEffect` availability (iOS 26)
- https://developer.apple.com/documentation/bundleresources/information-property-list/uidesignrequirescompatibility : compatibility key ignored from iOS 27 SDK
- https://developer.apple.com/news/upcoming-requirements/ : iOS 26 SDK upload requirement (28 April 2026)
- https://developer.apple.com/support/xcode/ : Xcode 27 deployment targets, debugging range, Swift 6.4
- https://developer.apple.com/support/app-store/ : iOS adoption figures (7 June 2026)
- https://developer.apple.com/documentation/xcode/organizing-your-code-with-local-packages : local Swift packages in an app project
- https://developer.apple.com/documentation/xcode/bundling-resources-with-a-swift-package : package resources and `Bundle.module`
- https://developer.apple.com/documentation/testing : Swift Testing overview
- https://developer.apple.com/documentation/testing/parameterizedtesting : parameterised tests
- https://developer.apple.com/documentation/testing/migratingfromxctest : migrating from XCTest; interoperability
- https://developer.apple.com/documentation/xctest : keep XCTest for UI and performance tests
- https://developer.apple.com/videos/play/wwdc2024/10179/ : WWDC24 Meet Swift Testing
- https://developer.apple.com/videos/play/wwdc2024/10195/ : WWDC24 Go further with Swift Testing
- https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:) : `.task` lifetime and cancellation
- https://developer.apple.com/documentation/swiftui/view/task(id:name:priority:file:line:_:) : `.task(id:)` restart on change
- https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:) : `onChange` behaviour
- https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)-4psgg : `onChange` availability (iOS 17)
- https://developer.apple.com/documentation/swiftui/scenephase : `scenePhase`
- https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:) : opening URLs (share links)
