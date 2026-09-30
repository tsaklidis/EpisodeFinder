from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    from app.models import Episode, Subtitle  # noqa: F401

    Base.metadata.create_all(bind=engine)


def create_fts():
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS subtitles_fts"))
        conn.execute(text(
            "CREATE VIRTUAL TABLE subtitles_fts "
            "USING fts5(text, content='subtitles', content_rowid='id')"
        ))
        conn.execute(text(
            "INSERT INTO subtitles_fts(rowid, text) "
            "SELECT id, text FROM subtitles"
        ))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
