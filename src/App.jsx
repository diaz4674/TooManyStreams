import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import Header from "./components/Header"
import StreamGrid from "./components/StreamGrid"
import AddStreamDialog from "./components/AddStreamDialog"
import EditStreamDialog from "./components/EditStreamDialog"
import ProjectsDialog from "./components/ProjectsDialog"
import StreamChatSidebar from "./components/StreamChatSidebar"
import {
	loadPersistedState,
	MAX_COLUMN_OPTIONS,
	normalizeMaxColumns,
	persistState,
	sampleStreams,
} from "./store"
import {
	consumeTwitchOAuthCallback,
	fetchLiveTwitchChannelNames,
	getStoredTwitchSession,
} from "./twitchApi"
import { useWallStore } from "./wallStore"

const LIVE_STATUS_REFRESH_MS = 60 * 1000
const EMPTY_LIVE_CHANNEL_NAMES = new Set()

function getStreamKey(platform, channelName) {
	return `${platform}:${channelName.trim().toLowerCase()}`
}

function areTwitchSessionsEqual(left, right) {
	if (left === right) {
		return true
	}

	if (!left || !right) {
		return !left && !right
	}

	return (
		left.accessToken === right.accessToken &&
		left.userId === right.userId &&
		left.login === right.login &&
		left.clientId === right.clientId &&
		left.expiresIn === right.expiresIn &&
		JSON.stringify(left.scopes ?? []) === JSON.stringify(right.scopes ?? [])
	)
}

function sanitizeProject(project, streamsById) {
	const streamIds = [
		...new Set(project.streamIds.filter((streamId) => streamId in streamsById)),
	]
	const twitchStreamIds = streamIds.filter(
		(streamId) => streamsById[streamId]?.platform === "twitch",
	)

	return {
		...project,
		streamIds,
		activeChatStreamId: twitchStreamIds.includes(project.activeChatStreamId)
			? project.activeChatStreamId
			: (twitchStreamIds[0] ?? null),
		layoutMode: project.layoutMode === "matrix" ? "matrix" : "auto",
	}
}

function getActiveProject(state) {
	return (
		state.projects.find((project) => project.id === state.activeProjectId) ??
		state.projects[0]
	)
}

function updateProject(state, projectId, updater) {
	let didChange = false
	const projects = state.projects.map((project) => {
		if (project.id !== projectId) {
			return project
		}

		const nextProject = updater(project)
		if (nextProject !== project) {
			didChange = true
		}
		return nextProject
	})

	return didChange ? { ...state, projects } : state
}

function pruneUnreferencedStreams(streamsById, projects) {
	const referencedIds = new Set(
		projects.flatMap((project) => project.streamIds),
	)

	return Object.fromEntries(
		Object.entries(streamsById).filter(([streamId]) =>
			referencedIds.has(streamId),
		),
	)
}

