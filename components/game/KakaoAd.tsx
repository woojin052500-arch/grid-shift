import { useEffect } from "react";

export function KakaoAd() {
  useEffect(() => {
    // 스크립트 중복 삽입 방지
    if (document.querySelector('script[src*="ba.min.js"]')) return;
    const script = document.createElement("script");
    script.src = "//t1.kakaocdn.net/kas/static/ba.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="w-full max-w-sm flex justify-center mt-2">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit="DAN-6sr6GmPDNHmT5BR1"
        data-ad-width="320"
        data-ad-height="50"
      />
    </div>
  );
}
