import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "")
	const exposeVercelEnv = {
		"import.meta.env.VITE_VERCEL_ENV": JSON.stringify(
			env.VITE_VERCEL_ENV || env.VERCEL_ENV || "",
		),
		"import.meta.env.VITE_VERCEL_URL": JSON.stringify(
			env.VITE_VERCEL_URL || env.VERCEL_URL || "",
		),
		"import.meta.env.VITE_VERCEL_BRANCH_URL": JSON.stringify(
			env.VITE_VERCEL_BRANCH_URL || env.VERCEL_BRANCH_URL || "",
		),
		"import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL": JSON.stringify(
			env.VITE_VERCEL_PROJECT_PRODUCTION_URL ||
				env.VERCEL_PROJECT_PRODUCTION_URL ||
				"",
		),
	}

	return {
		define: exposeVercelEnv,
		plugins: [react(), tailwindcss()],
		server: {
			port: 4173,
		},
	}
})
