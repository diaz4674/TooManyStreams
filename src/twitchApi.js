import {
	getCurrentAppUrl,
	getCurrentAppPathname,
	getPublicEnv,
	getVercelAppUrl,
	isLocalHostname,
} from "./env"

const TWITCH_SESSION_STORAGE_KEY = "multiwatch.twitch.session"
const TWITCH_OAUTH_STATE_KEY = "multiwatch.twitch.oauthState"
const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize"
const TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
const TWITCH_API_URL = "https://api.twitch.tv/helix"

export class TwitchAuthorizationError extends Error {
	constructor(message = "Your Twitch connection has expired.") {
		super(message)
		this.name = "TwitchAuthorizationError"
	}
}

export function getTwitchClientId() {
	return getPublicEnv("VITE_TWITCH_CLIENT_ID")
}

function shouldIgnoreConfiguredRedirectUri(redirectUri) {
	if (typeof window === "undefined") {
		return false
	}

	try {
		const configuredUrl = new URL(redirectUri)
		return (
			!isLocalHostname(window.location.hostname) &&
			isLocalHostname(configuredUrl.hostname)
		)
	} catch {
		return false
	}
}

export function getTwitchRedirectUri() {
	const configuredRedirectUri = getPublicEnv("VITE_TWITCH_REDIRECT_URI")
	if (
		configuredRedirectUri &&
		!shouldIgnoreConfiguredRedirectUri(configuredRedirectUri)
	) {
		return configuredRedirectUri
	}

	const pathname = getCurrentAppPathname()
	return getCurrentAppUrl(pathname) || getVercelAppUrl(pathname)
}

function getTwitchAuthorizationErrorMessage(error, description = "") {
	if (error === "redirect_mismatch") {
		return "Twitch rejected the callback URL. Register this site's exact redirect URL in your Twitch app settings."
	}

	if (error === "access_denied" || error === "denied") {
		return "Twitch connection was cancelled or denied."
	}

	if (description) {
		return description
	}

	return "Twitch connection could not be completed. Please try again."
}

function normalizeStoredScopes(value) {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((scope) => typeof scope === "string" && scope.trim())
		.map((scope) => scope.trim())
}

function normalizeStoredSession(session) {
	if (!session || typeof session !== "object") {
		return null
	}

	const accessToken =
		typeof session.accessToken === "string" ? session.accessToken.trim() : ""
	if (!accessToken) {
		return null
	}

	return {
		accessToken,
		userId: typeof session.userId === "string" ? session.userId : "",
		login: typeof session.login === "string" ? session.login : "",
		scopes: normalizeStoredScopes(session.scopes),
		clientId: typeof session.clientId === "string" ? session.clientId : "",
		expiresIn:
			typeof session.expiresIn === "number" && Number.isFinite(session.expiresIn)
				? session.expiresIn
				: null,
	}
}

export function storeTwitchSession(session) {
	const normalizedSession = normalizeStoredSession(session)
	if (!normalizedSession) {
		window.localStorage.removeItem(TWITCH_SESSION_STORAGE_KEY)
		return null
	}

	window.localStorage.setItem(
		TWITCH_SESSION_STORAGE_KEY,
		JSON.stringify(normalizedSession),
	)
	return normalizedSession
}

export function getStoredTwitchSession() {
	const raw = window.localStorage.getItem(TWITCH_SESSION_STORAGE_KEY)
	if (!raw) {
		return null
	}

	try {
		const parsed = JSON.parse(raw)
		return normalizeStoredSession(parsed)
	} catch {
		const legacyAccessToken = raw.trim()
		if (!legacyAccessToken) {
			return null
		}

		return {
			accessToken: legacyAccessToken,
			userId: "",
			login: "",
			scopes: [],
			clientId: "",
			expiresIn: null,
		}
	}
}

export function clearStoredTwitchSession() {
	window.localStorage.removeItem(TWITCH_SESSION_STORAGE_KEY)
}

export function beginTwitchAuthorization() {
	const clientId = getTwitchClientId()
	if (!clientId) {
		return false
	}

	const stateBytes = new Uint8Array(24)
	window.crypto.getRandomValues(stateBytes)
	const state = Array.from(stateBytes, (value) =>
		value.toString(16).padStart(2, "0"),
	).join("")

	window.sessionStorage.setItem(TWITCH_OAUTH_STATE_KEY, state)
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: getTwitchRedirectUri(),
		response_type: "token",
		scope: "",
		state,
	})

	window.location.assign(`${TWITCH_AUTHORIZE_URL}?${params.toString()}`)
	return true
}

export function consumeTwitchOAuthCallback() {
	const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))
	const query = new URLSearchParams(window.location.search)
	const accessToken = fragment.get("access_token")
	const error = fragment.get("error") || query.get("error")

	if (!accessToken && !error) {
		return { handled: false }
	}

	const expectedState = window.sessionStorage.getItem(TWITCH_OAUTH_STATE_KEY)
	window.sessionStorage.removeItem(TWITCH_OAUTH_STATE_KEY)
	const sanitizedUrl = new URL(window.location.href)
	sanitizedUrl.hash = ""
	sanitizedUrl.searchParams.delete("error")
	sanitizedUrl.searchParams.delete("error_description")
	sanitizedUrl.searchParams.delete("state")
	window.history.replaceState(
		null,
		document.title,
		`${sanitizedUrl.pathname}${sanitizedUrl.search}${sanitizedUrl.hash}`,
	)

	if (error) {
		return {
			handled: true,
			error: getTwitchAuthorizationErrorMessage(
				error,
				fragment.get("error_description") ||
					query.get("error_description") ||
					"",
			),
		}
	}

	const returnedState = fragment.get("state")
	if (!expectedState || !returnedState || returnedState !== expectedState) {
		return {
			handled: true,
			error: "Twitch connection could not be verified. Please connect again.",
		}
	}

	const session = storeTwitchSession({
		accessToken,
		scopes: String(fragment.get("scope") ?? "")
			.split(" ")
			.map((scope) => scope.trim())
			.filter(Boolean),
	})
	return { handled: true, session }
}

