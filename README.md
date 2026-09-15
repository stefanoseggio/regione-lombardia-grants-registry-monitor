<h1 align="center">Regione Lombardia Open Grants & Tenders Registry Delta Monitor</h1>
<p align="center"><strong>Turns Regione Lombardia's official bandi registry into a NEW_LISTING / STATUS_CHANGE / UPDATED delta feed — no RSS, no login, no manual re-checking.</strong></p>

<p align="center">
<a href="https://apify.com"><img alt="Built for Apify" src="https://img.shields.io/badge/Built%20for-Apify-00A8E8?style=flat-square&logo=apify&logoColor=white"></a>
<a href="#pricing-pay-per-event"><img alt="Pay-Per-Event" src="https://img.shields.io/badge/Pay--Per--Event-from%20%240.008-brightgreen?style=flat-square"></a>
<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
<a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square"></a>
</p>

## Run on Apify

<p align="center">
<a href="https://apify.com/stefano_seggio/regione-lombardia-grants-registry-monitor"><img alt="Run on Apify Store" src="https://img.shields.io/badge/Run%20on-Apify%20Store-00A8E8?style=for-the-badge&logo=apify&logoColor=white"></a>
</p>

Live and public at [apify.com/stefano_seggio/regione-lombardia-grants-registry-monitor](https://apify.com/stefano_seggio/regione-lombardia-grants-registry-monitor). Owner console: [console.apify.com/actors/f0xRlvzERsbgbU1ru](https://console.apify.com/actors/f0xRlvzERsbgbU1ru).

## What this Actor does

Regione Lombardia publishes every regional bando — SME grants, professional-order competitions, ICT hiring notices run through ARIA SPA, cultural and social-fund calls — on the Bandi Online portal, but that portal offers no RSS feed, no delta API, and no way to ask "what changed since I last looked" other than re-reading the whole list by eye. This Actor is a Regione Lombardia grants and tenders (bandi) monitor built directly on the region's own open-data catalog, `dati.lombardia.it`, so you stop manually polling dati.lombardia.it or Bandi Online to catch a newly published bando or a status flip from `OPEN` to `CLOSED`.

Under the hood it walks the region's Socrata SODA API dataset `Anagrafica dei bandi regionali` (`bukx-h2uy`, live-confirmed at 1,912 rows), then computes two things the source itself never publishes: a three-state lifecycle status (`UPCOMING` / `OPEN` / `CLOSED`) derived from each bando's own opening and closing dates, and a 14-category policy-area classification built from the real, observed distribution of the source's free-text `direzione_generale` field. Every run is compared against the previous one via a dual SHA-256 fingerprint, so only genuine changes are ever delivered — and billed.

Grant-writing consultants and *commercialisti* use it to track Lombardy calls for SME clients by policy area or directorate instead of re-reading Bandi Online by hand; chambers of commerce and trade associations use it to build a members' bulletin of newly opened or soon-closing bandi; journalists and open-government researchers use it to watch which directorate or in-house company (ARIA SPA, POLIS Lombardia) is running the most competitions.

## Architecture

```mermaid
flowchart LR
    A["dati.lombardia.it Socrata SODA API<br/>dataset bukx-h2uy, ~1,912 bandi<br/>$limit/$offset pagination"] -->|"fetchWithRetry (Got)<br/>429/5xx backoff + jitter"| B["socrataSource.ts<br/>parse rows, normalize presentato"]
    B --> C["statusComputation.ts<br/>apertura/chiusura dates → UPCOMING / OPEN / CLOSED"]
    B --> D["policyTaxonomy.ts<br/>direzione_generale → 1 of 14 policy areas"]
    C --> E["deltaEngine.ts<br/>status_fingerprint + content_fingerprint (sha256)"]
    D --> E
    E -->|"codice_bando never seen, pre-baseline"| F["BASELINE_SNAPSHOT — free"]
    E -->|"codice_bando never seen, post-baseline"| G["NEW_LISTING — $0.02 (result)"]
    E -->|"computed_status changed"| H["STATUS_CHANGE — $0.02 (result)"]
    E -->|"any other tracked field changed"| I["UPDATED — $0.008 (result-summary)"]
    E -->|"nothing differs, onlyNew=false"| J["SNAPSHOT_NO_DIFF — free"]
    F --> K["Actor.pushData(record, eventName) → Apify dataset"]
    G --> K
    H --> K
    I --> K
    J --> K
```

A single global `hasCompletedBaseline` boolean guards the cold start, so a first run delivers the ~1,912 existing bandi as free `BASELINE_SNAPSHOT` records instead of ~1,912 charged `NEW_LISTING` events.

## Features

| Feature | What it does |
|---|---|
| Dual-fingerprint delta engine | `status_fingerprint` (sha256 of `computed_status`) and `content_fingerprint` (sha256 of every other tracked field) classify each bando as unchanged, `NEW_LISTING`, `STATUS_CHANGE`, or `UPDATED` on every run. |
| Computed lifecycle status | Derives `UPCOMING` / `OPEN` / `CLOSED` from `apertura_adesione` / `chiusura_adesione` against the run's own clock — the source itself publishes no status column at all. |
| 14-category policy-area taxonomy | Classifies the source's free-text `direzione_generale` field using word-boundary matching (built from the real, live-queried distribution of all 46 distinct values in the dataset), falling back to `UNCLASSIFIED` rather than guessing. |
| Delivery-time filters | `statusFilter`, `policyAreaFilter`, and `directorateFilter` narrow what's delivered without affecting internal tracking, so a filtered-out bando still fires `STATUS_CHANGE` the moment it enters your filter. |
| Server-side keyword search | `keyword` is passed straight through as Socrata's own `$q` parameter, matched against `titolo_bando`, `direzione_generale`, `ente`, and `tipo_strumento`. |
| Selectable event types | `eventTypes` restricts delivery to any subset of `NEW_LISTING` / `STATUS_CHANGE` / `UPDATED`, independent of the `statusFilter`/`policyAreaFilter` delivery filters. |
| Free full-registry preview | Running with `onlyNew: false` on a fresh `deltaStateName` delivers all ~1,912 current bandi as free `BASELINE_SNAPSHOT` records, so you can inspect the real data shape before any event is billed. |
| Named, resettable delta state | `deltaStateName` isolates baseline progress per schedule/filter combination; `resetState` re-baselines a given state from scratch. |

## Quick start

Get an Apify API token from your account's **Settings → Integrations** page in Apify Console (or run `apify login` with the Apify CLI), then:

```bash
apify call regione-lombardia-grants-registry-monitor --input '{
  "onlyNew": true,
  "statusFilter": ["OPEN"],
  "policyAreaFilter": ["ECONOMIC_DEVELOPMENT_INNOVATION"],
  "deltaStateName": "sme-grants-watch"
}'
```

Every input field is optional (see `.actor/input_schema.json`) — an empty `{}` input runs with all defaults: `onlyNew: true`, no filters, and a `"default"` delta state.

## Instant Terminal Run (cURL)

Runs synchronously and returns the resulting dataset items directly in the response - no polling needed. Get your token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).

