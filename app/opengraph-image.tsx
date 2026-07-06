// app/opengraph-image.tsx
import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Linkslobby — Play. Confess. Connect."

// Vercel's documented pattern for pulling a Google Font into an OG image:
// ask Google's CSS endpoint for the @font-face src, then fetch that file.
async function loadGoogleFont(font: string, weight: number, text: string) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(
        text
      )}`
    )
  ).text()

  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/)
  if (match) {
    const res = await fetch(match[1])
    if (res.ok) return res.arrayBuffer()
  }
  throw new Error(`Failed to load font: ${font}`)
}

export default async function OpengraphImage() {
  const tagline = "Play. Confess. Connect."
  const subtext = "Games, confessions & anonymous messages with your friends."

  const [logoData, spaceGrotesk, inter] = await Promise.all([
    fetch(new URL("../public/linkslobby-logo.png", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    loadGoogleFont("Space+Grotesk", 700, tagline),
    loadGoogleFont("Inter", 500, subtext),
  ])

  const logoSrc = `data:image/png;base64,${Buffer.from(logoData).toString(
    "base64"
  )}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "linear-gradient(135deg, #14091f 0%, #1a0f2e 55%, #2a1245 100%)",
        }}
      >
        {/* ambient faint-purple glows, matching the landing page */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: -120,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: "rgba(147, 51, 234, 0.35)",
            filter: "blur(110px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(168, 85, 247, 0.25)",
            filter: "blur(110px)",
          }}
        />

        <img
          src={logoSrc}
          width={520}
          height={147}
          style={{ marginBottom: 40 }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 54,
            fontFamily: "Space Grotesk",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          {tagline}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 26,
            fontFamily: "Inter",
            fontWeight: 500,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {subtext}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: spaceGrotesk, weight: 700, style: "normal" },
        { name: "Inter", data: inter, weight: 500, style: "normal" },
      ],
    }
  )
}
