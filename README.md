<p align="center">
<img src="/assets/logo.png" alt="ExpenseOwl Logo" width="200" height="200" /><br>
</p>

<h1 align="center">ExpenseOwl</h1><br>

<p align="center">
<a href="https://github.com/davycools/expenseowl/actions/workflows/release.yml"><img src="https://github.com/davycools/expenseowl/actions/workflows/release.yml/badge.svg" alt="Release"></a>&nbsp;<a href="https://github.com/DavyCools/expenseowl/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/davycools/expenseowl"></a>&nbsp;<a href="https://hub.docker.com/r/davy123/expenseowl"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/davy123/expenseowl"></a>
</p>

<p align="center">
<a href="#features">Features</a>&nbsp;&bull;&nbsp;<a href="#installation">Installation</a>&nbsp;&bull;&nbsp;<a href="#usage">Usage</a>
</p>

<br>

<p align="center">
<b>ExpenseOwl</b> is an extremely simple self-hosted expense tracking system with a modern monthly pie-chart visualization and cashflow showcase.
</p>

<br>

<b>Forked from <a gref="https://github.com/Tanq16/ExpenseOwl">Tanq16/ExpenseOwl v4.7</a>, substantially modified</b>

# Features

### Core Functionality

- Quick expense/income add (only date, amount, and category are required)
- Single-user focused (mainly for a home lab deployment)
- Recurring transactions for both income and expenses
- Custom categories, currency symbols, and start date via app settings
- Optional tags for further classification
- Beautiful interface with both light and dark themes
- Self-contained binary and container image to ensure no internet interaction
- Multi-architecture Docker container with support for persistent storage
- PWA support for using the app on smartphone

### Visualization

1. Main dashboard - category breakdown (pie chart) and cashflow indicator
    - Click on a category to exclude it from the pie chart; click again to add it back
    - Visualize the month's breakdown without considering some categories like Rent
    - Cashflow shows total income, total expenses, and balance (red or green based on +ve or -ve)
    - Category and tag amounts show net spending, with an expense/income breakdown when both are present; the legend includes income-only categories
    - Pie slices use positive net spending; category percentages use gross expenses and tag percentages use the category's positive net spending
    - Disabling a category removes it from pie slices and legend totals and dims its tags, while cashflow continues to show all selected transactions
    - Category and tag legend amounts show net spending; when both expenses and income occur, the gross expense/income split is shown beside the net amount
    - The legend total covers the displayed, enabled expense categories, including their refunds; pie slices remain based on gross expenses, while tag percentages use the category's net spending
2. Table view for detailed expense listing
    - View monthly, yearly, or all expenses chronologically, edit them, and delete them (hold shift to skip confirm)
    - Filter by name, category, tags, amount, or date; category and tag dropdowns support multiple selections with exact category matches and any selected tag
    - Tags show up if at least one transaction uses it; 
3. Future transaction visibility
    - Chart and table views initially include transactions through today in your browser's local timezone
    - Enable the "Future transactions" switch below date navigation to include planned income and expenses in the selected monthly, yearly, or all-transactions view and its totals
    - Settings lets you hide/show the switch and choose whether future transactions are included by default, independently
    - These settings are saved for the app across devices; changing the switch in a view only affects that page until it is reloaded
    - Future recurring and manually added transactions remain stored and can be edited or deleted when shown; exports are unchanged
4. Settings page for configurations and additional features
    - Reorder, add, or remove custom categories
    - Select a custom currency symbol and a custom start date
    - Exporting data as CSV and import CSV from virtually anywhere

### Progressive Web App (PWA)

The front end of ExpenseOwl can be installed as a Progressive Web App on desktop and mobile devices (i.e., the back end still needs to be self-hosted). To install:

- Desktop: Click the install icon in your browser's address bar
- iOS: Use Safari's "Add to Home Screen" option in the share menu
- Android: Use Chrome's "Install" option in the menu

# Installation

The recommended installation method is Docker. To run the container via CLI, use the following command:

```bash
docker run --rm -d \
  --name expenseowl \
  -p 8080:8080 \
  -v expenseowl:/app/data \
  davy123/expenseowl:latest
```

To use Docker compose, use this YAML definition:

```yaml
services:
  expenseowl:
    image: davy123/expenseowl:latest
    restart: unless-stopped
    ports:
      - 5006:8080 # change 5006 to what you want to expose on
    volumes:
      - /home/tanq/expenseowl:/app/data # change dir as needed
```

