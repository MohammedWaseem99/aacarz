# A&A CARZ

The home page adds scroll-driven 3D perspective to the hero image, brand/category cards and promotional surfaces. `dist/home-depth.js` updates only near-viewport surfaces on scroll/resize using a single scheduled animation frame, remains idle otherwise, cleans up on route changes and respects reduced-motion preferences. Forms, fixed navigation and product-page gestures remain unaffected. Run `node scripts/check-home-depth.mjs` for responsive, depth, navigation and motion checks.

All application pages use one-time viewport reveal animations for sections and cards. `dist/scroll-reveal.js` observes newly rendered route/search/tab/form content, staggers sibling cards and cleans up detached targets. Header/bottom navigation and photo gesture surfaces remain stable. Keyboard focus reveals its containing card immediately; reduced-motion preferences disable reveals, and browsers without IntersectionObserver retain visible content. Run `node scripts/check-scroll-reveal.mjs` for route, dynamic-content, focus and reduced-motion checks.

On phones, the header menu icon is hidden; the fixed bottom navigation remains available on every page. The More page groups the purchase, financing, comparison, company and support links into icon-led cards, with prominent booking and trade-in shortcuts. `node scripts/check-more-hub.mjs` checks navigation, header visibility and responsive layouts.

The primary accent is `#D30C07`, sampled from the dominant red in the supplied JPEG logo. `--color-brand` and `--color-brand-hover` in `src/input.css` control buttons, accent text, active navigation, focus states and icon accents. Pale backgrounds and borders derive from the same red using `color-mix`; semantic green statuses remain green. `node scripts/check-brand-color.mjs` checks the rendered accent colors.

The home hero uses staggered text entrances, a short settling vehicle-photo zoom, a one-time button sheen and staggered trust-icon reveals. Explore Vehicles and Book a Visit lead to the existing browsing and booking routes. Motion runs once and is fully disabled for `prefers-reduced-motion`. Run `node scripts/check-home-hero.mjs` for responsive, navigation and motion checks.

The dealership logo uses the user's original supplied artwork at `dist/assets/aa-carz-logo.jpeg`, displayed in the header, footer, appointment-image branding and browser icon. The full logo is preserved; CSS sizes it for each placement and adds a readable wordmark alongside it.

A responsive HTML, Tailwind CSS 4 and vanilla JavaScript showroom inspired by the supplied mobile UI. Open `dist/index.html` in your browser. The compiled stylesheet is included, so viewing the site requires no installation or Tailwind CDN.

Edit `dist/index.html` and `dist/app.js` for markup and behavior. Responsive Tailwind utility classes live directly in the HTML and JavaScript templates. Edit `src/input.css` for design tokens and reusable component styles built with Tailwind `@apply`.

To rebuild the stylesheet after edits:

```sh
npm install
npm run build
```

