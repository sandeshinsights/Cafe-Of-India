import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#5C1A1B",
          borderRadius: "36px",
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: "bold",
            color: "#C4973B",
            fontFamily: "Georgia, serif",
          }}
        >
          C
        </span>
      </div>
    ),
    { ...size }
  );
}