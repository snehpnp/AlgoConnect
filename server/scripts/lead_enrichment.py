"""
AlgoConnect Lead Enrichment Script (Database Version)
===================================================

Purpose:
    Har SEBI lead (RA / IA / Sub-broker / Advisory) ke liye publicly available
    web info collect karta hai aur PostgreSQL (Prisma DB) se directly leads fetch karta hai.
    
    Filtering/Sorting Priority:
    1. First approach: RA (Research Analysts) - recognized by registrationNo starting with 'INH'.
    2. Location: Madhya Pradesh leads first, then other states.

Requirements:
    pip install requests beautifulsoup4 psycopg2-binary --break-system-packages

Environment variables needed:
    DATABASE_URL       -> Database connection string (e.g., postgresql://user:pass@localhost:5432/algoconnect)
    TAVILY_API_KEY     -> get a free/paid key at https://tavily.com
    ANTHROPIC_API_KEY  -> get a key at https://console.anthropic.com
                          (only needed if --use-llm is passed)

Usage:
    python lead_enrichment.py --output enriched.csv --limit 20 --use-llm
"""

import argparse
import csv
import json
import os
import re
import time
import urllib.robotparser
from urllib.parse import urlparse, urljoin
import psycopg2
import psycopg2.extras
import requests
import concurrent.futures
from bs4 import BeautifulSoup

# Config
REQUEST_TIMEOUT = 12
DELAY_BETWEEN_LEADS = 2.0
USER_AGENT = "AlgoConnectLeadBot/1.0 (+contact: your-email@example.com)"
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?91[\-\s]?)?[6-9]\d{9}")

SOCIAL_DOMAINS = {
    "linkedin.com": "linkedin",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "facebook.com": "facebook",
    "youtube.com": "youtube",
    "instagram.com": "instagram",
}
HEADERS = {"User-Agent": USER_AGENT}

def search_company(query: str, api_key: str, max_results: int = 5) -> list:
    if not api_key:
        return []
    try:
  
        resp = requests.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": query, "max_results": max_results, "search_depth": "basic"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("results", [])
    except requests.RequestException as e:
        print(f"  [search error] {e}")
        return []

def pick_official_website(results: list, company_name: str) -> str:
    skip_domains = set(SOCIAL_DOMAINS.keys()) | {
        "wikipedia.org", "youtube.com", "sebi.gov.in", "moneycontrol.com",
        "economictimes.indiatimes.com", "google.com",
    }
    for r in results:
        url = r.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if domain and not any(sd in domain for sd in skip_domains):
            return url
    return ""

def pick_social_links(results: list) -> dict:
    socials = {}
    for r in results:
        url = r.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        for sd, key in SOCIAL_DOMAINS.items():
            if sd in domain and key not in socials:
                socials[key] = url
    return socials

def robots_allows(url: str) -> bool:
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(USER_AGENT, url)
    except Exception:
        return True

def fetch_page(url: str) -> str:
    if not url or not robots_allows(url):
        return ""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        print(f"  [fetch error] {url} -> {e}")
        return ""

