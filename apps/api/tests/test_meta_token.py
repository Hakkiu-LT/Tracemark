import os
import datetime
import requests
from dotenv import load_dotenv, find_dotenv

def test_meta_ads_access_token_validity():
    # Load env variables from the root .env file
    env_path = find_dotenv()
    print(f"Loading env from: {env_path}")
    load_dotenv(env_path)

    token = os.environ.get("META_ADS_ACCESS_TOKEN")
    assert token is not None, "META_ADS_ACCESS_TOKEN environment variable is not defined in .env"
    assert token.strip() != "", "META_ADS_ACCESS_TOKEN is empty"

    # Try to inspect the token using the debug_token endpoint to get its expiration date
    app_id = os.environ.get("META_APP_ID")
    app_secret = os.environ.get("META_APP_SECRET")
    if app_id and app_secret:
        print("Debugging Meta Access Token details...")
        debug_url = "https://graph.facebook.com/debug_token"
        debug_params = {
            "input_token": token,
            "access_token": f"{app_id}|{app_secret}"
        }
        try:
            debug_resp = requests.get(debug_url, params=debug_params, timeout=15)
            if debug_resp.status_code == 200:
                debug_data = debug_resp.json().get("data", {})
                expires_at_timestamp = debug_data.get("expires_at")
                if expires_at_timestamp is not None:
                    if expires_at_timestamp == 0:
                        print("Token Expiration: Does not expire (never)")
                    else:
                        expires_at_date = datetime.datetime.fromtimestamp(expires_at_timestamp, tz=datetime.timezone.utc)
                        print(f"Token Expiration Date: {expires_at_date.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            else:
                print(f"Unable to query debug_token endpoint (Status {debug_resp.status_code}): {debug_resp.text}")
        except Exception as e:
            print(f"Failed to query debug_token endpoint: {e}")

    # Make a direct validation request to Meta's ads_archive API
    # targeting a small limit to minimize bandwidth/rate-limit footprint
    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "access_token": token,
        "search_terms": "test",
        "ad_reached_countries": '["US"]',
        "ad_type": "ALL",
        "fields": "id",
        "limit": 1,
    }

    print("Verifying Meta Access Token against Meta Graph API...")
    resp = requests.get(url, params=params, timeout=15)

    # If the response is not 200 OK, the test should fail with detailed error info
    assert resp.status_code == 200, (
        f"Meta Ads API request failed (Status {resp.status_code}).\n"
        f"Response Details: {resp.text}\n"
        f"Note: Ensure your Meta Access Token is active and your Meta Developer account "
        f"has completed ID verification (https://www.facebook.com/ads/library/api)."
    )

    data = resp.json()
    assert "data" in data, f"Unexpected response structure (missing 'data' key): {data}"
    print("Success: Meta Ads Access Token is active and working!")

if __name__ == "__main__":
    test_meta_ads_access_token_validity()
