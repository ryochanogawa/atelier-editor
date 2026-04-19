import { describe, it, expect } from "vitest";
import { atelierDarkTheme, ATELIER_THEME_NAME } from "@/lib/editor/theme";

describe("atelierDarkTheme", () => {
  it("is based on vs-dark with inherit enabled", () => {
    expect(atelierDarkTheme.base).toBe("vs-dark");
    expect(atelierDarkTheme.inherit).toBe(true);
  });

  it("defines token rules for syntax highlighting", () => {
    const tokenTypes = atelierDarkTheme.rules.map((r) => r.token);
    expect(tokenTypes).toContain("comment");
    expect(tokenTypes).toContain("keyword");
    expect(tokenTypes).toContain("string");
    expect(tokenTypes).toContain("number");
    expect(tokenTypes).toContain("type");
    expect(tokenTypes).toContain("function");
    expect(tokenTypes).toContain("variable");
  });

  it("defines editor background and foreground colors", () => {
    expect(atelierDarkTheme.colors["editor.background"]).toBe("#1e1e1e");
    expect(atelierDarkTheme.colors["editor.foreground"]).toBe("#d4d4d4");
  });

  it("defines cursor and selection colors", () => {
    expect(atelierDarkTheme.colors["editorCursor.foreground"]).toBeDefined();
    expect(atelierDarkTheme.colors["editor.selectionBackground"]).toBeDefined();
  });
});

describe("ATELIER_THEME_NAME", () => {
  it("is 'atelier-dark'", () => {
    expect(ATELIER_THEME_NAME).toBe("atelier-dark");
  });
});
