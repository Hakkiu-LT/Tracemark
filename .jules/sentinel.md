
## 2024-05-24 - [IDOR in API due to Supabase Service Role Key]
**Vulnerability:** Insecure Direct Object Reference (IDOR) on multiple endpoints (e.g. `/documents/{id}/send-email`) modifying/accessing resources solely based on ID.
**Learning:** The FastAPI backend relies on `get_supabase()` which uses the Supabase Service Role Key globally. This key bypasses database Row Level Security (RLS) entirely, meaning all authorization logic must be manually implemented in the API layer. Using only `get_current_user` for authentication without manual resource authorization is not enough.
**Prevention:** Always inject `profile: CurrentProfile = Depends(get_current_profile)` into route handlers. Explicitly verify resource ownership by mapping the resource back to the user (`profile.id`) or organization (`profile.organization_id`) before performing any read or write operations. Never trust the `id` in the URL parameter.
