import { isStreamChatCapable } from "./utils.js"
import { normalizeStreamViews } from "./streamViews.js"
import { STANDARD_PROJECT_KIND } from "./store.js"

export const SHARED_PROJECT_QUERY_PARAM = "share"
export const SHARED_PROJECT_VERSION = 2
const LEGACY_SHARED_PROJECT_VERSION = 1

function isSupportedPlatform(platform) {
	return platform === "twitch" || platform === "youtube"
}

function getStreamKey(platform, channelName) {
	return `${platform}:${channelName.trim().toLowerCase()}`
}

function isShareableStream(stream) {
	return (
		stream &&
		isSupportedPlatform(stream.platform) &&
		typeof stream.channelName === "string" &&
		stream.channelName.trim() &&
		typeof stream.title === "string" &&
		stream.title.trim()
	)
}

function bytesToBase64(bytes) {
	if (typeof btoa === "function") {
		let binary = ""
		for (const byte of bytes) {
			binary += String.fromCharCode(byte)
		}
		return btoa(binary)
	}

	if (typeof Buffer !== "undefined") {
		return Buffer.from(bytes).toString("base64")
	}

	throw new Error("Base64 encoding is unavailable in this environment.")
}

function base64ToBytes(base64Value) {
	if (typeof atob === "function") {
		const binary = atob(base64Value)
		return Uint8Array.from(binary, (char) => char.charCodeAt(0))
	}

	if (typeof Buffer !== "undefined") {
		return Uint8Array.from(Buffer.from(base64Value, "base64"))
	}

	throw new Error("Base64 decoding is unavailable in this environment.")
}

function normalizeSharedStream(rawStream) {
	const platform = String(rawStream?.platform ?? "")
		.trim()
		.toLowerCase()
	const channelName = String(rawStream?.channelName ?? "").trim()
	const title = String(rawStream?.title ?? "").trim()

	if (!isSupportedPlatform(platform) || !channelName || !title) {
		throw new Error("Invalid shared project stream.")
	}

	// Saved crop views are optional extras; invalid entries are dropped rather
	// than failing the whole payload.
	return normalizeStreamViews({
		platform,
		channelName,
		title,
		views: rawStream?.views,
		activeViewId: rawStream?.activeViewId,
	})
}

function normalizeLegacyPayload(rawPayload) {
	const name = String(rawPayload.project?.name ?? "").trim()
	const rawStreams = rawPayload.project?.streams

	if (!name || !Array.isArray(rawStreams)) {
		throw new Error("Invalid shared project payload.")
	}

	return {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: STANDARD_PROJECT_KIND,
			name,
			streams: rawStreams.map(normalizeSharedStream),
		},
	}
}

function normalizeSharedProjectPayload(rawPayload) {
	if (!rawPayload || typeof rawPayload !== "object") {
		throw new Error("Unsupported shared project payload.")
	}

	if (rawPayload.version === LEGACY_SHARED_PROJECT_VERSION) {
		return normalizeLegacyPayload(rawPayload)
	}

	if (rawPayload.version !== SHARED_PROJECT_VERSION) {
		throw new Error("Unsupported shared project payload.")
	}

	const name = String(rawPayload.project?.name ?? "").trim()
	if (!name) {
		throw new Error("Invalid shared project payload.")
	}

	const rawStreams = rawPayload.project?.streams
	if (!Array.isArray(rawStreams)) {
		throw new Error("Invalid shared project payload.")
	}

	return {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: STANDARD_PROJECT_KIND,
			name,
			streams: rawStreams.map(normalizeSharedStream),
		},
	}
}

export function buildSharedProjectPayload(project, streamsById) {
	const name = String(project?.name ?? "").trim()
	const streamIds = Array.isArray(project?.streamIds) ? project.streamIds : []
	const streams = streamIds
		.map((streamId) => streamsById?.[streamId])
		.filter(isShareableStream)
		.map((stream) =>
			normalizeStreamViews({
				platform: stream.platform,
				channelName: stream.channelName.trim(),
				title: stream.title.trim(),
				views: stream.views,
				activeViewId: stream.activeViewId,
			}),
		)

	return {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: STANDARD_PROJECT_KIND,
			name,
			streams,
		},
	}
}

export function encodeSharedProjectPayload(payload) {
	const normalizedPayload = normalizeSharedProjectPayload(payload)
	const json = JSON.stringify(normalizedPayload)
	const bytes = new TextEncoder().encode(json)

	return bytesToBase64(bytes)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "")
}

export function decodeSharedProjectPayload(value) {
	const encodedValue = String(value ?? "").trim()
	if (!encodedValue) {
		throw new Error("Missing shared project payload.")
	}

	const paddedValue = encodedValue.replace(/-/g, "+").replace(/_/g, "/")
	const paddingLength = paddedValue.length % 4
	const base64Value =
		paddingLength === 0
			? paddedValue
			: `${paddedValue}${"=".repeat(4 - paddingLength)}`
	const bytes = base64ToBytes(base64Value)
	const json = new TextDecoder().decode(bytes)

	return normalizeSharedProjectPayload(JSON.parse(json))
}

function importStandardProject(state, payload) {
	let streamsById = state.streamsById
	let didAddStream = false
	const importedStreamIds = []
	const existingStreamIdsByKey = new Map(
		Object.values(state.streamsById).flatMap((stream) =>
			isShareableStream(stream)
				? [[getStreamKey(stream.platform, stream.channelName), stream.id]]
				: [],
		),
	)

	for (const stream of payload.project.streams) {
		const key = getStreamKey(stream.platform, stream.channelName)
		let streamId = existingStreamIdsByKey.get(key)

		if (!streamId) {
			streamId = crypto.randomUUID()
			streamsById = {
				...streamsById,
				[streamId]: normalizeStreamViews({
					id: streamId,
					platform: stream.platform,
					channelName: stream.channelName,
					title: stream.title,
					views: stream.views,
					activeViewId: stream.activeViewId,
				}),
			}
			existingStreamIdsByKey.set(key, streamId)
			didAddStream = true
		}

		if (!importedStreamIds.includes(streamId)) {
			importedStreamIds.push(streamId)
		}
	}

	const activeChatStreamId =
		importedStreamIds.find((streamId) =>
			isStreamChatCapable(streamsById[streamId]),
		) ?? null
	const project = {
		id: crypto.randomUUID(),
		name: payload.project.name,
		kind: STANDARD_PROJECT_KIND,
		streamIds: importedStreamIds,
		activeChatStreamId,
		layoutMode: "auto",
	}

	return {
		...(didAddStream ? { ...state, streamsById } : state),
		projects: [...state.projects, project],
		activeProjectId: project.id,
	}
}

export function importSharedProject(state, payload) {
	let normalizedPayload
	try {
		normalizedPayload = normalizeSharedProjectPayload(payload)
	} catch {
		return state
	}

	return importStandardProject(state, normalizedPayload)
}

