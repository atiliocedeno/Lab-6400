# Capability diagnostic QA — 1.2.2

Scope: read-only ScalarWebAPI audit and the UI used to collect/share it.

## Corrections following expanded dry runs

- Invalid JSON envelopes and malformed method schemas cannot yield a completed
  audit. The raw schema remains in the report, with a top-level error.
- A Sony rejection while loading optional controls no longer prevents access to
  the audit after a successful connection. Transport errors still disconnect.
- Cancel immediately updates the screen status.
- `npm run build:android` now runs `npm run validate` before invoking EAS.

## Executed checks

- Existing camera probe/session/Android transport suites: passed.
- `tests/capabilities.cjs`: 33 passing cases. Covers fetch and mocked Android native
  routing, all allowlisted getters, duplicate/hostile names, missing methods,
  explicit Sony rejections, transport failures at multiple stages, malformed JSON,
  null/invalid envelopes, mismatched IDs, invalid method lists/schemas, oversized
  responses, mutex exclusion, cancellation and retry after failure.
- `tests/camera-panel.cjs`: 5 passing mocked-hook component flows. Completed report
  remains shareable after disconnect; rejected optional controls allow audit;
  partial report survives network failure; report survives background disconnect;
  new search clears the old report.
- TypeScript and Expo lint: passed.
- Android JS export (`expo export --platform android --no-bytecode`): succeeded,
  676 modules. Expo emitted its force-exit notice after writing the bundle; exit
  code was 0. This checks Metro bundling, not Gradle/Hermes compilation.

## Limits of this evidence

No physical A6400, Android OS runtime, Wi-Fi multicast, native Kotlin compilation,
APK installation, visual/device UI, or OS share-sheet test was performed here.
Mocks exercise app logic; they do not prove device/network behavior. The native
transport implementation and dependencies were not changed by this revision.
The audit is explicitly requested by the user; it never writes settings. Starting
an ordinary connection still has its existing `startRecMode` initialization.
A completed audit may contain explicit Sony rejections; it is not a compatibility
certificate. Reports remain in component memory, not persistent storage, and are
lost if the screen is unmounted or the app restarts. Share before leaving it.
Full recipe application remains unavailable pending verified remote commands.

## Reproduce before cloud build

```
npm ci
npm run validate
```

`npm run build:android` repeats validation and only invokes EAS if it passes.

## 1.2.3 — Android JSON file export

Added `Guardar diagnóstico completo (.json)` using the existing Expo FileSystem
SAF module. Captures JSON before opening the system picker, writes UTF-8 and reads
it back for exact equality. Text sharing remains available but destination apps
may truncate it; the precise truncation point in the user's report is unknown.

Export tests cover a 1,000-entry Unicode report, state mutation while the picker
opens, permission cancellation, truncated read-back, and write failure. Full
validation passed. OS picker behavior still requires a physical Android test.
No new native dependency was introduced. Select a writable subfolder, then attach
the saved JSON file rather than copying its contents into a message.
