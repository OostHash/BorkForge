# HexDesk brand assets

`hexdesk-logo.svg` is the canonical transparent emblem. It uses
`fill="currentColor"`, so consumers can recolour it with the CSS `color`
property. `hexdesk-logo-white.svg` is the fixed white variant for tools that do
not apply CSS.

The dark and light application icons use the same emblem geometry and padding.
`exports/` contains 16, 24, 32, 48, and 256 pixel PNGs plus multi-resolution
Windows ICO files. Tauri's desktop-ready exports remain in
`src/backend/icons/`, where the application and installer already expect them.

`hexdesk-social.svg` is the editable 1280 × 640 GitHub social-preview source;
`hexdesk-social.png` is the matching upload-ready export.
