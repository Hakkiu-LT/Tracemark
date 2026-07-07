import os
import json
import sys
from supabase import create_client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) must be set in environment variables.")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

cid = "dd1dc542-a24c-4c06-a593-0c318f0a7405"

# Run get_full_case equivalent query
res = supabase.table("cases").select("*, decisions(*), evidence(*), takedown_reports(*)").eq("id", cid).single().execute()
print("FULL CASE RETRIEVED:")
print(json.dumps(res.data, indent=2))
