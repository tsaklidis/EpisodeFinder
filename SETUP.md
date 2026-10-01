# Setup

## Prerequisites

- Docker and Docker Compose
- SRT subtitle files (not included in this repo)

## Installation

1. **Clone the repo**

```bash
git clone https://github.com/<your-username>/episode-finder.git
cd episode-finder
```

2. **Add your SRT files**

Place `.srt` files in the `srt_files/` directory. Expected filename format:

```
<episode_number> - <Title>.srt
```

Example: `1 - Συγκατοικηση.srt`

3. **Configure environment**

```bash
cp .env.example .env
```

4. **Run**

```bash
docker compose up -d --build
```

The app ingests the SRT files on first startup and is available at `http://localhost:8000`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `8000` | Host port |
| `SRT_DIR` | `./srt_files` | Path to SRT files |
| `DB_PATH` | `./app/data/subtitles.db` | SQLite database path |
| `RESULTS_PER_PAGE` | `20` | Results per page |

## Re-ingesting Subtitles

Ingestion skips episodes already in the database, so **adding** a new SRT file only
needs a restart:

```bash
docker compose restart
```

**Changing** an existing episode's SRT requires dropping the data volume, because
that episode is already recorded and would otherwise be skipped:

```bash
docker compose down -v
docker compose up -d --build
```

The app re-ingests automatically on the next startup — it detects the empty
database and rebuilds it. Expect the first request after a wipe to wait for that
(roughly a minute for ~27k subtitles).

To re-ingest without restarting the container:

```bash
docker compose exec app python -m app.ingest
```
