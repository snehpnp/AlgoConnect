"""
AlgoConnect Lead Enrichment Script — EMPTY WEBSITE LEADS
=========================================================

Purpose:
    Sirf un leads ko target karta hai jinke DB me "website" column
    empty ya NULL hai (~3000 leads). Har lead ke liye:
      1. Company name + registrationNo + address se web search karta hai (Tavily)
      2. Official website URL identify karke DB me store karta hai
      3. Website ka logo dhundh ke uska URL DB me store karta hai
      4. Website ke content se "About / Services" summary + product info
         nikaal ke (Groq LLM se structure karke) DB me store karta hai

    Priority (jaisa pehle script me tha):
      1. RA (Research Analysts) pehle -> registrationNo 'INH' se start hone wale
      2. Madhya Pradesh ke leads pehle, phir baaki states
      3. Website match karne ke baad hi baaki scraping hoti hai (pehle website
         confirm, tabhi logo/summary nikalta hai)

Requirements:
    pip install requests beautifulsoup4 psycopg2-binary python-dotenv --break-system-packages

Environment variables (.env ya shell me set karein):
    DATABASE_URL        -> postgresql://user:pass@host:5432/algoconnect
    TAVILY_API_KEY(S)    -> comma-separated agar multiple keys hain (rotation ke liye)
    GROQ_API_KEY         -> https://console.groq.com se free key milti hai

Usage:
    python lead_enrichment_empty_website.py --limit 3000 --use-llm --workers 5
    python lead_enrichment_empty_website.py --limit 50 --use-llm   # pehle chhote batch pe test karein
"""

import argparse
import csv
import json
import os
import re
import time
import threading
import urllib.robotparser
import concurrent.futures
from urllib.parse import urlparse, urljoin

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------------ config --
REQUEST_TIMEOUT = 12
DELAY_BETWEEN_LEADS = 2.0
USER_AGENT = "AlgoConnectLeadBot/1.0 (+contact: your-email@example.com)"
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?91[\-\s]?)?[6-9]\d{9}")
HEADERS = {"User-Agent": USER_AGENT}

SOCIAL_DOMAINS = {
    "linkedin.com": "linkedin",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "facebook.com": "facebook",
    "youtube.com": "youtube",
    "instagram.com": "instagram",
}

SKIP_DOMAINS = {
    "wikipedia.org", "youtube.com", "sebi.gov.in", "moneycontrol.com",
    "economictimes.indiatimes.com", "google.com", "justdial.com",
    "algotest.in", "instagram.com", "facebook.com", "twitter.com", "x.com",
    "linkedin.com", "indiamart.com", "sulekha.com",
}


# ---------------------------------------------------------------- search ----
def search_company(query: str, api_key: str, max_results: int = 5) -> list:
    if not api_key:
        return []
    for attempt in range(3):
        try:
            resp = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                },
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in (429, 432):
                time.sleep(2 + attempt * 2)
                continue
            resp.raise_for_status()
            return resp.json().get("results", [])
        except requests.RequestException as e:
            err_msg = e.response.text if getattr(e, "response", None) else str(e)
            if getattr(e, "response", None) and e.response.status_code in (429, 432) and attempt < 2:
                time.sleep(3)
                continue
            print(f"  [search error] {e} -> {err_msg}")
            return []
    return []


def pick_official_website(results: list) -> str:
    for r in results:
        url = r.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if domain and not any(sd in domain for sd in SKIP_DOMAINS):
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


