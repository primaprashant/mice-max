"""GET /api/ops/live: live step rows recorded by any agent since the server started."""
from typing import Optional

from fastapi import APIRouter

from . import steplog

router = APIRouter()


@router.get("/api/ops/live")
def live(conference_id: Optional[str] = None, after: Optional[str] = None) -> list[dict]:
    return steplog.recent(conference_id, after)
