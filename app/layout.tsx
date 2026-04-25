// app/layout.tsx
// Next.js App Router 필수 루트 레이아웃
// 이 파일을 your-next-app/app/layout.tsx 에 배치하세요.

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
      {/*
        bg-gray-950: 게임 배경색과 일치시켜 모바일에서
        주소창 영역까지 자연스럽게 이어지도록 설정
      */}
      <body className="bg-gray-950 antialiased">
        {children}
      </body>
    </html>
  );
}
