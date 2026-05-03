import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Structural guard: NotificationPopupContent is rendered inside a custom
 * portal that is NOT wrapped in <Dialog>. Importing Radix Dialog primitives
 * (DialogTitle, DialogHeader, etc.) here will crash the dashboard at runtime
 * with "DialogTitle must be used within Dialog". Block any future regression
 * at the file-level.
 */
describe("NotificationPopupContent structural guard", () => {
  const file = readFileSync(
    path.resolve(__dirname, "../NotificationPopupContent.tsx"),
    "utf-8",
  );

  it("does not import from @/components/ui/dialog", () => {
    expect(file).not.toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });

  it("does not import from @radix-ui/react-dialog", () => {
    expect(file).not.toMatch(/@radix-ui\/react-dialog/);
  });

  it("does not reference Radix Dialog primitive components", () => {
    expect(file).not.toMatch(/<Dialog(Title|Header|Description|Content|Footer|Overlay|Portal|Close|Trigger)\b/);
  });
});
