/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // 타입스크립트 에러 무시하고 강제 진행해!
  },
  eslint: {
    ignoreDuringBuilds: true, // ESLint 경고도 무시해!
  },
};

export default nextConfig;