# ÆTHER education site (aethera2.com)

Static HTML/CSS/JS, no build step. Hosted on Vercel (team `aether4`, project `aether-site`).

## Deploy
- **Pushing to `main` auto-deploys** (~30–60s). No CLI step needed.
- Production host is **www.aethera2.com**. The bare `aethera2.com` 307-redirects to www, so verify with `curl -L` or curl www directly.
- Commit as `strangmatt <strangm@umich.edu>` (`git config user.name strangmatt; git config user.email strangm@umich.edu`).
- This GitHub repo is **public**. Never commit secrets.

## Conventions
- Dark theme (#0a0a0a bg), gold accent #9A7D2E, GeometosRounded font. Shared styles in `assets/substance.css`.
- Canonicals, sitemap.xml and OG tags all use `https://www.aethera2.com`. Add new pages to `sitemap.xml`.
- **CSP in `vercel.json`:** any new external resource (image host, script, font, API) must be added to the Content-Security-Policy allowlist or the browser blocks it. Pages use inline scripts and handlers, so keep `'unsafe-inline'`.
- The Signal contact link lives in `index.html` (`openSignal`) and in the shop repo's `store.html` (`SIGNAL_LINK`). Update both together.
- The "Harm Reduction Store" button links to `aether-shop-aether4.vercel.app` (shop.aethera2.com DNS is not set up).

Related repos: `strangmatt/AETHER-Shop` (store), and the Sanity Studio.

## Two computers — automatic sync
This repo is edited from two machines (LAPTOP and WORK), each with its own Claude. They share `CLAUDE-LOG.md` and `INBOX.md` in the **AETHER-Shop** repo (private).
- `.claude/settings.json` hooks (committed, so both machines get them): **SessionStart** runs `.claude/sync.sh` (pulls every sibling `strangmatt/AETHER*` repo, skips backups, prints INBOX open items + newest log entries). **Stop** runs `.claude/check-unpushed.sh` (flags uncommitted/unpushed work once per turn; it never pushes).
- Hooks only fire when Claude is started **inside a repo folder**. Start site sessions with `cd` into `AETHER-Shop` (or the site repo) then `claude`. Otherwise run `bash <shop>/.claude/sync.sh` by hand first.
- Do INBOX open items, then move them to Done with date + machine. End of session: add a CLAUDE-LOG.md entry, commit, push.
