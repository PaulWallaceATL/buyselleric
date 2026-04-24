import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Default social preview: tab house icon + stacked “Buy / Sell / Eric”. */
export async function ogBrandImageResponse(): Promise<ImageResponse> {
  const svg = readFileSync(join(process.cwd(), "app", "icon.svg"), "utf8");
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  const inter = await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-700-normal.woff",
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f4ef",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 52,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG pipeline */}
          <img src={iconSrc} width={248} height={248} alt="" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
            }}
          >
            {(["Buy", "Sell", "Eric"] as const).map((word) => (
              <div
                key={word}
                style={{
                  fontSize: 92,
                  fontWeight: 700,
                  color: "#1a2d42",
                  letterSpacing: "-0.04em",
                  lineHeight: 0.98,
                  fontFamily: "Inter",
                }}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: inter, style: "normal", weight: 700 }],
    },
  );
}
