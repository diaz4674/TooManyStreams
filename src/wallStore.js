import { create } from "zustand"

const DEFAULT_FOCUS_LAYOUT = "single"
const MAX_FOCUSED_STREAMS = 5
const VALID_FOCUS_LAYOUTS = new Set(["single", "stacked", "equal"])

function uniqueIds(ids) {
	return [...new Set(ids.filter((id) => typeof id === "string" && id))]
}

function arraysEqual(left, right) {
	if (left === right) {
		return true
	}

	if (left.length !== right.length) {
		return false
	}

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false
		}
	}

	return true
}

function objectKeysEqual(left, right) {
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)

	if (leftKeys.length !== rightKeys.length) {
		return false
	}

	for (const key of leftKeys) {
		if (left[key] !== right[key]) {
			return false
		}
	}

	return true
}

function getDefaultFocusState() {
	return {
		focusedStreamIds: [],
		focusLayout: DEFAULT_FOCUS_LAYOUT,
		focusChatOpen: false,
		focusChatStreamId: null,
	}
}

function isValidFocusLayout(layout) {
	return VALID_FOCUS_LAYOUTS.has(layout)
}

function getFocusedChatCapableStreamIds(focusedStreamIds, chatCapableStreamIds) {
	return focusedStreamIds.filter((streamId) =>
		chatCapableStreamIds.includes(streamId),
	)
}

function getNextFocusChatStreamId({
	focusedStreamIds,
	chatCapableStreamIds,
	preferredStreamId = null,
	currentChatStreamId = null,
}) {
	const focusedChatCapableStreamIds = getFocusedChatCapableStreamIds(
		focusedStreamIds,
		chatCapableStreamIds,
	)

	if (focusedChatCapableStreamIds.length === 0) {
		return null
	}

	if (
		typeof preferredStreamId === "string" &&
		focusedChatCapableStreamIds.includes(preferredStreamId)
	) {
		return preferredStreamId
	}

	if (
		typeof currentChatStreamId === "string" &&
		focusedChatCapableStreamIds.includes(currentChatStreamId)
	) {
		return currentChatStreamId
	}

	return focusedChatCapableStreamIds[0]
}

