import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        open: true,
    },
    build: {
        outDir: "dist",
        sourcemap: true,
    },
    base: process.env.NODE_ENV === "production" ? "/WingTechBot-MK3/" : "/",
    assetsInclude: ["**/*.md"],
    optimizeDeps: {
        include: ["react-markdown", "remark-gfm", "react-syntax-highlighter"],
    },
});
