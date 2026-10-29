import { describe, expect, it } from "vitest";
import { en, ko } from "../shared/messages";

function keys(resource: object, prefix = ""): string[] {
  return Object.entries(resource).flatMap(([key, value]) => (typeof value === "string" ? [prefix + key] : keys(value, `${prefix}${key}.`))).sort();
}

function placeholders(resource: object): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (node: object, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") out[prefix + key] = [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]!).sort();
      else walk(value, `${prefix}${key}.`);
    }
  };
  walk(resource, "");
  return out;
}

describe("UI messages", () => {
  it("has the same keys in English and Korean", () => {
    expect(keys(ko)).toEqual(keys(en));
  });

  it("uses the same placeholders in both languages", () => {
    expect(placeholders(ko)).toEqual(placeholders(en));
  });

  it("keeps the English text free of Hangul", () => {
    expect(JSON.stringify(en)).not.toMatch(/[가-힣]/);
  });
});
