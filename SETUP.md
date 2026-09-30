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

If you update or add SRT files, remove the existing database volume and restart:

```bash
docker compose down -v
docker compose up -d --build
```
