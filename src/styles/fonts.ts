import { Geist, Geist_Mono } from "next/font/google";

// Self-hosted by next/font. Shared by both root layouts (the site and the
// admin), so each face is downloaded once.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Class names that define the font variables, for <html>. */
export const FONT_VARIABLES = `${geistSans.variable} ${geistMono.variable}`;