export const useWallStore = create((set) => ({
	projectId: "",
	orderedStreamIds: [],
	chatCapableStreamIds: [],
	chatOpen: false,
	activeChatStreamId: null,
	expandedCardChatStreamId: null,
	...getDefaultFocusState(),
	streamVolumes: {},
	syncProjectState({
		projectId,
		orderedStreamIds,
		chatCapableStreamIds,
		activeChatStreamId,
	}) {
		set((state) => {
			const nextOrderedIds = uniqueIds(orderedStreamIds)
			const nextChatCapableIds = uniqueIds(chatCapableStreamIds).filter((id) =>
				nextOrderedIds.includes(id),
			)
			const nextActiveChatStreamId = nextChatCapableIds.includes(
				activeChatStreamId,
			)
				? activeChatStreamId
				: (nextChatCapableIds[0] ?? null)
			const nextExpandedCardChatStreamId = nextChatCapableIds.includes(
				state.expandedCardChatStreamId,
			)
				? state.expandedCardChatStreamId
				: null
			const projectDidChange = state.projectId !== projectId
			const nextFocusedStreamIds = projectDidChange
				? []
				: uniqueIds(state.focusedStreamIds)
						.filter((id) => nextOrderedIds.includes(id))
						.slice(0, MAX_FOCUSED_STREAMS)
			const nextFocusChatStreamId = projectDidChange
				? null
				: getNextFocusChatStreamId({
						focusedStreamIds: nextFocusedStreamIds,
						chatCapableStreamIds: nextChatCapableIds,
						currentChatStreamId: state.focusChatStreamId,
					})
			const nextFocusChatOpen = nextFocusChatStreamId
				? projectDidChange
					? false
					: state.focusChatOpen
				: false
			const nextFocusLayout =
				nextFocusedStreamIds.length > 0 &&
				isValidFocusLayout(state.focusLayout)
					? state.focusLayout
					: DEFAULT_FOCUS_LAYOUT
			const nextStreamVolumes = Object.fromEntries(
				Object.entries(state.streamVolumes).filter(([id]) =>
					nextOrderedIds.includes(id),
				),
			)
			const nextChatOpen =
				nextChatCapableIds.length === 0 ? false : state.chatOpen

			if (
				state.projectId === projectId &&
				arraysEqual(state.orderedStreamIds, nextOrderedIds) &&
				arraysEqual(state.chatCapableStreamIds, nextChatCapableIds) &&
				state.chatOpen === nextChatOpen &&
				state.activeChatStreamId === nextActiveChatStreamId &&
				state.expandedCardChatStreamId === nextExpandedCardChatStreamId &&
				arraysEqual(state.focusedStreamIds, nextFocusedStreamIds) &&
				state.focusLayout === nextFocusLayout &&
				state.focusChatOpen === nextFocusChatOpen &&
				state.focusChatStreamId === nextFocusChatStreamId &&
				objectKeysEqual(state.streamVolumes, nextStreamVolumes)
			) {
				return state
			}

			return {
				...state,
				projectId,
				orderedStreamIds: nextOrderedIds,
				chatCapableStreamIds: nextChatCapableIds,
				chatOpen: nextChatOpen,
				activeChatStreamId: nextActiveChatStreamId,
				expandedCardChatStreamId: nextExpandedCardChatStreamId,
				focusedStreamIds: nextFocusedStreamIds,
				focusLayout: nextFocusLayout,
				focusChatOpen: nextFocusChatOpen,
				focusChatStreamId: nextFocusChatStreamId,
				streamVolumes: nextStreamVolumes,
			}
		})
	},
	toggleChat() {
		set((state) =>
			state.chatCapableStreamIds.length === 0
				? state
				: {
						...state,
						chatOpen: !state.chatOpen,
					},
		)
	},
	setActiveChatStream(streamId) {
		set((state) =>
			state.chatCapableStreamIds.includes(streamId)
				? {
						...state,
						activeChatStreamId: streamId,
					}
				: state,
		)
	},
	toggleCardChat(streamId) {
		set((state) => {
			if (!state.chatCapableStreamIds.includes(streamId)) {
				return state
			}

			return {
				...state,
				activeChatStreamId: streamId,
				expandedCardChatStreamId:
					state.expandedCardChatStreamId === streamId ? null : streamId,
			}
		})
	},
	setVolume(streamId, volume) {
		set((state) => ({
			...state,
			streamVolumes: {
				...state.streamVolumes,
				[streamId]: Math.max(0, Math.min(100, Math.round(volume))),
			},
		}))
	},
	enterFocus(streamId) {
		set((state) => {
			if (!state.orderedStreamIds.includes(streamId)) {
				return state
			}

			const nextFocusedStreamIds = [streamId]

			return {
				...state,
				focusedStreamIds: nextFocusedStreamIds,
				focusLayout: DEFAULT_FOCUS_LAYOUT,
				focusChatOpen: false,
				focusChatStreamId: getNextFocusChatStreamId({
					focusedStreamIds: nextFocusedStreamIds,
					chatCapableStreamIds: state.chatCapableStreamIds,
					preferredStreamId: streamId,
				}),
			}
		})
	},
	addFocusCompanion(streamId) {
		set((state) => {
			if (
				!state.focusedStreamIds.length ||
				state.focusedStreamIds.includes(streamId) ||
				!state.orderedStreamIds.includes(streamId) ||
				state.focusedStreamIds.length >= MAX_FOCUSED_STREAMS
			) {
				return state
			}

			const nextFocusedStreamIds = [...state.focusedStreamIds, streamId]

			return {
				...state,
				focusedStreamIds: nextFocusedStreamIds,
				focusChatStreamId: getNextFocusChatStreamId({
					focusedStreamIds: nextFocusedStreamIds,
					chatCapableStreamIds: state.chatCapableStreamIds,
					preferredStreamId: streamId,
					currentChatStreamId: state.focusChatStreamId,
				}),
			}
		})
	},
	removeFocusCompanion(streamId) {
		set((state) => {
			if (
				state.focusedStreamIds.length === 0 ||
				state.focusedStreamIds[0] === streamId ||
				!state.focusedStreamIds.includes(streamId)
			) {
				return state
			}

			const nextFocusedStreamIds = state.focusedStreamIds.filter(
				(id) => id !== streamId,
			)
			const nextFocusChatStreamId = getNextFocusChatStreamId({
				focusedStreamIds: nextFocusedStreamIds,
				chatCapableStreamIds: state.chatCapableStreamIds,
				currentChatStreamId: state.focusChatStreamId,
			})

			return {
				...state,
				focusedStreamIds: nextFocusedStreamIds,
				focusLayout:
					nextFocusedStreamIds.length > 0 &&
					isValidFocusLayout(state.focusLayout)
						? state.focusLayout
						: DEFAULT_FOCUS_LAYOUT,
				focusChatOpen: nextFocusChatStreamId ? state.focusChatOpen : false,
				focusChatStreamId: nextFocusChatStreamId,
			}
		})
	},
	promoteFocusStream(streamId) {
		set((state) => {
			if (!state.focusedStreamIds.includes(streamId)) {
				return state
			}

			const nextFocusedStreamIds = [
				streamId,
				...state.focusedStreamIds.filter((id) => id !== streamId),
			]

			return {
				...state,
				focusedStreamIds: nextFocusedStreamIds,
				focusChatStreamId: getNextFocusChatStreamId({
					focusedStreamIds: nextFocusedStreamIds,
					chatCapableStreamIds: state.chatCapableStreamIds,
					preferredStreamId: streamId,
					currentChatStreamId: state.focusChatStreamId,
				}),
			}
		})
	},
	setFocusLayout(layout) {
		set((state) =>
			!isValidFocusLayout(layout)
				? state
				: {
						...state,
						focusLayout: layout,
					},
		)
	},
	toggleFocusChat() {
		set((state) => {
			const focusedChatCapableStreamIds = getFocusedChatCapableStreamIds(
				state.focusedStreamIds,
				state.chatCapableStreamIds,
			)

			if (focusedChatCapableStreamIds.length === 0) {
				return state
			}

			return {
				...state,
				focusChatOpen: !state.focusChatOpen,
				focusChatStreamId:
					state.focusChatStreamId &&
					focusedChatCapableStreamIds.includes(state.focusChatStreamId)
						? state.focusChatStreamId
						: focusedChatCapableStreamIds[0],
			}
		})
	},
	setFocusChatStream(streamId) {
		set((state) => {
			const focusedChatCapableStreamIds = getFocusedChatCapableStreamIds(
				state.focusedStreamIds,
				state.chatCapableStreamIds,
			)

			return focusedChatCapableStreamIds.includes(streamId)
				? {
						...state,
						focusChatStreamId: streamId,
					}
				: state
		})
	},
	clearFocus() {
		set((state) => ({
			...state,
			...getDefaultFocusState(),
		}))
	},
}))
