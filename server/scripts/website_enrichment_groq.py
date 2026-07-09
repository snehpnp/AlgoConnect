"""
Lead Enrichment Script
-----------------------
Postgres "Lead" table se un leads ko fetch karta hai jinka website hai
aur isEnriched=false hai. Har lead ke liye:
  1. Website crawl karta hai (Playwright - JS heavy sites ke liye)
  2. Text extract karke Groq LLM se structured info nikalta hai
     (services, products, algo trading, broker partner, company size,
     social links)
  3. Logo/favicon download karta hai aur local folder me save karta hai
  4. Same row ko UPDATE karta hai (isEnriched = true)

Setup:
  pip install -r requirements.txt
  playwright install chromium

Env vars (.env file ya export karo):
  DATABASE_URL=postgresql://user:pass@host:5432/dbname
  GROQ_API_KEY=your_groq_key

Run:
  python website_enrichment_groq.py --limit 50 --batch-size 10
"""

import os
import sys
import time
import json
import argparse
import logging
from urllib.parse import urljoin, urlparse

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from openai import OpenAI  # Groq is OpenAI-SDK compatible

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
# Load from .env if possible (fallback if python-dotenv isn't installed)
try:
    from dotenv import load_dotenv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", ".env")
    load_dotenv(env_path)
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"  # Groq free tier model

PAGE_TIMEOUT_MS = 25000
REQUEST_DELAY_SEC = 3          # har lead ke beech delay (rate-limit safety)
MAX_TEXT_CHARS = 12000         # LLM ko bhejne se pehle text truncate karna
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("enrich")

if not DATABASE_URL:
    log.error("DATABASE_URL env var missing. Set it and re-run.")
    sys.exit(1)
if not GROQ_API_KEY:
    log.error("GROQ_API_KEY env var missing. Get free key from console.groq.com")
    sys.exit(1)

llm_client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

# ---------------------------------------------------------------------------
# DB HELPERS
# ---------------------------------------------------------------------------
def get_conn():
    return psycopg2.connect(DATABASE_URL)


def fetch_pending_leads(limit=50):
    """isEnriched=false aur website not null wale leads uthao."""
    sql = """
        SELECT id, name, website
        FROM "Lead"
        WHERE "isEnriched" = true
          AND website IS NOT NULL
          AND website <> ''
          AND ("servicesSummary" IS NULL OR "servicesSummary" = '')
        ORDER BY 
            CASE WHEN "registrationNo" ILIKE 'INH%%' THEN 1 ELSE 2 END,
            CASE WHEN "state" ILIKE '%%Madhya%%' OR "address" ILIKE '%%Madhya%%' THEN 1 ELSE 2 END,
            id ASC
        LIMIT %s
    """
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (limit,))
        rows = cur.fetchall()
    conn.close()
    return rows


def update_lead(lead_id, data: dict):
    """Enrichment fields ko lead row me update karo."""
    sql = """
        UPDATE "Lead"
        SET "isEnriched" = true,
            "linkedin" = COALESCE(%(linkedin)s, "linkedin"),
            "twitter" = COALESCE(%(twitter)s, "twitter"),
            "facebook" = COALESCE(%(facebook)s, "facebook"),
            "servicesSummary" = %(servicesSummary)s,
            "productsOffered" = %(productsOffered)s,
            "sellsAlgoTrading" = %(sellsAlgoTrading)s,
            "brokerPartner" = %(brokerPartner)s,
            "companySizeEstimate" = %(companySizeEstimate)s,
            "enrichmentNotes" = %(enrichmentNotes)s,
            "logoUrl" = COALESCE(%(logoUrl)s, "logoUrl"),
            "updatedAt" = NOW()
        WHERE id = %(id)s
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, {**data, "id": lead_id})
    conn.commit()
    conn.close()


def mark_failed(lead_id, reason):
    """Fail hone par notes me reason likh do, taaki baad me retry/inspect kar sako."""
    sql = """
        UPDATE "Lead"
        SET "enrichmentNotes" = %s, "updatedAt" = NOW()
        WHERE id = %s
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, (f"[SCRAPE_FAILED] {reason}", lead_id))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# SCRAPING
# ---------------------------------------------------------------------------
def normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def fetch_rendered_html(url: str) -> str:
    """Playwright se JS-rendered page load karo."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)  # thoda extra wait for JS content
            html = page.content()
        finally:
            browser.close()
    return html


def find_relevant_links(base_url: str, html: str, keywords):
    """Services/Pricing/About jaise pages ke internal links dhoondo."""
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").lower()
        href = a.get("href", "").lower()
        if any(k in text or k in href for k in keywords):
            full = urljoin(base_url, a.get("href", ""))
            if urlparse(full).netloc == urlparse(base_url).netloc:
                found.add(full)
    return list(found)[:3]  # zyada se zyada 3 extra pages


def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())
    return text[:MAX_TEXT_CHARS]


def extract_social_links(html: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    socials = {"linkedin": None, "twitter": None, "facebook": None}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "linkedin.com" in href and not socials["linkedin"]:
            socials["linkedin"] = href
        elif ("twitter.com" in href or "x.com" in href) and not socials["twitter"]:
            socials["twitter"] = href
        elif "facebook.com" in href and not socials["facebook"]:
            socials["facebook"] = href
    return socials


def find_logo_url(html: str, base_url: str, lead_id: int):
    """og:image -> header <img> -> favicon, priority order me try karo.
    Image download NAHI karte — sirf resolved absolute URL nikaal ke return karte hain,
    aur ek halka GET check karke confirm karte hain ki URL live hai."""
    soup = BeautifulSoup(html, "html.parser")
    candidate_url = None

    # 1. og:image meta tag
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        candidate_url = urljoin(base_url, og_image["content"])

    # 2. header/nav ke andar pehli img (usually logo hoti hai)
    if not candidate_url:
        header = soup.find(["header", "nav"])
        if header:
            img = header.find("img")
            if img and img.get("src"):
                candidate_url = urljoin(base_url, img["src"])

    # 3. fallback: favicon link tag
    if not candidate_url:
        icon = soup.find("link", rel=lambda v: v and "icon" in v.lower())
        if icon and icon.get("href"):
            candidate_url = urljoin(base_url, icon["href"])

    # 4. last resort: /favicon.ico
    if not candidate_url:
        candidate_url = urljoin(base_url, "/favicon.ico")

    # Quick liveness check — agar URL 200 nahi de raha to null rakho
    try:
        resp = requests.get(
            candidate_url, headers={"User-Agent": USER_AGENT}, timeout=10, stream=True
        )
        if resp.status_code == 200:
            return candidate_url
        log.warning(f"[{lead_id}] logo URL returned {resp.status_code}: {candidate_url}")
    except Exception as e:
        log.warning(f"[{lead_id}] logo URL check failed: {e}")
    return None


# ---------------------------------------------------------------------------
# LLM EXTRACTION
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """Neeche ek SEBI-registered RA/IA/Sub-broker company ki website se \
liya gaya text hai. Isse neeche diye JSON schema me extract karo. \
Agar koi field ki info text me nahi mile to us field ki value null rakho. \
Sirf raw JSON return karo, koi extra text/markdown fence nahi.

