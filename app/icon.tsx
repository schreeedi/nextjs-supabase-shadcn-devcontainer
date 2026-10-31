import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// Favicon generated at build time (static) — replace with app/icon.png or
// app/favicon.ico once there is a real logo.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        color: "#fafafa",
        borderRadius: 6,
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      {SITE_NAME.charAt(0)}
    </div>,
    size,
  );
}
