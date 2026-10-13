import { ImageResponse } from "next/og";

// Default share image for pages without their own (the layout declares summary_large_image).
export const alt = "Ridekit · Capacetes e equipamentos para moto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#1f1f1f", color: "#ffffff" }}>
        <div style={{ display: "flex", width: 120, height: 12, background: "#f28000", borderRadius: 6 }} />
        <div style={{ marginTop: 40, fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>RIDEKIT</div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#d4d4d4" }}>Capacetes e equipamentos para moto</div>
        <div style={{ marginTop: 48, fontSize: 28, color: "#f28000" }}>Produto original · Nota fiscal · Troca facilitada</div>
      </div>
    ),
    size,
  );
}
