## 2025-02-28 - Missing Authorization Checks in API Routes
**Vulnerability:** Insecure Direct Object Reference (IDOR) on multiple endpoints in `monitoring.py`. Any authenticated user could modify status or takedown reports for ANY case ID.
**Learning:** The FastAPI backend completely bypasses Supabase Row Level Security (RLS) by using the global Service Role Key (`get_supabase()`). This places 100% of the authorization burden on the application code.
**Prevention:** Always use `Depends(get_current_profile)` to access the user's `organization_id` and manually verify ownership (e.g., via a helper like `_verify_case_ownership`) before modifying ANY database record in a route.