function viewerReducer(state, action) {
	switch (action.type) {
		case "setMaxColumns": {
			const maxColumns = normalizeMaxColumns(action.maxColumns)
			return maxColumns === state.maxColumns ? state : { ...state, maxColumns }
		}
		case "createProject": {
			const name = action.name.trim() || `Project ${state.projects.length + 1}`
			const project = {
				id: crypto.randomUUID(),
				name,
				kind: "standard",
				streamIds: [],
				activeChatStreamId: null,
				layoutMode: "auto",
			}

			return {
				...state,
				projects: [...state.projects, project],
				activeProjectId: project.id,
			}
		}
		case "switchProject":
			return state.projects.some((project) => project.id === action.projectId)
				? { ...state, activeProjectId: action.projectId }
				: state
		case "renameProject":
			return updateProject(state, action.projectId, (project) => {
				const name = action.name.trim()
				if (!name || name === project.name) {
					return project
				}

				return { ...project, name }
			})
		case "deleteProject": {
			if (state.projects.length <= 1) {
				return state
			}

			const remainingProjects = state.projects.filter(
				(project) => project.id !== action.projectId,
			)
			if (remainingProjects.length === state.projects.length) {
				return state
			}

			return {
				...state,
				streamsById: pruneUnreferencedStreams(
					state.streamsById,
					remainingProjects,
				),
				projects: remainingProjects,
				activeProjectId:
					state.activeProjectId === action.projectId
						? remainingProjects[0].id
						: state.activeProjectId,
			}
		}
		case "addExistingStreamToProject":
			return updateProject(state, action.projectId, (project) => {
				if (
					project.streamIds.includes(action.streamId) ||
					!(action.streamId in state.streamsById)
				) {
					return project
				}

				return sanitizeProject(
					{
						...project,
						streamIds: [...project.streamIds, action.streamId],
					},
					state.streamsById,
				)
			})
		case "createStreamAndAddToProject": {
			const platform = action.stream.platform
			const channelName = action.stream.channelName.trim()
			const title = action.stream.title.trim()
			if (!platform || !channelName || !title) {
				return state
			}

			const existingStream = Object.values(state.streamsById).find(
				(stream) =>
					getStreamKey(stream.platform, stream.channelName) ===
					getStreamKey(platform, channelName),
			)
			const streamId = existingStream?.id ?? crypto.randomUUID()
			const streamsById = existingStream
				? state.streamsById
				: {
						...state.streamsById,
						[streamId]: {
							id: streamId,
							platform,
							channelName,
							title,
						},
					}

			const nextState = existingStream ? state : { ...state, streamsById }
			return updateProject(nextState, action.projectId, (project) => {
				if (project.streamIds.includes(streamId)) {
					return project
				}

				return sanitizeProject(
					{
						...project,
						streamIds: [...project.streamIds, streamId],
					},
					streamsById,
				)
			})
		}
		case "updateStream": {
			const previousStream = state.streamsById[action.streamId]
			const platform = action.stream.platform
			const channelName = action.stream.channelName.trim()
			const title = action.stream.title.trim()
			if (
				!previousStream ||
				(platform !== "twitch" && platform !== "youtube") ||
				!channelName ||
				!title
			) {
				return state
			}

			if (
				previousStream.platform === platform &&
				previousStream.channelName === channelName &&
				previousStream.title === title
			) {
				return state
			}

			const streamsById = {
				...state.streamsById,
				[action.streamId]: {
					...previousStream,
					platform,
					channelName,
					title,
				},
			}

			return {
				...state,
				streamsById,
				projects: state.projects.map((project) =>
					sanitizeProject(project, streamsById),
				),
			}
		}
		case "loadSampleStreams": {
			let streamsById = state.streamsById
			let didAddLibraryStream = false
			const project = state.projects.find(
				(entry) => entry.id === action.projectId,
			)
			if (!project) {
				return state
			}

			const nextStreamIds = [...project.streamIds]
			const existingByKey = new Map(
				Object.values(streamsById).map((stream) => [
					getStreamKey(stream.platform, stream.channelName),
					stream.id,
				]),
			)

			for (const sample of sampleStreams) {
				const key = getStreamKey(sample.platform, sample.channelName)
				let streamId = existingByKey.get(key)
				if (!streamId) {
					streamId = crypto.randomUUID()
					streamsById = {
						...streamsById,
						[streamId]: {
							...sample,
							id: streamId,
						},
					}
					existingByKey.set(key, streamId)
					didAddLibraryStream = true
				}

				if (!nextStreamIds.includes(streamId)) {
					nextStreamIds.push(streamId)
				}
			}

			const nextProject = sanitizeProject(
				{
					...project,
					streamIds: nextStreamIds,
				},
				streamsById,
			)
			const projects = state.projects.map((entry) =>
				entry.id === action.projectId ? nextProject : entry,
			)

			return {
				...(didAddLibraryStream ? { ...state, streamsById } : state),
				projects,
			}
		}
		case "removeStreamFromProject": {
			const project = state.projects.find(
				(entry) => entry.id === action.projectId,
			)
			if (
				!project ||
				!project.streamIds.includes(action.streamId)
			) {
				return state
			}

			const nextProject = sanitizeProject(
				{
					...project,
					streamIds: project.streamIds.filter(
						(streamId) => streamId !== action.streamId,
					),
					activeChatStreamId:
						project.activeChatStreamId === action.streamId
							? null
							: project.activeChatStreamId,
				},
				state.streamsById,
			)
			const projects = state.projects.map((entry) =>
				entry.id === action.projectId ? nextProject : entry,
			)

			return {
				...state,
				streamsById: pruneUnreferencedStreams(state.streamsById, projects),
				projects,
				activeProjectId: state.activeProjectId,
			}
		}
		case "reorderProjectStreams":
			return updateProject(state, action.projectId, (project) => {
				const draggedIndex = project.streamIds.indexOf(action.draggedId)
				const overIndex = project.streamIds.indexOf(action.overId)
				if (draggedIndex < 0 || overIndex < 0 || draggedIndex === overIndex) {
					return project
				}

				const streamIds = [...project.streamIds]
				const [draggedId] = streamIds.splice(draggedIndex, 1)
				streamIds.splice(overIndex, 0, draggedId)

				return {
					...project,
					streamIds,
				}
			})
		case "toggleProjectLayoutMode":
			return updateProject(state, action.projectId, (project) =>
				project.layoutMode === action.layoutMode
					? project
					: sanitizeProject(
							{
								...project,
								layoutMode: action.layoutMode,
							},
							state.streamsById,
						),
			)
		case "setProjectActiveChatStream":
			return updateProject(state, action.projectId, (project) => {
				const nextProject = sanitizeProject(
					{
						...project,
						activeChatStreamId: action.streamId,
					},
					state.streamsById,
				)

				return nextProject.activeChatStreamId === project.activeChatStreamId
					? project
					: nextProject
			})
		default:
			return state
	}
}

