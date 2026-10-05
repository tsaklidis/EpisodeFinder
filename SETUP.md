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

## Statistics

Traffic and search terms both come from the nginx access logs via
[GoAccess](https://goaccess.io) — the app itself stores nothing about visitors.

GoAccess is already installed on the server. Reading `/var/log/nginx/` needs
elevated rights, so either prefix with `sudo` or add yourself to the `adm`
group once:

```bash
sudo usermod -aG adm $USER   # log out and back in; afterwards no sudo needed
```

### A report you can open in a browser

```bash
sudo goaccess /var/log/nginx/access.log --log-format=COMBINED -o ~/report.html
```

Include the rotated logs for a fuller picture (they cover 14 days):

```bash
sudo zcat -f /var/log/nginx/access.log* | goaccess --log-format=COMBINED -o ~/report.html -
```

### A live dashboard

```bash
sudo goaccess /var/log/nginx/access.log --log-format=COMBINED --real-time-html -o ~/report.html
```

### Reading search terms

Searches reach nginx as `/api/search?q=...`, so they show up under
**Requested Files** — but URL-encoded, which makes Greek unreadable
(`%CE%9C%CE%B1%CF%81%CE%BF%CF%8D%CF%83%CE%B9`). To list the actual terms,
most-searched first:

```bash
sudo grep -o '/api/search?q=[^ &"]*' /var/log/nginx/access.log \
  | sed 's|.*q=||' \
  | python3 -c "import sys,urllib.parse as u; [print(u.unquote_plus(l.strip())) for l in sys.stdin]" \
  | sort | uniq -c | sort -rn | head -40
```

Keep `--log-format=COMBINED` and do **not** pass `-q` / `--no-query-string` to
GoAccess, or the search terms are stripped from the report.

### Retention and privacy

nginx rotates daily and keeps 14 days (`/etc/logrotate.d/nginx`). These logs
contain IP addresses, which are personal data under GDPR — that is why the
site's legal notice discloses them and states the 14-day window. If you change
the rotation, update the notice in `app/static/index.html` to match.
