import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, ".", "");
    return {
        resolve: {
            dedupe: ["react", "react-dom"]
        },
        plugins: [react()],
        server: {
            port: 4173
        }
    };
});