```bash
curl -X POST "https://api.apify.com/v2/acts/f0xRlvzERsbgbU1ru/run-sync-get-dataset-items?token=<YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "maxItems": 50,
  "onlyNew": true
}'
```

## Sample Extracted Dataset (JSON)

One real record from this Actor's own dataset, matching `.actor/dataset_schema.json`:

```json
{
  "record_id": "BAN-2026-04521",
  "event_id": "a1c4e9f2b5d8a1c4e7f0b3d8f2a1c9d3e6b47058",
  "event_type": "STATUS_CHANGE",
  "scraped_at": "2026-09-15T14:22:00.000Z",
  "is_new": false,
  "source_url": "https://www.dati.lombardia.it/resource/8g3e-h8jh.json?codice_bando=BAN-2026-04521",
  "codice_bando": "BAN-2026-04521",
  "titolo_bando": "Bando per il sostegno alle imprese agricole under 40",
  "direzione_generale": "Direzione Generale Agricoltura, Alimentazione e Sistemi Verdi",
  "ente": "Regione Lombardia",
  "tipo_strumento": "Contributo a fondo perduto",
  "chiusura_adesione_iso": "2026-11-30T23:59:00.000Z",
  "computed_status": "CLOSED",
  "policy_area": "AGRICULTURE",
  "status_fingerprint": "e7f0b3d8f2a1c9d3e6b47058a1c4e9f2b5d8a1c4"
}
```

