import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bucket column header colors (Section 4.4)
        bucket: {
          new: "#3B82F6",
          intake: "#F59E0B",
          available: "#8B5CF6",
          wip: "#10B981",
          outbound: "#14B8A6",
        },
        // Revenue stream badge colors (Section 4.5)
        stream: {
          service: "#10B981",
          ecu: "#8B5CF6",
          sourcing: "#3B82F6",
          commission: "#6366F1",
          track_day: "#EF4444",
          transport: "#F59E0B",
          dlt: "#6B7280",
          bike_hotel: "#14B8A6",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
