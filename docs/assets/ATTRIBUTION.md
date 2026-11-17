# Asset sources

Manufacturer logo PNGs are sourced from the [Car Logos Dataset](https://github.com/filippofilip95/car-logos-dataset), whose image sources are documented in its data file. The logo artwork identifies the respective vehicle manufacturers.

Interface icons are original [Lucide SVG assets](https://github.com/lucide-icons/lucide). The accompanying license is included at `icons/LICENSE.txt`.

Both logos and icons are served locally. `icons.js` contains the SVG markup used by the HTML and JavaScript templates. Refresh the assets with `node scripts/fetch-assets.mjs`; regenerate `icons.js` with `node scripts/build-icons.mjs` if changing the icon collection.

`reference.jpeg` is the UI reference image supplied by the user. Only the A&A CARZ logo is displayed from this image. Vehicle photographs are original high-resolution Wikimedia Commons photos stored in `cars/`, with individual authors and licenses listed in `cars/ATTRIBUTION.md`, `cars/credits.json`, and the site's `photo-credits.html` page. Manufacturer brand cards use the original PNG logo assets. The website's page structure, text, buttons, forms and interactions are implemented in HTML, Tailwind CSS and JavaScript.
