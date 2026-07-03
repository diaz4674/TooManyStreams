import test from "node:test"
import assert from "node:assert/strict"
import { readPersistedState } from "./store.js"

test("readPersistedState migrates legacy versioned projects into kind-aware standard projects", () => {
	const raw = JSON.stringify({
		version: 10,
		streamsById: {
			"stream-1": {
				id: "stream-1",
				platform: "twitch",
				channelName: "tarik",
				title: "Tarik",
			},
		},
		projects: [
			{
				id: "project-1",
				name: "Main View",
				streamIds: ["stream-1"],
				activeChatStreamId: "stream-1",
				layoutMode: "matrix",
			},
		],
		activeProjectId: "project-1",
		maxColumns: 4,
	})

	const state = readPersistedState(raw)

	assert.equal(state.projects.length, 1)
	assert.equal(state.projects[0].kind, "standard")
	assert.equal(state.projects[0].layoutMode, "matrix")
	assert.equal(state.maxColumns, 4)
})

test("readPersistedState preserves valid saved views and drops broken ones", () => {
	const raw = JSON.stringify({
		version: 12,
		streamsById: {
			"stream-1": {
				id: "stream-1",
				platform: "twitch",
				channelName: "tarik",
				title: "Tarik",
				views: [
					{
						id: "view-1",
						name: "Minimap",
						crop: { x: 0, y: 0, width: 0.25, height: 0.25 },
					},
					{ id: "view-2", name: "Broken", crop: { x: 0 } },
				],
				activeViewId: "view-1",
			},
		},
		projects: [
			{
				id: "project-1",
				name: "Main View",
				streamIds: ["stream-1"],
				activeChatStreamId: "stream-1",
				layoutMode: "auto",
			},
		],
		activeProjectId: "project-1",
		maxColumns: 3,
	})

	const state = readPersistedState(raw)
	const stream = state.streamsById["stream-1"]

	assert.equal(stream.views.length, 1)
	assert.equal(stream.views[0].name, "Minimap")
	assert.deepEqual(stream.views[0].crop, {
		x: 0,
		y: 0,
		width: 0.25,
		height: 0.25,
	})
	assert.equal(stream.activeViewId, "view-1")
})

test("readPersistedState drops legacy tournament projects and keeps standard ones", () => {
	const raw = JSON.stringify({
		version: 11,
		streamsById: {
			"stream-1": {
				id: "stream-1",
				platform: "twitch",
				channelName: "tarik",
				title: "Tarik",
			},
		},
		projects: [
			{
				id: "project-tournament",
				name: "Arena Finals",
				kind: "tournament",
				tournament: { id: "tour-1", name: "Arena Finals" },
			},
			{
				id: "project-1",
				name: "Main View",
				streamIds: ["stream-1"],
				activeChatStreamId: "stream-1",
				layoutMode: "auto",
			},
		],
		activeProjectId: "project-tournament",
		maxColumns: 3,
	})

	const state = readPersistedState(raw)

	assert.equal(state.projects.length, 1)
	assert.equal(state.projects[0].id, "project-1")
	assert.equal(state.projects[0].kind, "standard")
	assert.equal(state.activeProjectId, "project-1")
})
