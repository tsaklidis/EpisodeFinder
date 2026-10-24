from pydantic import BaseModel


class SearchResult(BaseModel):
    id: int
    episode_number: int
    title: str
    timestamp: str
    text: str
    speaker: str | None = None

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    query: str
    total: int
    page: int
    per_page: int
    results: list[SearchResult]


class ContextLine(BaseModel):
    timestamp: str
    text: str
    speaker: str | None = None
    is_match: bool = False


class ContextResponse(BaseModel):
    lines: list[ContextLine]


class EpisodeSummary(BaseModel):
    episode_number: int
    title: str
    lines: int


class Season(BaseModel):
    label: str
    years: str
    first: int
    last: int


class StatsResponse(BaseModel):
    total_episodes: int
    subtitle_count: int
    dialogue_minutes: int
    seasons: list[Season]
    episodes: list[EpisodeSummary]
