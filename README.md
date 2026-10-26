# We Love Scripture: the website

This folder is the whole website for **WeLoveScripture.org**, plus a **console** that lets anyone on the team add and edit things without touching code.

## Everyday use

1. **Open the console.** Double-click the launcher for your computer:
   - Mac: `Start Console.command` (first time only: right-click it, then Open)
   - Windows: `start-console.bat`
   - Linux: `./start-console.sh`

   The first time, it installs what it needs (one or two minutes). Your browser then opens the console. You need [Node.js](https://nodejs.org) (the LTS version) installed once.
2. **Write.** Add guides, articles, videos and projects. The editor has buttons for headings, Scripture, and the three guide prompts (*Tell each other*, *Pray together*, *Sit with this*).
3. **Preview.** *Preview the site* shows everything, drafts included.
4. **Publish.** Switch the item to *Published*, then press *Publish to the web*. GitHub builds the site and puts it online in a couple of minutes.

Podcast episodes appear on their own, as picture tiles (the Listen page shows 12 at a time, which you can change in Settings, with older ones on following pages). In the console's *Podcast episodes* screen you can **feature** up to three, which puts them first on the Listen page and the home page: the site reads your Spotify feed every morning and every time you publish.

## Writing guides

The editor has buttons for headings, lists, quotes, links, pictures (paste or drop one straight in), Scripture, and:

- **Tell each other / Pray together / Sit with this**: the three prompts. Each one gets a private note box online and ruled lines in print.
- **Write space**: a question with its own place to answer. Choose how many lines it gets when printed.
- **Callout**: a highlighted aside.

Your work saves itself every few seconds. A guide can be any length. *Focus* hides everything but the writing.

**Readers' notes** are saved only in their own browser, on their own device. Nothing is sent to us. *Print with my notes* puts what they typed onto the ruled lines.

**PDFs:** every guide gets a printable PDF (A4), built automatically when you publish and published with the site. They are not stored in the repository. To skip one, add `pdf: false` to that guide.

## Getting updates

When Claude sends a new zip, open the console, go to **Updates**, and choose the zip. It lists what will change, you press *Apply update*, and the console restarts itself. Your writing, images, settings, menu, counters and domain are never overwritten, and each replaced file is first copied into a `.backups` folder.

## One-time GitHub setup

1. Create an empty repository on GitHub (public is fine). Do not add a README.
2. In the console go to **Publish**, press *Set up Git*, then paste the repository address.
3. Tell Git who you are, once, in a terminal: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
4. On GitHub: **Settings → Pages → Source: GitHub Actions**.
5. Same page, **Custom domain**: `welovescripture.org`, then tick *Enforce HTTPS* when it allows.
6. At your domain provider, point the domain at GitHub Pages: an `A` record for each of `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` record for `www` pointing to `<your-github-name>.github.io`.
7. Press *Publish* in the console.

## What is in here

| Folder | What it holds |
|---|---|
| `src/content/resources` | Guides, articles, videos, kids' resources (Markdown files) |
| `src/content/projects` | Projects (series) |
| `src/content/pages` | About, Start here, AI policy |
| `src/_data` | Settings, menu, counters, podcast episode choices |
| `src/assets/uploads` | Images you upload in the console |
| `design/` | Brand colours, fonts, logos (`tokens.json` is the source of truth for colours) |
| `lib/`, `eleventy.config.js` | The site generator ([Eleventy](https://www.11ty.dev)) |
| `console/` | The console |
| `trash/` | Anything you delete in the console lands here, so nothing is lost (never published) |

Nothing here needs editing by hand, but everything is plain files if you want to.

## Scripture markup (if you write Markdown yourself)

```
::: passage Ecclesiastes 4:9–10 | King James Version
9 Two are better than one...
10 For if they fall...
:::

::: talk
A question for friends to answer out loud.
:::
```

Also `::: pray` and `::: sit`.

## Search engines and AI

- `robots.txt` welcomes search engines and AI assistants that look up an answer and link back, and asks AI-training crawlers to stay away.
- Pages carry `noai` and `tdm-reservation` signals, `/.well-known/tdmrep.json`, and an `/ai-policy/` page.
- `llms.txt` gives AI assistants a clean summary of the site.
- `sitemap.xml`, Atom `feed.xml`, structured data (JSON-LD) and a social preview image for every page are generated automatically.

**Honest limits:** these are requests, not locks. Reputable crawlers honour them; others may not, and assistants fetching a page because a person asked them to may not check robots.txt at all. Anything on a public website can be copied. `Google-Extended` is blocked, which asks Google not to use the site for its AI models; ordinary Google Search is unaffected.

## Commands

```
npm install        # once
npm run console    # the console
npm run dev        # live preview on http://localhost:8090
npm run build      # build into _site
npm run check      # colour contrast + built-site checks
```

Switches: `DRAFTS=1` includes drafts; `SYNC_EPISODES=1` forces a fresh podcast feed; `SKIP_SEARCH=1` skips building the search index.

## Fonts and licences

Fraunces, Literata and Figtree are open fonts (SIL OFL). Scripture text is the King James Version.
