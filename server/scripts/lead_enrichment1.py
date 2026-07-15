"""
AlgoConnect Lead Enrichment Script — EMPTY WEBSITE LEADS (v2 - strict verify)
==============================================================================

Ye version pehle wale se ALAG hai is cheez me:

    PEHLE: search me jo bhi pehla non-skip-domain result milta tha, use hi
           "website" maan ke store kar dete the. Isse GALAT match ki
           possibility thi (same/similar naam ki koi aur company, ek news
           mention, kisi third party ka page, etc.) — aur wo galat data
           DB me chala jata tha.

    AB:    Top N candidate results ko FETCH + VERIFY karte hain. Verification
           me dekha jata hai:
             - company name ke tokens site ke title/meta/text me hain ya nahi
             - registrationNo site pe mila ya nahi
             - city/state ka mention hai ya nahi
             - "trading / SEBI / research analyst / investment / advisor /
               securities / capital / algo" jaise finance keywords hain ya nahi
             - domain khud company-name se milta julta hai ya nahi
           In sab se ek CONFIDENCE SCORE (0-1) banta hai. Sirf tabhi
           "hasOwnWebsite = true" set hota hai jab score >= WEBSITE_MATCH_THRESHOLD.

    Agar koi bhi candidate threshold pass nahi karta (aur search khud
    successfully chali thi, fail nahi hui thi), to hum:
             - website column ko EMPTY hi rehne dete hain (galat data store
               nahi karte)
             - "noOwnWebsite" = true mark karte hain
             - "websiteCheckedAt" timestamp save karte hain
           Ye "noOwnWebsite=true" wale leads hi tumhare "inhe website bana ke
           offer denge" wale pitch list ke liye use honge.

    Agar search hi fail ho gayi (API error / rate limit / no results at all),
    to hum "noOwnWebsite" MARK NAHI karte — kyoki humein pata nahi ki website
    hai ya nahi, sirf search fail hui hai. Isse false "no website" leads nahi
    banenge.

Requirements:
    pip install requests beautifulsoup4 psycopg2-binary python-dotenv rapidfuzz --break-system-packages
    (rapidfuzz na mile to script apne aap difflib pe fallback kar leta hai)

Environment variables (.env ya shell me set karein):
    DATABASE_URL          -> postgresql://user:pass@host:5432/algoconnect
    SERPER_API_KEY(S)      -> comma-separated agar multiple keys hain
    GROQ_API_KEY           -> https://console.groq.com se free key milti hai

DB migration (pehle ek baar chala lena, naye columns ke liye):
    ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "noOwnWebsite" BOOLEAN DEFAULT false;
    ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "websiteConfidence" DOUBLE PRECISION;
    ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "websiteCheckedAt" TIMESTAMP;

Usage:
    python lead_enrichment.py --limit 50 --use-llm            # pehle chhote batch pe test karo
    python lead_enrichment.py --limit 3000 --use-llm --workers 5
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
import random
import datetime
from urllib.parse import urlparse, urljoin

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

try:
    from rapidfuzz import fuzz as _rf_fuzz
    def name_similarity(a: str, b: str) -> float:
        """0-1 similarity score."""
        if not a or not b:
            return 0.0
        return _rf_fuzz.token_set_ratio(a, b) / 100.0
except ImportError:
    from difflib import SequenceMatcher
    def name_similarity(a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

# ------------------------------------------------------------------ config --
REQUEST_TIMEOUT = 12
DELAY_BETWEEN_LEADS = 0.5
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?91[\-\s]?)?[6-9]\d{9}")
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

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
    "linkedin.com", "indiamart.com", "sulekha.com", "esi.in", "mind2markets.com",
    "enit.nseindia.com", "tracxn.com", "zaubacorp.com", "scribd.com",
    "apps.apple.com", "indiafilings.com", "instafinancials.com",
    # additional false-positive-prone domains
    "nseindia.com", "bseindia.com", "cdslindia.com", "nsdl.co.in",
    "business-standard.com", "livemint.com", "financialexpress.com",
    "reddit.com", "quora.com", "medium.com", "play.google.com",
    "pinterest.com", "yellowpages.in", "hellotrade.com",
    "trustpilot.com", "mca.gov.in", "companycheck.co.in", "probe42.in",
    "screener.in",
    # company-data-aggregator / LEI-registry / filing-lookup sites — these
    # are NEVER a company's own website, they just index public records,
    # and they commonly block scrapers (403) which was starving the real
    # candidate slots
    "legalentityidentifier.in", "indialei.in", "gleif.org", "lei-lookup.com",
    "filesure.in", "thecompanycheck.com", "cleartax.in", "zoominfo.com",
    "pitchbook.com", "dnb.com", "sec.gov", "crunchbase.com", "tofler.in",
    "corporatefilings.in", "vakilsearch.com", "cin.gov.in", "roc.gov.in",
    "opencorporates.com", "bloomberg.com", "growjo.com", "signalhire.com",
    "rocketreach.co", "apollo.io", "leadiq.com", "owler.com", "craft.co",
    "wellfound.com", "angel.co", "similarweb.com", "sitejabber.com",
}

# Substring keywords checked against the whole domain — catches aggregator/
# registry sites not explicitly listed above (new ones pop up often)
AGGREGATOR_KEYWORDS = [
    "leicert", "lei-", "-lei", "zauba", "tofler", "probe42", "instafinancial",
    "companycheck", "corporatefiling", "filesure", "cin-", "roc-", "gstin",
    "dnb.", "zoominfo", "pitchbook", "crunchbase", "opencorporates",
    "rocketreach", "signalhire", "apollo.io", "leadiq", "owler", "craft.co",
    "similarweb", "sitejabber", "trustpilot", "glassdoor", "ambitionbox",
]

DIRECTORY_DOMAINS = {
    "justdial.com", "indiamart.com", "sulekha.com", "tradeindia.com", "crunchbase.com",
    "zaubacorp.com", "ambitionbox.com", "glassdoor.co.in", "startupindia.gov.in",
    "instafinancials.com", "companycheck.co.in", "probe42.in", "tofler.in",
}

# Words to strip when normalizing a company name for matching
NAME_STOPWORDS = {
    "pvt", "pvt.", "private", "ltd", "ltd.", "limited", "llp", "inc", "inc.",
    "co", "co.", "company", "the", "and", "&", "india", "securities",
    "capital", "advisors", "advisor", "advisory", "research", "investment",
    "investments", "wealth", "financial", "finance", "services", "solutions",
    "trading", "traders", "group", "corp", "corporation",
}

FINANCE_KEYWORDS = [
    "sebi", "research analyst", "investment advisor", "investment advisory",
    "algo trading", "algorithmic trading", "trading strategy", "trading strategies",
    "portfolio management", "pms", "broker", "brokerage", "stock market",
    "equity research", "mutual fund", "wealth management", "derivatives",
    "nse", "bse", "demat", "trading terminal", "backtesting",
]

WEBSITE_MATCH_THRESHOLD = 0.6  # tune karo experiment ke baad


# ---------------------------------------------------------------- search ----
def search_company(query: str, api_key: str, max_results: int = 5) -> list:
    if not api_key:
        return []
    for attempt in range(5):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": max_results},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in (429, 432, 403):
                time.sleep(4 + attempt * 3 + random.uniform(0, 3))
                continue
            resp.raise_for_status()
            organic = resp.json().get("organic", [])
            return [
                {"title": r.get("title", ""), "url": r.get("link", ""), "content": r.get("snippet", "")}
                for r in organic[:max_results]
            ]
        except requests.RequestException as e:
            resp_obj = getattr(e, "response", None)
            err_msg = resp_obj.text if resp_obj is not None else str(e)
            if resp_obj is not None and resp_obj.status_code in (429, 432, 403) and attempt < 4:
                time.sleep(4 + attempt * 3 + random.uniform(0, 3))
                continue
            print(f"  [search error] status={resp_obj.status_code if resp_obj is not None else 'n/a'} query={query!r} -> {err_msg}")
            return None  # None = search itself failed (different from "no results")
    print(f"  [SERPER RATE LIMIT] Exhausted 5 retries for query: {query}")
    return None


def normalize_company_name(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9\s&]", " ", name or "")
    tokens = [t.lower() for t in name.split() if t.lower() not in NAME_STOPWORDS]
    return " ".join(tokens).strip()


def candidate_domains(results: list, other_listings_str: str = "") -> list:
    """Skip/directory/social domains hata ke, already-known domains hata ke,
    ordered unique candidate result list deta hai (verification ke liye)."""
    existing_domains = set()
    if other_listings_str:
        try:
            parsed = json.loads(other_listings_str)
            for item in parsed:
                if isinstance(item, dict) and item.get("url"):
                    d = urlparse(item["url"]).netloc.replace("www.", "")
                    if d:
                        existing_domains.add(d)
        except Exception:
            pass

    seen = set()
    out = []
    for r in results:
        url = r.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if not domain or domain in seen:
            continue
        if any(sd in domain for sd in SKIP_DOMAINS):
            continue
        if any(kw in domain for kw in AGGREGATOR_KEYWORDS):
            continue
        if any(dd in domain for dd in DIRECTORY_DOMAINS):
            continue
        if domain in existing_domains:
            continue
        seen.add(domain)
        out.append(r)
    return out


def pick_directory_website(results: list) -> str:
    for r in results:
        url = r.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if domain and any(dd in domain for dd in DIRECTORY_DOMAINS):
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
    if not url or url.startswith(("mailto:", "tel:", "javascript:")) or not robots_allows(url):
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
        href = a["href"].lower().strip()
        if href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        if "about" in text or "about" in href:
            return urljoin(base_url, a["href"])
    return ""


def find_contact_page(base_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").strip().lower()
        href = a["href"].lower().strip()
        if href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        if "contact" in text or "contact" in href:
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


def get_page_title_meta(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    parts = []
    if soup.title and soup.title.string:
        parts.append(soup.title.string)
    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        parts.append(desc["content"])
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        parts.append(og_title["content"])
    return " ".join(parts)


# ------------------------------------------------------------ verification --
def verify_official_website(lead: dict, url: str, html: str) -> dict:
    """Returns {"score": float 0-1, "reasons": {...}} — kitna confident hain
    ke ye website is company ki APNI/OFFICIAL website hai."""
    reasons = {}
    if not html:
        return {"score": 0.0, "reasons": {"fetch_failed": True}}

    company = lead.get("name") or ""
    norm_company = normalize_company_name(company)
    domain = urlparse(url).netloc.replace("www.", "").split(".")[0]

    title_meta = get_page_title_meta(html)
    body_text = extract_visible_text(html, limit_chars=8000)
    full_text_upper = (title_meta + " " + body_text).upper()

    score = 0.0

    # 1) name similarity vs title/meta (weight 0.35)
    title_sim = name_similarity(norm_company, normalize_company_name(title_meta))
    reasons["title_name_similarity"] = round(title_sim, 3)
    score += 0.35 * title_sim

    # 2) name similarity vs domain itself (weight 0.15)
    domain_sim = name_similarity(norm_company, normalize_company_name(domain))
    reasons["domain_name_similarity"] = round(domain_sim, 3)
    score += 0.15 * domain_sim

    # 3) registration number literally present on page (weight 0.25 — strong signal)
    reg_no = (lead.get("registrationNo") or "").strip().upper()
    reg_found = bool(reg_no) and reg_no in full_text_upper
    reasons["registration_no_found"] = reg_found
    if reg_found:
        score += 0.25

    # 4) city/state mention (weight 0.10)
    city = (lead.get("city") or "").strip()
    state = (lead.get("state") or "").strip()
    location_found = bool((city and city.upper() in full_text_upper) or (state and state.upper() in full_text_upper))
    reasons["location_found"] = location_found
    if location_found:
        score += 0.10

    # 5) finance/trading domain relevance (weight 0.15 — filters out unrelated
    #    same-name companies, e.g. a textile company with a similar name)
    finance_hits = sum(1 for kw in FINANCE_KEYWORDS if kw in body_text.lower())
    reasons["finance_keyword_hits"] = finance_hits
    score += 0.15 * min(finance_hits / 3.0, 1.0)

    score = round(min(score, 1.0), 3)
    reasons["final_score"] = score
    return {"score": score, "reasons": reasons}


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
    for attempt in range(5):
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
                timeout=30,
            )
            if resp.status_code == 429:
                time.sleep(4 + attempt * 4)
                continue
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            text = text.strip().strip("```json").strip("```").strip()
            return json.loads(text)
        except Exception as e:
            resp_obj = getattr(e, "response", None)
            err_msg = resp_obj.text if resp_obj is not None else str(e)
            if resp_obj is not None and resp_obj.status_code == 429 and attempt < 4:
                time.sleep(4 + attempt * 4)
                continue
            print(f"  [llm error] {e} -> {err_msg}")
            return {}
    print("  [GROQ RATE LIMIT] Exhausted 5 retries.")
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


def enrich_lead(lead: dict, serper_key: str, groq_key: str, use_llm: bool) -> dict:
    company = (lead.get("name") or "").strip()
    city = lead.get("city") or ""
    if not city and lead.get("address"):
        addr_parts = [p.strip() for p in lead["address"].split(",") if p.strip()]
        city = addr_parts[-2] if len(addr_parts) >= 2 else (addr_parts[-1] if addr_parts else "")

    other_listings_str = lead.get("otherListings") or ""

    # Step 1: search (2 queries, merge results)
    query = build_search_query(lead, city)
    results = search_company(query, serper_key, max_results=10)
    search_failed = results is None
    results = results or []

    if company:
        results2 = search_company(f"{company} {city}".strip(), serper_key, max_results=10)
        if results2 is None:
            search_failed = search_failed and True  # both failed -> still failed
        else:
            search_failed = False
            results = results + results2

    directory_url = pick_directory_website(results)
    socials = pick_social_links(results)

    # Step 2: build verified candidate list, fetch + score each
    candidates = candidate_domains(results, other_listings_str)
    best = {"url": "", "score": 0.0, "html": "", "reasons": {}}
    for cand in candidates[:8]:  # top 8 candidates max, keep it fast
        cand_url = cand.get("url", "")
        html = fetch_page(cand_url)
        if not html:
            continue
        verification = verify_official_website(lead, cand_url, html)
        if verification["score"] > best["score"]:
            best = {"url": cand_url, "score": verification["score"], "html": html, "reasons": verification["reasons"]}

    website = best["url"] if best["score"] >= WEBSITE_MATCH_THRESHOLD else ""
    homepage_html = best["html"] if website else ""
    has_own_website = bool(website)

    # no_own_website: sirf tab True jab search chali (fail nahi hui) aur
    # koi candidate threshold pass nahi kar paya
    no_own_website = (not has_own_website) and (not search_failed) and (len(candidates) >= 0)

    reg_no = (lead.get("registrationNo") or "").strip().upper()
    verified = bool(reg_no and homepage_html and reg_no in homepage_html.upper())

    contacts = extract_contacts(homepage_html) if homepage_html else {"emails": [], "phones": []}
    if homepage_html and website:
        socials.update(extract_social_from_html(website, homepage_html))
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
        "website_match_score": best["score"],
        "website_match_reasons": best["reasons"],
        "registration_no_found_on_site": verified,
        "socials": socials,
        "contacts_found_on_site": contacts,
        "site_text": about_text[:6000],
    }

    enrichment = llm_structure(lead, raw_findings, groq_key) if (use_llm and website) else {}

    return {
        "lead": lead,
        "website": website,
        "website_confidence": best["score"],
        "website_match_reasons": best["reasons"],
        "no_own_website": no_own_website,
        "search_failed": search_failed,
        "directory_url": directory_url,
        "has_own_website": has_own_website,
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
    SELECT *
        FROM "Lead"
        WHERE website ='' OR website is null
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
    directory_url = e.get("directory_url", "")
    has_own_website = e.get("has_own_website", False)
    no_own_website = e.get("no_own_website", False)
    website_confidence = e.get("website_confidence", 0.0)

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
    if about_summary and services:
        services = f"{about_summary} | {services}"
    elif about_summary:
        services = about_summary

    logo_url = e.get("logoUrl", "")
    found_emails = e.get("contacts_found_on_site", {}).get("emails", [])
    found_phones = e.get("contacts_found_on_site", {}).get("phones", [])
    scraped_email = found_emails[0] if found_emails else None
    scraped_phone = found_phones[0] if found_phones else None

    if e.get("search_failed"):
        print(f"  [skip update] lead {lead_id}: search itself failed, DB row untouched")
        return

    if not website and not directory_url and not no_own_website:
        print(f"  [skip update] lead {lead_id}: inconclusive, DB row untouched")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    update_q = '''
        UPDATE "Lead" SET
            "isEnriched" = true,
            "hasOwnWebsite" = %s,
            "noOwnWebsite" = %s,
            "websiteConfidence" = %s,
            "websiteCheckedAt" = %s,
            "website" = %s,
            "directoryUrl" = %s,
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
        has_own_website, no_own_website, website_confidence, datetime.datetime.utcnow(),
        website, directory_url, linkedin, twitter, facebook,
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
            "website_confidence": e.get("website_confidence", ""),
            "no_own_website": e.get("no_own_website", ""),
            "directory_url": e.get("directory_url", ""),
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
    global WEBSITE_MATCH_THRESHOLD
    parser = argparse.ArgumentParser(description="Enrich leads with empty website column (strict verification).")
    parser.add_argument("--output", default="enriched_empty_website.csv")
    parser.add_argument("--limit", type=int, default=0, help="0 = saare empty-website leads")
    parser.add_argument("--use-llm", action="store_true", help="Groq se about/services summary structure karo")
    parser.add_argument("--api-keys", default="", help="Comma-separated Serper API keys (overrides SERPER_API_KEY)")
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--threshold", type=float, default=WEBSITE_MATCH_THRESHOLD,
                         help="Website match confidence threshold (0-1), default 0.6")
    args = parser.parse_args()
    WEBSITE_MATCH_THRESHOLD = args.threshold

    try:
        from dotenv import load_dotenv
        script_dir = os.path.dirname(os.path.abspath(__file__))
        load_dotenv(os.path.join(script_dir, "..", ".env"))
        load_dotenv(os.path.join(script_dir, ".env"))
    except ImportError:
        pass

    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:123456@localhost:5432/algoconnect")
    env_keys = os.environ.get("SERPER_API_KEYS", os.environ.get("SERPER_API_KEY", ""))

    serper_keys_raw = args.api_keys if args.api_keys else env_keys
    serper_keys = [k.strip() for k in serper_keys_raw.split(",") if k.strip()]
    groq_key = os.environ.get("GROQ_API_KEY", "")

    if not serper_keys:
        print("WARNING: SERPER_API_KEY(S) set nahi hai. Search step skip hoga.")
    if args.use_llm and not groq_key:
        print("WARNING: --use-llm diya hai par GROQ_API_KEY set nahi hai.")

    key_state = {"idx": 0, "calls": 0, "lock": threading.Lock()}

    def get_serper_key():
        if not serper_keys:
            return ""
        with key_state["lock"]:
            if key_state["calls"] >= 700:
                key_state["calls"] = 0
                key_state["idx"] = (key_state["idx"] + 1) % len(serper_keys)
            key_state["calls"] += 1
            return serper_keys[key_state["idx"]]

    leads = fetch_leads_with_empty_website(db_url, args.limit)
    print(f"Loaded {len(leads)} leads with empty website from database.")
    print(f"Website match threshold: {WEBSITE_MATCH_THRESHOLD}")

    def process_single_lead(item):
        i, lead = item
        try:
            time.sleep(DELAY_BETWEEN_LEADS)
            key = get_serper_key()
            result = enrich_lead(lead, key, groq_key, args.use_llm)
            if "id" in lead:
                update_lead_in_db(db_url, lead["id"], result)
            if result.get("website"):
                status = f"FOUND (score={result.get('website_confidence')})"
            elif result.get("no_own_website"):
                status = "NO OWN WEBSITE (confirmed)"
            elif result.get("search_failed"):
                status = "SEARCH FAILED"
            else:
                status = "INCONCLUSIVE"
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
    no_website_count = sum(1 for e in enriched if e.get("no_own_website"))
    print(f"\nDone. {found_count}/{len(leads)} leads ke liye website mili (confidence >= {WEBSITE_MATCH_THRESHOLD}).")
    print(f"{no_website_count}/{len(leads)} leads confirm ho gaye ki unki khud ki website NAHI hai (pitch list ke liye).")
    print(f"Saved: {args.output} aur {out_json}")


if __name__ == "__main__":
    main()