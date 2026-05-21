from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class AnalysisResult:
    score: int
    summary: str


def analyze_listing(payload: dict) -> AnalysisResult:
    raise NotImplementedError("Wire up AI analysis here when the backend integration starts.")
