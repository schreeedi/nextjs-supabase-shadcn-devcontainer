import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// Share image for every page without its own (inherited by segments below).
// Generated at build time; the twitter card in app/layout.tsx uses it too.
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        gap: 24,
        background: "#fafafa",
        color: "#171717",
      }}
    >
      <div style={{ fontSize: 88, fontWeight: 700 }}>{SITE_NAME}</div>
      <div style={{ fontSize: 40, color: "#525252" }}>{SITE_DESCRIPTION}</div>
    </div>,
    size,
  );
}
