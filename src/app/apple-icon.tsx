import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bar = (w: number, color: string, h = 12) => (
    <div style={{ width: w, height: h, background: color, borderRadius: h / 2, marginTop: 12 }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0e1116", display: "flex", flexDirection: "column", padding: "40px 34px" }}>
        <div style={{ width: 112, height: 16, background: "#fff" }} />
        {bar(80, "#d7263d")}
        {bar(98, "#1f5fbf")}
        {bar(58, "#e0a800")}
      </div>
    ),
    size,
  );
}