Use `npm run watch` during development. `npm run check` checks JavaScript syntax. `dist/styles.css` is generated; edit the source stylesheet instead. This follows the [Tailwind CLI workflow](https://tailwindcss.com/docs/installation/tailwind-cli).

The website now follows the supplied mobile reference, with a centered mobile frame on larger screens. Open `dist/screens.html` to review all eleven reference screens together, or `dist/index.html` to use the website.

The home and inventory pages expand for tablets and desktop. Their red-themed vehicle finder uses one column on phones, two on tablets and four on wide screens. Make/model options are linked; year and body type combine with the selection, the button previews the matching count, and submitted search values are encoded in the URL. Reset clears the filters. All inventory appears in browsing results. `dist/filters.js` holds the explicitly illustrative search years in `stockSearchData`; replace these with verified dealer inventory before use with customers.

The home page's Find Your Kind of Drive section includes nine photo categories: SUVs, sedans, hatchbacks, wagons, coupes, convertibles, pickups, vans and MPVs. Its responsive cards link to the matching category in Browse Cars. Categories without stock offer an availability enquiry instead of showing unrelated inventory. Category imagery uses locally stored Wikimedia photos with credits on `photo-credits.html`.

The home trade-in promotion and `#trade-in` page use original local vehicle photos, dark image overlays, red actions, a three-step guide, preparation checklist, expandable FAQs and booking/enquiry links. The trade-in enquiry link pre-selects Trade-In and fills in the message. The page expands to a wider layout on desktop while retaining the mobile navigation. Its components live in `dist/support.js`. `node scripts/check-trade-in.mjs` verifies the route, image, FAQs, booking, enquiry and responsive layouts.

Explore Our Vehicle Range is a responsive horizontal carousel: one card on phones, two on tablets, three on desktops, with swipe/keyboard scrolling, previous/next buttons, position indicator and In Stock / New Cars / Used Cars tabs. Current sample listings are all pre-owned; New Cars displays an honest empty state. Mileage and fuel/transmission values are illustrative and configurable in `dist/carousel.js`. The dealership statistics animate from zero when scrolled into view. Example totals from the reference are 500 completed deals, 450 happy clients and 200 certified vehicles, explicitly labelled as samples. Experience is calculated from the user-supplied founding year 2016 using the Asia/Colombo calendar year. Update `dealershipStatistics` with verified totals and set `demoTotals` to false before presenting the figures as real. Reduced-motion users see final totals without animation. `node scripts/check-statistics.mjs` verifies the counter behavior.

Product detail pages include breadcrumbs, model/trim heading, summary badges, Share/Save/Compare actions, the existing multi-photo gallery, visit-booking and enquiry actions, complete overview, feature groups, dimensions, engine/transmission tables and PDF downloads. `dist/product.js` contains the user-supplied illustrative specification and feature data. The Camry example uses the requested title, trim description, 2023 year, 20 miles and VIN MCB123818. The supplied trim and specification values are not verified model facts; the page labels them as sample data. The brochure PDF contains the sample specs and features; the test-drive PDF is a planning worksheet, not a booking confirmation. `#compare` compares up to three vehicles and saves the shortlist in localStorage.

Routes: `#home`, `#brands`, `#brand/toyota`, `#cars`, `#car/1`, `#car/1?tab=Specifications`, `#appointment/1`, `#appointment/2`, `#appointment/3`, `#process`, and `#more`. The booking flow advances through the three steps without needing manual route changes. Additional brand routes use the logo slug, such as `#brand/honda`.

Includes brand browsing, vehicle search and category filters, vehicle detail tabs, persistent favourites, and a validated three-step demonstration appointment form. The reference's inventory counts are illustrative; the results count reflects the actual sample vehicles available.

Appointments and favourites use browser localStorage. No booking is sent to a business. Inventory, specifications and condition are illustrative. Original high-resolution model photos are stored in `dist/assets/cars`; brand heroes, cards, details and bookings use matching vehicle photos. Every brand has a matching sample car. The supplied image remains a CSS sprite only for the A&A CARZ logo. All assets and system fonts work offline.

All nine manufacturer logos and the Lucide SVG interface icons are included locally in `dist/assets`. Brand cards use the original manufacturer logo PNGs. Icon markup is bundled in `dist/icons.js` so icons also work when opening the HTML file directly. Rebuild the icon bundle with `node scripts/build-icons.mjs`. Asset sources and icon license are documented in `dist/assets/ATTRIBUTION.md`.

Vehicle photographs are sourced from Wikimedia Commons. `dist/photo-credits.html` includes photographer, source and license details. Refresh photos with `node scripts/fetch-car-photos.mjs`, then rebuild the attribution page with `node scripts/build-photo-credits.mjs`. Brand-to-photo mappings are explicit in `brandHeroes` in `dist/app.js`. The photographs illustrate models and are not actual dealership stock photos.

Every vehicle detail page has a multi-photo gallery with thumbnails, previous/next buttons, swipe, photo counts and a keyboard-accessible fullscreen viewer. Model-specific interior, dashboard, steering-wheel and rear-seat reference photos are mapped in `dist/gallery-data.js`; not every view is available for every model. Replace the reference entries with actual vehicle photos before publishing real stock. Each photo has a `label` and `src`, plus source/author/license metadata. The viewer automatically accommodates additional photos. Run `node scripts/fetch-gallery-photos.mjs` to retrieve reference photos and `node scripts/build-photo-credits.mjs` to update credits.

`#faq` includes searchable questions, category filters, accessible expandable answers and a contact shortcut. `#contact` includes showroom-visit booking, contact-detail slots and a validated enquiry form. Set verified phone, email, WhatsApp, address and opening hours in `dealershipContact` at the top of `dist/support.js`. Direct contact links activate when values are configured. The enquiry form saves the latest enquiry to browser localStorage (`aa-enquiry`); it does not send email or contact a dealership.

`node scripts/browser-check.mjs` runs hidden Chrome checks and writes screenshots into `qa/` (requires Chrome at the path specified in that script). It verifies all reference views, horizontal overflow, asset loading, search, favourites, specifications and the complete booking flow.

To use in production, replace illustrative vehicle data and imagery in `dist/app.js` and connect the booking form to a server or booking service.

Vehicle prices are removed from cards, carousels, details, comparisons and generated PDFs. Search now uses Make, Model, Year and Body Type. The shared dark footer appears on every route with showroom/support navigation, a contact link, photo credits, copyright and a back-to-top button. Real phone details appear only when configured in dealershipContact.

The home appointment section uses a responsive photo-and-copy layout with visit highlights, booking and purchase-guide links. Product Specifications, Features and Condition tabs use a shared icon-card design: grouped specification tables, equipment-category cards and condition-summary cards. All supplied specification values remain illustrative. Run `node scripts/check-detail-design.mjs` for focused responsive and interaction checks.

The product gallery now displays a green Featured tag on the main image. The missing-photo request links and the separate Featured / Explore This Car / Request Video badge row have been removed.

Product photos open in a fullscreen viewer with pinch zoom, double-tap zoom/reset, touch or mouse dragging, wheel zoom, +/- controls, and keyboard +/-/0 shortcuts. Zoom is clamped to 100–400%, panning is bounded to the image, and changing photos resets the zoom. At normal size, swiping browses images; zoomed swipes pan instead. Close/Escape restores page scrolling and focus. `dist/gallery-zoom.js` implements these gestures. `node scripts/check-gallery-zoom.mjs` tests trusted Chrome touch input for pinch, double-tap, pan and swipe.
