# chrome-page-height

Chrome extension that measures the full height of the current page and shows the result in a toast at the bottom right.

## How it works

Chrome exposes layout dimensions in CSS pixels. Because CSS pixels are based on a 96 dpi reference, this extension converts the measured document height to a 72 dpi equivalent with:

`72dpi pixels = CSS pixels * 72 / 96`

The toast shows both values so the conversion stays explicit.

## Load the extension

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository folder.

## Use it

1. Open any page you want to measure.
2. Click the extension icon in Chrome's toolbar to turn the overlay on for that tab.
3. Look for the toast in the bottom right corner of the page.
4. Click the extension icon again to turn the overlay off.

When the overlay is on, the extension badge shows `ON` and the toast stays visible while the page height updates.

The toast shows something like:

`Page Height: 3,240 px @ 72 dpi (4,320 CSS px)`

Reloading or navigating the tab resets the overlay to off.
