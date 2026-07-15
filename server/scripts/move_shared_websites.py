import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, "..", ".env")
load_dotenv(env_path)

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def main():
    if not DATABASE_URL:
        print("Error: DATABASE_URL not found in .env")
        return

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Get all domains that have count > 1
    query = """
    SELECT
        LOWER(
            SPLIT_PART(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(website, '^https?://', ''),
                    '^www\.',
                    ''
                ),
                '/',
                1
            )
        ) AS domain,
        COUNT(*) AS "Website_count"
    FROM public."Lead"
    WHERE website IS NOT NULL
      AND website <> ''
    GROUP BY domain
    HAVING COUNT(*) > 1
    ORDER BY "Website_count" DESC;
    """
    
    print("Fetching duplicate domains...")
    cur.execute(query)
    duplicate_domains = cur.fetchall()
    print(f"Found {len(duplicate_domains)} domains shared by multiple leads.")
    
    total_moved = 0
    for row in duplicate_domains:
        domain = row["domain"]
        count = row["Website_count"]
        print(f"Processing shared domain '{domain}' ({count} leads)...")
        
        # Fetch leads for this domain
        cur.execute("""
            SELECT id, website, "otherListings" 
            FROM public."Lead"
            WHERE website IS NOT NULL AND website <> ''
              AND LOWER(SPLIT_PART(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://', ''), '^www\.', ''), '/', 1)) = %s
        """, (domain,))
        
        leads = cur.fetchall()
        for lead in leads:
            lead_id = lead["id"]
            website = lead["website"]
            other_listings_raw = lead["otherListings"]
            
            existing = []
            if other_listings_raw:
                try:
                    existing = json.loads(other_listings_raw)
                except Exception:
                    existing = []
            
            # Ensure it is a list
            if not isinstance(existing, list):
                existing = []
                
            # Check if it already exists
            existing_urls = {item.get("url") for item in existing if isinstance(item, dict)}
            if website not in existing_urls:
                existing.append({
                    "url": website,
                    "title": "Directory / Platform Listing",
                    "source": "Moved from main website (Shared Domain)"
                })
            
            new_other_listings = json.dumps(existing, ensure_ascii=False)
            
            # Update lead: set website to NULL and update otherListings
            cur.execute("""
                UPDATE public."Lead"
                SET website = NULL,
                    "otherListings" = %s
                WHERE id = %s
            """, (new_other_listings, lead_id))
            total_moved += 1
            
    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone! Moved {total_moved} shared websites to otherListings and cleared their main website fields.")

if __name__ == "__main__":
    main()
