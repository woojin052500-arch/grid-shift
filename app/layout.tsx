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
      <head>
        {/*
          Samsung 브라우저 포함 모든 모바일에서 실제 뷰포트 높이를 --vh 변수로 주입.
          100vh 대신 calc(var(--vh, 1vh) * 100) 를 사용하면 주소창 높이 문제 해결됨.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function setVh() {
                var vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
              }
              setVh();
              window.addEventListener('resize', setVh);
            `,
          }}
        />
      </head>
      <body className="bg-gray-950 antialiased">
        {children}
      </body>
    </html>
  );
}
