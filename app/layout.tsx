import './globals.css'   // ← 이게 빠져 있어서 Tailwind가 안 로드됨

export const metadata = {
  title: 'Grid Shift',
  description: 'Swipe, Blast, and Combo!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}