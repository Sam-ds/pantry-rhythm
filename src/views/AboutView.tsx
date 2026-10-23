import {
  ArrowUpRight,
  BookOpen,
  CloudOff,
  Database,
  ExternalLink,
  Fingerprint,
  Gauge,
  HeartHandshake,
  Info,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { offAttribution } from '../lib/openfoodfacts'

export function AboutView() {
  return (
    <div className="page about-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">About Pantry Rhythm</p>
          <h1>Useful, honest, and yours</h1>
          <p className="page-subtitle">
            A small household tool for finding a calmer pantry rhythm — with no cloud account
            and no guesswork about where your data lives.
          </p>
        </div>
      </header>

      <div className="about-grid">
        <div className="about-main">
          <section className="panel about-section">
            <div className="about-section-heading">
              <span className="about-icon">
                <Gauge size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">The estimate</p>
                <h2>How restock dates are calculated</h2>
              </div>
            </div>
            <p>
              When you mark an item as <strong>ran out</strong>, Pantry Rhythm records how many
              days passed since that purchase and how many units were bought. It turns those
              cycles into days per unit, uses the median across completed cycles, and multiplies
              by the quantity in your current purchase.
            </p>
            <div className="formula-card">
              <span>Restock date</span>
              <strong>purchase date + quantity × median days per unit</strong>
            </div>
            <ul className="about-list">
              <li>
                <strong>No completed cycles.</strong> The date uses your initial duration with a
                deliberately wide range.
              </li>
              <li>
                <strong>One or two cycles.</strong> It says “limited history” and keeps a wide
                possible range.
              </li>
              <li>
                <strong>Three or more cycles.</strong> It says “your pattern” and narrows the
                range — but never calls the date accurate.
              </li>
              <li>
                <strong>Early restocks</strong> are kept in history but are excluded from the
                calculation because they don't show how long the item actually lasted.
              </li>
              <li>
                <strong>You can override</strong> the current cycle's estimate at any time. A
                correction is labelled clearly.
              </li>
            </ul>
            <div className="honest-note">
              <Info size={18} aria-hidden="true" />
              <p>
                This first version has not been validated against real household usage at scale.
                Treat every date as a rough planning estimate, not a promise. Your records are
                most useful when you correct them as real life happens.
              </p>
            </div>
          </section>

          <section className="panel about-section">
            <div className="about-section-heading">
              <span className="about-icon">
                <LockKeyhole size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Privacy</p>
                <h2>Where your household data lives</h2>
              </div>
            </div>
            <div className="privacy-points">
              <article>
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <h3>No account or server database</h3>
                  <p>
                    Items, purchases, notes, and estimates are stored in IndexedDB inside this
                    browser. Pantry Rhythm has no sign-in, cloud sync, analytics, or advertising
                    tracker.
                  </p>
                </div>
              </article>
              <article>
                <CloudOff size={19} aria-hidden="true" />
                <div>
                  <h3>Household history is never sent with a product lookup</h3>
                  <p>
                    Search terms and barcode numbers are sent to Open Food Facts when you choose
                    to look something up. Your purchase dates, notes, quantities, and household
                    name are not included. Product images load from Open Food Facts.
                  </p>
                </div>
              </article>
              <article>
                <Fingerprint size={19} aria-hidden="true" />
                <div>
                  <h3>No one else can see it by default</h3>
                  <p>
                    There is no shared server copy. A person using this browser profile could see
                    the data, so use a device passcode if the device is shared.
                  </p>
                </div>
              </article>
              <article>
                <ExternalLink size={19} aria-hidden="true" />
                <div>
                  <h3>Sharing is explicit</h3>
                  <p>
                    A share link or QR encodes a copy of your household data. The payload is
                    compressed, not encrypted. Anyone who has it can read it. The data is placed
                    after <code>#</code> in the URL, so it is not sent to the static hosting
                    server, but it may appear in browser history.
                  </p>
                </div>
              </article>
            </div>
            <p className="about-fineprint">
              Browser storage can be removed by clearing site data or by device cleanup. Keep a
              JSON backup from the Share page. The optional search proxy is stateless: it only
              forwards the search query and receives public product data in response.
            </p>
          </section>

          <section className="panel about-section">
            <div className="about-section-heading">
              <span className="about-icon">
                <Database size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Open data</p>
                <h2>Open Food Facts attribution</h2>
              </div>
            </div>
            <div className="off-attribution-card">
              <div>
                <h3>Open Food Facts</h3>
                <p>
                  Product search and barcode lookup use Open Food Facts, a collaborative,
                  open food database run by a non-profit. Pantry Rhythm is not affiliated with
                  Open Food Facts and does not endorse or verify every product record.
                </p>
              </div>
              <span className="off-mark" aria-hidden="true">
                OFF
              </span>
            </div>
            <div className="license-grid">
              <div>
                <strong>Database</strong>
                <span>{offAttribution.dataLicense}</span>
                <a href={offAttribution.licenseUrl} target="_blank" rel="noreferrer">
                  License <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
              <div>
                <strong>Product images</strong>
                <span>{offAttribution.imageLicense}</span>
                <a href={offAttribution.dataUrl} target="_blank" rel="noreferrer">
                  Data source <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
              <div>
                <strong>API use</strong>
                <span>Public service, best effort</span>
                <a href={offAttribution.termsUrl} target="_blank" rel="noreferrer">
                  Terms <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
            </div>
            <p className="about-fineprint">
              Product data is displayed with source links and attribution. The real-time Open
              Food Facts API is free but rate-limited and not guaranteed. The app is designed to
              keep working without it: every lookup has a manual fallback. Open Food Facts terms
              and licences were reviewed on 24 October 2026; high-volume or commercial use needs
              its own review. OpenMRP is an ERP, not a product catalogue, and is not used here.
            </p>
            <div className="link-row">
              <a href={offAttribution.dataUrl} target="_blank" rel="noreferrer">
                <BookOpen size={15} aria-hidden="true" /> Open Food Facts data
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
              <a href={offAttribution.searchLicenseUrl} target="_blank" rel="noreferrer">
                <Sparkles size={15} aria-hidden="true" /> Open source search project
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </section>

          <section className="panel about-section">
            <div className="about-section-heading">
              <span className="about-icon">
                <CloudOff size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Resilience</p>
                <h2>When product lookup is unavailable</h2>
              </div>
            </div>
            <p>
              Search and barcode lookup depend on a public API. If Open Food Facts is down, slow,
              rate-limited, or blocked on your network, the app explains the problem and offers
              manual entry. Manual items keep their barcode if you have one and work fully
              offline once entered.
            </p>
            <p>
              Camera barcode scanning decodes frames on your device. It uses the browser's built-in
              Barcode Detection API where available, and a bundled open-source decoder (ZXing)
              everywhere else, including iPhone Safari and Chrome. Frames are never uploaded. If
              the camera is unavailable, enter the barcode by hand.
            </p>
          </section>
        </div>

        <aside className="about-aside">
          <section className="about-card">
            <HeartHandshake size={22} aria-hidden="true" />
            <h2>Built to stay small</h2>
            <p>
              A static front end and local database keep hosting inexpensive. There is no
              server-side household data to secure or back up.
            </p>
          </section>
          <section className="about-card about-card-warm">
            <Info size={22} aria-hidden="true" />
            <h2>Version 0.1</h2>
            <p>
              This is an early, deliberately small release focused on manual entry, purchase
              history, and correction-friendly restock estimates.
            </p>
          </section>
          <section className="about-card about-card-green">
            <LockKeyhole size={22} aria-hidden="true" />
            <h2>Your next step</h2>
            <p>
              Add a few items, record real run-outs for two weeks, and then judge whether the
              estimates match your household. Correct them as you learn.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
