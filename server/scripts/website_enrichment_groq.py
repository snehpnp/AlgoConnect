"""
Lead Enrichment Script (Hybrid: Groq LLM if available, else Rule-based)
-------------------------------------------------------------------------
Postgres "Lead" table se leads fetch karke website scrape karta hai.
Har lead ke liye:
  1. Website crawl karta hai (Playwright - JS heavy sites ke liye)
  2. Info extract karta hai:
       - Agar GROQ_API_KEY set hai -> Groq LLM se smart extraction
       - Agar nahi hai -> automatically keyword/regex based extraction
         (koi crash nahi hota, seamlessly fallback ho jaata hai)
  3. Logo/favicon ka live URL nikalta hai (download nahi karta)
  4. Same row ko UPDATE karta hai (isEnriched = true)

Setup:
  pip install -r requirements.txt
  playwright install chromium

Env vars (.env file ya export karo):
  DATABASE_URL=postgresql://user:pass@host:5432/dbname
  GROQ_API_KEY=your_groq_key   # OPTIONAL - na ho to rule-based mode chalega

Run:
  python website_enrichment_groq.py --limit 50 --batch-size 10
"""

import os
import sys
import time
import json
import re
import argparse
import logging
from urllib.parse import urljoin, urlparse

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

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

# --- Groq / LLM setup (OPTIONAL) ---
USE_LLM = False
llm_client = None

if GROQ_API_KEY:
    try:
        from openai import OpenAI  # Groq is OpenAI-SDK compatible
        llm_client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
        USE_LLM = True
        log.info("GROQ_API_KEY mil gayi -> LLM-based extraction use hoga.")
    except ImportError:
        log.warning("openai package install nahi hai (`pip install openai`) -> rule-based extraction use hoga.")
else:
    log.info("GROQ_API_KEY set nahi hai -> rule-based (no AI) extraction use hoga.")


# ---------------------------------------------------------------------------
# DB HELPERS
# ---------------------------------------------------------------------------
def get_conn():
    return psycopg2.connect(DATABASE_URL)


