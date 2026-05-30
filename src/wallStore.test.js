import assert from "node:assert/strict"
import test from "node:test"
import { useWallStore } from "./wallStore.js"

function resetWallStore(overrides = {}) {
	useWallStore.setState({
		projectId: "project-1",
		orderedStreamIds: [],
		chatCapableStreamIds: [],
		chatOpen: false,
		activeChatStreamId: null,
		expandedCardChatStreamId: null,
		focusedStreamIds: [],
		focusLayout: "single",
		focusChatOpen: false,
		focusChatStreamId: null,
		streamVolumes: {},
		...overrides,
	})
}

test("setFocusLayout accepts duo and trims focused streams to primary plus secondary", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b", "c"],
		chatCapableStreamIds: ["a", "b", "c"],
		focusedStreamIds: ["a", "b", "c"],
		focusLayout: "stacked",
		focusChatOpen: true,
		focusChatStreamId: "c",
	})

	useWallStore.getState().setFocusLayout("duo")

	const state = useWallStore.getState()
	assert.equal(state.focusLayout, "duo")
	assert.deepEqual(state.focusedStreamIds, ["a", "b"])
	assert.equal(state.focusChatOpen, true)
	assert.equal(state.focusChatStreamId, "a")
})

test("promote and remove keep duo chat selection valid", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b"],
		chatCapableStreamIds: ["a", "b"],
		focusedStreamIds: ["a", "b"],
		focusLayout: "duo",
		focusChatOpen: true,
		focusChatStreamId: "b",
	})

	useWallStore.getState().promoteFocusStream("b")
	let state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["b", "a"])
	assert.equal(state.focusChatStreamId, "b")

	useWallStore.getState().removeFocusCompanion("a")
	state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["b"])
	assert.equal(state.focusLayout, "duo")
	assert.equal(state.focusChatOpen, true)
	assert.equal(state.focusChatStreamId, "b")
})

test("toggleFocusChat picks the first focused chat-capable stream when current chat is invalid", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b"],
		chatCapableStreamIds: ["b"],
		focusedStreamIds: ["a", "b"],
		focusLayout: "duo",
		focusChatOpen: false,
		focusChatStreamId: "a",
	})

	useWallStore.getState().toggleFocusChat()

	const state = useWallStore.getState()
	assert.equal(state.focusChatOpen, true)
	assert.equal(state.focusChatStreamId, "b")
})