export async function validateTwitchSession(session, signal) {
	const accessToken =
		typeof session === "string"
			? session.trim()
			: typeof session?.accessToken === "string"
				? session.accessToken.trim()
				: ""
	if (!accessToken) {
		throw new TwitchAuthorizationError(
			"Connect Twitch before searching for channels.",
		)
	}

	const response = await fetch(TWITCH_VALIDATE_URL, {
		headers: { Authorization: `OAuth ${accessToken}` },
		signal,
	})

	if (response.status === 401) {
		throw new TwitchAuthorizationError()
	}

	if (!response.ok) {
		throw new Error("Unable to verify the Twitch connection right now.")
	}

	const validation = await response.json()
	const clientId = getTwitchClientId()
	if (clientId && validation.client_id !== clientId) {
		throw new TwitchAuthorizationError(
			"This Twitch connection belongs to a different app configuration.",
		)
	}

	const nextSession = storeTwitchSession({
		accessToken,
		userId: validation.user_id ?? "",
		login: validation.login ?? "",
		scopes: Array.isArray(validation.scopes) ? validation.scopes : session?.scopes,
		clientId: validation.client_id ?? "",
		expiresIn:
			typeof validation.expires_in === "number" ? validation.expires_in : null,
	})

	return nextSession
}

function normalizeTwitchChannel(channel) {
	return {
		channelName: channel.broadcaster_login.toLowerCase(),
		title: channel.display_name || channel.broadcaster_login,
		thumbnailUrl: channel.thumbnail_url || "",
		isLive: Boolean(channel.is_live),
	}
}

async function fetchTwitchApi(path, sessionOrToken, signal) {
	const clientId = getTwitchClientId()
	if (!clientId) {
		throw new Error("Twitch discovery is not configured.")
	}

	const accessToken =
		typeof sessionOrToken === "string"
			? sessionOrToken.trim()
			: String(sessionOrToken?.accessToken ?? "").trim()
	if (!accessToken) {
		throw new TwitchAuthorizationError(
			"Connect Twitch before searching for channels.",
		)
	}

	const response = await fetch(`${TWITCH_API_URL}${path}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Client-Id": clientId,
		},
		signal,
	})

	if (response.status === 401) {
		throw new TwitchAuthorizationError()
	}

	if (!response.ok) {
		throw new Error("Twitch is unavailable right now.")
	}

	return response.json()
}

export async function searchTwitchChannels(query, sessionOrToken, signal) {
	const trimmedQuery = query.trim()
	const params = new URLSearchParams({
		query: trimmedQuery,
		live_only: "false",
		first: "12",
	})
	const result = await fetchTwitchApi(
		`/search/channels?${params.toString()}`,
		sessionOrToken,
		signal,
	)
	const channels = result.data.map(normalizeTwitchChannel)
	const exactLogin = trimmedQuery.replace(/^@/, "").toLowerCase()

	if (
		!/^[a-z0-9_]{1,25}$/.test(exactLogin) ||
		channels.some((channel) => channel.channelName === exactLogin)
	) {
		return channels
	}

	const users = await fetchTwitchApi(
		`/users?${new URLSearchParams({ login: exactLogin }).toString()}`,
		sessionOrToken,
		signal,
	)
	const exactUser = users.data[0]
	if (!exactUser) {
		return channels
	}

	const streams = await fetchTwitchApi(
		`/streams?${new URLSearchParams({ user_id: exactUser.id }).toString()}`,
		sessionOrToken,
		signal,
	)
	const exactStream = streams.data[0]

	return [
		{
			channelName: exactUser.login.toLowerCase(),
			title: exactUser.display_name || exactUser.login,
			thumbnailUrl: exactUser.profile_image_url || "",
			isLive: Boolean(exactStream),
		},
		...channels,
	]
}

export async function fetchLiveTwitchChannelNames(
	channelNames,
	sessionOrToken,
	signal,
) {
	const uniqueChannelNames = [
		...new Set(
			channelNames
				.map((channelName) => String(channelName).trim().toLowerCase())
				.filter(Boolean),
		),
	]
	const liveChannelNames = new Set()

	for (let offset = 0; offset < uniqueChannelNames.length; offset += 100) {
		const params = new URLSearchParams()
		for (const channelName of uniqueChannelNames.slice(offset, offset + 100)) {
			params.append("user_login", channelName)
		}

		const result = await fetchTwitchApi(
			`/streams?${params.toString()}`,
			sessionOrToken,
			signal,
		)
		for (const stream of result.data) {
			const channelName = String(stream.user_login ?? "").toLowerCase()
			if (channelName) {
				liveChannelNames.add(channelName)
			}
		}
	}

	return liveChannelNames
}
