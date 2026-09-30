import html

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas import ContextLine, SearchResult
from app.security import sanitize_highlight


def search_subtitles(
    db: Session,
    query: str,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[SearchResult], int]:
    query = query.strip()
    if not query:
        return [], 0

    fts_query = " ".join(f'"{word}"*' for word in query.split() if word)

    count_sql = text(
        "SELECT COUNT(*) FROM subtitles_fts WHERE subtitles_fts MATCH :q"
    )
    total = db.execute(count_sql, {"q": fts_query}).scalar() or 0

    if total == 0:
        return [], 0

    offset = (page - 1) * per_page
    search_sql = text("""
        SELECT
            s.id,
            e.episode_number,
            e.title,
            s.start_time AS timestamp,
            s.text,
            s.speaker,
            highlight(subtitles_fts, 0, '<mark>', '</mark>') AS highlighted_text
        FROM subtitles_fts fts
        JOIN subtitles s ON s.id = fts.rowid
        JOIN episodes e ON e.id = s.episode_id
        WHERE subtitles_fts MATCH :q
        ORDER BY e.episode_number, s.start_time
        LIMIT :limit OFFSET :offset
    """)

    rows = db.execute(search_sql, {"q": fts_query, "limit": per_page, "offset": offset}).mappings().all()

    results = [
        SearchResult(
            id=row["id"],
            episode_number=row["episode_number"],
            title=html.escape(row["title"]),
            timestamp=row["timestamp"].split(",")[0],
            text=sanitize_highlight(row["highlighted_text"]),
            speaker=html.escape(row["speaker"]) if row["speaker"] else None,
        )
        for row in rows
    ]

    return results, total


def get_context(db: Session, subtitle_id: int, surrounding: int = 2) -> list[ContextLine]:
    sql = text("""
        SELECT s2.start_time, s2.text, s2.speaker, s2.id
        FROM subtitles s1
        JOIN subtitles s2
            ON s2.episode_id = s1.episode_id
            AND s2.index_num BETWEEN s1.index_num - :n AND s1.index_num + :n
        WHERE s1.id = :sid
        ORDER BY s2.index_num
    """)
    rows = db.execute(sql, {"sid": subtitle_id, "n": surrounding}).mappings().all()
    return [
        ContextLine(
            timestamp=row["start_time"].split(",")[0],
            text=html.escape(row["text"]),
            speaker=html.escape(row["speaker"]) if row["speaker"] else None,
            is_match=(row["id"] == subtitle_id),
        )
        for row in rows
    ]
