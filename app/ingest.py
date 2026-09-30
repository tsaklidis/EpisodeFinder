"""Parse SRT files and populate the database."""

import os
import re
import unicodedata

from app.config import settings
from app.database import SessionLocal, create_fts, init_db
from app.models import Episode, Subtitle


def parse_srt(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = re.split(r"\n\n+", content.strip())
    entries = []

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue

        try:
            index_num = int(lines[0].strip())
        except ValueError:
            continue

        time_match = re.match(
            r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})",
            lines[1].strip(),
        )
        if not time_match:
            continue

        subtitle_text = "\n".join(lines[2:]).strip()
        if not subtitle_text:
            continue

        entries.append({
            "index_num": index_num,
            "start_time": time_match.group(1),
            "end_time": time_match.group(2),
            "text": subtitle_text,
        })

    return entries


def parse_episode_from_filename(filename: str) -> tuple[int, str] | None:
    name = os.path.splitext(filename)[0]
    name = unicodedata.normalize("NFC", name)

    match = re.match(r"^(\d+)\s*-\s*(.+)$", name)
    if match:
        return int(match.group(1)), match.group(2).strip()

    return None




def ingest():
    init_db()
    db = SessionLocal()

    srt_dir = settings.srt_dir
    srt_files = sorted(
        f for f in os.listdir(srt_dir) if f.endswith(".srt")
    )

    if not srt_files:
        print(f"No .srt files found in {srt_dir}")
        return

    print(f"Found {len(srt_files)} SRT files in {srt_dir}\n")

    total_subtitles = 0

    for srt_file in srt_files:
        parsed = parse_episode_from_filename(srt_file)
        if not parsed:
            print(f"  [SKIP] Cannot parse episode info: {srt_file}")
            continue

        ep_num, title = parsed
        filepath = os.path.join(srt_dir, srt_file)

        existing = db.query(Episode).filter_by(episode_number=ep_num).first()
        if existing:
            print(f"  [SKIP] Episode {ep_num} already in DB")
            continue

        entries = parse_srt(filepath)
        if not entries:
            print(f"  [SKIP] No subtitles parsed: {srt_file}")
            continue

        episode = Episode(episode_number=ep_num, title=title)
        db.add(episode)
        db.flush()

        subtitles = [
            Subtitle(
                episode_id=episode.id,
                index_num=e["index_num"],
                start_time=e["start_time"],
                end_time=e["end_time"],
                text=e["text"],
            )
            for e in entries
        ]
        db.add_all(subtitles)
        total_subtitles += len(subtitles)

        print(f"  [OK] Episode {ep_num} - {title} ({len(subtitles)} subtitles)")

    db.commit()

    db.close()

    print("Building FTS index...")
    create_fts()
    print(f"\nDone! Ingested {total_subtitles} subtitles from {len(srt_files)} files.")


if __name__ == "__main__":
    ingest()
