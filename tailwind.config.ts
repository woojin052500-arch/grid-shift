import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-red-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", "bg-purple-400",
    "shadow-red-400/60", "shadow-blue-400/60", "shadow-green-400/60",
    "shadow-yellow-400/60", "shadow-purple-400/60",
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
