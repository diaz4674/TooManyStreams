import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import StreamPlayer from "./StreamPlayer"
import {
	FULL_CROP,
	MIN_CROP_SIZE,
	areCropsEqual,
	getStreamViews,
	isFullCrop,
	normalizeCropRect,
} from "../streamViews"

const HANDLE_HIT_SIZE_PX = 14

const RESIZE_HANDLES = [
	{ edges: ["top", "left"], cursor: "nwse-resize", className: "top-0 left-0 -translate-x-1/2 -translate-y-1/2" },
	{ edges: ["top"], cursor: "ns-resize", className: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
	{ edges: ["top", "right"], cursor: "nesw-resize", className: "top-0 right-0 translate-x-1/2 -translate-y-1/2" },
	{ edges: ["right"], cursor: "ew-resize", className: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2" },
	{ edges: ["bottom", "right"], cursor: "nwse-resize", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2" },
	{ edges: ["bottom"], cursor: "ns-resize", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
	{ edges: ["bottom", "left"], cursor: "nesw-resize", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2" },
	{ edges: ["left"], cursor: "ew-resize", className: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" },
]

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

function formatCropPercent(value) {
	return `${Math.round(value * 100)}%`
}

function buildDefaultViewName(views) {
	const existingNames = new Set(views.map((view) => view.name))
	let index = views.length + 1
	while (existingNames.has(`View ${index}`)) {
		index += 1
	}

	return `View ${index}`
}

function CropEditorSurface({ crop, onCropChange }) {
	const surfaceRef = useRef(null)
	const gestureRef = useRef(null)

	const getPointerPosition = useCallback((event) => {
		const rect = surfaceRef.current?.getBoundingClientRect()
		if (!rect || rect.width <= 0 || rect.height <= 0) {
			return null
		}

		return {
			x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
			y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
		}
	}, [])

	const startGesture = useCallback((event, gesture) => {
		if (event.button !== 0) {
			return
		}

		event.preventDefault()
		event.stopPropagation()
		event.currentTarget.setPointerCapture(event.pointerId)
		gestureRef.current = { ...gesture, pointerId: event.pointerId }
	}, [])

	const handleSurfacePointerDown = useCallback(
		(event) => {
			const position = getPointerPosition(event)
			if (!position) {
				return
			}

			startGesture(event, { kind: "draw", anchor: position })
		},
		[getPointerPosition, startGesture],
	)

	const handleMovePointerDown = useCallback(
		(event) => {
			const position = getPointerPosition(event)
			if (!position) {
				return
			}

			startGesture(event, {
				kind: "move",
				start: position,
				startCrop: crop,
			})
		},
		[crop, getPointerPosition, startGesture],
	)

	const handleResizePointerDown = useCallback(
		(edges) => (event) => {
			startGesture(event, { kind: "resize", edges, startCrop: crop })
		},
		[crop, startGesture],
	)

	const handlePointerMove = useCallback(
		(event) => {
			const gesture = gestureRef.current
			if (!gesture || event.pointerId !== gesture.pointerId) {
				return
			}

			const position = getPointerPosition(event)
			if (!position) {
				return
			}

			if (gesture.kind === "draw") {
				// Ignore plain clicks; only replace the crop once a drag starts.
				if (
					Math.abs(position.x - gesture.anchor.x) < 0.01 &&
					Math.abs(position.y - gesture.anchor.y) < 0.01
				) {
					return
				}

				const left = Math.min(gesture.anchor.x, position.x)
				const top = Math.min(gesture.anchor.y, position.y)
				const width = Math.max(
					Math.abs(position.x - gesture.anchor.x),
					MIN_CROP_SIZE,
				)
				const height = Math.max(
					Math.abs(position.y - gesture.anchor.y),
					MIN_CROP_SIZE,
				)
				onCropChange({
					x: Math.min(left, 1 - width),
					y: Math.min(top, 1 - height),
					width,
					height,
				})
				return
			}

			if (gesture.kind === "move") {
				const { start, startCrop } = gesture
				onCropChange({
					...startCrop,
					x: clamp(
						startCrop.x + (position.x - start.x),
						0,
						1 - startCrop.width,
					),
					y: clamp(
						startCrop.y + (position.y - start.y),
						0,
						1 - startCrop.height,
					),
				})
				return
			}

			const { edges, startCrop } = gesture
			let left = startCrop.x
			let top = startCrop.y
			let right = startCrop.x + startCrop.width
			let bottom = startCrop.y + startCrop.height

			if (edges.includes("left")) {
				left = clamp(position.x, 0, right - MIN_CROP_SIZE)
			}
			if (edges.includes("right")) {
				right = clamp(position.x, left + MIN_CROP_SIZE, 1)
			}
			if (edges.includes("top")) {
				top = clamp(position.y, 0, bottom - MIN_CROP_SIZE)
			}
			if (edges.includes("bottom")) {
				bottom = clamp(position.y, top + MIN_CROP_SIZE, 1)
			}

			onCropChange({
				x: left,
				y: top,
				width: right - left,
				height: bottom - top,
			})
		},
		[getPointerPosition, onCropChange],
	)

	const handlePointerEnd = useCallback((event) => {
		const gesture = gestureRef.current
		if (!gesture || event.pointerId !== gesture.pointerId) {
			return
		}

		gestureRef.current = null
	}, [])

	return (
		<div
			ref={surfaceRef}
			onPointerDown={handleSurfacePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerEnd}
			onPointerCancel={handlePointerEnd}
			className="absolute inset-0 cursor-crosshair touch-none select-none overflow-hidden"
		>
			<div
				onPointerDown={handleMovePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerEnd}
				className="absolute cursor-move border-2 border-cyan-300/90 shadow-[0_0_0_100vmax_rgba(2,6,23,0.42)]"
				style={{
					left: `${crop.x * 100}%`,
					top: `${crop.y * 100}%`,
					width: `${crop.width * 100}%`,
					height: `${crop.height * 100}%`,
				}}
			>
				<div className="pointer-events-none absolute inset-0">
					<div className="absolute inset-y-0 left-1/3 w-px bg-cyan-200/30" />
					<div className="absolute inset-y-0 left-2/3 w-px bg-cyan-200/30" />
					<div className="absolute inset-x-0 top-1/3 h-px bg-cyan-200/30" />
					<div className="absolute inset-x-0 top-2/3 h-px bg-cyan-200/30" />
				</div>

				<div className="pointer-events-none absolute -top-7 left-0 whitespace-nowrap rounded-full bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-cyan-100/90">
					{formatCropPercent(crop.width)} × {formatCropPercent(crop.height)}
				</div>

				{RESIZE_HANDLES.map((handle) => (
					<div
						key={handle.edges.join("-")}
						onPointerDown={handleResizePointerDown(handle.edges)}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerEnd}
						onPointerCancel={handlePointerEnd}
						className={`absolute z-10 rounded-full border border-slate-950/70 bg-cyan-300 ${handle.className}`}
						style={{
							width: `${HANDLE_HIT_SIZE_PX}px`,
							height: `${HANDLE_HIT_SIZE_PX}px`,
							cursor: handle.cursor,
						}}
					/>
				))}
			</div>
		</div>
	)
}

export default function StreamViewsDialog({
	stream,
	onClose,
	onSaveView,
	onDeleteView,
	onSelectView,
}) {
	const views = getStreamViews(stream)
	const [selectedViewId, setSelectedViewId] = useState(
		() => stream.activeViewId ?? null,
	)
	const selectedView = views.find((view) => view.id === selectedViewId) ?? null
	const [draftName, setDraftName] = useState(
		() => selectedView?.name ?? buildDefaultViewName(views),
	)
	const [draftCrop, setDraftCrop] = useState(
		() => selectedView?.crop ?? { ...FULL_CROP },
	)

	useEffect(() => {
		const handleEsc = (event) => {
			if (event.key === "Escape") onClose()
		}
		document.addEventListener("keydown", handleEsc)
		return () => document.removeEventListener("keydown", handleEsc)
	}, [onClose])

	const loadView = useCallback((view) => {
		setSelectedViewId(view.id)
		setDraftName(view.name)
		setDraftCrop(view.crop)
	}, [])

	const startNewView = useCallback(() => {
		setSelectedViewId(null)
		setDraftName(buildDefaultViewName(views))
		setDraftCrop({ ...FULL_CROP })
	}, [views])

	const handleDelete = useCallback(
		(viewId) => {
			onDeleteView(stream.id, viewId)
			if (viewId === selectedViewId) {
				setSelectedViewId(null)
			}
		},
		[onDeleteView, selectedViewId, stream.id],
	)

	const normalizedDraftCrop = useMemo(
		() => normalizeCropRect(draftCrop) ?? { ...FULL_CROP },
		[draftCrop],
	)
	const isDraftFullFrame = isFullCrop(normalizedDraftCrop)
	const hasUnsavedChanges =
		!selectedView ||
		selectedView.name !== draftName.trim() ||
		!areCropsEqual(selectedView.crop, normalizedDraftCrop)

	const handleSave = useCallback(() => {
		if (isDraftFullFrame) {
			return
		}

		const viewId = selectedViewId ?? crypto.randomUUID()
		onSaveView(stream.id, {
			id: viewId,
			name: draftName.trim() || buildDefaultViewName(views),
			crop: normalizedDraftCrop,
		})
		setSelectedViewId(viewId)
	}, [
		draftName,
		isDraftFullFrame,
		normalizedDraftCrop,
		onSaveView,
		selectedViewId,
		stream.id,
		views,
	])

	return (
		<div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
			<div className="flex max-h-[calc(100vh-2rem)] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.6rem] lg:h-[min(46rem,calc(100vh-2rem))] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(14,22,43,0.98),rgba(8,12,28,0.99))] text-slate-50 shadow-[0_36px_100px_rgba(2,6,23,0.7)]">
				<div className="flex shrink-0 items-start justify-between gap-4 border-b border-cyan-400/12 px-6 py-4">
					<div className="min-w-0">
						<p className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-cyan-200/80">
							Saved Views
						</p>
						<h2 className="mt-1 mb-1 truncate text-xl font-semibold">
							Crop {stream.title}
						</h2>
						<p className="m-0 text-sm text-slate-300/75">
							Drag on the video to draw a crop, or move and resize the frame.
							Saved views apply everywhere this stream appears.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="shrink-0 rounded-2xl border-0 bg-white/8 px-5 py-3 font-bold text-white transition-colors cursor-pointer hover:bg-white/12"
					>
						Done
					</button>
				</div>

				<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:overflow-hidden">
					<div className="flex min-h-0 min-w-0 flex-col gap-3">
						<div className="relative w-full overflow-hidden rounded-[1.1rem] border border-white/10 bg-slate-950 max-lg:aspect-video lg:min-h-0 lg:flex-1">
							<VideoStage
								stream={stream}
								crop={normalizedDraftCrop}
								onCropChange={setDraftCrop}
							/>
						</div>

						<div className="flex shrink-0 flex-wrap items-center gap-2">
							<label className="flex min-w-0 flex-1 items-center gap-2 rounded-[0.9rem] border border-slate-400/20 bg-slate-900/80 px-3 py-2">
								<span className="shrink-0 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-slate-300/70">
									Name
								</span>
								<input
									type="text"
									value={draftName}
									onChange={(event) => setDraftName(event.target.value)}
									placeholder="Minimap, Player cam..."
									className="w-full min-w-0 border-0 bg-transparent text-sm text-slate-50 focus:outline-none"
								/>
							</label>

							<button
								type="button"
								onClick={() => setDraftCrop({ ...FULL_CROP })}
								className="rounded-full bg-white/8 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-slate-100 transition-colors cursor-pointer hover:bg-white/12"
							>
								Reset Crop
							</button>

							<button
								type="button"
								onClick={handleSave}
								disabled={isDraftFullFrame || !hasUnsavedChanges}
								title={
									isDraftFullFrame
										? "Draw a crop on the video first"
										: undefined
								}
								className={`rounded-full px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] transition-colors ${
									isDraftFullFrame || !hasUnsavedChanges
										? "cursor-not-allowed bg-white/6 text-slate-400"
										: "cursor-pointer bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-[0_14px_26px_rgba(124,58,237,0.3)] hover:-translate-y-px"
								}`}
							>
								{selectedView ? "Save & Apply" : "Save View & Apply"}
							</button>
						</div>
					</div>

					<aside className="flex min-h-0 flex-col rounded-[1.1rem] border border-cyan-400/12 bg-slate-950/50">
						<div className="flex shrink-0 items-center justify-between gap-2 border-b border-cyan-400/12 px-4 py-3">
							<span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-cyan-100/75">
								Views ({views.length})
							</span>
							<button
								type="button"
								onClick={startNewView}
								className="rounded-full bg-cyan-400/14 px-3 py-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-cyan-50 transition-colors cursor-pointer hover:bg-cyan-400/22"
							>
								<i className="fa-solid fa-plus mr-1.5" />
								New
							</button>
						</div>

						<div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
							<button
								type="button"
								onClick={() => onSelectView(stream.id, null)}
								className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
									!stream.activeViewId
										? "bg-cyan-400/16 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]"
										: "bg-white/5 text-slate-100 hover:bg-white/10"
								}`}
							>
								<span className="flex min-w-0 items-center gap-2">
									<i className="fa-solid fa-expand shrink-0 text-[0.72rem] text-slate-300/70" />
									<span className="truncate">Full frame</span>
								</span>
								{!stream.activeViewId && (
									<span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-cyan-200/85">
										Active
									</span>
								)}
							</button>

							{views.map((view) => {
								const isActive = stream.activeViewId === view.id
								const isEditing = selectedViewId === view.id

								return (
									<div
										key={view.id}
										className={`rounded-xl px-3 py-2.5 transition-colors ${
											isActive
												? "bg-cyan-400/16 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]"
												: "bg-white/5 hover:bg-white/10"
										}`}
									>
										<button
											type="button"
											onClick={() => {
												loadView(view)
												onSelectView(stream.id, view.id)
											}}
											className="flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-sm text-slate-50 cursor-pointer"
										>
											<span className="flex min-w-0 items-center gap-2">
												<i className="fa-solid fa-crop-simple shrink-0 text-[0.72rem] text-cyan-200/80" />
												<span className="truncate font-semibold">
													{view.name}
												</span>
											</span>
											{isActive && (
												<span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-cyan-200/85">
													Active
												</span>
											)}
										</button>

										<div className="mt-1.5 flex items-center justify-between gap-2">
											<span className="truncate text-[0.62rem] uppercase tracking-[0.1em] text-slate-300/60">
												{formatCropPercent(view.crop.width)} ×{" "}
												{formatCropPercent(view.crop.height)}
												{isEditing ? " — editing" : ""}
											</span>
											<button
												type="button"
												onClick={() => handleDelete(view.id)}
												aria-label={`Delete ${view.name}`}
												title={`Delete ${view.name}`}
												className="shrink-0 rounded-full border-0 bg-white/6 px-2 py-1 text-[0.62rem] text-rose-200/90 transition-colors cursor-pointer hover:bg-rose-500/25"
											>
												<i className="fa-solid fa-trash-can" />
											</button>
										</div>
									</div>
								)
							})}

							{views.length === 0 && (
								<p className="m-0 px-1 py-2 text-xs leading-5 text-slate-400">
									No saved views yet. Draw a crop on the video, give it a name,
									and save it to switch back to it anytime.
								</p>
							)}
						</div>
					</aside>
				</div>
			</div>
		</div>
	)
}

const EDITOR_AUTOPLAY_RETRY_DELAYS_MS = [1500, 3500, 6500, 10000]

// Keeps the live preview letterboxed at 16:9 so editor coordinates map 1:1
// onto the video frame, with the crop editor layered on top.
function VideoStage({ stream, crop, onCropChange }) {
	const stageRef = useRef(null)
	const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
	// Twitch/YouTube often block autoplay for players spawned mid-session, so
	// keep re-requesting muted playback the same way cinema mode does.
	const [playbackToken, setPlaybackToken] = useState(1)

	useEffect(() => {
		const timeoutIds = EDITOR_AUTOPLAY_RETRY_DELAYS_MS.map((delayMs) =>
			window.setTimeout(() => {
				setPlaybackToken((token) => token + 1)
			}, delayMs),
		)

		return () => {
			for (const timeoutId of timeoutIds) {
				window.clearTimeout(timeoutId)
			}
		}
	}, [])

	useEffect(() => {
		const node = stageRef.current
		if (!node) {
			return undefined
		}

		const updateSize = () => {
			const rect = node.getBoundingClientRect()
			setStageSize({ width: rect.width, height: rect.height })
		}

		updateSize()

		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(() => updateSize())
		resizeObserver?.observe(node)

		return () => {
			resizeObserver?.disconnect()
		}
	}, [])

	const videoFrame = useMemo(() => {
		if (stageSize.width <= 0 || stageSize.height <= 0) {
			return null
		}

		const stageAspectRatio = stageSize.width / stageSize.height
		const videoAspectRatio = 16 / 9
		const width =
			stageAspectRatio > videoAspectRatio
				? stageSize.height * videoAspectRatio
				: stageSize.width
		const height = width / videoAspectRatio

		return {
			left: (stageSize.width - width) / 2,
			top: (stageSize.height - height) / 2,
			width,
			height,
		}
	}, [stageSize.height, stageSize.width])

	return (
		<div ref={stageRef} className="absolute inset-0">
			{videoFrame && (
				<div
					className="absolute"
					style={{
						left: `${videoFrame.left}px`,
						top: `${videoFrame.top}px`,
						width: `${videoFrame.width}px`,
						height: `${videoFrame.height}px`,
					}}
				>
					<StreamPlayer
						stream={stream}
						muted
						volume={0}
						playbackToken={playbackToken}
						loadSessionKey={`views-editor-${stream.id}`}
					/>
					<CropEditorSurface crop={crop} onCropChange={onCropChange} />
				</div>
			)}
		</div>
	)
}
