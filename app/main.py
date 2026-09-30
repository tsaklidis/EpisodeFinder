import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, init_db
from app.schemas import ContextResponse, SearchResponse
from app.search import get_context, search_subtitles
from app.security import SecurityMiddleware, validate_query


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Konstantinou kai Elenis Search",
    description="Search through episodes",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(SecurityMiddleware)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(os.path.join(static_dir, "index.html"))


@app.get("/api/search", response_model=SearchResponse)
def api_search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    page: int = Query(1, ge=1, le=500),
    per_page: int = Query(None, ge=1, le=50),
    db: Session = Depends(get_db),
):
    clean = validate_query(q)
    if clean is None:
        raise HTTPException(
            status_code=400,
            detail="Επιτρέπονται μόνο ελληνικοί χαρακτήρες.",
        )

    if per_page is None:
        per_page = settings.results_per_page

    results, total = search_subtitles(db, clean, page=page, per_page=per_page)

    return SearchResponse(
        query=clean,
        total=total,
        page=page,
        per_page=per_page,
        results=results,
    )


@app.get("/api/context/{subtitle_id}", response_model=ContextResponse)
def api_context(
    subtitle_id: int = ...,
    db: Session = Depends(get_db),
):
    if subtitle_id < 1 or subtitle_id > 999_999:
        raise HTTPException(status_code=400, detail="Invalid ID")
    lines = get_context(db, subtitle_id, surrounding=2)
    return ContextResponse(lines=lines)
