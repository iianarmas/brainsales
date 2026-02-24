/**
 * A comprehensive list of generic/public email providers that should NOT
 * be allowed as company domain whitelists.
 *
 * If a user enters one of these as their "company domain," any person in the
 * world with that email provider would be auto-admitted — a major security hole.
 *
 * Used in both the /register frontend and the /api/organizations/register API.
 */
export const GENERIC_EMAIL_DOMAINS = new Set([
    // Google
    "gmail.com",
    "googlemail.com",
    // Microsoft
    "hotmail.com",
    "hotmail.co.uk",
    "hotmail.fr",
    "hotmail.de",
    "hotmail.es",
    "hotmail.it",
    "live.com",
    "live.co.uk",
    "live.fr",
    "live.de",
    "live.nl",
    "live.com.au",
    "outlook.com",
    "outlook.co.uk",
    "msn.com",
    "passport.com",
    // Yahoo
    "yahoo.com",
    "yahoo.co.uk",
    "yahoo.co.in",
    "yahoo.com.au",
    "yahoo.fr",
    "yahoo.de",
    "yahoo.es",
    "yahoo.it",
    "yahoo.ca",
    "ymail.com",
    "rocketmail.com",
    // Apple
    "icloud.com",
    "me.com",
    "mac.com",
    // AOL / Verizon
    "aol.com",
    "aim.com",
    "verizon.net",
    // Comcast / Charter
    "comcast.net",
    "xfinity.com",
    "charter.net",
    "sbcglobal.net",
    "att.net",
    "bellsouth.net",
    // Other major free providers
    "protonmail.com",
    "proton.me",
    "pm.me",
    "tutanota.com",
    "tuta.io",
    "zoho.com",
    "mail.com",
    "email.com",
    "usa.com",
    "gmx.com",
    "gmx.net",
    "gmx.de",
    "web.de",
    "freenet.de",
    "t-online.de",
    "yandex.com",
    "yandex.ru",
    "mail.ru",
    "inbox.ru",
    "list.ru",
    "bk.ru",
    "rambler.ru",
    "qq.com",
    "163.com",
    "126.com",
    "sina.com",
    "rediffmail.com",
    "naver.com",
    "daum.net",
    "hushmail.com",
    "fastmail.com",
    "fastmail.fm",
    "runbox.com",
    "mailfence.com",
    "guerrillamail.com",
    "temp-mail.org",
    "throwam.com",
    "sharklasers.com",
    "guerrillamailblock.com",
]);

/**
 * Returns true if the given domain is a generic public email provider
 * that should not be used as a company SSO domain.
 */
export function isGenericEmailDomain(domain: string): boolean {
    return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase().trim());
}
