import os
import json
from dotenv import load_dotenv, find_dotenv
from supabase import create_client

load_dotenv(find_dotenv())

supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")

if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

supabase = create_client(supabase_url, supabase_key)

cid = "dd1dc542-a24c-4c06-a593-0c318f0a7405"

# Run get_full_case equivalent query
res = supabase.table("cases").select("*, decisions(*), evidence(*), takedown_reports(*)").eq("id", cid).single().execute()
print("FULL CASE RETRIEVED:")
print(json.dumps(res.data, indent=2))
