/**
 * URL and Favicon Utilities for SocraticOS Web Saver
 */

/**
 * Normalizes a raw URL string by trimming whitespace, ensuring standard protocol (https://),
 * and stripping dangerous javascript: or data: URIs.
 * 
 * @param {string} rawUrl 
 * @returns {string} Normalized URL string or empty string if invalid
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let trimmed = rawUrl.trim();

  // Guard against dangerous schemes
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return "";
  }

  // Prepend https:// if protocol is missing
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    // Check if it looks like a domain / path
    if (trimmed.startsWith("//")) {
      trimmed = "https:" + trimmed;
    } else {
      trimmed = "https://" + trimmed;
    }
  }

  try {
    const parsed = new URL(trimmed);
    // Ensure valid HTTP/HTTPS protocol
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Validates if a string is a valid HTTP or HTTPS URL.
 * 
 * @param {string} rawUrl 
 * @returns {boolean}
 */
export function isValidUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  return Boolean(normalized);
}

/**
 * Extracts a clean domain/hostname from a URL string (e.g. "developer.mozilla.org").
 * 
 * @param {string} rawUrl 
 * @returns {string} Clean domain name or empty string
 */
export function extractDomain(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    let hostname = parsed.hostname;
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return "";
  }
}

/**
 * Generates an automated high-resolution Google favicon service URL for a given URL or domain.
 * 
 * @param {string} rawUrl 
 * @param {number} [size=64] - Favicon resolution size (e.g. 32, 64, 128)
 * @returns {string} Google Favicon URL
 */
export function getFaviconUrl(rawUrl, size = 64) {
  const domain = extractDomain(rawUrl);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Derives a human-readable title from a URL if no title is provided by the user.
 * Example: "https://github.com/facebook/react" -> "React — Github"
 * Example: "https://en.wikipedia.org/wiki/Calculus" -> "Calculus — Wikipedia"
 * 
 * @param {string} rawUrl 
 * @returns {string} Derived readable title
 */
export function generateFallbackTitle(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "Saved Website";

  try {
    const parsed = new URL(normalized);
    let domain = extractDomain(normalized);
    
    // Clean up domain name for display (e.g. "en.wikipedia.org" -> "Wikipedia", "github.com" -> "Github")
    const domainParts = domain.split(".");
    let domainName = domainParts[0] || "Website";
    if (domainParts.length > 2 && /^(en|m|docs|api|app|www|beta|dev)$/i.test(domainParts[0])) {
      domainName = domainParts[1] || domainParts[0];
    }
    domainName = domainName.charAt(0).toUpperCase() + domainName.slice(1);

    // Check pathname for meaningful segments
    const pathSegments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map(seg => decodeURIComponent(seg).replace(/[-_+]/g, " ").trim())
      .filter(seg => seg.length > 0 && !/^(index|page|html|php|jsp|v\d+|en|docs|wiki)$/i.test(seg));

    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      const capitalized = lastSegment
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return `${capitalized} — ${domainName}`;
    }

    return `${domainName}`;
  } catch {
    return "Saved Website";
  }
}
