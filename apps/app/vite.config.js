import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
export default defineConfig({
    resolve: {
        dedupe: ["react", "react-dom"]
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "Locoris",
                short_name: "Locoris",
                description: "Orbital knowledge map for projects, notes, and canvases.",
                theme_color: "#161338",
                background_color: "#0d0a24",
                display: "standalone",
                orientation: "any",
                lang: "en",
                icons: [
                    {
                        src: "/pwa-icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any"
                    },
                    {
                        src: "/mask-icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "maskable"
                    }
                ]
            }
        })
    ],
    server: {
        port: 4173
    }
});
