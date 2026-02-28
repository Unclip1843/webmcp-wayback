# webmcp-wayback

Wayback Machine-style UI for browsing, searching, and comparing website capability maps over time.

Works with data produced by [webmcp-mapper](https://github.com/Unclip1843/webmcp-mapper).

## Quick Start

```bash
git clone https://github.com/Unclip1843/webmcp-wayback.git
cd webmcp-wayback
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Requirements

- Node.js >= 22

## Usage

```bash
# Start the server (default port 3000, reads from .webmcp/)
node dist/cli.js serve

# Custom port and data directory
node dist/cli.js serve --port 4200 --data /path/to/data
```

### Data Directory

The server reads from a data directory (default: `.webmcp/`) with this structure:

```
.webmcp/
  sites/
    <site-id>/
      versions/
        v1/
          analysis/
            sitemap.json    # capability map produced by webmcp-mapper
          screenshots/      # optional page screenshots
          html/             # optional captured HTML for mirror view
        v2/
          ...
```

Point `--data` at your webmcp-mapper output directory.

## Features

- **Site Library** — browse, search, filter, and sort all mapped sites
- **Capability Browser** — explore capabilities by type, page, or search
- **Screenshot Gallery** — visual snapshots with lightbox viewer
- **Site Mirror** — rendered HTML capture with structure view
- **Timeline** — scrubable version history with change tracking
- **Trends** — per-site analytics with charts over time
- **Network** — categorized network request analysis
- **Visual Diff** — side-by-side, slider, and onion skin screenshot comparison
- **API Explorer** — discovered API endpoints with request/response shapes
- **Global Insights** — aggregate analytics across all sites
- **Keyboard Shortcuts** — `Cmd+K` search, `g s` sites, `g a` analytics, `?` help

## Development

```bash
npm run dev    # watch mode — recompiles TypeScript on change
npm start      # run the built server
```

The frontend is zero-dependency vanilla JS in `public/`. No build step needed for frontend changes — just refresh the browser.

## License

MIT
