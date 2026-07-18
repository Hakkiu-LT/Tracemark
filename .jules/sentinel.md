## 2024-05-18 - [Fix IDOR in Infringements Endpoints]
**Vulnerability:** IDOR in `/api/v1/infringements/{id}`, `/api/v1/infringements/{id}/evidence`, and `/api/v1/infringements/{id}/status` allowing any user to read and update any infringement by knowing its ID.
**Learning:** The FastAPI backend accesses Supabase using the service role key, bypassing RLS. All multi-tenant isolation requires manual verification in the route handlers against the `CurrentProfile` dependency.
**Prevention:** Always join relational context (like `cases!inner(organization_id, user_id)`) to the fetched resource and manually verify that either `organization_id` or `user_id` matches the profile before returning or updating data.
