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
		savedFocusByPrimaryId: {},
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

test("re-entering cinema restores the companions and layout last set for that stream", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b", "c", "d"],
		chatCapableStreamIds: ["a", "b", "c", "d"],
	})

	useWallStore.getState().enterFocus("a")
	useWallStore.getState().setFocusLayout("stacked")
	useWallStore.getState().addFocusCompanion("b")
	useWallStore.getState().addFocusCompanion("c")

	let state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["a", "b", "c"])
	assert.equal(state.focusLayout, "stacked")

	useWallStore.getState().clearFocus()
	state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, [])

	// Focusing a different stream should not inherit a's companions.
	useWallStore.getState().enterFocus("d")
	state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["d"])
	assert.equal(state.focusLayout, "single")

	// Re-entering a restores its saved companions and layout.
	useWallStore.getState().enterFocus("a")
	state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["a", "b", "c"])
	assert.equal(state.focusLayout, "stacked")
})

test("restoring a saved arrangement drops companions that left the wall", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b", "c"],
		chatCapableStreamIds: ["a", "b", "c"],
		focusedStreamIds: ["a", "b", "c"],
		focusLayout: "stacked",
		savedFocusByPrimaryId: {
			a: { focusedStreamIds: ["a", "b", "c"], focusLayout: "stacked" },
		},
	})

	useWallStore.getState().clearFocus()
	// Stream c is removed from the wall.
	useWallStore.getState().syncProjectState({
		projectId: "project-1",
		orderedStreamIds: ["a", "b"],
		chatCapableStreamIds: ["a", "b"],
		activeChatStreamId: "a",
	})

	useWallStore.getState().enterFocus("a")
	const state = useWallStore.getState()
	assert.deepEqual(state.focusedStreamIds, ["a", "b"])
})

test("changing project clears saved cinema arrangements", () => {
	resetWallStore({
		orderedStreamIds: ["a", "b"],
		chatCapableStreamIds: ["a", "b"],
		savedFocusByPrimaryId: {
			a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
		},
	})

	useWallStore.getState().syncProjectState({
		projectId: "project-2",
		orderedStreamIds: ["a", "b"],
		chatCapableStreamIds: ["a", "b"],
		activeChatStreamId: "a",
	})

	assert.deepEqual(useWallStore.getState().savedFocusByPrimaryId, {})
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
