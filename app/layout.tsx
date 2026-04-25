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
