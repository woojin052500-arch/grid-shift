"use client";

import dynamic from "next/dynamic";

// 서버 사이드 렌더링(SSR)을 비활성화하고 클라이언트에서만 게임을 로드합니다.
const GridShiftGame = dynamic(() => import("@/components/GridShift"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-gray-950 flex items-center justify-center text-yellow-400 font-mono text-sm tracking-widest uppercase">
      Loading Game...
    </div>
  ),
});

export default function Page() {
  return (
    <main>
      <GridShiftGame />
    </main>
  );
}