## 2024-05-18 - [Missing Authorization Checks in Monitoring API]
**Vulnerability:** IDOR in `/monitoring/{case_id}/status` and `/monitoring/takedowns/*` endpoints.
**Learning:** Endpoints retrieving cases or takedown reports lacked ownership checks. Since `get_supabase()` bypasses RLS, explicit data authorization verification must be performed using `get_current_profile`.
**Prevention:** Always verify resource ownership against `profile.organization_id` or `profile.id` before allowing state modifications.
