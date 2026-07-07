## 2025-02-27 - [Hardcoded Credentials Script]
**Vulnerability:** A hardcoded Supabase secret key (`SUPABASE_SERVICE_ROLE_KEY` equivalent) was present in `apps/api/query_case_details.py`.
**Learning:** Utility scripts inside the `apps/api` directory sometimes bypass the central configuration loading used by the application and end up with hardcoded secrets, which exposes critical infrastructure.
**Prevention:** Always verify utility scripts for hardcoded secrets. Use `os.environ.get("SUPABASE_SERVICE_ROLE_KEY")` as a standardized method across all scripts to load sensitive keys.
