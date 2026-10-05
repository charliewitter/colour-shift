import { ImageResponse } from "next/og";

// Home screen icon (iOS rounds the corners itself). Same placeholder as icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <div style={{ flex: 1, background: "#e8643c" }} />
        <div style={{ flex: 1, background: "#1f3a5f" }} />
      </div>
    ),
    size,
  );
}