def find_contact_page(base_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").strip().lower()
        if "contact" in text or "contact" in a["href"].lower():
            return urljoin(base_url, a["href"])
    return ""

def extract_contacts(html: str) -> dict:
    text = BeautifulSoup(html, "html.parser").get_text(" ")
    emails = sorted(set(EMAIL_RE.findall(text)))
    phones = sorted(set(m.group(0) for m in PHONE_RE.finditer(text)))
    return {"emails": emails, "phones": phones}

def extract_social_from_html(base_url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    socials = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        domain = urlparse(href).netloc.replace("www.", "")
        for sd, key in SOCIAL_DOMAINS.items():
            if sd in domain and key not in socials:
                socials[key] = href
    return socials

def llm_structure(lead: dict, raw_findings: dict, api_key: str) -> dict:
    if not api_key:
        return {}
    prompt = f"""You are enriching a SEBI-registered lead for a B2B sales CRM.
Only use the information given below - do not invent facts.

SEBI record:
{json.dumps(lead, indent=2, default=str)}

Raw findings collected from public web search and the company's own website:
{json.dumps(raw_findings, indent=2)}

Return ONLY a JSON object (no markdown, no preamble) with these fields:
{{
  "website": "",
  "linkedin": "",
  "twitter": "",
  "facebook": "",
  "emails": [],
  "phones": [],
  "services_summary": "",
  "products_offered": [],
  "sells_algo_trading": "yes/no/unclear",
  "broker_partner": "",
  "company_size_estimate": "",
  "notes": ""
}}
If a field is unknown, leave it empty string / empty list. Do not guess."""
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-5-sonnet-20240620",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        text = text.strip().strip("```json").strip("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"  [llm error] {e}")
        return {}

def enrich_lead(lead: dict, tavily_key: str, anthropic_key: str, use_llm: bool) -> dict:
    company = lead.get("name", "").strip()
    city = lead.get("city", "") or ""
    
    if not city and lead.get("address"):
        address = lead.get("address", "")
        parts = [p.strip() for p in address.split(",") if p.strip()]
        city = parts[-2] if len(parts) >= 2 else (parts[-1] if parts else "")

    query = f"{company} {city} SEBI registered advisor".strip()
    print(f"-> Searching: {query}")
    results = search_company(query, tavily_key)

    website = pick_official_website(results, company)
    socials = pick_social_links(results)

    html = fetch_page(website) if website else ""
    contacts = extract_contacts(html) if html else {"emails": [], "phones": []}
    socials.update(extract_social_from_html(website, html) if html else {})

    if html and website:
        contact_url = find_contact_page(website, html)
        if contact_url and contact_url != website:
            contact_html = fetch_page(contact_url)
            more = extract_contacts(contact_html) if contact_html else {"emails": [], "phones": []}
            contacts["emails"] = sorted(set(contacts["emails"] + more["emails"]))
            contacts["phones"] = sorted(set(contacts["phones"] + more["phones"]))

    raw_findings = {
        "search_results": [{"title": r.get("title"), "url": r.get("url"), "snippet": (r.get("content", "")[:300])} for r in results],
        "website": website,
        "socials": socials,
        "contacts_found_on_site": contacts,
    }

    enrichment = {}
    if use_llm:
        enrichment = llm_structure(lead, raw_findings, anthropic_key)

    return {
        "lead": lead,
        "website": website,
        "socials": socials,
        "contacts_found_on_site": contacts,
        "llm_enrichment": enrichment,
    }

def fetch_leads_from_db(db_url: str, limit: int = 0) -> list:
    print("Connecting to database...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Priority:
    # 1. RA (Research Analysts) -> registrationNo starting with 'INH'
    # 2. State: Madhya Pradesh first
    query = '''
        SELECT * FROM "Lead"
        WHERE "isEnriched" = false
        ORDER BY 
            CASE WHEN "registrationNo" ILIKE 'INH%' THEN 1 ELSE 2 END,
            CASE WHEN "state" ILIKE '%Madhya%' OR "address" ILIKE '%Madhya%' THEN 1 ELSE 2 END,
            id ASC
    '''
    if limit > 0:
        query += f" LIMIT {limit}"
        
    cur.execute(query)
    leads_rows = cur.fetchall()
    
    leads = [dict(row) for row in leads_rows]
    cur.close()
    conn.close()
    return leads

def update_lead_in_db(db_url: str, lead_id: int, e: dict):
    llm = e.get("llm_enrichment") or {}
    socials = e.get("socials") or {}
    
    website = e.get("website", "")
    linkedin = socials.get("linkedin", llm.get("linkedin", ""))
    twitter = socials.get("twitter", llm.get("twitter", ""))
    facebook = socials.get("facebook", llm.get("facebook", ""))
    services = llm.get("services_summary", "")
    
    products_val = llm.get("products_offered")
    if isinstance(products_val, list):
        products = "; ".join(products_val)
    else:
        products = str(products_val or "")
        
    algo = llm.get("sells_algo_trading", "")
    broker = llm.get("broker_partner", "")
    size = llm.get("company_size_estimate", "")
    notes = llm.get("notes", "")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    update_q = '''
        UPDATE "Lead" SET 
            "isEnriched" = true,
            "website" = %s,
            "linkedin" = %s,
            "twitter" = %s,
            "facebook" = %s,
            "servicesSummary" = %s,
            "productsOffered" = %s,
            "sellsAlgoTrading" = %s,
            "brokerPartner" = %s,
            "companySizeEstimate" = %s,
            "enrichmentNotes" = %s
        WHERE id = %s
    '''
    cur.execute(update_q, (website, linkedin, twitter, facebook, services, products, algo, broker, size, notes, lead_id))
    conn.commit()
    cur.close()
    conn.close()


def save_outputs(enriched: list, out_csv: str, out_json: str):
    with open(out_json, "w", encoding="utf-8") as f:
        # custom converter for datetime if present
        def json_serial(obj):
            if hasattr(obj, 'isoformat'):
                return obj.isoformat()
            raise TypeError ("Type %s not serializable" % type(obj))
        json.dump(enriched, f, indent=2, ensure_ascii=False, default=json_serial)

    flat_rows = []
    for e in enriched:
        lead = e["lead"]
        llm = e.get("llm_enrichment") or {}
        flat_rows.append({
            "id": lead.get("id", ""),
            "name": lead.get("name", ""),
            "registration_no": lead.get("registrationNo", ""),
            "original_email": lead.get("email", ""),
            "original_phone": lead.get("phone", ""),
            "state": lead.get("state", ""),
            "address": lead.get("address", ""),
            "website": e.get("website", ""),
            "linkedin": e.get("socials", {}).get("linkedin", llm.get("linkedin", "")),
            "twitter": e.get("socials", {}).get("twitter", llm.get("twitter", "")),
            "facebook": e.get("socials", {}).get("facebook", llm.get("facebook", "")),
            "found_emails": "; ".join(e.get("contacts_found_on_site", {}).get("emails", [])),
            "found_phones": "; ".join(e.get("contacts_found_on_site", {}).get("phones", [])),
            "services_summary": llm.get("services_summary", ""),
            "products_offered": "; ".join(llm.get("products_offered", []) or []),
            "sells_algo_trading": llm.get("sells_algo_trading", ""),
            "broker_partner": llm.get("broker_partner", ""),
            "company_size_estimate": llm.get("company_size_estimate", ""),
            "notes": llm.get("notes", ""),
        })

    if flat_rows:
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(flat_rows[0].keys()))
            writer.writeheader()
            writer.writerows(flat_rows)

def main():
    parser = argparse.ArgumentParser(description="Enrich SEBI leads from PostgreSQL database.")
    parser.add_argument("--output", default="enriched.csv", help="Output CSV path")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of leads processed (0 = all)")
    parser.add_argument("--use-llm", action="store_true", help="Use Claude API to structure the data")
    parser.add_argument("--workers", type=int, default=5, help="Number of concurrent workers (default 5)")
    args = parser.parse_args()

    # Load from .env if possible (fallback if python-dotenv isn't installed)
    try:
        from dotenv import load_dotenv
        script_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(script_dir, "..", ".env")
        load_dotenv(env_path)
    except ImportError:
        pass

    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:123456@localhost:5432/algoconnect")
    tavily_key = os.environ.get("TAVILY_API_KEY", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if not tavily_key:
        print("WARNING: TAVILY_API_KEY not set. Search step will be skipped.")
    if args.use_llm and not anthropic_key:
        print("WARNING: --use-llm passed but ANTHROPIC_API_KEY not set.")

    leads = fetch_leads_from_db(db_url, args.limit)
    print(f"Loaded {len(leads)} leads from database.")

    enriched = []
    
    def process_single_lead(args_tuple):
        i, lead = args_tuple
        reg = lead.get('registrationNo') or 'No Reg'
        state = lead.get('state') or 'No State'
        print(f"[{i}/{len(leads)}] {lead.get('name', '(no name)')} | Reg: {reg} | State: {state}")
        try:
            result = enrich_lead(lead, tavily_key, anthropic_key, args.use_llm)
            if "id" in lead:
                update_lead_in_db(db_url, lead["id"], result)
            return result
        except Exception as e:
            print(f"  [error] {e}")
            return {"lead": lead, "error": str(e)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        args_list = [(i, lead) for i, lead in enumerate(leads, 1)]
        results = list(executor.map(process_single_lead, args_list))
        enriched.extend(results)

    out_json = args.output.rsplit(".", 1)[0] + ".json"
    save_outputs(enriched, args.output, out_json)
    print(f"\nDone. Saved: {args.output} and {out_json}")

if __name__ == "__main__":
    main()
