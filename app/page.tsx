import dynamic from "next/dynamic";

// 서버 사이드 렌더링(SSR)을 비활성화하고 클라이언트에서만 게임을 로드합니다.
// 이렇게 하면 Math.random() 이나 브라우저 전용 API로 인한 
// Hydration 에러 및 초기화 순서 에러를 방지할 수 있습니다.
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