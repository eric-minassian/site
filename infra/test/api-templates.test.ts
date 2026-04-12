import { describe, expect, it } from "vitest";

// Test slug validation regex (same as in templates.ts)
const SLUG_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

describe("template slug validation", () => {
  it("accepts valid slugs", () => {
    expect(SLUG_RE.test("my-template")).toBe(true);
    expect(SLUG_RE.test("minimal")).toBe(true);
    expect(SLUG_RE.test("dark-mode-v2")).toBe(true);
    expect(SLUG_RE.test("portfolio-theme")).toBe(true);
    expect(SLUG_RE.test("ab")).toBe(false); // too short (min 3 chars)
    expect(SLUG_RE.test("abc")).toBe(true); // min length
  });

  it("rejects slugs starting with non-letter", () => {
    expect(SLUG_RE.test("1template")).toBe(false);
    expect(SLUG_RE.test("-template")).toBe(false);
  });

  it("rejects slugs ending with hyphen", () => {
    expect(SLUG_RE.test("template-")).toBe(false);
  });

  it("rejects uppercase slugs", () => {
    expect(SLUG_RE.test("My-Template")).toBe(false);
  });

  it("rejects slugs with special characters", () => {
    expect(SLUG_RE.test("my_template")).toBe(false);
    expect(SLUG_RE.test("my template")).toBe(false);
    expect(SLUG_RE.test("my.template")).toBe(false);
  });

  it("rejects slugs that are too long", () => {
    const long = "a" + "b".repeat(63) + "c"; // 65 chars
    expect(SLUG_RE.test(long)).toBe(false);
  });

  it("accepts max length slug", () => {
    const maxLen = "a" + "b".repeat(62) + "c"; // 64 chars
    expect(SLUG_RE.test(maxLen)).toBe(true);
  });
});

// Test variable validation logic (mirrors templates.ts)
const VALID_VARIABLE_TYPES = new Set([
  "color",
  "font",
  "number",
  "select",
  "text",
]);

function validateVariable(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return "Variable must be an object";
  const obj = v as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim())
    return "Variable name is required";
  if (typeof obj.label !== "string" || !obj.label.trim())
    return "Variable label is required";
  if (!VALID_VARIABLE_TYPES.has(obj.type as string))
    return "Variable type must be one of: color, font, number, select, text";
  if (typeof obj.default !== "string")
    return "Variable default value is required";
  if (
    obj.type === "select" &&
    (!Array.isArray(obj.options) || obj.options.length === 0)
  ) {
    return "Select variables must have options";
  }
  return null;
}

describe("template variable validation", () => {
  it("accepts valid color variable", () => {
    expect(
      validateVariable({
        name: "primaryColor",
        label: "Primary Color",
        type: "color",
        default: "#ff0000",
      }),
    ).toBeNull();
  });

  it("accepts valid text variable", () => {
    expect(
      validateVariable({
        name: "siteName",
        label: "Site Name",
        type: "text",
        default: "My Site",
      }),
    ).toBeNull();
  });

  it("accepts valid select variable with options", () => {
    expect(
      validateVariable({
        name: "layout",
        label: "Layout",
        type: "select",
        default: "grid",
        options: ["grid", "list", "masonry"],
      }),
    ).toBeNull();
  });

  it("rejects select variable without options", () => {
    expect(
      validateVariable({
        name: "layout",
        label: "Layout",
        type: "select",
        default: "grid",
      }),
    ).toBe("Select variables must have options");
  });

  it("rejects select variable with empty options", () => {
    expect(
      validateVariable({
        name: "layout",
        label: "Layout",
        type: "select",
        default: "grid",
        options: [],
      }),
    ).toBe("Select variables must have options");
  });

  it("rejects non-object values", () => {
    expect(validateVariable(null)).toBe("Variable must be an object");
    expect(validateVariable("string")).toBe("Variable must be an object");
    expect(validateVariable(42)).toBe("Variable must be an object");
  });

  it("rejects missing name", () => {
    expect(
      validateVariable({
        label: "Color",
        type: "color",
        default: "#000",
      }),
    ).toBe("Variable name is required");
  });

  it("rejects empty name", () => {
    expect(
      validateVariable({
        name: "  ",
        label: "Color",
        type: "color",
        default: "#000",
      }),
    ).toBe("Variable name is required");
  });

  it("rejects missing label", () => {
    expect(
      validateVariable({
        name: "color",
        type: "color",
        default: "#000",
      }),
    ).toBe("Variable label is required");
  });

  it("rejects invalid type", () => {
    expect(
      validateVariable({
        name: "color",
        label: "Color",
        type: "invalid",
        default: "#000",
      }),
    ).toBe("Variable type must be one of: color, font, number, select, text");
  });

  it("rejects missing default", () => {
    expect(
      validateVariable({
        name: "color",
        label: "Color",
        type: "color",
      }),
    ).toBe("Variable default value is required");
  });
});

// Test router matching logic (mirrors index.ts)
function matchRoute(
  patternSegments: string[],
  path: string,
): Record<string, string> | null {
  const pathSegments = path.split("/");
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const seg = patternSegments[i];
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = pathSegments[i];
    } else if (seg !== pathSegments[i]) {
      return null;
    }
  }
  return params;
}

describe("route matching", () => {
  it("matches exact paths", () => {
    const segs = "/api/templates".split("/");
    expect(matchRoute(segs, "/api/templates")).toEqual({});
  });

  it("extracts single param", () => {
    const segs = "/api/templates/:slug".split("/");
    expect(matchRoute(segs, "/api/templates/my-theme")).toEqual({
      slug: "my-theme",
    });
  });

  it("extracts param with suffix segments", () => {
    const segs = "/api/templates/:id/fork".split("/");
    expect(matchRoute(segs, "/api/templates/abc-123/fork")).toEqual({
      id: "abc-123",
    });
  });

  it("rejects mismatched segment count", () => {
    const segs = "/api/templates/:slug".split("/");
    expect(matchRoute(segs, "/api/templates")).toBeNull();
    expect(matchRoute(segs, "/api/templates/a/b")).toBeNull();
  });

  it("rejects mismatched literal segments", () => {
    const segs = "/api/templates/:id/fork".split("/");
    expect(matchRoute(segs, "/api/templates/abc/edit")).toBeNull();
  });
});
