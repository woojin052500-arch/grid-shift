// lib/supabase.ts
// Supabase 클라이언트 싱글턴 초기화
// 이 파일을 your-next-app/lib/supabase.ts 에 배치하세요.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 싱글턴 패턴: 모듈이 한 번만 초기화되도록 보장
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// 📊 리더보드 타입 정의
// ============================================================
export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  country_code: string;
  created_at: string;
}

// ============================================================
// 📥 TOP 10 점수 가져오기
// ============================================================
export async function getTopScores(): Promise<LeaderboardEntry[]> {
  console.log("[SUPABASE] TOP 10 점수 조회 시작...");

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[SUPABASE] 점수 조회 실패:", error.message);
    return [];
  }

  console.log("[SUPABASE] 점수 조회 성공:", data);
  return data as LeaderboardEntry[];
}

// ============================================================
// 📤 점수 제출하기
// ============================================================
export async function submitScore(
  player_name: string,
  score: number,
  country_code: string = "KR"
): Promise<boolean> {
  console.log("[SUPABASE] 점수 제출 시작:", { player_name, score, country_code });

  const { error } = await supabase
    .from("leaderboard")
    .insert([{ player_name, score, country_code }]);

  if (error) {
    console.error("[SUPABASE] 점수 제출 실패:", error.message);
    return false;
  }

  console.log("[SUPABASE] 점수 제출 성공!");
  return true;
}