<details>
<summary>Expand this to see additional execution options</summary>

### Using the Binary or Building from Source

Download the appropriate binary from the project releases. The binary automatically sets up a `data` directory in your CWD, and starts the app at `http://localhost:8080`.

To build the binary yourself:

```bash
git clone https://github.com/DavyCools/expenseowl.git && \
cd expenseowl && \
go build ./cmd/expenseowl
```

### Kubernetes Deployment

This is a community-contributed Kubernetes spec. Treat it as a sample and review before deploying to your cluster. Read the [associated readme](./kubernetes/README.md) for more information.

</details>

# Development

The frontend uses plain HTML, CSS, and JavaScript modules; no frontend build step is required.

- [Page controllers](internal/web/templates/pages) compose the dashboard, table, and settings views.
- [Components](internal/web/templates/components) keep related HTML templates, JavaScript behavior, and CSS together.
- [Shared utilities](internal/web/templates/shared) contain date/currency helpers, DOM utilities, messages, and base styling.
- Go composes the embedded HTML fragments before serving each page. Dynamic rows and lists clone HTML `<template>` elements and populate their values in JavaScript.
- Third-party assets, the service worker, theme script, and icons retain their existing root paths.

Run from the repository root with `go run ./cmd/expenseowl`. Since frontend assets are embedded in the binary, restart/rebuild after editing them.

