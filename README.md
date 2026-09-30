# Episode Finder

Search through TV show subtitle files by phrase and instantly find which episode said it, when, and what was said around it.

Drop in your `.srt` files, spin up the Docker container, and start searching.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, Uvicorn |
| Database | SQLite with FTS5 full-text search |
| ORM | SQLAlchemy 2.0 |
| Config | Pydantic Settings (`.env`) |
| Frontend | Vanilla HTML / CSS / JS — no build step |
| Deployment | Docker, Docker Compose |

## How Search Works

1. On startup, the app parses all `.srt` files and ingests them into a SQLite database with an [FTS5 virtual table](https://www.sqlite.org/fts5.html) for full-text indexing.

2. When a user searches, the query is split into words and each word becomes a prefix match (`"word"*`). This means typing `φαντ` will match `φαντάζεσαι`, `φανταστικό`, etc.

3. Results are ranked by episode number and timestamp, with matched terms highlighted using FTS5's built-in `highlight()` function.

4. Clicking a result expands it to show the surrounding dialogue lines (2 above and 2 below), giving context to the matched subtitle.

## Security

- **Input validation** — only Greek characters accepted (Unicode ranges `U+0370–U+03FF`, `U+1F00–U+1FFF`), NFC-normalized, max 100 characters
- **SQL injection** — all queries use parameterized statements via SQLAlchemy
- **XSS protection** — all output HTML-escaped, FTS5 highlight tags preserved through a safe swap-escape-restore pipeline
- **Rate limiting** — sliding window, 30 requests/minute per IP on API endpoints
- **Security headers** — Content Security Policy (`script-src 'self'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy

## Project Structure

```
app/
├── main.py          # FastAPI app, routes, middleware
├── config.py        # Pydantic settings
├── database.py      # SQLAlchemy engine + session
├── models.py        # ORM models (Episode, Subtitle)
├── schemas.py       # Pydantic response schemas
├── search.py        # FTS5 search + context queries
├── security.py      # Validation, rate limiting, CSP
├── ingest.py        # SRT parser + DB ingestion
└── static/
    ├── index.html
    ├── style.css
    └── app.js
Dockerfile
docker-compose.yml
```

## API

```
GET /api/search?q=<phrase>&page=1&per_page=20
GET /api/context/<subtitle_id>
```

The search endpoint returns paginated results with episode number, title, timestamp, speaker, and highlighted text. The context endpoint returns the surrounding dialogue lines for a given subtitle.

## Getting Started

See [SETUP.md](SETUP.md) for installation and configuration instructions.

## License

MIT
