import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "hsl(var(--paper))",
          raised: "hsl(var(--paper-raised))",
          sunken: "hsl(var(--paper-sunken))",
        },
        line: {
          DEFAULT: "hsl(var(--line))",
          strong: "hsl(var(--line-strong))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          muted: "hsl(var(--ink-muted))",
          faint: "hsl(var(--ink-faint))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          strong: "hsl(var(--brand-strong))",
          soft: "hsl(var(--brand-soft))",
          contrast: "hsl(var(--brand-contrast))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          line: "hsl(var(--sidebar-line))",
          ink: "hsl(var(--sidebar-ink))",
          muted: "hsl(var(--sidebar-muted))",
          active: "hsl(var(--sidebar-active))",
          mark: "hsl(var(--sidebar-mark))",
        },
        amber: { DEFAULT: "hsl(var(--amber))", soft: "hsl(var(--amber-soft))" },
        rust: { DEFAULT: "hsl(var(--rust))", soft: "hsl(var(--rust-soft))" },
        moss: { DEFAULT: "hsl(var(--moss))", soft: "hsl(var(--moss-soft))" },
        slate: { DEFAULT: "hsl(var(--slate))", soft: "hsl(var(--slate-soft))" },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) - 3px)",
        md: "calc(var(--radius) - 1px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-ui)", "system-ui", "sans-serif"],
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-data)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px hsl(210 35% 12% / 0.04), 0 1px 1px hsl(210 35% 12% / 0.03)",
        pop: "0 8px 24px -8px hsl(210 35% 12% / 0.18), 0 2px 6px hsl(210 35% 12% / 0.06)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "indeterminate-bar": {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "100%": { transform: "translateX(200%) scaleX(0.4)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "scale-in": "scale-in 0.12s ease-out",
        "slide-in-right": "slide-in-right 0.22s cubic-bezier(0.32,0.72,0,1)",
        "indeterminate-bar": "indeterminate-bar 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
