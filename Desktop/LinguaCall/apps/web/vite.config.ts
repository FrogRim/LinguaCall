import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const buildAppInToss = process.env.VITE_BUILD_APPINTOSS !== "false";
const mainInput = {
  main: resolve(__dirname, "index.html")
};
const appInTossInput = {
  appintoss: resolve(__dirname, "appintoss.html")
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: buildAppInToss ? { ...mainInput, ...appInTossInput } : mainInput,
    },
  },
});