# ------------------------------------------------------------------ fetch ---
def robots_allows(url: str) -> bool:
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        resp = requests.get(robots_url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(resp.text.splitlines())
            return rp.can_fetch(USER_AGENT, url)
        return True
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


def find_about_page(base_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").strip().lower()
        href = a["href"].lower()
        if "about" in text or "about" in href:
            return urljoin(base_url, a["href"])
    return ""


def find_contact_page(base_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").strip().lower()
        if "contact" in text or "contact" in a["href"].lower():
            return urljoin(base_url, a["href"])
    return ""


def find_logo_url(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    candidate_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        candidate_url = urljoin(base_url, og_image["content"])
    if not candidate_url:
        header = soup.find(["header", "nav"])
        if header:
            img = header.find("img")
            if img and img.get("src"):
                candidate_url = urljoin(base_url, img["src"])
    if not candidate_url:
        icon = soup.find("link", rel=lambda v: v and "icon" in v.lower())
        if icon and icon.get("href"):
            candidate_url = urljoin(base_url, icon["href"])
    if not candidate_url:
        candidate_url = urljoin(base_url, "/favicon.ico")

    try:
        resp = requests.get(candidate_url, headers=HEADERS, timeout=5, stream=True)
        if resp.status_code == 200:
            return candidate_url
    except Exception:
        pass
    return ""


def extract_contacts(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    emails, phones = set(), set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.lower().startswith("mailto:"):
            addr = href.split(":", 1)[1].split("?")[0].strip()
            if addr:
                emails.add(addr.lower())
        elif href.lower().startswith("tel:"):
            digits = re.sub(r"[^\d]", "", href.split(":", 1)[1])
            if digits:
                phones.add(digits)
    text = soup.get_text(" ")
    emails.update(EMAIL_RE.findall(text))
    phones.update(m.group(0) for m in PHONE_RE.finditer(text))
    return {"emails": sorted(emails), "phones": sorted(phones)}


def extract_visible_text(html: str, limit_chars: int = 6000) -> str:
    """Homepage + about page ka readable text nikaalta hai (LLM summary ke liye)."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    return text[:limit_chars]


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


# -------------------------------------------------------------------- LLM ---
def llm_structure(lead: dict, raw_findings: dict, groq_key: str) -> dict:
    if not groq_key:
        return {}
    prompt = f"""You are enriching a SEBI-registered lead for a B2B sales CRM.
Only use the information given below - do not invent facts.

SEBI record:
{json.dumps(lead, indent=2, default=str)}

Raw findings collected from public web search and the company's own website
(homepage + about page text, truncated):
{json.dumps(raw_findings, indent=2, default=str)}

Return ONLY a JSON object (no markdown, no preamble) with these fields:
{{
  "website": "",
  "linkedin": "",
  "twitter": "",
  "facebook": "",
  "emails": [],
  "phones": [],
  "about_summary": "2-4 sentence plain-language summary of what this company does, based only on the scraped text",
  "services_summary": "",
  "products_offered": [],
  "sells_algo_trading": "yes/no/unclear",
  "broker_partner": "",
  "company_size_estimate": "",
  "notes": ""
}}
If a field is unknown, leave it empty string / empty list. Do not guess."""
    for attempt in range(3):
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
                timeout=30,
            )
            if resp.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            text = text.strip().strip("```json").strip("```").strip()
            return json.loads(text)
        except Exception as e:
            err_msg = e.response.text if getattr(e, "response", None) else str(e)
            if getattr(e, "response", None) and e.response.status_code == 429 and attempt < 2:
                time.sleep(3)
                continue
            print(f"  [llm error] {e} -> {err_msg}")
            return {}
    return {}


# ---------------------------------------------------------------- pipeline --
def build_search_query(lead: dict, city: str) -> str:
    parts = []
    name = (lead.get("name") or "").strip()
    if name:
        parts.append(name)
    if lead.get("registrationNo"):
        parts.append(lead["registrationNo"])
    if city:
        parts.append(city)
    parts.append("official website SEBI registered")
    return " ".join(parts)


def enrich_lead(lead: dict, tavily_key: str, groq_key: str, use_llm: bool) -> dict:
    company = (lead.get("name") or "").strip()
    city = lead.get("city") or ""
    if not city and lead.get("address"):
        addr_parts = [p.strip() for p in lead["address"].split(",") if p.strip()]
        city = addr_parts[-2] if len(addr_parts) >= 2 else (addr_parts[-1] if addr_parts else "")

    # Step 1: search
    query = build_search_query(lead, city)
    results = search_company(query, tavily_key)
    website = pick_official_website(results)
    socials = pick_social_links(results)

    # Step 2: agar pehli try me nahi mila to sirf name+city se retry
    if not website and company:
        results2 = search_company(f"{company} {city}".strip(), tavily_key)
        website = pick_official_website(results2)
        for k, v in pick_social_links(results2).items():
            socials.setdefault(k, v)
        results = results + results2

    homepage_html = fetch_page(website) if website else ""

    # Step 3: registrationNo se loosely verify (agar mil jaaye to zyada confidence)
    reg_no = (lead.get("registrationNo") or "").strip().upper()
    verified = bool(reg_no and reg_no in homepage_html.upper()) if homepage_html else False

    contacts = extract_contacts(homepage_html) if homepage_html else {"emails": [], "phones": []}
    socials.update(extract_social_from_html(website, homepage_html) if homepage_html else {})
    logo_url = find_logo_url(homepage_html, website) if homepage_html and website else ""

    about_text = extract_visible_text(homepage_html) if homepage_html else ""

    if homepage_html and website:
        about_url = find_about_page(website, homepage_html)
        if about_url and about_url != website:
            about_html = fetch_page(about_url)
            if about_html:
                about_text += " " + extract_visible_text(about_html, limit_chars=3000)

        contact_url = find_contact_page(website, homepage_html)
        if contact_url and contact_url != website:
            contact_html = fetch_page(contact_url)
            more = extract_contacts(contact_html) if contact_html else {"emails": [], "phones": []}
            contacts["emails"] = sorted(set(contacts["emails"] + more["emails"]))
            contacts["phones"] = sorted(set(contacts["phones"] + more["phones"]))

    raw_findings = {
        "search_results": [
            {"title": r.get("title"), "url": r.get("url"), "snippet": (r.get("content", "")[:300])}
            for r in results
        ],
        "website": website,
        "registration_no_found_on_site": verified,
        "socials": socials,
        "contacts_found_on_site": contacts,
        "site_text": about_text[:6000],
    }

    enrichment = llm_structure(lead, raw_findings, groq_key) if use_llm else {}

    return {
        "lead": lead,
        "website": website,
        "has_own_website": bool(website),
        "registration_verified_on_site": verified,
        "socials": socials,
        "contacts_found_on_site": contacts,
        "logoUrl": logo_url,
        "about_text_raw": about_text[:2000],
        "llm_enrichment": enrichment,
    }


# ------------------------------------------------------------------- DB -----
def fetch_leads_with_empty_website(db_url: str, limit: int = 0) -> list:
    print("Connecting to database...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    query = '''
        SELECT * FROM "Lead"
        WHERE ("website" IS NULL OR TRIM("website") = '')
        ORDER BY
            CASE WHEN "registrationNo" ILIKE 'INH%' THEN 1 ELSE 2 END,
            CASE WHEN "state" ILIKE '%Madhya%' OR "address" ILIKE '%Madhya%' THEN 1 ELSE 2 END,
            id ASC
    '''
    if limit > 0:
        query += f" LIMIT {limit}"

    cur.execute(query)
    rows = cur.fetchall()
    leads = [dict(r) for r in rows]
    cur.close()
    conn.close()
    return leads


def update_lead_in_db(db_url: str, lead_id: int, e: dict):
    llm = e.get("llm_enrichment") or {}
    socials = e.get("socials") or {}

    website = e.get("website", "")
    has_own_website = e.get("has_own_website", False)
    linkedin = socials.get("linkedin", llm.get("linkedin", ""))
    twitter = socials.get("twitter", llm.get("twitter", ""))
    facebook = socials.get("facebook", llm.get("facebook", ""))

    about_summary = llm.get("about_summary", "")
    services = llm.get("services_summary", "")
    products_val = llm.get("products_offered")
    products = "; ".join(products_val) if isinstance(products_val, list) else str(products_val or "")
    algo = llm.get("sells_algo_trading", "")
    broker = llm.get("broker_partner", "")
    size = llm.get("company_size_estimate", "")
    notes = llm.get("notes", "")
    # about_summary ko notes/servicesSummary ke saath prefix kar dete hain taaki
    # schema me alag column na ho to bhi data na khoye
    if about_summary and services:
        services = f"{about_summary} | {services}"
    elif about_summary:
        services = about_summary

    logo_url = e.get("logoUrl", "")
    found_emails = e.get("contacts_found_on_site", {}).get("emails", [])
    found_phones = e.get("contacts_found_on_site", {}).get("phones", [])
    scraped_email = found_emails[0] if found_emails else None
    scraped_phone = found_phones[0] if found_phones else None

    # website sirf tab update karo jab kuch mila ho — khaali string se overwrite mat karo
    if not website:
        print(f"  [skip update] lead {lead_id}: no website found, DB row untouched (isEnriched not set)")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    update_q = '''
        UPDATE "Lead" SET
            "isEnriched" = true,
            "hasOwnWebsite" = %s,
            "website" = %s,
            "linkedin" = %s,
            "twitter" = %s,
            "facebook" = %s,
            "servicesSummary" = %s,
            "productsOffered" = %s,
            "sellsAlgoTrading" = %s,
            "brokerPartner" = %s,
            "companySizeEstimate" = %s,
            "enrichmentNotes" = %s,
            "logoUrl" = COALESCE(NULLIF(%s, ''), "logoUrl"),
            "scrapedEmail" = COALESCE(NULLIF(%s, ''), "scrapedEmail"),
            "scrapedPhone" = COALESCE(NULLIF(%s, ''), "scrapedPhone")
        WHERE id = %s
    '''
    cur.execute(update_q, (
        has_own_website, website, linkedin, twitter, facebook,
        services, products, algo, broker, size, notes,
        logo_url, scraped_email, scraped_phone, lead_id,
    ))
    conn.commit()
    cur.close()
    conn.close()


# ------------------------------------------------------------------- I/O ----
def save_outputs(enriched: list, out_csv: str, out_json: str):
    def json_serial(obj):
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False, default=json_serial)

    flat_rows = []
    for e in enriched:
        lead = e.get("lead", {})
        llm = e.get("llm_enrichment") or {}
        flat_rows.append({
            "id": lead.get("id", ""),
            "name": lead.get("name", ""),
            "registration_no": lead.get("registrationNo", ""),
            "state": lead.get("state", ""),
            "address": lead.get("address", ""),
            "website": e.get("website", ""),
            "registration_verified_on_site": e.get("registration_verified_on_site", ""),
            "logo_url": e.get("logoUrl", ""),
            "linkedin": e.get("socials", {}).get("linkedin", llm.get("linkedin", "")),
            "twitter": e.get("socials", {}).get("twitter", llm.get("twitter", "")),
            "facebook": e.get("socials", {}).get("facebook", llm.get("facebook", "")),
            "found_emails": "; ".join(e.get("contacts_found_on_site", {}).get("emails", [])),
            "found_phones": "; ".join(e.get("contacts_found_on_site", {}).get("phones", [])),
            "about_summary": llm.get("about_summary", ""),
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


# ------------------------------------------------------------------ main ----
def main():
    parser = argparse.ArgumentParser(description="Enrich leads with empty website column.")
    parser.add_argument("--output", default="enriched_empty_website.csv")
    parser.add_argument("--limit", type=int, default=0, help="0 = saare empty-website leads (~3000)")
    parser.add_argument("--use-llm", action="store_true", help="Groq se about/services summary structure karo")
    parser.add_argument("--api-keys", default="", help="Comma-separated Tavily keys (overrides TAVILY_API_KEY)")
    parser.add_argument("--workers", type=int, default=5)
    args = parser.parse_args()

    try:
        from dotenv import load_dotenv
        script_dir = os.path.dirname(os.path.abspath(__file__))
        load_dotenv(os.path.join(script_dir, "..", ".env"))
        load_dotenv(os.path.join(script_dir, ".env"))
    except ImportError:
        pass

    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:123456@localhost:5432/algoconnect")
    env_keys = os.environ.get("TAVILY_API_KEYS", os.environ.get("TAVILY_API_KEY", ""))


    tavily_keys_raw = args.api_keys if args.api_keys else env_keys
    tavily_keys = [k.strip() for k in tavily_keys_raw.split(",") if k.strip()]
    groq_key = os.environ.get("GROQ_API_KEY", "")
    
    if not tavily_keys:
        print("WARNING: TAVILY_API_KEY(S) set nahi hai. Search step skip hoga.")
    if args.use_llm and not groq_key:
        print("WARNING: --use-llm diya hai par GROQ_API_KEY set nahi hai.")

    key_state = {"idx": 0, "calls": 0, "lock": threading.Lock()}

    def get_tavily_key():
        if not tavily_keys:
            return ""
        with key_state["lock"]:
            if key_state["calls"] >= 700:
                key_state["calls"] = 0
                key_state["idx"] = (key_state["idx"] + 1) % len(tavily_keys)
            key_state["calls"] += 1
            return tavily_keys[key_state["idx"]]

    leads = fetch_leads_with_empty_website(db_url, args.limit)
    print(f"Loaded {len(leads)} leads with empty website from database.")

    def process_single_lead(item):
        i, lead = item
        try:
            time.sleep(DELAY_BETWEEN_LEADS)
            key = get_tavily_key()
            result = enrich_lead(lead, key, groq_key, args.use_llm)
            if "id" in lead:
                update_lead_in_db(db_url, lead["id"], result)
            status = "FOUND" if result.get("website") else "NOT FOUND"
            print(f"[{i}/{len(leads)}] ID: {lead.get('id')} | {lead.get('name', '')} | {status} | {result.get('website', '')}")
            return result
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[{i}/{len(leads)}] ID: {lead.get('id')} | ERROR | {e}")
            return {"lead": lead, "error": str(e)}

    enriched = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        items = list(enumerate(leads, 1))
        enriched = list(executor.map(process_single_lead, items))

    out_json = args.output.rsplit(".", 1)[0] + ".json"
    save_outputs(enriched, args.output, out_json)
    found_count = sum(1 for e in enriched if e.get("website"))
    print(f"\nDone. {found_count}/{len(leads)} leads ke liye website mili.")
    print(f"Saved: {args.output} aur {out_json}")


if __name__ == "__main__":
    main()