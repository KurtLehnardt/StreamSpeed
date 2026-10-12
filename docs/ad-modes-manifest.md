# Ad-aware modes: manifest entries

The ad-aware features (PR #38) are disabled by default via `SS_AD_MODES_ENABLED` in
`content/settings.js`. So that the default build requests no more permissions than
4.1.3 (`activeTab`, `scripting`), the manifest entries below were removed from
`manifest.json`. The feature code is still in the repo.

## To enable the ad-aware modes

1. Set `g.SS_AD_MODES_ENABLED = true;` in `content/settings.js`.
2. Merge the entries below back into `manifest.json` at the top level.
3. Add `"storage"` to the existing `"permissions"` array (it becomes
   `["activeTab", "scripting", "storage"]`).

Note: enabling adds permissions, so Chrome will disable the extension on update
until the user accepts the new permissions.

## Entries (verbatim from #38)

```json
{
  "host_permissions": [
    "*://*.youtube.com/*",
    "*://*.hulu.com/*",
    "*://*.peacocktv.com/*",
    "*://*.twitch.tv/*"
  ],
  "optional_permissions": [
    "webRequest"
  ],
  "optional_host_permissions": [
    "*://*.doubleclick.net/*",
    "*://*.googlesyndication.com/*",
    "*://imasdk.googleapis.com/*",
    "*://*.moatads.com/*",
    "*://*.adsafeprotected.com/*",
    "*://*.fwmrm.net/*",
    "*://*.amazon-adsystem.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "options_page": "options.html",
  "content_scripts": [
    {
      "matches": [
        "*://*.youtube.com/*",
        "*://*.twitch.tv/*"
      ],
      "js": [
        "content/settings.js",
        "content/dom-utils.js",
        "content/siteRegistry.js",
        "content/firstRun.js",
        "content/adModes.js",
        "content/adDetector.js"
      ],
      "css": [
        "content/breathing.css"
      ],
      "run_at": "document_idle",
      "all_frames": false
    },
    {
      "matches": [
        "*://*.hulu.com/*",
        "*://*.peacocktv.com/*"
      ],
      "js": [
        "content/settings.js",
        "content/dom-utils.js",
        "content/siteRegistry.js",
        "content/firstRun.js",
        "content/adModes.js",
        "content/adDetector.js"
      ],
      "css": [
        "content/breathing.css"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ]
}
```
