from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(tags=["debug"])


class DebugBar(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    buy_volume: float = 0.0


class DebugRequest(BaseModel):
    code: str
    bars: list[DebugBar]


class DebugStep(BaseModel):
    index: int
    timestamp: int
    bar: DebugBar
    variables: dict[str, float | None]
    signal: str | None = None
    meta: str | None = None


class DebugResponse(BaseModel):
    variable_names: list[str]
    steps: list[DebugStep]


@router.post("/debug/evaluate", response_model=DebugResponse)
async def debug_evaluate(req: DebugRequest) -> DebugResponse:
    """Evaluate a DSL strategy bar-by-bar and return all variable values at each step."""
    from hquant import DslStrategy

    try:
        strategy = DslStrategy(req.code)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid DSL code: {exc}",
        ) from exc

    var_names: list[str] = strategy.variable_names()
    steps: list[DebugStep] = []

    for i, bar in enumerate(req.bars):
        result = strategy.debug_evaluate(bar.model_dump())
        steps.append(
            DebugStep(
                index=i,
                timestamp=bar.timestamp,
                bar=bar,
                variables=result["variables"],
                signal=result.get("signal"),
                meta=result.get("meta"),
            )
        )

    return DebugResponse(variable_names=var_names, steps=steps)