For automatic rebuilding, install [Air](https://github.com/air-verse/air) with `go install github.com/air-verse/air@latest`, then run `air -c .air.toml`. The configuration watches Go, HTML, JavaScript, CSS, and JSON files, excluding temporary builds, stored data, tests, and node_modules. For automatic browser refresh, run `air -c .air.toml -proxy.enabled true -proxy.app_port 8080 -proxy.proxy_port 8090` and open `http://localhost:8090`.

Tests live separately from application components:

```powershell
go test ./...
npm ci
npm test
```

Frontend DOM tests live under [tests/frontend](tests/frontend) and use Node.js 22 or newer. Install dependencies from the repository root using [package.json](package.json): i18next is an application dependency, while jsdom is a test-only development dependency. Node/npm is not needed to run the app; the pinned i18next ES module is embedded alongside the frontend and imported directly without a global variable.

### Translations

English is the default application language. Settings offers English and Nederlands; the saved `language` preference applies to all browsers. Saving reloads Settings, so save any other edits first. Other open pages adopt the language on their next reload. Month names are translated, while existing numeric date and currency formats are preserved.

The shared [JSON catalogs](internal/localization/locales) supply both Go-rendered HTML and JavaScript messages. [i18next](https://www.i18next.com/) handles browser interpolation and plurals through the [shared wrapper](internal/web/templates/shared/i18n.js). Its assets are served locally, not from a CDN.

If a required catalog cannot be loaded, the page keeps its server-rendered language, shows a translated reload message, and stops interactive initialization rather than mixing languages. Missing individual keys still use the English fallback and emit a diagnostic.

To add a language:

1. Copy `en.json` to a new locale file, such as `fr.json`, under `internal/localization/locales`.
2. Set its `code` to the filename stem, `name` to the native language name, and `locale` to the appropriate Intl locale (for example, `fr-FR`).
3. Translate every entry in `translation`, keeping semantic keys and named `{{parameters}}` intact. Use complete sentences, not translated sentence fragments. Language-specific plural variants use i18next's `_one`, `_other`, and other CLDR suffixes.
4. Run the Go and frontend tests above, then rebuild/restart the app. Embedded catalogs are discovered automatically and appear in the selector; no component changes or database migration are required. Tests reject missing keys and mismatched interpolation parameters.

For new UI text, add a semantic key to every catalog. HTML uses the page context's `T` method; JavaScript uses `t(key, parameters)` after `initI18n()`. Populate text with `textContent` or attributes, never translation-generated HTML. Public API errors expose stable `code`/`params` values for translation while retaining the English `error` field for existing clients. Developer diagnostics stay in logs.

User-entered transaction/category/tag names (including editable seeded categories), brand names, currency codes, and CSV headers/filenames are not translated or rewritten. Native date pickers, file choosers, and alert buttons follow browser/OS language; app-provided labels, validation messages, and alert text follow the saved app language.

The i18next version is pinned in [the root package manifest](package.json). After updating it, run `npm install`, then `npm run vendor` from the repository root. The [vendor script](scripts/vendor.cjs) copies the self-contained ES module and license into the embedded vendor directory; no bundler or CDN is needed. Commit the resulting asset and lockfile changes and rerun the suites. Normal application builds require no npm step.

# Usage

Once deployed, use the web interface to do everything. Access it through your browser:

- Dashboard: `http://localhost:8080/`
- Table View: `http://localhost:8080/table`
- Settings: `http://localhost:8080/settings`

> [!NOTE]
> This app does not include authentication, so deploy carefully. I don't want to add half-baked authentication, so use Authelia, or equivalent as needed. ExpenseOwl works well with a reverse proxy like Nginx Proxy Manager too and is intended for homelab use only.

### Configuration Options

With the exception of [Data backends](#data-backends), all configuration of ExpenseOwl happens via the application UI. The list of all such options available via the settings page (`/settings` endpoint) is as follows:

- Category Settings:
- Currency Symbol:
  - This is a frontend symbol configuration on what symbol to use to show amount values
  - Each currency has its default behavior for using `,` or `.` as separators (and if it uses decimals or not)
- Start Date:
  - This is a custom day of the month from when the expenses will be displayed
  - Example: setting it to 5 means, expenses for each month will be counted from 5th to next month's 4th
- Recurring Transactions:
  - A recurring transaction can be for an expense or an income (gain)
  - Given a value for number of occurences and a start date, the app will add the transactions accordingly
  - Recurring transactions will be listed at the bottom of the page and can be edited/removed (all or future only transactions)
  - Recurring transactions allow similar options as normal expenses - category, tags, amount, name
- Theme Settings: supports light and dark theme, with default behavior to adapt to system
- Language: English (default) or Nederlands, saved in both JSON and PostgreSQL configuration; shared across browsers
- Future Transactions:
  - Saved config keys: `showFutureTransactions` and `includeFutureTransactions`
  - Show or hide the future transactions switch on the chart and table (shown by default)
  - Include or exclude future transactions by default (excluded by default), even when the switch is hidden
- Import/Export Data: covered under [Data Import/Export](#data-importexport)

### Data Backends

ExpenseOwl supports two data backends - JSON (default), and Postgres. Postgres was added with v4.0 of the app primarily for homelabbers to reuse their Postgres instances as needed for better backup compatibility.

Ideally, you need not configure anything differently for the JSON backend. ExpenseOwl automatically creates the data directory and the `.json` files. You may, however, want to mount a specific volume to `/app/data` within the container for persistence.

For configuring Postgres, use the following environment variables:

| Variable | Sample Value | Details |
| --- | --- | --- |
| STORAGE_TYPE | postgres | defaults to `json`, hence JSON backend is default |
| STORAGE_URL | "localhost:5432/expenseowldb" | format - SERVER/DB - the sslmode value is set by the next variable |
| STORAGE_SSL | require | can be one of `disable` (default), `verify-full`, `verify-ca`, or `require` |
| STORAGE_USER | testuser | the user to authenticate with your Postgres instance |
| STORAGE_PASS | testpassword | the password for the Postgres user |

The app has been tested with SSL mode for Postgres set to disable for simplicity.

> [!TIP]
> The environment variables can be set for using `-e` in the command line or `environment` in a compose stack.

> [!TIP]
> Having learnt more Go, I introduced the Storage interface in v4.0, making it easy to add any storage backend by simply implementing the interface.

### Data Import/Export

ExpenseOwl is meant to make things simple, and importing CSV abides by the same philosophy. ExpenseOwl will accept any CSV file as long as it contains the columns - `name`, `category`, `amount`, and `date`. This is case-insensitive so `name` or `Name` doesn't matter.

> [!TIP]
> This feature allows ExpenseOwl to use exported data from any tool as long as the required categories are present, making it insanely easy to shift from any provider.

> [!WARNING]
> The recommended format for the date is RFC3339. Additionally, ExpenseOwl can ingest several other time formats, including a short, human written date like `2012/8/14` (14th August 2012).
> HOWEVER !!!
> ExpenseOwl only ingests date in YYYY-MM-DD (this order). ExpenseOwl does NOT deal with MM/DD or DD/MM. Full 4 digit year comes first, followed by month, and lastly the date.

> [!NOTE]
> ExpenseOwl goes through every row in the imported data, and will intelligently fail on rows that have invalid or absent data. There is a 10 millisecond delay per record to reduce disk/db overhead, so please allow appropriate time for ingestion (eg. ~10 seconds for 1000 records).

Data exported as CSV will include expense IDs, so when importing the same CSV file, IDs will be maintained and skipped appropriately.