Schema:
{{
  "servicesSummary": "2-3 line summary of services offered",
  "productsOffered": "comma separated list of products/strategies (e.g. Scalping, Options, Algo bots)",
  "sellsAlgoTrading": "Yes / No / Unclear",
  "brokerPartner": "broker name if mentioned (e.g. Zerodha, Upstox, Alice Blue) else null",
  "companySizeEstimate": "Small / Medium / Large / Unknown (based on team size, offices, client count mentions)",
  "enrichmentNotes": "any other useful sales-relevant detail (pricing hints, notable clients, years of experience etc.)"
}}

Website text:
\"\"\"{page_text}\"\"\"
"""


def call_llm_extract(page_text: str) -> dict:
    prompt = EXTRACTION_PROMPT.format(page_text=page_text)
    resp = llm_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=800,
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.warning("LLM output JSON parse fail, raw output saved in notes.")
        return {
            "servicesSummary": None,
            "productsOffered": None,
            "sellsAlgoTrading": "Unclear",
            "brokerPartner": None,
            "companySizeEstimate": "Unknown",
            "enrichmentNotes": f"[RAW_LLM_OUTPUT] {raw[:500]}",
        }


# ---------------------------------------------------------------------------
# MAIN PER-LEAD PIPELINE
# ---------------------------------------------------------------------------
KEYWORDS_FOR_EXTRA_PAGES = ["service", "pricing", "plan", "product", "about"]


def process_lead(lead: dict):
    lead_id = lead["id"]
    url = normalize_url(lead["website"])
    log.info(f"[{lead_id}] {lead['name']} -> {url}")

    try:
        home_html = fetch_rendered_html(url)
    except Exception as e:
        mark_failed(lead_id, f"homepage fetch failed: {e}")
        log.error(f"[{lead_id}] homepage fetch failed: {e}")
        return

    combined_text = extract_text(home_html)

    # extra pages (services/pricing/etc) — best effort, fail silently
    for link in find_relevant_links(url, home_html, KEYWORDS_FOR_EXTRA_PAGES):
        try:
            extra_html = fetch_rendered_html(link)
            combined_text += " " + extract_text(extra_html)
        except Exception:
            continue
        if len(combined_text) >= MAX_TEXT_CHARS:
            break
    combined_text = combined_text[:MAX_TEXT_CHARS]

    socials = extract_social_links(home_html, url)
    logo_url = find_logo_url(home_html, url, lead_id)

    try:
        extracted = call_llm_extract(combined_text)
    except Exception as e:
        mark_failed(lead_id, f"LLM extraction failed: {e}")
        log.error(f"[{lead_id}] LLM extraction failed: {e}")
        return

    update_data = {
        "linkedin": socials.get("linkedin"),
        "twitter": socials.get("twitter"),
        "facebook": socials.get("facebook"),
        "servicesSummary": extracted.get("servicesSummary"),
        "productsOffered": extracted.get("productsOffered"),
        "sellsAlgoTrading": extracted.get("sellsAlgoTrading"),
        "brokerPartner": extracted.get("brokerPartner"),
        "companySizeEstimate": extracted.get("companySizeEstimate"),
        "enrichmentNotes": extracted.get("enrichmentNotes"),
        "logoUrl": logo_url,
    }
    update_lead(lead_id, update_data)
    log.info(f"[{lead_id}] enriched successfully. logo={logo_url}")


# ---------------------------------------------------------------------------
# ENTRYPOINT
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Total leads process karne hain")
    parser.add_argument("--batch-size", type=int, default=10, help="Ek batch me kitne leads")
    args = parser.parse_args()

    leads = fetch_pending_leads(limit=args.limit)
    log.info(f"Total pending leads found: {len(leads)}")

    for i, lead in enumerate(leads, start=1):
        process_lead(lead)
        time.sleep(REQUEST_DELAY_SEC)

        if i % args.batch_size == 0:
            log.info(f"Batch of {args.batch_size} done, chhota break le rahe hain...")
            time.sleep(10)

    log.info("Enrichment run complete.")


if __name__ == "__main__":
    main()