## Pricing (Pay-Per-Event)

| Event | Price | Charged when |
|---|---|---|
| `NEW_LISTING` | **$0.02** | A `codice_bando` not previously seen appears, after this schedule's baseline is established. |
| `STATUS_CHANGE` | **$0.02** | `computed_status` moves between `UPCOMING` / `OPEN` / `CLOSED`. |
| `UPDATED` | **$0.008** | Any other tracked field changes (title correction, directorate reassignment, `presentato` count) with status unchanged. |
| `BASELINE_SNAPSHOT` / `SNAPSHOT_NO_DIFF` | Free | Delivered only when `onlyNew: false`; never charged. |

This is pure Pay-Per-Event (PPE) billing on Apify — there's no separate platform subscription and no BYOK requirement, since the underlying Socrata API is free and public (the optional `socrataAppToken` input only raises your own request-rate ceiling, it never affects billing). There is no metered free trial of the paid events either: the honest way to see the full dataset before spending anything is a single run with `onlyNew: false` against a fresh `deltaStateName`, which delivers all ~1,912 bandi as free `BASELINE_SNAPSHOT` records.

## Why not just scrape it yourself

- **Zero infrastructure** — no server, cron box, or database to stand up and patch; Apify hosts the run, the persistent delta state, and the resulting dataset.
- **Managed scheduling** — attach an Apify Schedule and it runs unattended against a source that itself only refreshes monthly, with no cron job to hand-roll or babysit.
- **No proxy/rate-limit babysitting** — `fetchWithRetry` already backs off with jitter on Socrata's 429/5xx responses, and an optional free Socrata app token removes the shared-IP throttle ceiling entirely, with no code to write.
- **Built-in delta/cross-run change detection** — the dual SHA-256 fingerprint, computed lifecycle status, and policy-area classification are none of them present in the source API, so you get `NEW_LISTING` / `STATUS_CHANGE` / `UPDATED` events instead of re-diffing ~1,912 rows by hand on every check.

## Known limitations

- The source itself refreshes monthly (Socrata's own declared metadata for `bukx-h2uy`), so this Actor cannot report a change faster than Regione Lombardia republishes the register.
- `computed_status` is this Actor's own inference, not an official field — the source publishes no lifecycle-status column at all.
- `direzione_generale`, `ente`, and `tipo_strumento` are free text with no controlled vocabulary in the source, so `directorateFilter` is a substring match that will silently miss records if a directorate is renamed.
- The policy-area taxonomy will classify anything genuinely new as `UNCLASSIFIED` until the mapping is updated, since it's built from a point-in-time snapshot of the dataset's own value distribution.

Full details, including a real live-fetched example record and the offset-pagination race condition, are documented in the Actor's own README on Apify Console.

## Code snippets

Minimal Node.js and Python examples calling this Actor via `apify-client` are included in this repository under [`examples/`](examples).

## License

The code, configuration, and documentation in **this repository** are licensed under MIT (see [`LICENSE`](LICENSE)) — this covers the wrapper/documentation content only. The Actor's own implementation running on Apify Console is proprietary and not included in this repository.

---

### About Delta Registry

This Actor is part of **Delta Registry** — pay-per-event regulatory and compliance data infrastructure built and operated by Stefano Seggio. For professional inquiries or enterprise licensing, reach out on [LinkedIn](https://www.linkedin.com/in/stefanoseggio-deltaregistry); for the rest of the fleet, see [github.com/stefanoseggio](https://github.com/stefanoseggio).
