// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grid Shift",
  description: "Hyper casual puzzle game — swipe to shift, match 2×2 to blast.",
  openGraph: {
    title: "Grid Shift",
    description: "Global hypercasual puzzle. Can you beat the leaderboard?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 antialiased">
        {children}
      </body>
    </html>
  );
}
