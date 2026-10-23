# Pantry Rhythm

A mobile-first, local-first household pantry tracker. It records what you buy, when it
actually runs out, and estimates when to restock next — while keeping the household data in
your own browser.

**Status:** working v0.1, deployable to GitHub Pages at
<https://sam-ds.github.io/pantry-rhythm/>.
**Terms review:** 24 October 2026 - see [Terms and licence review](#terms-and-licence-review-24-october-2026).

> **Previously called Restock Radar.** The IndexedDB database and the `app` field in share
> payloads keep the old `restock-radar` identifier so existing local households and older
> links/backups keep working. New share links use `pantry-rhythm`; the importer accepts both.

## What it does

- **Find a product three ways:** search Open Food Facts, look up a barcode (manual entry or
  on-device camera scanning where the browser supports `BarcodeDetector`), or create any item
  manually.
- **Track real cycles:** purchase date, quantity, your own duration estimate, notes, and the
  actual run-out date. Restocking early closes the previous cycle without treating it as
  consumption history.
- **Estimate the next restock:** median observed days-per-unit from completed run-out cycles,
  multiplied by the current quantity. Falls back to your initial estimate with a deliberately
  wide range when there is no history.
- **Show uncertainty honestly:** "no history", "limited history", "your pattern", or "manual"
  labels, plus an earliest/latest range. It never claims accuracy.
- **Dashboard windows:** 3, 7, and 14 days, an automatic restock checklist, and quick
  purchased/consumed actions.
- **Correct anything:** edit product details, purchase history, cycle dates, or pin a manual
  estimate for the current cycle.
- **Share or back up:** a gzip-compressed link/QR code generated in the browser, plus JSON
  export/import with merge or replace.

## Privacy model

- There is **no backend database, account, cloud sync, analytics, or tracker**.
- Items, purchase history, notes, and settings live in **IndexedDB** in this browser profile.
- Product searches and barcode numbers are sent to Open Food Facts only when you explicitly
  submit a lookup. Purchase dates, quantities, notes, and household name are never included.
- Share links put the payload **after `#` in the URL**, so it is not sent to the static host.
  The payload is compressed, **not encrypted** — anyone with the link or QR can read it.
- Clearing site data removes the household. Download a JSON backup from the Share page.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

```bash
npm test        # 29 unit tests: prediction, repository, share codec, OFF mapping
npm run build   # type-check + production build into dist/
npm run preview # serve the production build
```

## Open Food Facts usage norms

Open Food Facts is free, open data, but its public API is a shared, rate-limited service.

- **Searches run only on explicit submit** — never per keystroke. There is also a 10-minute
  client cache, in-flight request deduplication, and a 60-second local cooldown after a `429`.
- **A descriptive User-Agent** is set on every request (`vite.config.ts` in development, the
  Cloudflare Functions in production). Update the contact string before a public deployment.
- **Fixed, minimal fields** are requested, and successful searches/products are briefly cached
  at the edge.
- **Manual entry is always available.** If OFF is down, rate-limited, CORS-blocked, or missing
  the product, the UI offers a manual fallback with the same barcode pre-filled.

The optional proxies are stateless: they forward only a public search term or barcode and
return public product data. They never receive household data.

**OpenMRP is not used anywhere in this app.**

Product names and barcodes in Open Food Facts can be missing or wrong. Every imported product
can be edited immediately, and manual items need no barcode at all.

Attribution: database under ODbL, images under CC BY-SA. See the About page in the app and
<https://world.openfoodfacts.org/data>.

## Terms and licence review (24 October 2026)

> This is a research summary, **not legal advice**. Terms and licences change. Re-check the
> linked pages before a public, high-volume, or commercial launch, and ask a lawyer if the
> risk matters to you.

### Verdict

| Service | Used here? | What it actually is | Verdict |
| --- | --- | --- | --- |
| Open Food Facts | Yes — optional product search and barcode lookup | Open, collaborative food-product database with a public API | **Safe to use within its licences and API rules.** Commercial reuse is permitted under ODbL/DbCL/CC BY-SA conditions. The API is shared infrastructure with hard rate limits. |
| OpenMRP | **No** | Cloud manufacturing/ERP platform (orders, inventory, production, purchasing, sales), not a product catalogue | **Not suitable and not needed.** No food catalogue or barcode lookup. The hosted API needs an organisation account and an admin-issued secret key. |

Neither service receives your household records. Open Food Facts receives only the search term or
barcode you explicitly submit; OpenMRP receives nothing because it is not integrated.

### Open Food Facts

Reviewed: [terms of use](https://world.openfoodfacts.org/terms-of-use),
[API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/), and
[data page](https://world.openfoodfacts.org/data).

**Licences**

- The **database** is under the
  [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1.0/) (ODbL).
- **Individual contents** are under the
  [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1.0/) (DbCL).
- **Product images** are under
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.en).
- The terms explicitly allow use and reproduction **for all purposes, including commercial use**,
  subject to attribution and share-alike for derivative works. They also warn that image licences
  cover the photo only; trademarks, product design, and other third-party rights may still apply.
- Attribution must name Open Food Facts and link to <https://openfoodfacts.org> (or the relevant
  product page). Derivative databases must be shared under the same terms.
- Data is provided **as-is**, with no guarantee of accuracy or completeness, and must not be used
  for medical purposes. The service may be unavailable or change. French law governs, and the
  French text prevails over the English translation.

**API rules**

- **15 requests/minute/IP** for product reads and **10 requests/minute/IP** for searches. Search
  must not be used for search-as-you-type. Open Food Facts reserves the right to ban IPs that
  exceed the limits, and applies global limits that can return HTTP 503.
- A custom User-Agent in the form `AppName/Version (contact)` is required. Reads need no other
  authentication; writes need an account and authentication.
- Before using the API, fill in the
  [API usage form](https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform)
  so the project can identify your use.
- API v3 is current; v2 is deprecated. For bulk data, download the CSV/JSONL dumps instead of
  paginating through the API.

**How this app complies**

- Searches run only on explicit submit — never per keystroke. A 10-minute client cache, in-flight
  request deduplication, and a 60-second cooldown after HTTP 429 reduce repeated traffic.
- Requests carry a descriptive User-Agent, ask for a small fixed field set, and are cached briefly
  at the edge by the optional stateless proxies.
- Manual entry always works, so the app remains usable if Open Food Facts is down, rate-limited,
  blocked by CORS, or missing the product.
- The About page shows the licences and links to the source; product records stay editable
  because names and barcodes can be wrong or missing.
- The app does **not** claim that Open Food Facts data or its own estimates are accurate.

**Before a public or commercial launch**

1. Fill in the API usage form and replace the placeholder contact string in the User-Agent
   (`vite.config.ts` and `functions/api/*.js`).
2. Keep the attribution and licence links visible. If you publish an OFF-derived database, comply
   with ODbL share-alike rather than assuming the app's local-only storage is enough.
3. Do not bulk-scrape through the API; use the published data dumps.
4. Check image use separately for trademarks and product-design rights in your jurisdiction.
5. Re-read the terms at launch time. They can change at any time.

**If Open Food Facts objects to this use**, remove the integration: delete
`src/lib/openfoodfacts.ts` and `functions/api/off-search.js` / `off-product.js`, and remove the
search and barcode entry points from the Add view. Manual entry is the supported fallback, so the
core pantry tracker keeps working.

### OpenMRP

Searches for "OpenMRP" often return **OpenMP** (the parallel-programming standard), which is a
different thing. The relevant service is <https://openmrp.ai>, operated by **Augno Inc.** Its
[public API repository](https://github.com/open-mrp/api) is Apache-2.0, but the hosted platform is
a commercial service with its own
[Terms of Service](https://openmrp.ai/terms-of-service) (last updated 19 February 2026) and
[Privacy Policy](https://openmrp.ai/privacy-policy) (last updated 7 January 2026).

**What it is:** a cloud manufacturing management platform — items and bills of materials,
production planning, purchasing, inventory, sales orders, shipping, invoicing, and analytics. It
is built for manufacturers and distributors, not for looking up retail food products.

**Why it is not integrated**

- It has **no public food catalogue or barcode lookup**, so it cannot replace Open Food Facts.
- API access requires an organisation account created by an administrator. An administrator then
  creates a secret bearer API key in the dashboard; requests also identify the account
  (`OpenMRP-Account`) and pin an API version (`OpenMRP-Version`). Every call is logged in the
  organisation's request logs.
- Its terms describe paid subscription plans, automatic enrolment after a free trial, and
  restrictions on automated access, excessive API requests, resale/redistribution, and competitive
  analysis. The code licence (Apache-2.0) does not grant rights to the hosted service, and
  "OpenMRP"/"Augno" are trademarks of Augno Inc.
- Using it would mean creating an organisation account on a subscription-based service, storing a
  long-lived secret on a server, and sending organisation data to a third party — cost and risk
  with no product-metadata benefit.

**Conclusion:** OpenMRP is not used, no key is stored, and no request is made. Do not add it
without a new product requirement, an organisation account, server-side secret storage, and a
fresh review of the then-current terms. For this app's purpose it is the wrong category of
service.

### Sources

Reviewed 24 October 2026:

- Open Food Facts terms: <https://world.openfoodfacts.org/terms-of-use>
- Open Food Facts API documentation: <https://openfoodfacts.github.io/openfoodfacts-server/api/>
- Open Food Facts data and licences: <https://world.openfoodfacts.org/data>
- ODbL 1.0: <https://opendatacommons.org/licenses/odbl/1.0/>
- DbCL 1.0: <https://opendatacommons.org/licenses/dbcl/1.0/>
- CC BY-SA 3.0: <https://creativecommons.org/licenses/by-sa/3.0/deed.en>
- OpenMRP terms: <https://openmrp.ai/terms-of-service>
- OpenMRP privacy policy: <https://openmrp.ai/privacy-policy>
- OpenMRP API repository and authentication notes: <https://github.com/open-mrp/api>
- OpenMRP first-request guide: <https://docs.openmrp.ai/api-request>

## Deploying cheaply

The build is a static site plus two optional stateless Cloudflare Pages Functions:

```text
functions/api/off-search.js   -> /api/off-search?q=...
functions/api/off-product.js  -> /api/off-product?barcode=...
public/_headers               -> CSP and security headers
```

### GitHub Pages

The repository includes `.github/workflows/deploy.yml`. On every push to `main` it installs,
tests, builds, and publishes `dist/` with the official GitHub Pages actions.

1. Open **Settings → Pages** and set **Source** to **GitHub Actions**. The workflow also asks
   GitHub to enable Pages on its first run.
2. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.
3. The site appears at <https://sam-ds.github.io/pantry-rhythm/>.

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so the same `dist/`
works at a repository subpath or on a custom domain.

**Open Food Facts on GitHub Pages:** GitHub Pages cannot run the two Cloudflare Functions.
The client detects the missing proxy and falls back to direct Open Food Facts requests, then to
manual entry. Barcode lookup works because the product API allows browser CORS. Free-text
search is best-effort: the fast search service does not send CORS headers, and the legacy
`cgi/search.pl` endpoint is intermittently unavailable. When that happens the app explains the
limitation and offers an Open Food Facts search link plus manual entry. For full search, the
proxy, custom User-Agent, and edge caching, deploy the `functions/` folder to Cloudflare Pages
instead. Household data never reaches either static host.

### Cloudflare Pages

1. Push this folder to a Git repository.
2. Create a Pages project with build command `npm run build` and output directory `dist`.
3. Pages picks up `functions/` automatically; no bindings, secrets, or database are needed.
4. Update the User-Agent contact string in `functions/api/*.js` and `vite.config.ts` to a real
   project/contact URL before public traffic.
5. Review the current Open Food Facts terms and rate limits before high-volume or commercial use.

Any static host works too. Without the Functions, the client attempts the public OFF APIs
directly; browser CORS may block search on some hosts, in which case the app explains the
problem and manual entry still works.

## How the estimate works

For completed cycles (ended because the item **ran out**):

```text
days per unit = days between purchase and run-out / quantity
```

- 0 completed cycles: initial duration, range ±30%, confidence "no history".
- 1–2 cycles: median days-per-unit, wide range, confidence "limited history".
- 3+ cycles: median days-per-unit, narrower range, confidence "your pattern".
- Current cycle can be manually pinned, labelled "manual".
- Early restocks are excluded from consumption history.
- Dates are planning aids, not promises. The calculation has not been validated against
  real-world usage at scale; correct it as your household changes.

## Project layout

```text
src/
  App.tsx                 navigation, modal state, import/share handling
  lib/prediction.ts       restock estimate, confidence, due counts
  lib/repository.ts       Dexie/IndexedDB CRUD, validation, import, demo data
  lib/share.ts            compressed Base64URL share codec, QR size guard
  lib/openfoodfacts.ts    OFF search/barcode client, cache, cooldown, fallback
  views/                  Dashboard, Pantry, Add, ItemDetail, Share, About
  components/             shell, modals, scanner, thumbnails, toasts
  styles.css              mobile-first styling and responsive layout
functions/api/            stateless Cloudflare Pages proxies
```

## Known limitations

- Estimates are unvalidated and depend on honest run-out records.
- Browser barcode scanning is not available in Safari/Firefox today; manual barcode entry is.
- Camera scanning requires HTTPS (or localhost).
- IndexedDB is per browser profile; it does not sync between devices.
- Share payloads can grow beyond reliable QR capacity; the app falls back to the link/JSON.