export default function App() {
	const [viewerState, dispatch] = useReducer(
		viewerReducer,
		undefined,
		loadPersistedState,
	)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [editingStreamId, setEditingStreamId] = useState(null)
	const [projectsDialogOpen, setProjectsDialogOpen] = useState(false)
	const [twitchSession, setTwitchSession] = useState(() =>
		getStoredTwitchSession(),
	)
	const [twitchConnectionMessage, setTwitchConnectionMessage] = useState("")
	const [liveTwitchSnapshot, setLiveTwitchSnapshot] = useState({
		projectId: "",
		channelNames: EMPTY_LIVE_CHANNEL_NAMES,
	})

	const activeProject = getActiveProject(viewerState)
	const activeTwitchChannelNames = useMemo(
		() =>
			activeProject.streamIds
				.map((streamId) => viewerState.streamsById[streamId])
				.filter((stream) => stream?.platform === "twitch")
				.map((stream) => stream.channelName.trim().toLowerCase()),
		[activeProject.streamIds, viewerState.streamsById],
	)
	const liveTwitchChannelNames =
		liveTwitchSnapshot.projectId === activeProject.id
			? liveTwitchSnapshot.channelNames
			: EMPTY_LIVE_CHANNEL_NAMES
	const streamIds = useMemo(
		() => {
			const savedStreamIds = activeProject.streamIds.filter((streamId) =>
				Boolean(viewerState.streamsById[streamId]),
			)

			return savedStreamIds
				.map((streamId, index) => {
					const stream = viewerState.streamsById[streamId]
					return {
						streamId,
						index,
						isLive:
							stream.platform === "twitch" &&
							liveTwitchChannelNames.has(
								stream.channelName.trim().toLowerCase(),
							),
					}
				})
				.sort(
					(left, right) =>
						Number(right.isLive) - Number(left.isLive) ||
						left.index - right.index,
				)
				.map(({ streamId }) => streamId)
		},
		[
			activeProject.streamIds,
			liveTwitchChannelNames,
			viewerState.streamsById,
		],
	)
	const streams = useMemo(
		() =>
			streamIds
				.map((streamId) => viewerState.streamsById[streamId])
				.filter(Boolean),
		[streamIds, viewerState.streamsById],
	)
	const twitchStreams = useMemo(
		() => streams.filter((stream) => stream.platform === "twitch"),
		[streams],
	)
	const savedTwitchStreams = useMemo(
		() =>
			Object.values(viewerState.streamsById).filter(
				(stream) => stream.platform === "twitch",
			),
		[viewerState.streamsById],
	)
	const availableLibraryStreams = Object.values(viewerState.streamsById)
		.filter((stream) => !activeProject.streamIds.includes(stream.id))
		.sort((left, right) => left.title.localeCompare(right.title))

	const {
		chatOpen,
		activeChatStreamId,
		expandedCardChatStreamId,
		focusedStreamIds,
		focusLayout,
		focusChatOpen,
		focusChatStreamId,
	} = useWallStore(
		useShallow((state) => ({
			chatOpen: state.chatOpen,
			activeChatStreamId: state.activeChatStreamId,
			expandedCardChatStreamId: state.expandedCardChatStreamId,
			focusedStreamIds: state.focusedStreamIds,
			focusLayout: state.focusLayout,
			focusChatOpen: state.focusChatOpen,
			focusChatStreamId: state.focusChatStreamId,
		})),
	)

	const handleTwitchSessionChange = useCallback((nextSession) => {
		setTwitchSession((currentSession) =>
			areTwitchSessionsEqual(currentSession, nextSession)
				? currentSession
				: nextSession,
		)
	}, [])

	useEffect(() => {
		persistState(viewerState)
	}, [viewerState])

	useEffect(() => {
		const callback = consumeTwitchOAuthCallback()
		if (callback.error) {
			setTwitchConnectionMessage(callback.error)
			handleTwitchSessionChange(getStoredTwitchSession())
			return
		}

		if (callback.session) {
			handleTwitchSessionChange(callback.session)
		}
	}, [handleTwitchSessionChange])

	useEffect(() => {
		if (!twitchSession?.accessToken || activeTwitchChannelNames.length === 0) {
			setLiveTwitchSnapshot({
				projectId: activeProject.id,
				channelNames: EMPTY_LIVE_CHANNEL_NAMES,
			})
			return undefined
		}

		let currentController = null
		let disposed = false
		const refreshLiveStatus = async () => {
			currentController?.abort()
			currentController = new AbortController()

			try {
				const channelNames = await fetchLiveTwitchChannelNames(
					activeTwitchChannelNames,
					twitchSession,
					currentController.signal,
				)
				if (!disposed) {
					setLiveTwitchSnapshot({
						projectId: activeProject.id,
						channelNames,
					})
				}
			} catch (error) {
				if (!disposed && error.name !== "AbortError") {
					setLiveTwitchSnapshot({
						projectId: activeProject.id,
						channelNames: EMPTY_LIVE_CHANNEL_NAMES,
					})
				}
			}
		}

		void refreshLiveStatus()
		const intervalId = window.setInterval(
			refreshLiveStatus,
			LIVE_STATUS_REFRESH_MS,
		)

		return () => {
			disposed = true
			currentController?.abort()
			window.clearInterval(intervalId)
		}
	}, [activeProject.id, activeTwitchChannelNames, twitchSession])

	useEffect(() => {
		useWallStore.getState().syncProjectState({
			projectId: activeProject.id,
			orderedStreamIds: streamIds,
			twitchStreamIds: twitchStreams.map((stream) => stream.id),
			activeChatStreamId: activeProject.activeChatStreamId,
		})
	}, [
		activeProject.activeChatStreamId,
		activeProject.id,
		streamIds,
		twitchStreams,
	])

	const createProject = useCallback((name) => {
		dispatch({ type: "createProject", name })
	}, [])

	const switchProject = useCallback((projectId) => {
		dispatch({ type: "switchProject", projectId })
	}, [])

	const openProject = useCallback(
		(project) => {
			if (!project) {
				return
			}

			switchProject(project.id)
			setProjectsDialogOpen(false)
		},
		[switchProject],
	)

	const renameProject = useCallback((projectId, name) => {
		dispatch({ type: "renameProject", projectId, name })
	}, [])

	const deleteProject = useCallback((projectId) => {
		dispatch({ type: "deleteProject", projectId })
	}, [])

	const addExistingStreamToProject = useCallback(
		(streamId) => {
			dispatch({
				type: "addExistingStreamToProject",
				projectId: activeProject.id,
				streamId,
			})
		},
		[activeProject.id],
	)

	const createStreamAndAddToProject = useCallback(
		(stream) => {
			dispatch({
				type: "createStreamAndAddToProject",
				projectId: activeProject.id,
				stream,
			})
		},
		[activeProject.id],
	)

	const editStream = useCallback((streamId, stream) => {
		dispatch({ type: "updateStream", streamId, stream })
	}, [])

	const loadSamples = useCallback(() => {
		dispatch({ type: "loadSampleStreams", projectId: activeProject.id })
	}, [activeProject.id])

	const removeStream = useCallback(
		(id) => {
			dispatch({
				type: "removeStreamFromProject",
				projectId: activeProject.id,
				streamId: id,
			})
		},
		[activeProject.id],
	)

	const reorderStreams = useCallback(
		(draggedId, overId) => {
			if (draggedId === overId) return
			dispatch({
				type: "reorderProjectStreams",
				projectId: activeProject.id,
				draggedId,
				overId,
			})
		},
		[activeProject.id],
	)

	const handleStreamVolumeChange = useCallback((id, volume) => {
		useWallStore.getState().setVolume(id, volume)
	}, [])

	const handleToggleChat = useCallback(() => {
		useWallStore.getState().toggleChat()
	}, [])

	const handleActiveChatStreamChange = useCallback(
		(streamId) => {
			useWallStore.getState().setActiveChatStream(streamId)
			dispatch({
				type: "setProjectActiveChatStream",
				projectId: activeProject.id,
				streamId,
			})
		},
		[activeProject.id],
	)

	const handleToggleCardChat = useCallback((streamId) => {
		useWallStore.getState().toggleCardChat(streamId)
	}, [])

	const handleEnterFocus = useCallback((streamId) => {
		useWallStore.getState().enterFocus(streamId)
	}, [])

	const handleAddFocusCompanion = useCallback((streamId) => {
		useWallStore.getState().addFocusCompanion(streamId)
	}, [])

	const handleRemoveFocusCompanion = useCallback((streamId) => {
		useWallStore.getState().removeFocusCompanion(streamId)
	}, [])

	const handlePromoteFocusStream = useCallback((streamId) => {
		useWallStore.getState().promoteFocusStream(streamId)
	}, [])

	const handleSetFocusLayout = useCallback((layout) => {
		useWallStore.getState().setFocusLayout(layout)
	}, [])

	const handleToggleFocusChat = useCallback(() => {
		useWallStore.getState().toggleFocusChat()
	}, [])

	const handleSetFocusChatStream = useCallback((streamId) => {
		useWallStore.getState().setFocusChatStream(streamId)
	}, [])

	const handleClearFocus = useCallback(() => {
		useWallStore.getState().clearFocus()
	}, [])

	useEffect(() => {
		if (focusedStreamIds.length === 0) {
			return undefined
		}

		const handleEsc = (event) => {
			if (event.key === "Escape") {
				handleClearFocus()
			}
		}

		document.addEventListener("keydown", handleEsc)
		return () => {
			document.removeEventListener("keydown", handleEsc)
		}
	}, [focusedStreamIds.length, handleClearFocus])

	const hasStreams = streams.length > 0
	const layoutMode = activeProject.layoutMode ?? "auto"
	const isMatrixMode = hasStreams && layoutMode === "matrix"

	const handleLayoutModeChange = useCallback(
		(nextLayoutMode) => {
			if (nextLayoutMode === "matrix") {
				useWallStore.getState().clearFocus()
			}
			dispatch({
				type: "toggleProjectLayoutMode",
				projectId: activeProject.id,
				layoutMode: nextLayoutMode,
			})
		},
		[activeProject.id],
	)
	const handleMaxColumnsChange = useCallback((maxColumns) => {
		dispatch({ type: "setMaxColumns", maxColumns })
	}, [])

	return (
		<main
			className={
				isMatrixMode
					? "h-screen min-h-screen w-full overflow-hidden bg-black"
					: "min-h-screen w-full p-6 max-md:p-4"
			}
		>
			{!isMatrixMode && (
				<Header
					projectCount={viewerState.projects.length}
					activeProjectName={activeProject.name}
					streamCount={streams.length}
					twitchStreamCount={twitchStreams.length}
					twitchSession={twitchSession}
					savedTwitchStreams={savedTwitchStreams}
					activeStreamIds={activeProject.streamIds}
					chatOpen={chatOpen}
					layoutMode={layoutMode}
					maxColumns={viewerState.maxColumns}
					onToggleChat={handleToggleChat}
					onSetLayoutMode={handleLayoutModeChange}
					onSetMaxColumns={handleMaxColumnsChange}
					onOpenDialog={() => setDialogOpen(true)}
					onOpenProjects={() => setProjectsDialogOpen(true)}
					onAddExistingStream={addExistingStreamToProject}
					onAddStream={createStreamAndAddToProject}
					onTwitchSessionChange={handleTwitchSessionChange}
					twitchConnectionMessage={twitchConnectionMessage}
				/>
			)}

			{isMatrixMode ? (
				<div className="relative flex h-screen min-h-0 w-full overflow-hidden bg-black">
					<StreamGrid
						streams={streams}
						layoutMode="matrix"
						maxColumns={viewerState.maxColumns}
					/>

					{chatOpen && twitchStreams.length > 0 && (
						<div className="hidden h-full w-[22rem] shrink-0 xl:block">
							<StreamChatSidebar
								streams={twitchStreams}
								activeStreamId={activeChatStreamId}
								onSelectStream={handleActiveChatStreamChange}
								variant="matrixDock"
							/>
						</div>
					)}

					<div className="fixed top-4 left-4 z-30 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-[1.4rem] bg-slate-950/84 p-1.5 shadow-[0_14px_38px_rgba(0,0,0,0.46)] backdrop-blur">
						<button
							type="button"
							onClick={() => handleLayoutModeChange("auto")}
							className="rounded-full border-0 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white cursor-pointer transition-colors hover:bg-white/16"
						>
							<i className="fa-solid fa-grip mr-2 text-cyan-300" />
							Auto Wall
						</button>
						<button
							type="button"
							onClick={handleToggleChat}
							disabled={twitchStreams.length === 0}
							className={`rounded-full border-0 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
								chatOpen
									? "bg-cyan-400/20 text-cyan-50"
									: "bg-white/10 hover:bg-white/16"
							}`}
						>
							<i
								className={`fa-solid ${chatOpen ? "fa-comments" : "fa-comment"} mr-2`}
							/>
							{chatOpen ? "Hide Chat" : "Show Chat"}
						</button>
						<div
							className="inline-flex items-center gap-1 rounded-full bg-white/10 p-1"
							role="group"
							aria-label="Cards per row"
						>
							<span className="px-2 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-300/78">
								Cols
							</span>
							{MAX_COLUMN_OPTIONS.map((columnCount) => (
								<button
									key={columnCount}
									type="button"
									onClick={() => handleMaxColumnsChange(columnCount)}
									aria-pressed={viewerState.maxColumns === columnCount}
									aria-label={`${columnCount} cards per row maximum`}
									className={`rounded-full border-0 px-3 py-1.5 text-xs font-bold text-white cursor-pointer transition-colors ${
										viewerState.maxColumns === columnCount
											? "bg-cyan-400/24 text-cyan-50"
											: "bg-transparent text-slate-300 hover:bg-white/12"
									}`}
								>
									{columnCount}
								</button>
							))}
						</div>
					</div>

					{chatOpen && twitchStreams.length > 0 && (
						<div className="fixed inset-0 z-40 xl:hidden">
							<button
								type="button"
								aria-label="Close chat"
								onClick={handleToggleChat}
								className="absolute inset-0 h-full w-full border-0 bg-slate-950/64"
							/>
							<div className="absolute inset-y-0 right-0 w-[min(24rem,calc(100vw-2rem))]">
								<StreamChatSidebar
									streams={twitchStreams}
									activeStreamId={activeChatStreamId}
									onSelectStream={handleActiveChatStreamChange}
									variant="matrixDrawer"
									onClose={handleToggleChat}
								/>
							</div>
						</div>
					)}
				</div>
			) : hasStreams ? (
				<div className="flex min-w-0 items-start gap-4 max-xl:flex-col">
					<StreamGrid
						streams={streams}
						layoutMode={layoutMode}
						maxColumns={viewerState.maxColumns}
						expandedCardChatStreamId={expandedCardChatStreamId}
						focusState={{
							focusedStreamIds,
							focusLayout,
							focusChatOpen,
							focusChatStreamId,
						}}
						onVolumeChange={handleStreamVolumeChange}
						onRemove={removeStream}
						onEdit={setEditingStreamId}
						onReorder={reorderStreams}
						onToggleChat={handleToggleCardChat}
						onEnterFocus={handleEnterFocus}
						onAddFocusCompanion={handleAddFocusCompanion}
						onRemoveFocusCompanion={handleRemoveFocusCompanion}
						onPromoteFocusStream={handlePromoteFocusStream}
						onSetFocusLayout={handleSetFocusLayout}
						onToggleFocusChat={handleToggleFocusChat}
						onSetFocusChatStream={handleSetFocusChatStream}
						onClearFocus={handleClearFocus}
					/>

					{chatOpen && twitchStreams.length > 0 && (
						<StreamChatSidebar
							streams={twitchStreams}
							activeStreamId={activeChatStreamId}
							onSelectStream={handleActiveChatStreamChange}
						/>
					)}
				</div>
			) : (
				<section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/16 bg-slate-950/42 px-6 py-10 shadow-[0_36px_90px_rgba(8,15,35,0.42)]">
					<div className="pointer-events-none absolute inset-x-12 top-0 h-52 rounded-[50%] bg-cyan-400/10 blur-3xl" />
					<div className="relative z-10 mx-auto max-w-3xl text-center">
						<p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-violet-300">
							Empty Project
						</p>
						<h2 className="mt-2 mb-3 text-[clamp(2rem,4vw,3rem)] leading-none">
							{activeProject.name} is ready for a TooManyStreams wall.
						</h2>
						<p className="mx-auto mb-6 max-w-2xl text-slate-300/80">
							Add Twitch or YouTube streams, keep them mounted while you
							reorder the wall, and open a dedicated Twitch chat lane whenever
							you need it.
						</p>

						<div className="flex flex-wrap justify-center gap-3">
							<button
								type="button"
								onClick={() => setDialogOpen(true)}
								className="inline-flex items-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-fuchsia-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 cursor-pointer hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
							>
								<i className="fa-solid fa-plus" />
								Add Stream
							</button>
							<button
								type="button"
								onClick={loadSamples}
								className="rounded-2xl border-0 bg-white/8 px-5 py-3.5 font-bold text-white transition-all duration-300 cursor-pointer hover:-translate-y-px hover:bg-white/12"
							>
								Add Sample Streams
							</button>
						</div>
					</div>
				</section>
			)}

			{dialogOpen && (
				<AddStreamDialog
					projectName={activeProject.name}
					existingStreams={availableLibraryStreams}
					onClose={() => setDialogOpen(false)}
					onAddExistingStream={addExistingStreamToProject}
					onAddStream={createStreamAndAddToProject}
					onLoadSamples={loadSamples}
				/>
			)}

			{editingStreamId && viewerState.streamsById[editingStreamId] && (
				<EditStreamDialog
					stream={viewerState.streamsById[editingStreamId]}
					onClose={() => setEditingStreamId(null)}
					onSave={editStream}
				/>
			)}

			{projectsDialogOpen && (
				<ProjectsDialog
					projects={viewerState.projects}
					activeProjectId={activeProject.id}
					onClose={() => setProjectsDialogOpen(false)}
					onCreateProject={createProject}
					onOpenProject={openProject}
					onRenameProject={renameProject}
					onDeleteProject={deleteProject}
				/>
			)}
		</main>
	)
}