def claim_one_lead():
    """Ek lead ko atomically 'claim' karo taaki multiple processes ek saath chalne par
    duplicate scrape na ho. FOR UPDATE SKIP LOCKED use karta hai — agar koi doosra
    process pehle se us row ko lock kiye hue hai to ye automatically agli row utha lega.
    Claim hote hi enrichmentNotes me temporary marker likh dete hain (baad me
    process_lead asli data se overwrite kar dega)."""
    sql = """
        WITH candidate AS (
            SELECT id
            FROM "Lead"
            WHERE "isEnriched" = true
              AND website IS NOT NULL
              AND website <> ''
              AND ("servicesSummary" IS NULL OR "servicesSummary" = '')
              AND ("enrichmentNotes" IS NULL OR "enrichmentNotes" NOT LIKE '[CLAIMED]%%')
            ORDER BY 
                CASE WHEN "registrationNo" ILIKE 'INH%%' THEN 1 ELSE 2 END,
                CASE WHEN "state" ILIKE '%%Madhya%%' OR "address" ILIKE '%%Madhya%%' THEN 1 ELSE 2 END,
                id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE "Lead"
        SET "enrichmentNotes" = '[CLAIMED] ' || NOW()::text
        WHERE id IN (SELECT id FROM candidate)
        RETURNING id, name, website
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        conn.close()


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
            "scrapedEmail" = COALESCE(%(scrapedEmail)s, "scrapedEmail"),
            "scrapedPhone" = COALESCE(%(scrapedPhone)s, "scrapedPhone"),
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


# --- Email / Phone extraction (regex-based, no AI needed, always runs) ---
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+91[-\s]?)?[6-9]\d{9}')

# Placeholder / junk emails jo templates me common hote hain, inhe ignore karo
JUNK_EMAIL_DOMAINS = [
    "example.com", "yourdomain.com", "email.com", "domain.com", "test.com",
    "sentry.io", "wixpress.com", "godaddy.com", "yoursite.com",
]


def extract_contact_info(html: str, text: str) -> dict:
    """Sabse pehle mailto:/tel: links check karo (most reliable), fir footer/body
    text pe regex fallback lagao. Jo bhi page pe pehle mile wahi use hota hai."""
    soup = BeautifulSoup(html, "html.parser")
    emails = set()
    phones = set()

    # 1. mailto: / tel: links — sabse reliable source
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.lower().startswith("mailto:"):
            addr = href.split(":", 1)[1].split("?")[0].strip()
            if addr:
                emails.add(addr.lower())
        elif href.lower().startswith("tel:"):
            digits = re.sub(r"[^\d]", "", href.split(":", 1)[1])
            phones.add(digits)

    # 2. regex fallback — visible text me se (about/contact/footer sab isme aa jaata hai)
    for m in EMAIL_REGEX.findall(text):
        emails.add(m.lower())
    for m in PHONE_REGEX.findall(text):
        phones.add(re.sub(r"\D", "", m))

    # Junk/placeholder emails filter karo
    emails = {e for e in emails if not any(j in e for j in JUNK_EMAIL_DOMAINS)}

    # Phone numbers normalize karo — sirf valid 10-digit Indian mobile rakho
    clean_phones = set()
    for p in phones:
        digits = p
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) == 10 and digits[0] in "6789":
            clean_phones.add(digits)

    return {
        "scrapedEmail": sorted(emails)[0] if emails else None,
        "scrapedPhone": sorted(clean_phones)[0] if clean_phones else None,
    }


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
# LLM EXTRACTION (used only when USE_LLM = True)
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
    return json.loads(raw)  # JSONDecodeError bahar catch hoga (process_lead me)


# ---------------------------------------------------------------------------
# RULE-BASED EXTRACTION (No AI) — automatic fallback jab GROQ_API_KEY na ho
# ---------------------------------------------------------------------------
ALGO_KEYWORDS = [
    "algo trading", "algorithmic trading", "automated trading", "trading bot",
    "systematic trading", "auto trading", "algo strategies", "trading algorithm",
    "quant strategy", "automated strategy",
]

BROKER_LIST = [
    "Zerodha", "Upstox", "Alice Blue", "Angel One", "Angel Broking",
    "ICICI Direct", "HDFC Securities", "Kotak Securities", "5paisa",
    "Fyers", "IIFL", "Motilal Oswal", "Sharekhan", "Groww", "Dhan",
    "SAS Online", "Paytm Money", "Axis Direct",
]

PRODUCT_KEYWORDS = [
    "Scalping", "Intraday", "Positional", "Swing Trading", "Option Strategy",
    "Options Trading", "Portfolio Management", "Research Advisory",
    "Equity Advisory", "Commodity Trading", "Futures Trading",
    "Technical Analysis", "Charting", "Backtesting",
]

SIZE_HINT_PATTERNS = {
    "Large": [r"\b(pan[- ]india|500\+|1000\+|multiple branches|nationwide)\b"],
    "Medium": [r"\b(team of \d{2,3}|\d{2,3}\+ employees|multiple offices)\b"],
    "Small": [r"\b(boutique|small team|family-owned|founded by)\b"],
}


def rule_based_extract(text: str, html: str) -> dict:
    text_lower = text.lower()

    # --- Algo trading detection ---
    sells_algo = "Unclear"
    if any(kw in text_lower for kw in ALGO_KEYWORDS):
        sells_algo = "Yes"

    # --- Broker partner detection ---
    broker_partner = None
    for broker in BROKER_LIST:
        if broker.lower() in text_lower:
            broker_partner = broker
            break

    # --- Products/strategies offered ---
    products_found = [kw for kw in PRODUCT_KEYWORDS if kw.lower() in text_lower]
    products_offered = ", ".join(products_found) if products_found else None

    # --- Services summary: meta description tag use karo, warna None ---
    soup = BeautifulSoup(html, "html.parser")
    meta_desc = soup.find("meta", attrs={"name": "description"})
    services_summary = meta_desc["content"].strip() if meta_desc and meta_desc.get("content") else None

    # --- Company size: rough regex-based guess (weak without AI, best-effort) ---
    company_size = "Unknown"
    for size, patterns in SIZE_HINT_PATTERNS.items():
        if any(re.search(p, text_lower) for p in patterns):
            company_size = size
            break

    return {
        "servicesSummary": services_summary,
        "productsOffered": products_offered,
        "sellsAlgoTrading": sells_algo,
        "brokerPartner": broker_partner,
        "companySizeEstimate": company_size,
        "enrichmentNotes": None,  # AI ke bina generic notes generate nahi kar sakte
    }


# ---------------------------------------------------------------------------
# HYBRID EXTRACTION DISPATCHER
# ---------------------------------------------------------------------------
def extract_lead_info(lead_id: int, page_text: str, html: str) -> dict:
    """Agar LLM available hai to usse try karo, fail ho ya na ho -> rule-based fallback.
    Agar rate-limit (429) mile to poore run ke liye LLM band kar do -> baaki saare
    leads seedha rule-based se process honge, taaki har lead pe wasted API call na ho."""
    global USE_LLM
    if USE_LLM:
        try:
            return call_llm_extract(page_text)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower():
                log.warning(
                    f"[{lead_id}] Groq rate-limit hit gaya -> is poore run ke liye "
                    f"LLM band kar rahe hain, ab sab leads rule-based se process honge."
                )
                USE_LLM = False
            else:
                log.warning(f"[{lead_id}] LLM extraction fail hui ({e}) -> rule-based fallback use ho raha hai.")
    return rule_based_extract(page_text, html)


# ---------------------------------------------------------------------------
# MAIN PER-LEAD PIPELINE
# ---------------------------------------------------------------------------
KEYWORDS_FOR_EXTRA_PAGES = ["service", "pricing", "plan", "product", "about", "contact"]

# In directory/aggregator sites par company ki apni website nahi hoti - scrape karne se
# garbage data (unrelated logo, unrelated text) DB me chala jaata hai, isliye skip karo.
BLOCKED_WEBSITE_DOMAINS = [
    "justdial.com", "scribd.com", "indiamart.com", "facebook.com",
    "instagram.com", "linkedin.com", "sulekha.com", "tradeindia.com",
    "yellowpages.in", "google.com", "youtube.com", "twitter.com", "x.com",
]


def is_blocked_domain(url: str) -> bool:
    domain = urlparse(url).netloc.lower()
    return any(blocked in domain for blocked in BLOCKED_WEBSITE_DOMAINS)


def process_lead(lead: dict):
    lead_id = lead["id"]
    url = normalize_url(lead["website"])
    log.info(f"[{lead_id}] {lead['name']} -> {url}")

    if is_blocked_domain(url):
        mark_failed(lead_id, f"skipped - directory/aggregator listing, not a real company website: {url}")
        log.warning(f"[{lead_id}] directory/aggregator site hai (JustDial/Scribd/etc.), skip kar rahe hain.")
        return

    try:
        home_html = fetch_rendered_html(url)
    except Exception as e:
        mark_failed(lead_id, f"homepage fetch failed: {e}")
        log.error(f"[{lead_id}] homepage fetch failed: {e}")
        return

    combined_text = extract_text(home_html)
    all_htmls = [home_html]  # email/phone extraction har page pe chalayenge

    # extra pages (services/pricing/about/contact/etc) — best effort, fail silently
    for link in find_relevant_links(url, home_html, KEYWORDS_FOR_EXTRA_PAGES):
        try:
            extra_html = fetch_rendered_html(link)
            combined_text += " " + extract_text(extra_html)
            all_htmls.append(extra_html)
        except Exception:
            continue
        if len(combined_text) >= MAX_TEXT_CHARS:
            break
    combined_text = combined_text[:MAX_TEXT_CHARS]

    socials = extract_social_links(home_html, url)
    logo_url = find_logo_url(home_html, url, lead_id)

    # Email/phone: har crawl ki hui page pe try karo, jo pehle mile wahi rakho
    contact_info = {"scrapedEmail": None, "scrapedPhone": None}
    for page_html in all_htmls:
        page_text = extract_text(page_html)
        found = extract_contact_info(page_html, page_text)
        if not contact_info["scrapedEmail"] and found["scrapedEmail"]:
            contact_info["scrapedEmail"] = found["scrapedEmail"]
        if not contact_info["scrapedPhone"] and found["scrapedPhone"]:
            contact_info["scrapedPhone"] = found["scrapedPhone"]
        if contact_info["scrapedEmail"] and contact_info["scrapedPhone"]:
            break

    extracted = extract_lead_info(lead_id, combined_text, home_html)

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
        "scrapedEmail": contact_info.get("scrapedEmail"),
        "scrapedPhone": contact_info.get("scrapedPhone"),
    }
    update_lead(lead_id, update_data)
    log.info(
        f"[{lead_id}] enriched successfully. logo={logo_url}, "
        f"email={contact_info.get('scrapedEmail')}, phone={contact_info.get('scrapedPhone')}"
    )


# ---------------------------------------------------------------------------
# ENTRYPOINT
# ---------------------------------------------------------------------------
def worker_loop(worker_id: int, max_leads: int):
    """Ek worker process ka loop — jab tak leads milte rahein (ya max_leads cross ho
    jaye) tab tak ek-ek karke lead claim karke process karta rahega."""
    processed = 0
    log.info(f"[Worker-{worker_id}] shuru ho gaya.")
    while processed < max_leads:
        lead = claim_one_lead()
        if not lead:
            log.info(f"[Worker-{worker_id}] koi pending lead nahi mila, band ho raha hai.")
            break
        try:
            process_lead(lead)
        except Exception as e:
            log.error(f"[Worker-{worker_id}] lead {lead['id']} process karte waqt crash: {e}")
            mark_failed(lead["id"], f"worker crash: {e}")
        processed += 1
        time.sleep(REQUEST_DELAY_SEC)
    log.info(f"[Worker-{worker_id}] khatam. Total processed: {processed}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Total leads process karne hain (sab workers milakar)")
    parser.add_argument("--workers", type=int, default=1, help="Kitne parallel processes chalane hain")
    args = parser.parse_args()

    if args.workers <= 1:
        worker_loop(worker_id=1, max_leads=args.limit)
        log.info("Enrichment run complete.")
        return

    # Har worker ko roughly limit/workers leads milenge — thoda extra bhi de dete hain
    # taaki uneven claiming ki wajah se koi worker jaldi khaali na baith jaye.
    per_worker_limit = (args.limit // args.workers) + 5

    from multiprocessing import Process
    processes = []
    for w in range(1, args.workers + 1):
        p = Process(target=worker_loop, args=(w, per_worker_limit))
        p.start()
        processes.append(p)

    for p in processes:
        p.join()

    log.info("Sab workers khatam ho gaye. Enrichment run complete.")


if __name__ == "__main__":
    main()