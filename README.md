# SmartSeat — CP3405

Static frontend with the FastAPI backend in `Smartseat/backend`.

## Language and mobile layout

The interface defaults to Simplified Chinese. The top language bar switches between
简体中文 and English without resetting entered form values or selected seats.
The choice is saved as `smartseat-language` in local storage; when storage is
unavailable the switch still works for the current page.

`i18n.js` contains the translation catalog, dynamic message patterns, and the shared
`I18n.t`, `I18n.alert`, and `I18n.confirm` helpers. A DOM observer translates legacy
page text and newly rendered content while leaving input values, API fields, and
seat IDs unchanged. Mark user-authored content with `data-no-i18n` when adding it.
`responsive.css` is loaded after page styles. On narrow screens, pages stack,
teacher navigation becomes a drawer, and seat maps scroll within their own viewport
so that individual seats remain large enough to select.

## Frontend checks

Requires Node.js and a Chromium browser:

```sh
npm ci
npx playwright install chromium
npm test
```

Alternatively set `BROWSER_PATH` to an installed Chrome or Edge executable.
Set `SCREENSHOT_DIR` to an existing directory to save mobile screenshots.
The suite starts a local static server, mocks the API, and checks all 14 pages at
320, 390, 768, and 1440 pixels. It also checks English on phones, language persistence,
form/seat state across language changes, Chinese search, seat-map scrolling,
reservation submission, mobile navigation, and unavailable browser storage.
It does not validate the live backend. The existing Tailwind, chart, and icon CDN
resources require internet access during these browser checks.
