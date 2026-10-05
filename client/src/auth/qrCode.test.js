import { describe, expect, it, vi } from "vitest";

const toDataURL = vi.fn().mockResolvedValue("data:image/png;base64,AAA");
vi.mock("qrcode", () => ({ default: { toDataURL } }));

describe("generateQrDataUrl", () => {
  it("gera o QR localmente com a lib qrcode", async () => {
    const { generateQrDataUrl } = await import("./qrCode.js");
    await expect(generateQrDataUrl("otpauth://totp/x?secret=ABC")).resolves.toBe("data:image/png;base64,AAA");
    expect(toDataURL).toHaveBeenCalledWith("otpauth://totp/x?secret=ABC", expect.objectContaining({ margin: 1 }));
  });
});
