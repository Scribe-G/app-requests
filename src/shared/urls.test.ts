import { describe, expect, it } from "vitest";
import { normalizeHost, queuePosition, slugify } from "./urls";

describe("normalizeHost", () => {
  it("keeps only the lowercase host", () => {
    expect(normalizeHost("https://www.Example.com/pricing?x=1#top")).toBe("example.com");
    expect(normalizeHost("http://APP.example.io")).toBe("app.example.io");
    expect(normalizeHost("example.com/path")).toBe("example.com");
  });
  it("refuses what isn't an http(s) address", () => {
    for (const input of ["", "not a url", "ftp://example.com", "javascript:alert(1)", "https://localhost", "mailto:a@b.com", "https://user:pw@example.com"]) {
      expect(normalizeHost(input), input).toBeNull();
    }
  });
});

describe("queuePosition", () => {
  it("reads as a place in line", () => {
    expect([1, 2, 3, 4, 11, 12, 21, 22, 23].map(queuePosition)).toEqual([
      "Next", "2nd", "3rd", "4th", "11th", "12th", "21st", "22nd", "23rd",
    ]);
  });
});

describe("slugify", () => {
  it("makes a URL slug from a name", () => {
    expect(slugify("Team Surveys!")).toBe("team-surveys");
    expect(slugify("  Café  Menu ")).toBe("cafe-menu");
  });
});
