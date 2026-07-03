import test from "node:test"
import assert from "node:assert/strict"
import {
	buildSharedProjectPayload,
	decodeSharedProjectPayload,
	encodeSharedProjectPayload,
	importSharedProject,
	SHARED_PROJECT_VERSION,
} from "./shareProject.js"

function createState(overrides = {}) {
	return {
		streamsById: {},
		projects: [],
		activeProjectId: "",
		maxColumns: 3,
		...overrides,
	}
}

test("shared standard project payload round-trips mixed streams and unicode text", () => {
	const twitchId = crypto.randomUUID()
	const youtubeId = crypto.randomUUID()
	const payload = buildSharedProjectPayload(
		{
			name: "Summer Finals 日本語",
			kind: "standard",
			streamIds: [twitchId, youtubeId],
		},
		{
			[twitchId]: {
				id: twitchId,
				platform: "twitch",
				channelName: "shroud",
				title: "Shroud POV",
			},
			[youtubeId]: {
				id: youtubeId,
				platform: "youtube",
				channelName: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
				title: "Lofi Girl - café",
			},
		},
	)

	assert.deepEqual(decodeSharedProjectPayload(encodeSharedProjectPayload(payload)), {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: "standard",
			name: "Summer Finals 日本語",
			streams: [
				{
					platform: "twitch",
					channelName: "shroud",
					title: "Shroud POV",
				},
				{
					platform: "youtube",
					channelName: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
					title: "Lofi Girl - café",
				},
			],
		},
	})
})

test("legacy shared payload still decodes into the new standard shape", () => {
	const legacyPayload = {
		version: 1,
		project: {
			name: "Legacy Stream Wall",
			streams: [
				{
					platform: "twitch",
					channelName: "tarik",
					title: "Tarik",
				},
			],
		},
	}

	assert.deepEqual(decodeSharedProjectPayload(encodeSharedProjectPayload(legacyPayload)), {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: "standard",
			name: "Legacy Stream Wall",
			streams: [
				{
					platform: "twitch",
					channelName: "tarik",
					title: "Tarik",
				},
			],
		},
	})
})

test("importSharedProject preserves order, reuses existing streams, and activates the new standard project", () => {
	const existingTwitchId = "stream-existing-twitch"
	const existingOtherId = "stream-existing-other"
	const state = createState({
		streamsById: {
			[existingTwitchId]: {
				id: existingTwitchId,
				platform: "twitch",
				channelName: "shroud",
				title: "Shroud",
			},
			[existingOtherId]: {
				id: existingOtherId,
				platform: "twitch",
				channelName: "tarik",
				title: "Tarik",
			},
		},
		projects: [
			{
				id: "project-1",
				name: "Main View",
				kind: "standard",
				streamIds: [existingOtherId],
				activeChatStreamId: existingOtherId,
				layoutMode: "auto",
			},
		],
		activeProjectId: "project-1",
	})
	const sharedPayload = {
		version: SHARED_PROJECT_VERSION,
		project: {
			kind: "standard",
			name: "Championship Watch Party",
			streams: [
				{
					platform: "youtube",
					channelName: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
					title: "Lofi Girl",
				},
				{
					platform: "twitch",
					channelName: "Shroud",
					title: "Shroud Alt Title",
				},
				{
					platform: "twitch",
					channelName: "mynewstream",
					title: "My New Stream",
				},
			],
		},
	}

	const nextState = importSharedProject(state, sharedPayload)

	assert.equal(nextState.projects.length, 2)
	assert.notEqual(nextState, state)
	assert.equal(nextState.activeProjectId, nextState.projects[1].id)
	assert.equal(nextState.projects[1].name, "Championship Watch Party")
	assert.equal(nextState.projects[1].layoutMode, "auto")
	assert.equal(nextState.projects[1].streamIds[1], existingTwitchId)
})
