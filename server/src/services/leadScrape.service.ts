const SKIP_DOMAINS = [
  'wikipedia.org', 'youtube.com', 'sebi.gov.in', 'moneycontrol.com',
  'economictimes.indiatimes.com', 'google.com', 'justdial.com',
  'instagram.com', 'facebook.com', 'twitter.com', 'x.com',
  'linkedin.com', 'indiamart.com', 'sulekha.com', 'zaubacorp.com',
  'nseindia.com', 'bseindia.com', 'mca.gov.in', 'companycheck.co.in',
  'probe42.in', 'screener.in', 'tofler.in', 'zoominfo.com', 'pitchbook.com',
  'crunchbase.com', 'vakilsearch.com', 'bloomberg.com', 'algotest.in',
  'indiafilings.com', 'yahoo.com', 'sec.gov', 'reuters.com',
];

const CONTACT_PATHS = ['/', '/contact', '/contact-us', '/contactus', '/about', '/about-us'];

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const isValidEmail = (emailStr: string): boolean => {
  const clean = emailStr.trim().toLowerCase();
  if (clean.length < 6 || !clean.includes('@') || !clean.includes('.')) return false;
  if (/\.(png|jpg|jpeg|gif|svg|css|js|webp|woff2?)$/i.test(clean)) return false;
  if (
    clean.includes('example.com') ||
    clean.includes('sentry.io') ||
    clean.includes('wixpress.com') ||
    clean.includes('cloudflare') ||
    clean.includes('schema.org') ||
    clean.startsWith('noreply@') ||
    clean.startsWith('no-reply@')
  ) {
    return false;
  }
  return true;
};

const normalizeUrl = (raw: string): string => {
  let domain = raw.trim();
  if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
  return domain;
};

const originOf = (urlStr: string): string => {
  try {
    return new URL(urlStr).origin;
  } catch {
    return urlStr.replace(/\/+$/, '');
  }
};

export const fetchPageContent = async (urlStr: string, timeoutMs = 10000): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: REQUEST_HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('html') && !contentType.includes('text')) return '';
    const text = await res.text();
    return text.slice(0, 400000);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
};

export const extractEmails = (html: string, preferredDomain?: string): string[] => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matched = html.match(emailRegex) || [];
  const unique = [...new Set(matched.map((e) => e.trim().toLowerCase()).filter(isValidEmail))];
  if (!preferredDomain) return unique;
  const host = preferredDomain.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase();
  return unique.sort((a, b) => Number(b.includes(host)) - Number(a.includes(host)));
};

export const extractPhones = (html: string): string[] => {
  const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}/g;
  const matched = html.match(phoneRegex) || [];
  const unique = [...new Set(matched.map((p) => p.replace(/[\s-]/g, '').trim()))];
  return unique;
};

export const findWebsiteFromSearch = async (
  name: string,
  registrationNo?: string | null
): Promise<string | null> => {
  const key = process.env.SERPER_API_KEY;
  if (!key || !name) return null;

  const query = registrationNo ? `"${name}" ${registrationNo}` : `"${name}" official website`;
  try {
    const resp = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 8 }),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const links: string[] = (data.organic || [])
      .map((r: any) => r?.link)
      .filter((link: unknown): link is string => typeof link === 'string');

    for (const link of links) {
      let host = '';
      try {
        host = new URL(link).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        continue;
      }
      if (SKIP_DOMAINS.some((d) => host.includes(d))) continue;
      if (link.toLowerCase().endsWith('.pdf')) continue;
      return link;
    }
  } catch {
    return null;
  }
  return null;
};

export const scrapeWebsiteContactInfo = async (website: string) => {
  const base = normalizeUrl(website);
  const origin = originOf(base);
  const pagesToTry = CONTACT_PATHS.map((p) => (p === '/' ? base : `${origin}${p}`));
  const uniquePages = [...new Set(pagesToTry)];

  const htmlChunks = await Promise.all(uniquePages.map((url) => fetchPageContent(url, 8000)));
  const html = htmlChunks.filter(Boolean).join('\n');
  const emails = extractEmails(html, origin);
  const phones = extractPhones(html);

  return {
    htmlFound: html.length > 0,
    emailFound: emails[0] || null,
    phoneFound: phones[0] || null,
  };
};
