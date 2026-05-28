import { describe, it, expect } from "vitest";
import { safeAppRedirect } from "@/lib/routing";
import { uploadPhaseHint, uploadPhaseLabel } from "@/pages/Upload";

describe("routing helpers", () => {
  it("allows only app-local redirects", () => {
    expect(safeAppRedirect("/profile?tab=stats")).toBe("/profile?tab=stats");
    expect(safeAppRedirect("//evil.test")).toBe("/");
    expect(safeAppRedirect("https://evil.test")).toBe("/");
    expect(safeAppRedirect(null, "/auth")).toBe("/auth");
  });
});

describe("upload progress copy", () => {
  it("uses explicit copy for known and fallback upload phases", () => {
    expect(uploadPhaseLabel("processing_highlights")).toBe("Preparing editor…");
    expect(uploadPhaseHint("processing_highlights")).toContain("Highlight detection queue");
    expect(uploadPhaseLabel("idle")).toBe("Working...");
  });
});
