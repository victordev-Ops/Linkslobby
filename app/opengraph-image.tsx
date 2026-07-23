// app/opengraph-image.tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Linkslobby — Connect and Play"

// Must not be prerendered at build time: the Google Fonts fetch below needs
// live network access, which Vercel's build sandbox doesn't have (only the
// deployed serverless function does, at request time).
export const dynamic = "force-dynamic"

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
  // Three real actions, not one slogan — the tagline is a literal 3-step
  // sequence (play a game → confess something → connect with a friend), so
  // giving each word its own weight/color step makes the typography carry
  // that structure instead of just repeating it as plain bold text.
  const words = [
    { text: "Connect.", color: "#ffffff" },
    { text: "Play.", color: "#c084fc" },
  ]
  const tagline = words.map((w) => w.text).join(" ")
  const subtext = "Play Games, confessions & anonymous messages with your friends."
  const byline = "linkslobby.com"

  const [logoData, spaceGroteskBold, interMedium, interSemibold] = await Promise.all([
    readFile(path.join(process.cwd(), "public/linkslobby-logo-og.png")),
    loadGoogleFont("Space+Grotesk", 700, tagline),
    loadGoogleFont("Inter", 500, subtext),
    loadGoogleFont("Inter", 600, byline),
  ])

  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`

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

        <img src={logoSrc} width={480} height={136} style={{ marginBottom: 36 }} />

        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontFamily: "Space Grotesk",
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          {words.map((w, i) => (
            <span key={w.text} style={{ color: w.color, marginRight: i < words.length - 1 ? 18 : 0 }}>
              {w.text}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 22,
            maxWidth: 620,
            textAlign: "center",
            fontSize: 25,
            lineHeight: 1.5,
            fontFamily: "Inter",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {subtext}
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            fontFamily: "Inter",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.32)",
          }}
        >
          {byline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: spaceGroteskBold, weight: 700, style: "normal" },
        { name: "Inter", data: interMedium, weight: 500, style: "normal" },
        { name: "Inter", data: interSemibold, weight: 600, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=86400, s-maxage=86400",
      },
    }
  )
}
