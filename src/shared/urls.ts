// Address rules shared by the pages and the server.

/**
 * The host of a web address: lowercase, no scheme, no leading `www.`, no
 * path. A bare host gets `https://`. Null for anything but a valid http(s)
 * address with a dotted host.
 */
export function normalizeHost(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  if (hasScheme && !/^https?:\/\//i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  if (host.split(".").some((part) => !part || part.startsWith("-"))) return null;
  return host;
}

/** The address as an http(s) URL string, or null. */
export function httpUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** `Team Surveys!` as `team-surveys`. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** 1 as "Next", 2 as "2nd", 3 as "3rd", 11 as "11th". */
export function queuePosition(position: number): string {
  if (position === 1) return "Next";
  const tens = position % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
          position % 10
        ] ?? "th";
  return `${position}${suffix}`;
}
