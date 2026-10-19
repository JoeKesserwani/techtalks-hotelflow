// components/Auth/LoginBackground.tsx
// Simple + cute: soft little hotel "stickers" that gently bob around the login box.
// Decorative only, no hooks, deterministic data (safe for server/client rendering).

import type { CSSProperties, ReactNode } from "react";
import styles from "./LoginBackground.module.css";

type IconName =
  | "key"
  | "bell"
  | "bed"
  | "moon"
  | "suitcase"
  | "coffee"
  | "heart"
  | "star";

// Simple rounded line icons (24x24)
const ICONS: Record<IconName, ReactNode> = {
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13l9-9M15 8l3 3M17.5 5.5l2 2" />
    </>
  ),
  bell: (
    <>
      <path d="M4.5 17a7.5 7.5 0 0 1 15 0" />
      <path d="M3 17h18M5 20.5h14M12 9.5V7M10.5 7h3" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V7M3 14h18v4M21 14a3 3 0 0 0-3-3h-7v3" />
      <circle cx="7" cy="11" r="1.6" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  suitcase: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2.5" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  star: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
};

type Tone = "sage" | "clay" | "linen" | "olive";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  sage: { bg: "#DCE6D0", fg: "#55704A" },
  clay: { bg: "#F6DCCD", fg: "#BA6035" },
  linen: { bg: "#EFE4CF", fg: "#A97C50" },
  olive: { bg: "#7C8A67", fg: "#FAF2E5" },
};

type Sticker = {
  icon: IconName;
  tone: Tone;
  x: number; // % from left
  y: number; // % from top
  size: number; // px
  round?: boolean; // circle instead of rounded square
  tilt: number; // deg
  seconds: number; // bob speed
  delay: number; // negative = starts mid-way so they never move in sync
};

const STICKERS: Sticker[] = [
  { icon: "key", tone: "sage", x: 8, y: 14, size: 64, round: true, tilt: -8, seconds: 7, delay: -1 },
  { icon: "bell", tone: "clay", x: 21, y: 7, size: 56, tilt: 7, seconds: 8, delay: -4 },
  { icon: "moon", tone: "linen", x: 5, y: 47, size: 58, round: true, tilt: -5, seconds: 9, delay: -2 },
  { icon: "bed", tone: "olive", x: 11, y: 78, size: 66, tilt: 6, seconds: 8, delay: -6 },
  { icon: "suitcase", tone: "sage", x: 25, y: 90, size: 54, tilt: -7, seconds: 7, delay: -3 },
  { icon: "coffee", tone: "linen", x: 90, y: 11, size: 60, tilt: 6, seconds: 9, delay: -5 },
  { icon: "heart", tone: "clay", x: 77, y: 6, size: 50, round: true, tilt: -9, seconds: 6, delay: -2 },
  { icon: "star", tone: "sage", x: 94, y: 45, size: 52, round: true, tilt: 8, seconds: 8, delay: -7 },
  { icon: "bell", tone: "olive", x: 88, y: 77, size: 62, tilt: -6, seconds: 9, delay: -1 },
  { icon: "key", tone: "clay", x: 75, y: 91, size: 52, round: true, tilt: 7, seconds: 7, delay: -4 },
];

// tiny twinkles
const SPARKLES = [
  { x: 15, y: 28, size: 14, delay: 0 },
  { x: 30, y: 17, size: 10, delay: -1.2 },
  { x: 7, y: 64, size: 12, delay: -2.4 },
  { x: 82, y: 22, size: 12, delay: -0.6 },
  { x: 93, y: 62, size: 10, delay: -1.8 },
  { x: 70, y: 82, size: 14, delay: -3 },
];

export default function LoginBackground() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={`${styles.blob} ${styles.blobSage}`} />
      <div className={`${styles.blob} ${styles.blobClay}`} />

      {SPARKLES.map((s, i) => (
        <svg
          key={`sparkle-${i}`}
          className={styles.sparkle}
          viewBox="0 0 24 24"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        >
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
        </svg>
      ))}

      {STICKERS.map((s, i) => {
        const tone = TONES[s.tone];
        return (
          <div
            key={`sticker-${i}`}
            className={styles.slot}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <div
              className={`${styles.sticker} ${s.round ? styles.round : ""}`}
              style={
                {
                  width: s.size,
                  height: s.size,
                  "--bg": tone.bg,
                  "--fg": tone.fg,
                  "--r": `${s.tilt}deg`,
                  "--delay": `${s.delay}s`,
                  animationDuration: `${s.seconds}s`,
                  animationDelay: `${s.delay}s`,
                } as CSSProperties
              }
            >
              <svg
                viewBox="0 0 24 24"
                width="52%"
                height="52%"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[s.icon]}
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}