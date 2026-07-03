import { isStreamChatCapable } from "./utils.js"
import { normalizeStreamViews } from "./streamViews.js"

const STORAGE_KEY = "multiwatch.viewer.state"
const STORAGE_VERSION = 12
const DEFAULT_PROJECT_NAME = "Main View"
const DEFAULT_MAX_COLUMNS = 3

export const STANDARD_PROJECT_KIND = "standard"
export const MAX_COLUMN_OPTIONS = [2, 3, 4]

export function normalizeMaxColumns(maxColumns) {
	return MAX_COLUMN_OPTIONS.includes(maxColumns)
		? maxColumns
		: DEFAULT_MAX_COLUMNS
}

export const sampleStreams = [
	{
		id: crypto.randomUUID(),
		platform: "twitch",
		channelName: "shroud",
		title: "Shroud",
	},
	{
		id: crypto.randomUUID(),
		platform: "twitch",
		channelName: "pokimane",
		title: "Pokimane",
	},
	{
		id: crypto.randomUUID(),
		platform: "twitch",
		channelName: "tarik",
		title: "Tarik",
	},
	{
		id: crypto.randomUUID(),
		platform: "youtube",
		channelName: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
		title: "Lofi Girl",
	},
	{
		id: crypto.randomUUID(),
		platform: "twitch",
		channelName: "esl_csgo",
		title: "ESL Counter-Strike",
	},
]

function isValidStream(stream) {
	return (
		stream &&
		typeof stream.id === "string" &&
		typeof stream.platform === "string" &&
		(stream.platform === "twitch" || stream.platform === "youtube") &&
		typeof stream.channelName === "string" &&
		typeof stream.title === "string"
	)
}

function buildStandardProject(
	{
		id = crypto.randomUUID(),
		name = DEFAULT_PROJECT_NAME,
		streamIds = [],
		activeChatStreamId = null,
		layoutMode = "auto",
	},
	streamsById = {},
) {
	const uniqueStreamIds = [
		...new Set(streamIds.filter((streamId) => typeof streamId === "string")),
	]
	const chatCapableStreamIds = uniqueStreamIds.filter((streamId) =>
		isStreamChatCapable(streamsById[streamId]),
	)
	return {
		id,
		name:
			typeof name === "string" && name.trim()
				? name.trim()
				: DEFAULT_PROJECT_NAME,
		kind: STANDARD_PROJECT_KIND,
		streamIds: uniqueStreamIds,
		activeChatStreamId: chatCapableStreamIds.includes(activeChatStreamId)
			? activeChatStreamId
			: (chatCapableStreamIds[0] ?? null),
		layoutMode:
			layoutMode === "matrix" || layoutMode === "creative" ? "matrix" : "auto",
	}
}

function buildProject(rawProject, streamsById = {}) {
	return buildStandardProject(rawProject, streamsById)
}

function buildStateFromStreams(streams, options = {}) {
	const validStreams = streams.filter(isValidStream)
	const streamsById = Object.fromEntries(
		validStreams.map((stream) => [stream.id, stream]),
	)
	const firstChatCapableStreamId =
		validStreams.find((stream) => isStreamChatCapable(stream))?.id ?? null
	const project = buildStandardProject(
		{
			name: options.projectName ?? DEFAULT_PROJECT_NAME,
			streamIds: validStreams.map((stream) => stream.id),
			activeChatStreamId:
				options.activeChatStreamId ?? firstChatCapableStreamId,
		},
		streamsById,
	)
	return {
		streamsById,
		projects: [project],
		activeProjectId: project.id,
		maxColumns: normalizeMaxColumns(options.maxColumns),
	}
}

function getFallbackState() {
	return buildStateFromStreams([], {
		projectName: DEFAULT_PROJECT_NAME,
	})
}

function loadLegacyState(parsed) {
	const streams =
		Array.isArray(parsed.streams) && parsed.streams.length > 0
			? parsed.streams.filter(isValidStream)
			: []

	return buildStateFromStreams(streams, {
		projectName: DEFAULT_PROJECT_NAME,
	})
}

function loadVersionedState(parsed) {
	if (
		!parsed ||
		![2, 3, 4, 5, 6, 7, 8, 9, 10, 11, STORAGE_VERSION].includes(parsed.version)
	) {
		return null
	}

	const streamEntries =
		parsed.streamsById && typeof parsed.streamsById === "object"
			? Object.values(parsed.streamsById)
					.filter(isValidStream)
					.map(normalizeStreamViews)
			: []

	if (
		streamEntries.length === 0 &&
		(!Array.isArray(parsed.projects) || parsed.projects.length === 0)
	) {
		return null
	}

	const streamsById = Object.fromEntries(
		streamEntries.map((stream) => [stream.id, stream]),
	)
	const projects = Array.isArray(parsed.projects)
		? parsed.projects
				.filter(
					(project) =>
						project &&
						project.kind !== "following" &&
						project.kind !== "tournament" &&
						typeof project.id === "string",
				)
				.map((project) => {
					if (!Array.isArray(project.streamIds)) {
						return null
					}

					return buildProject(
						{
							...project,
							streamIds: project.streamIds.filter(
								(streamId) => streamId in streamsById,
							),
							activeChatStreamId:
								typeof project.activeChatStreamId === "string"
									? project.activeChatStreamId
									: null,
							layoutMode: project.layoutMode,
						},
						streamsById,
					)
				})
				.filter(Boolean)
		: []

	if (projects.length === 0) {
		return null
	}

	const referencedIds = new Set(
		projects.flatMap((project) => project.streamIds ?? []),
	)
	const prunedStreamsById = Object.fromEntries(
		Object.entries(streamsById).filter(([streamId]) =>
			referencedIds.has(streamId),
		),
	)
	const normalizedProjects = projects.map((project) =>
		buildProject(
			{
				...project,
				streamIds: project.streamIds.filter(
					(streamId) => streamId in prunedStreamsById,
				),
			},
			prunedStreamsById,
		),
	)
	const activeProjectId = normalizedProjects.some(
		(project) => project.id === parsed.activeProjectId,
	)
		? parsed.activeProjectId
		: normalizedProjects[0].id

	return {
		streamsById: prunedStreamsById,
		projects: normalizedProjects,
		activeProjectId,
		maxColumns: normalizeMaxColumns(parsed.maxColumns),
	}
}

export function readPersistedState(raw) {
	const fallback = getFallbackState()
	if (!raw) {
		return fallback
	}

	try {
		const parsed = JSON.parse(raw)
		const versionedState = loadVersionedState(parsed)
		if (versionedState) {
			return versionedState
		}

		if (Array.isArray(parsed.streams)) {
			return loadLegacyState(parsed)
		}

		return fallback
	} catch {
		return fallback
	}
}

export function loadPersistedState() {
	return readPersistedState(window.localStorage.getItem(STORAGE_KEY))
}

export function persistState(state) {
	const payload = {
		version: STORAGE_VERSION,
		streamsById: state.streamsById,
		projects: state.projects.map((project) => ({
			id: project.id,
			name: project.name,
			kind: STANDARD_PROJECT_KIND,
			streamIds: project.streamIds,
			activeChatStreamId: project.activeChatStreamId,
			layoutMode: project.layoutMode === "matrix" ? "matrix" : "auto",
		})),
		activeProjectId: state.activeProjectId,
		maxColumns: normalizeMaxColumns(state.maxColumns),
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
