# Debug (Polyfills)

An add-on for [Polyfills](https://github.com/PoomSmart/Polyfills) that renders browser console output directly on the web page. Useful when debugging Mobile Safari or WebKit views without a tethered Mac.

## Requirements

- [Polyfills](https://github.com/PoomSmart/Polyfills) **2.12.0** or later
- iOS 8.0 or later

## Installation

Install the `com.ps.polyfillsdebug` package on a device that already has Polyfills installed.

## How It Works

Debug installs two scripts into Polyfills' asset directories:

| Script | Injection | Role |
|--------|-----------|------|
| `scripts-priority/base/A_debug.js` | Document start (high priority) | Hooks `console` and error handlers early, buffers messages, tracks `<script>` elements |
| `scripts-post/base/A_debug.js` | Document end | Renders the on-page log panel and replays buffered messages |

The priority script (document start) hooks `console` early to **buffer** messages into `window._debugMessages`, tracks `<script>` elements, and owns error/rejection/CSP handling. It exposes the native console as `window._debugOriginalConsole`.

The post script (document end) builds the panel, replays the buffered messages, then installs its **own** `console.*` hooks and error/rejection/CSP listeners that render straight to the panel (forwarding console output to the native console). Owning capture in the post script — rather than relying on the priority hooks reaching it — is what keeps logging reliable on older WebKit (e.g. iOS 8): it works even if the page reassigned `console.*` after document start, or **the entire document-start bundle never ran**. The post script sets `window._debugErrorsOwnedByPanel`, which makes the priority script's error handlers stand down so errors aren't logged twice. Error helpers (`_debugExplainScriptError`, `_debugDumpTrackedScripts`, the sanitized-error cap) are used from the priority script when present, with local fallbacks otherwise.

Note: if you only ever see the document-end log (`Polyfills scripts-post started.`) but never the document-start log (`Polyfills scripts started.`), the document-start user-script bundle is not executing on that device — that points at Polyfills injection/transpilation, not at the debug tool.

## Log Panel

A fixed panel appears at the bottom of the page (about 40% of the viewport height) with a dark background and monospace text.

### Toolbar

| Button | Action |
|--------|--------|
| **Copy** | Copy the full log text to the clipboard |
| **Clear** | Clear the log (same as `console.clear()`) |
| **Top** | Scroll to the top |
| **Bottom** | Scroll to the bottom and resume auto-scroll |
| **Collapse** / **Expand** | Hide or show the log area (toolbar stays visible; logging continues while collapsed) |

Auto-scroll follows new output while you are at the bottom. Scrolling up pauses it so you can read earlier lines. Text in the log area can be selected and copied manually.

### Duplicate Aggregation

Identical consecutive lines are collapsed into one entry with a repeat count, similar to browser devtools:

```
Error: Script error. at :0:0
Error: Script error. at :0:0 (×12)
Script hint: Browser hid file/line (cross-origin script without crossorigin + CORS)
Script hint: Suppressed further cross-origin script errors (×288)
```

Cross-origin `Script error.` lines are capped at **12** visible entries (with the explanatory hint shown only on the first). Further occurrences are counted in a single suppression line instead of flooding the log.

### Troubleshooting: `Script error` on every website

If you see `Script error. at :0:0` on **every** site (including minimal pages), Debug is probably **revealing** errors rather than causing them:

| Test | Interpretation |
|------|----------------|
| Polyfills **on**, Debug **off** — errors still occur | Source is Polyfills injection or WebKit, not the Debug panel |
| Polyfills **off** — errors stop | Polyfills scripts are the source |
| Debug **off** only — errors stop | File a Debug bug (unexpected) |

Polyfills injects JavaScript via `WKUserScript` into **all frames** (`forMainFrameOnly: NO`), including cross-origin iframes. On older WebKit (e.g. iOS 8), failures there often surface on the top window as sanitized `Script error.` with no file or line — the same symptom on every site that loads iframes or heavy polyfill bundles.

Debug hooks errors in `scripts-priority` only; `scripts-post` renders the panel. The first capped `Script error` includes a snapshot of `<script>` URLs on the page to help distinguish page embeds from injection noise.

## Captured Output

### Console methods

`log`, `info`, `warn`, `error`, `debug`, `trace`, `assert`, `dir`, `dirxml`, `table`, `group`, `groupCollapsed`, `groupEnd`, `time`, `timeEnd`, `timeLog`, `count`, `countReset`, `clear`

### Errors and events

- Uncaught JavaScript errors (with stack traces when available)
- Failed resource loads (`<script>`, `<img>`, etc.)
- Unhandled promise rejections and later handled rejections
- Content Security Policy violations

### Script error hints

When the browser reports a sanitized `Script error.` with no file or line (common for cross-origin scripts), Debug tries to identify the likely source by tracking recently added or executed scripts and prints **Script hint** lines alongside the error. On the **first** such error, it also dumps up to 24 tracked `<script>` URLs/inline snippets seen on the page at that moment.

## Project Layout

```
scripts-priority/
  A_debug.js          # Early hooks and message buffering (source)
scripts-post/
  A_debug.js          # Log panel UI (source)
layout/Library/Application Support/Polyfills/
  scripts-priority/base/A_debug.js   # Minified output (installed on device)
  scripts-post/base/A_debug.js       # Minified output (installed on device)
```

Edit the files under `scripts-priority/` and `scripts-post/`, then rebuild the package. Source files are minified into `layout/` before packaging.

## Building

```sh
make
```

Requires Node.js (`npx uglify-js`) for JavaScript minification.

## License

See the Polyfills project for author and licensing information.
