function readEnvValue(name) {
	return String(import.meta.env[name] ?? "").trim()
}

function normalizeHost(host) {
	return host.replace(/^https?:\/\//, "").replace(/\/+$/, "")
}

function normalizePathname(pathname) {
	if (!pathname) {
		return "/"
	}

	return pathname.startsWith("/") ? pathname : `/${pathname}`
}

function buildHttpsUrl(host, pathname) {
	const normalizedHost = normalizeHost(host)
	if (!normalizedHost) {
		return ""
	}

	return `https://${normalizedHost}${normalizePathname(pathname)}`
}

export function getPublicEnv(name) {
	return readEnvValue(name)
}

export function getCurrentAppPathname() {
	if (typeof window === "undefined") {
		return "/"
	}

	return normalizePathname(window.location.pathname)
}

export function getVercelAppUrl(pathname = getCurrentAppPathname()) {
	const vercelEnvironment = readEnvValue("VITE_VERCEL_ENV")

	if (vercelEnvironment === "production") {
		return (
			buildHttpsUrl(
				readEnvValue("VITE_VERCEL_PROJECT_PRODUCTION_URL"),
				pathname,
			) || buildHttpsUrl(readEnvValue("VITE_VERCEL_URL"), pathname)
		)
	}

	if (vercelEnvironment === "preview") {
		return (
			buildHttpsUrl(readEnvValue("VITE_VERCEL_BRANCH_URL"), pathname) ||
			buildHttpsUrl(readEnvValue("VITE_VERCEL_URL"), pathname)
		)
	}

	return buildHttpsUrl(readEnvValue("VITE_VERCEL_URL"), pathname)
}
