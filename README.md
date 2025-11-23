# Modern Blog App

A premium, feature-rich blog application built with Node.js, Express, and EJS.

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development (uses nodemon):
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000 (or set PORT in a `.env` file)

## Environment

- Create a `.env` file to set environment variables (e.g. PORT). `.env` is ignored by git.
- The app persists data to a local SQLite file `blog.db` (ignored by git). To reset the DB remove `blog.db`.

## Project structure (important files)

- [server.js](server.js) — Express app, routes, sanitization, Quill integration
- [database.js](database.js) — SQLite setup (better-sqlite3)
- [public/js/quill-setup.js](public/js/quill-setup.js) — Quill editor client setup
- [views/layout.ejs](views/layout.ejs) — main layout and asset includes

## Notes

- HTML content is sanitized server-side using DOMPurify via `isomorphic-dompurify` + `jsdom`.
- Image thumbnails are extracted from post HTML and used as previews.
- If adding files that should be committed (e.g. seed data), update `.gitignore` accordingly.
