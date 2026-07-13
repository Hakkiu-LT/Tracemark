

## 2024-05-24 - Missing Authorization Check on update_case_status endpoint
**Vulnerability:** The `/monitoring/{case_id}/status` endpoint did not check if the user updating the case belonged to the same organization as the case itself. Any authenticated user could update the status of any case given its ID (IDOR).
**Learning:** The backend frequently bypasses RLS (using Supabase Service Role Key globally via get_supabase()). This means that database-level policies aren't enforcing data ownership, so every endpoint must manually fetch the entity and verify `organization_id` or `user_id` against the requester's profile.
**Prevention:** Always implement explicit ownership checks for `organization_id` or `user_id` in API routes before performing mutations on entities when RLS is bypassed.
