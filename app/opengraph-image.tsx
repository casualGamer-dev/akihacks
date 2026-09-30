import { ImageResponse } from "next/og";

export const alt = "AKI HACKS 2026 — Build Solutions. Break Barriers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f5f2",
          color: "#0c0c0d",
          padding: 72,
          borderLeft: "24px solid #f25d27",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700 }}>First edition · Kolkata · October 2026</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 190, fontWeight: 900, lineHeight: 0.9, letterSpacing: -6 }}>AKI HACKS</div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, marginTop: 28 }}>
            Build Solutions. <span style={{ color: "#c93f0d", marginLeft: 16 }}>Break Barriers.</span>
          </div>
        </div>
        <div style={{ fontSize: 30 }}>akihacks.xyz</div>
      </div>
    ),
    size,
  );
}
