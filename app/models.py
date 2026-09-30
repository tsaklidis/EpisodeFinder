from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Episode(Base):
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    episode_number: Mapped[int] = mapped_column(unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))

    subtitles: Mapped[list["Subtitle"]] = relationship(back_populates="episode", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Episode {self.episode_number}: {self.title}>"


class Subtitle(Base):
    __tablename__ = "subtitles"

    id: Mapped[int] = mapped_column(primary_key=True)
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"))
    index_num: Mapped[int]
    start_time: Mapped[str] = mapped_column(String(20))
    end_time: Mapped[str] = mapped_column(String(20))
    text: Mapped[str]
    speaker: Mapped[str | None] = mapped_column(String(100), default=None)

    episode: Mapped["Episode"] = relationship(back_populates="subtitles")

    __table_args__ = (
        Index("ix_subtitles_episode_start", "episode_id", "start_time"),
    )

    def __repr__(self) -> str:
        return f"<Subtitle {self.episode_id}:{self.index_num} {self.start_time}>"
