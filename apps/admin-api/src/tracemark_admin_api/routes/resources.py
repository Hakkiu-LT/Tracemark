"""Resource + API-usage monitoring, proxied from the main API.

The actual metrics live in the main (scraping) process; we fetch them over the
internal service-to-service channel after checking the staff member's permission.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from tracemark_admin_api import main_api
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/resources/metrics")
def resource_metrics(staff: StaffPrincipal = Depends(require_permission("resources.view"))):
    return main_api.get_resource_metrics()


@router.get("/resources/status")
def resource_status(staff: StaffPrincipal = Depends(require_permission("resources.view"))):
    return main_api.get_resource_status()


@router.get("/usage-stats")
def usage_stats(staff: StaffPrincipal = Depends(require_permission("resources.view"))):
    return main_api.get_usage_stats()
