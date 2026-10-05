# Unsplash for the Colour Shift iOS app

Researched 2026-10-05

## Summary for Colour Shift

- **Don't use an Unsplash SDK.** The only official iOS package, `unsplash-photopicker-ios`, is a UIKit search-and-pick screen, not an API client. Its last release was 1.3.0 in April 2022 ([releases](https://github.com/unsplash/unsplash-photopicker-ios/releases)). It needs the access key in the app, and it has no random-photo feature. There is no official Swift API client ([docs, Libraries & SDKs](https://unsplash.com/documentation#libraries--sdks)).
- **Keep the plan: the iOS app calls `/api/photos`, never Unsplash's API.** The guidelines say the Access Key and Secret Key "must remain confidential. This may require using a proxy if accessing the API client-side" ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). The proxy we already have is that proxy.
- **Load images straight from `images.unsplash.com` on iOS (hotlinking).** Build them from `rawUrl` and keep its `ixid` parameter. Image requests don't count against the rate limit ([docs, Rate limiting](https://unsplash.com/documentation#rate-limiting)).
- **Size images as `rawUrl + "&w=<points>&dpr=<displayScale>&fit=max&q=80"`.** Also send an `Accept: image/avif,image/webp,*/*` header, or Unsplash's CDN falls back to JPEG. I tested this: `*/*` returned a 22.9 KB JPEG, and the AVIF Accept header returned a 14.5 KB AVIF (see Findings §5).
- **Add `blurHash`, `color`, `width` and `height` to the proxy's `Photo` response.** None of them costs extra API calls. `blur_hash` gives iOS an instant blurred placeholder with no 200px preview download. `width`/`height` let SwiftUI reserve the right aspect ratio before the image arrives.
- **Fix download tracking in the proxy so it uses `links.download_location`.** Today it calls `/photos/<id>/download` without the `ixid`. The guideline says "Be sure to include any query parameters included in the URL (like the `ixid`)" ([download guideline](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download)).
- **Rethink *when* a download is tracked (owner decision).** Unsplash defines a download as "an action where a user does something with the photo, usually inserting or setting it somewhere" ([download guideline](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download)). Views are counted separately, through hotlinking. Tracking on every shown photo goes beyond that definition and doubles our API calls.
- **Cut API calls with `count`.** `/photos/random?count=N` returns up to 30 photos in **one** request ([docs, Get a random photo](https://unsplash.com/documentation#get-a-random-photo)). Our route makes one call per photo, which matters more once web and iOS share one hourly limit.
- **One Unsplash application (one key) can serve both web and iOS through the proxy.** The two clients then share its hourly budget: 50/hour on demo, 1,000/hour in production ([docs](https://unsplash.com/documentation#rate-limiting)). Apply for production now. The iOS app adds nothing new for Unsplash to review, because Unsplash only ever sees our server.
- **iOS attribution: show "Photo by [name] on Unsplash".** Both names should be tappable links with our UTM tags, opened in Safari or `SFSafariViewController` ([attribution guideline](https://help.unsplash.com/en/articles/2511315-guideline-attribution)). Don't put "Unsplash" in the app's name or icon ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)).

## Findings

### 1. Official iOS SDK

- **What exists.** Unsplash lists its official libraries as PHP, Ruby, JavaScript, iOS (`unsplash/unsplash-photopicker-ios`) and Android (`unsplash/unsplash-photopicker-android`) ([docs, Libraries & SDKs](https://unsplash.com/documentation#libraries--sdks)). There is no official Swift API client. The only Swift repos in the org are the picker, a 2018 image view, a Snowplow tracker fork and a SwiftUI collection-view experiment ([github.com/unsplash](https://github.com/unsplash)). I checked these with the GitHub API on 2026-10-05.
- **What the picker is.** It is "a view controller. You present it to offer your users to select one or multiple photos from Unsplash", and it returns `UnsplashPhoto` objects ([README](https://github.com/unsplash/unsplash-photopicker-ios#description)). Unsplash announced it in November 2018 as a way to "search and download photos" ([Unsplash blog](https://unsplash.com/blog/easily-add-unsplash-search-into-your-ios-apps)). In the source, its only API request class calls `/search/photos` ([SearchPhotosRequest.swift](https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Operations/SearchPhotosRequest.swift)). It is a picker UI, not a random-photo stream.
- **How it handles keys.** Its configuration requires `accessKey` and `secretKey` as plain strings in the app ([README, Configuration](https://github.com/unsplash/unsplash-photopicker-ios#configuration)). In the source, the secret key is stored but never used. The access key goes into a `Client-ID` header and into a `client_id` query on the `download_location` ping ([UnsplashRequest.swift](https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Operations/UnsplashRequest.swift), [UnsplashPhotoPicker.swift](https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Controllers/UnsplashPhotoPicker.swift)). So the key would ship inside the app binary, and that conflicts with our proxy approach. It does track downloads when photos are picked.
- **Maintenance.**
  - The latest release is 1.3.0, published 2022-04-05 ([releases](https://github.com/unsplash/unsplash-photopicker-ios/releases)). The last commit on `master` is from the same day.
  - The repo's `pushed_at` is 2023-03-03, and it is not archived.
  - There are 8 open issues and PRs. The newest is a crash-fix PR from 2025-11-27 that hasn't been merged ([issues](https://github.com/unsplash/unsplash-photopicker-ios/issues)).
  - These details come from the GitHub API on 2026-10-05.
- **Platform.** The README says iOS 12.1+, Xcode 12.5+, Swift 5.3+, UIKit, and no Objective-C ([README, Requirements](https://github.com/unsplash/unsplash-photopicker-ios#requirements)). `Package.swift` uses swift-tools-version 5.3 and `.iOS(.v11)`. There is no SwiftUI or Swift Concurrency support.
- **Licence.** MIT ([repo](https://github.com/unsplash/unsplash-photopicker-ios)).
- **Fit for Colour Shift.** Poor. It is the wrong UI (search grid rather than a stream), it needs a key on the device, it is UIKit-only and it has been unmaintained since 2022.

### 2. Guidelines and terms for a native app

None of the guideline pages or the API terms has a mobile-specific section. The same rules apply to every "Developer App" ([API terms](https://unsplash.com/api-terms)). The terms page shows no "last updated" date.

- **Attribution.**
  - "When displaying a photo from Unsplash, your application must attribute Unsplash, the Unsplash photographer, and contain a link back to their Unsplash profile" ([attribution guideline](https://help.unsplash.com/en/articles/2511315-guideline-attribution)).
  - The recommended form is "Photo by [Annie Spratt] on [Unsplash]". The name links to `https://unsplash.com/@user?utm_source=your_app_name&utm_medium=referral` and "Unsplash" links to `https://unsplash.com/?utm_source=…&utm_medium=referral` (same page).
  - The terms require attribution "each time you or your Developer App displays an Image" (§9, [API terms](https://unsplash.com/api-terms)).
  - On iOS, both names should be tappable links. The web app links "Unsplash" to the photo page (`photoUrl`) instead of the home page. That still links to Unsplash with UTM, but it differs from the recommended form.
- **UTM.** All links back should use `?utm_source=your_app_name&utm_medium=referral` ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). Our server already adds `utm_source=colour_shift`. Keep the same `utm_source` on iOS so referrals show as one app.
- **Hotlinking (no re-hosting).**
  - "All API uses must use the hotlinked image URLs returned by the API under the `photo.urls` properties. This applies to all uses of the image and not just search results" ([hotlinking guideline](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images)).
  - Resized URLs "must keep" the `ixid` parameter, "as it allows for your application to report photo views" ([docs, Dynamically resizable images](https://unsplash.com/documentation#dynamically-resizable-images)).
  - Companies that need their own image hosting must contact Unsplash for "a potential photo views beacon alternative" (hotlinking guideline). A derivative or "remixed" image doesn't need hotlinking.
- **Download endpoint: what counts as "using" a photo.**
  - You must call `photo.links.download_location` "when your application performs something similar to a download (like when a user chooses the image to include in a blog post, set as a header, etc.)" ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)).
  - The guideline defines this as "an action where a user does something with the photo, usually inserting or setting it somewhere". Its examples are setting a wallpaper, inserting into slides or a blog post, choosing a board background, and selecting a photo to remix. It says to authorise the call (`client_id` or bearer token, "otherwise you will get a 401"), to keep `ixid`, and to trigger it asynchronously ([download guideline](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download)).
  - The endpoint "is purely an event endpoint used to increment the number of downloads", and must not be used to embed the photo ([docs, Track a photo download](https://unsplash.com/documentation#track-a-photo-download)).
  - The guidelines don't say outright whether merely displaying a photo counts. Display isn't in the examples, and views are already counted through hotlinking (`ixid`). For Colour Shift, the closest match to "doing something with the photo" is probably taking its colour pair: export, share link or copy. That is an owner decision (see Open questions).
- **Branding.** "You cannot use the Unsplash name directly in your application name and you cannot use the Unsplash logo as an app icon" ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)). The terms also forbid using Unsplash marks in a way that suggests sponsorship, or more prominently than your own mark (§9, [API terms](https://unsplash.com/api-terms)).
- **Not replicating Unsplash.**
  - "You cannot replicate the core user experience of Unsplash (unofficial clients, wallpaper applications, etc.)". The test is whether the app still has value without the integration ([replicating guideline](https://help.unsplash.com/en/articles/2511257-guideline-replicating-unsplash)).
  - Colour Shift is a colour and contrast tool that still works with no photos (it falls back to the fallback pair), so it should pass. If unsure, Unsplash says to "shoot us an email before you integrate" (api@unsplash.com).
- **Quality and use.** The API is for "non-automated, high-quality, and authentic experiences". Unsplash says to stay away from spam, "displaying advertising near to the API content", charging for access to the API, data mining, and training AI models ([high-quality guideline](https://help.unsplash.com/en/articles/2511256-guideline-high-quality-authentic-experiences)). If the iOS app is ever paid, check this clause with Unsplash first.
- **Privacy policy.** The terms require "a published privacy policy for each of your Developer Apps" (§5, [API terms](https://unsplash.com/api-terms)). The App Store needs one anyway.
- **Caching.** Neither the API terms nor the guideline pages mention caching. I searched the terms for "cache", "caching", "copy" and "store", and only "store" appears, about user data (§5). So I could not confirm whether on-device caching is allowed. What *is* clear: images must come from the `photo.urls` CDN URLs and must not be re-hosted. Normal HTTP caching of those hotlinked URLs (`URLCache`) is a different thing from re-hosting, but Unsplash doesn't address it. The docs say public-auth API responses are "generally cacheable by our system", meaning Unsplash's own side ([docs, Public authentication](https://unsplash.com/documentation#public-authentication)).
- **Illustrations.** Since 2025-01-07, "Endpoints that return photos will now include illustrations as well" ([API changelog](https://unsplash.com/documentation/changelog)). So random results can include illustrations. That probably suits a colour tool.

### 3. Keys

- **Public access needs only the access key**, sent as `Authorization: Client-ID YOUR_ACCESS_KEY` or as a `client_id` query parameter ([docs, Public authentication](https://unsplash.com/documentation#public-authentication)).
- **The secret key is only for OAuth (user login).** It is used as `client_secret` when exchanging an authorisation code at `https://unsplash.com/oauth/token` ([user authentication workflow](https://unsplash.com/documentation/user-authentication-workflow)). Colour Shift doesn't need user login, so the secret key is never needed and should never be in any client.
- **Embedding the key in an iOS app.**
  - The guidelines say "Your application's Access Key and Secret Key must remain confidential. This may require using a proxy if accessing the API client-side" ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)).
  - The terms say "You may not share your Credentials with any third party" (§2, [API terms](https://unsplash.com/api-terms)).
  - A key compiled into an app binary can be extracted (general knowledge; not from an Unsplash source). So embedding the key is advised against, and the proxy is the documented answer.
  - The guidelines also say apps must not make users register their own developer accounts. Instead, "build a proxy that signs requests on behalf of your users, allowing them to all share a single API key" (same page). That is exactly our design.

### 4. Rate limits and production access

- **Limits.** "For applications in demo mode, the Unsplash API currently places a limit of 50 requests per hour. After approval for production, this limit is increased to 1000 requests per hour" ([docs, Rate limiting](https://unsplash.com/documentation#rate-limiting)).
- **What is counted.** The limit is per application, and the application is identified by its access key. Every response carries `X-Ratelimit-Limit` and `X-Ratelimit-Remaining` headers. Only requests to `api.unsplash.com` count, not `images.unsplash.com` (same section). The docs don't say whether the hour is a rolling window or a fixed one. I could not verify this.
- **Over the limit.** Our project map records a 403 with `x-ratelimit-remaining: 0` (PROJECT-MAP §7.6). I did not find this status code in the Unsplash docs I fetched.
- **One key for web and iOS.** Because iOS goes through `/api/photos`, Unsplash sees one application (our server) making all the calls. Both clients share the 50/hour or 1,000/hour budget. I found no Unsplash statement either requiring or forbidding a separate application per platform. Secondary sources say one application works across platforms, but those aren't authoritative.
- **Applying for production.**
  - Demo is meant for "small personal projects that aren't intended for the public". Public apps "should apply for Production status".
  - To be eligible, an app must meet the guidelines "including reporting image views via hotlinking and tracking download events". It must also meet the API terms, and the application must "include screenshots and accurate information, including a relevant title and description" ([when to apply](https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit)).
  - "If your submission does not clearly meet all of the guidelines, it will likely be rejected … until you provide clear examples of all of the guidelines being met" ([API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)).
  - The docs tell you to follow the "Apply for Production" instructions on your app's page ([docs, Registering your application](https://unsplash.com/documentation#registering-your-application)).
  - A secondary source (search-result snippet, not verified on an Unsplash page) says reviewers look for screenshots that show attribution and where each credit link points: a hover URL, the code, or a screen recording.
- **Budget arithmetic for Colour Shift (my calculation).** At about 2 calls per photo (one random photo plus one download), 1,000/hour is about 500 photos an hour across *all* users of both apps. Using `count` and tracking downloads only on export or share would raise that a lot (see §6).

### 5. Image URLs on mobile

- **Officially supported imgix parameters:** `w`, `h`, `crop`, `fm`, `auto=format`, `q`, `fit` and `dpr`. Other imgix parameters "can be used, but we don't officially support them and may remove support for them at any time" ([docs, Supported parameters](https://unsplash.com/documentation#supported-parameters)).
- **`urls.raw` and the preset sizes.** `urls.raw` is the base URL with just the path and `ixid`. Unsplash's own example adds `&w=1500&dpr=2` to it. The presets are `regular` (1080 wide), `small` (400) and `thumb` (200) (same docs section).
- **`dpr`** "controls the output density". It defaults to 1, goes up to 5, accepts fractions, and needs `w` or `h` to work. For example, `w=500&h=300&dpr=2` gives 1000×600 ([imgix dpr](https://docs.imgix.com/apis/rendering/pixel-density/dpr)).
- **Retina sizing on iOS.** Ask for `w = view width in points` and `dpr = displayScale` (SwiftUI `EnvironmentValues.displayScale`, a `CGFloat`, iOS 13+; [Apple](https://developer.apple.com/documentation/swiftui/environmentvalues/displayscale)). For example, a 393 pt wide panel at 3× becomes `w=393&dpr=3`, so 1,179 px. That keeps one URL per layout and lets imgix do the arithmetic.
- **`fit`.** `max` fits inside `w`/`h` without cropping and "will not increase the size if it is smaller". `crop` fills the box exactly and crops the excess. The default is `clip` ([imgix fit](https://docs.imgix.com/apis/rendering/size/fit)). Keep `fit=max` (as on the web). Or use `w`+`h`+`fit=crop` if the iOS photo panel has a fixed aspect ratio and you want imgix to do the crop.
- **`q`.** It sets quality for lossy formats (jpg, webp, avif and others), from 0 to 100, default 75 ([imgix q](https://docs.imgix.com/apis/rendering/format/q)). The web app uses 80.
- **`auto=format` and `fm` on iOS.**
  - imgix chooses AVIF, then WebP, then JPEG or PNG, based on the client's Accept header ([imgix auto](https://docs.imgix.com/apis/url/auto)).
  - I tested `images.unsplash.com/photo-1461988320302-91bde64fc8e4?w=400&q=80&auto=format&fit=max` with curl on 2026-10-05. The responses carry `vary: Accept, User-Agent`:
    - `Accept: */*`: `image/jpeg`, 22,887 bytes
    - `Accept: image/webp,*/*`: `image/webp`, 22,064 bytes
    - `Accept: image/avif,image/webp,*/*`: `image/avif`, 14,549 bytes
  - So on iOS, set the Accept header on the image request yourself, or force a format with `fm`. I did not verify the default Accept header that `URLSession`/`AsyncImage` sends. Safari 16 (iOS 16) "Added support for non-animated AVIF" ([Safari 16 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-16-release-notes)). I did not verify AVIF decoding in `UIImage`/ImageIO against an Apple primary source, so test it on a device.
- **`blur_hash`.** "All photo objects returned by the Unsplash API include a `blur_hash` string … which can be used to display a blurred preview before the real image loads" ([docs, BlurHash placeholders](https://unsplash.com/documentation#blurhash-placeholders); field added 2020-09-28 per the [changelog](https://unsplash.com/documentation/changelog)).
- **BlurHash on iOS.** The reference Swift decoder is a single file you can copy into the project. It adds `UIImage(blurHash:size:punch:)`, and the README says "32 pixels wide is plenty" ([woltapp/blurhash Swift](https://github.com/woltapp/blurhash/tree/master/Swift), MIT licence). That gives an instant placeholder with no network request. The web app instead downloads a 200px image for its blurred preview.
- **Colour extraction on iOS.** The web app runs node-vibrant on the 200px image. If iOS does its own extraction, it can still fetch `w=200` from the CDN (images don't count against the rate limit), and it doesn't need CORS.

### 6. Proxy fields and `/photos/random` parameters

- **Fields we return now:** `id`, `urls.raw`, `alt_description`, `user.name`, `user.links.html` and `links.html`. All are documented on the photo object ([docs, Get a photo](https://unsplash.com/documentation#get-a-photo)).
- **Worth adding**, all on the same object at no extra cost:
  - `blur_hash`: the iOS placeholder (above).
  - `color`: a hex average colour, for example `"#60544D"`. It is an even cheaper placeholder, and a possible fallback colour if extraction fails.
  - `width`, `height`: the aspect ratio before the image loads. They avoid layout jumps in SwiftUI.
  - `links.download_location`: the exact URL to ping, including `ixid` ([download guideline](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download)). It contains no secret. The client can echo it back, and the server checks that it starts with `https://api.unsplash.com/photos/<id>/download` before adding the key. That stops the proxy from being used to call other URLs.
  - Optionally `user.username`, to build the recommended `unsplash.com/@username` link. Our `user.links.html` already points to the profile.
- **`/photos/random` parameters** ([docs, Get a random photo](https://unsplash.com/documentation#get-a-random-photo)):
  - `query`: limits to photos matching a search term.
  - `count`: number of photos, default 1, max 30. "When supplying a `count` parameter - and *only* then - the response will be an array of photos, even if the value of `count` is 1."
  - `orientation`: `landscape`, `portrait` or `squarish`.
  - `content_filter`: `low` (default) or `high`. `low` "guarantees that no content violating our submission guidelines (like images containing nudity or violence)" is returned, and `high` "further remove[s] content that may be unsuitable for younger audiences" ([docs, Content safety](https://unsplash.com/documentation#content-safety)).
  - `collections`, `topics`, `username`.
  - "You can't use the collections or topics filtering with query parameters in the same request."
- **What this means for our route.**
  - It makes N separate `query=<word>` calls, one per photo. A single `query=<word>&count=3` call would cost 1 request instead of 3, but all three photos would share a word.
  - Another option is `topics=<id1,id2,…>&count=N`, which spreads one request across several topics. I have not tested how varied that is.
  - `orientation=portrait` might suit a phone's tall photo panel. The web app deliberately omits `orientation` (PROJECT-MAP §7.2).
  - `content_filter=high` may help with a low App Store age rating.

### 7. Recommendation for Colour Shift iOS

1. **No SDK.** Write a small Swift client for our own `/api/photos` (a `Codable` `Photo` and `URLSession`). Load images with `AsyncImage` or a small loader that sets the Accept header.
2. **Keep the key on the server only.** Don't put any Unsplash key in the iOS bundle. Never use the secret key.
3. **Change `/api/photos`. It stays backwards-compatible: the web app ignores the new fields.**
   - Add `blurHash`, `color`, `width`, `height` and `downloadLocation` to `Photo` (and to the `UnsplashPhoto` type in `route.ts`).
   - Change the download branch so it pings the validated `download_location`, with `ixid`, instead of `/photos/<id>/download`. Or have it accept `id` plus `ixid`.
   - Consider adding `count=` batching per word, or `topics`, to cut calls.
   - Consider an optional `orientation` pass-through for iOS.
   - Decide whether to pass `content_filter=high`.
4. **Images on iOS:** `rawUrl + "&w=\(points)&dpr=\(displayScale)&fit=max&q=80&auto=format"`, plus an `Accept: image/avif,image/webp,*/*` header. Test that AVIF decodes on the minimum iOS version you choose. If it doesn't, drop AVIF from the Accept header.
5. **Placeholder:** decode `blurHash` at about 32 px wide and let SwiftUI scale it up. Use `color` as the background underneath.
6. **Credit:** "Photo by **Name** on **Unsplash**", both as `Link`s with `utm_source=colour_shift&utm_medium=referral`, wherever a photo is visible. Include it in any exported or shared output, as the web Markdown export does.
7. **Production access:** apply now with the web app (live URL and screenshots showing credit links and download tracking). Mention in the description that a native iOS client uses the same server. Ask api@unsplash.com about anything uncertain, such as the download trigger or a paid app.

## Open questions / decisions for the owner

- **When should a "download" be tracked?** Options are on show (current; simple, but it doubles API calls and isn't the guideline's definition), or only when the user exports, copies or shares a pair (closer to "doing something with the photo"). This should match on web and iOS.
- **Photo variety vs rate budget.** One `query` with `count`, or several `topics` with `count`, or keep one call per word?
- **Orientation on iOS.** Should the iOS app pass `orientation=portrait` (or `squarish`), or crop like the web app does?
- **Content filter.** Use `content_filter=high` for both apps? It may help the App Store age rating.
- **One Unsplash application or two?** One key behind the proxy works technically. Unsplash doesn't say whether it wants a separate application per platform. Ask them if you want separate stats or limits.
- **Not verified:** whether `UIImage`/ImageIO decodes AVIF on your minimum iOS version; what Accept header `URLSession` sends by default; whether the rate-limit hour is rolling; the exact status code when the limit is hit; and whether Unsplash allows on-device caching of hotlinked images (the terms are silent).
- **Paid app or ads?** Ads near photos are discouraged, and "charging for access to the API" is listed as something to avoid. Check with Unsplash before monetising.

## Sources

- https://unsplash.com/documentation : API docs: auth, rate limits, imgix parameters, `ixid`, BlurHash, random photo parameters, download tracking, SDK list
- https://unsplash.com/documentation/user-authentication-workflow : OAuth flow; where the secret key is used
- https://unsplash.com/documentation/changelog : `blur_hash` added (2020); illustrations included (2025)
- https://unsplash.com/api-terms : API terms: credentials, attribution, hotlinking, marks, quotas, privacy policy
- https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines : main API guidelines (keys, proxy, naming, replication)
- https://help.unsplash.com/en/articles/2511315-guideline-attribution : credit format and UTM links
- https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download : what counts as a download; `download_location` and `ixid`
- https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images : hotlinking rule, re-hosting exception
- https://help.unsplash.com/en/articles/2511257-guideline-replicating-unsplash : no unofficial clients or wallpaper apps
- https://help.unsplash.com/en/articles/2511256-guideline-high-quality-authentic-experiences : no ads near content, no charging for access, no AI training
- https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit : demo vs production; review criteria
- https://unsplash.com/blog/easily-add-unsplash-search-into-your-ios-apps : 2018 announcement of the iOS picker
- https://github.com/unsplash : org repo list (no Swift API client)
- https://github.com/unsplash/unsplash-photopicker-ios : picker README, licence, requirements, source
- https://github.com/unsplash/unsplash-photopicker-ios/releases : last release 1.3.0 (2022-04-05)
- https://github.com/unsplash/unsplash-photopicker-ios/issues : open issues and PRs
- https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Operations/SearchPhotosRequest.swift : picker uses `/search/photos`
- https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Operations/UnsplashRequest.swift : picker sends access key from the device
- https://github.com/unsplash/unsplash-photopicker-ios/blob/master/UnsplashPhotoPicker/UnsplashPhotoPicker/Classes/Controllers/UnsplashPhotoPicker.swift : picker's download tracking
- https://docs.imgix.com/apis/rendering/pixel-density/dpr : `dpr` range and behaviour
- https://docs.imgix.com/apis/rendering/size/fit : `fit` modes
- https://docs.imgix.com/apis/rendering/format/q : `q` default and range
- https://docs.imgix.com/apis/url/auto : `auto=format` negotiation (AVIF, WebP, JPEG)
- https://developer.apple.com/documentation/swiftui/environmentvalues/displayscale : SwiftUI display scale for `dpr`
- https://developer.apple.com/documentation/safari-release-notes/safari-16-release-notes : AVIF support in Safari 16 / iOS 16
- https://github.com/woltapp/blurhash/tree/master/Swift : reference Swift BlurHash decoder
- https://images.unsplash.com/photo-1461988320302-91bde64fc8e4?w=400&q=80&auto=format&fit=max : my own curl test of format negotiation by Accept header (2026-10-05)
