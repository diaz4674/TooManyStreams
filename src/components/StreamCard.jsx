import { memo, useEffect, useRef, useState } from "react"
import EmbeddedStreamChat from "./EmbeddedStreamChat"
import StreamPlayer from "./StreamPlayer"
import { isStreamChatCapable } from "../utils"

const TWITCH_CARD_AUTOPLAY_THRESHOLD = 0.6
const APP_RESUME_DEDUP_WINDOW_MS = 400
const CINEMA_PRIMARY_AUTOPLAY_RETRY_DELAYS_MS = [
	0,
	320,
	900,
	1700,
	2600,
	3800,
	5200,
	7000,
	9000,
	12000,
]

function PlatformLogo({ platform }) {
	if (platform === "twitch") {
		return <i className="fa-brands fa-twitch text-violet-400" />
	}

	if (platform === "youtube") {
		return <i className="fa-brands fa-youtube text-red-400" />
	}

	return <i className="fa-solid fa-play text-slate-400" />
}

function FocusActionButton({ icon, label, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className="stream-card-interactive pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border-0 bg-slate-950/78 text-cyan-50 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur cursor-pointer transition-colors hover:bg-slate-900/92"
		>
			<i className={`fa-solid ${icon} text-[0.78rem]`} />
		</button>
	)
}

function FocusVolumeControl({ streamTitle, volume, onChange }) {
	return (
		<label className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-slate-950/78 px-3 py-2 text-white shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
			<i className="fa-solid fa-volume-low text-[0.8rem] text-cyan-50/92" />
			<span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-cyan-50/88">
				Volume
			</span>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				value={volume}
				onChange={(event) => onChange(Number(event.target.value))}
				className="stream-card-interactive h-1.5 w-28 accent-cyan-400 md:w-36"
				aria-label={`Volume for ${streamTitle}`}
			/>
			<span className="min-w-8 text-right text-[0.66rem] font-bold uppercase tracking-[0.12em] text-cyan-50/78">
				{volume}
			</span>
		</label>
	)
}

function StreamCardComponent({
	stream,
	videoHeight,
	volume,
	onVolumeChange,
	onRemove,
	onEdit,
	onFocus,
	forcedMuted,
	playbackToken = 0,
	isFocused = false,
	onToggleChat,
	chatExpanded = false,
	inlineChatHeight = 320,
	dragHandleAttributes,
	dragHandleListeners,
	fluidVideo = false,
	isDragging = false,
	presentation = "default",
	focusTileRole = "primary",
	focusTilePlacement = "main",
	onExitFocus,
	onPromoteFocus,
	onRemoveFromFocus,
	onPlayerReady,
	loadSessionKey,
	preserveFullFrame = false,
	canManageStreamMembership = true,
	canReorderStreamMembership = true,
}) {
	const isFocusPresentation = presentation === "focus"
	const showVolume = stream.platform === "youtube"
	const isChatCapable = isStreamChatCapable(stream)
	const showInlineChatToggle =
		!isFocusPresentation && isChatCapable && typeof onToggleChat === "function"
	const showInlineChatHint =
		!isFocusPresentation &&
		stream.platform === "youtube" &&
		!isChatCapable &&
		typeof onToggleChat === "function"
	const showCompanionHoverActions =
		isFocusPresentation && focusTileRole === "companion"
	const showPersistentBottomCompanionRemove =
		showCompanionHoverActions &&
		focusTilePlacement === "bottom" &&
		typeof onRemoveFromFocus === "function"
	const showFocusVolumeOnHover = isFocusPresentation && showVolume
	const showEmbeddedFocusOverlay =
		isFocusPresentation &&
		!(stream.platform === "twitch" && focusTileRole === "primary")
	const dragHandleLabel = "Drag to reorder stream"
	const shouldCropToFill =
		!preserveFullFrame &&
		stream.platform === "youtube" &&
		(isFocusPresentation ? focusTileRole === "companion" : fluidVideo)
	const articleRef = useRef(null)
	const isCardVisibleRef = useRef(isFocusPresentation)
	const lastAppResumeAtRef = useRef(0)
	const cinemaAutoplayTimeoutsRef = useRef([])
	const [viewportPlaybackToken, setViewportPlaybackToken] = useState(0)
	const combinedPlaybackToken = playbackToken + viewportPlaybackToken

	const getCardVisibility = () => {
		const node = articleRef.current
		if (!node) {
			return false
		}

		const rect = node.getBoundingClientRect()
		const totalArea = rect.width * rect.height
		if (totalArea <= 0) {
			return false
		}

		const visibleWidth = Math.max(
			0,
			Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
		)
		const visibleHeight = Math.max(
			0,
			Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
		)
		const visibleArea = visibleWidth * visibleHeight
		return visibleArea / totalArea >= TWITCH_CARD_AUTOPLAY_THRESHOLD
	}

	const handleFocusVolumeChange = (nextVolume) => {
		onVolumeChange(stream.id, nextVolume)
	}

	useEffect(() => {
		isCardVisibleRef.current = isFocusPresentation
	}, [isFocusPresentation, stream.id])

	useEffect(() => {
		if (stream.platform !== "twitch" || isFocusPresentation) {
			return undefined
		}

		const node = articleRef.current
		if (!node) {
			return undefined
		}

		if (typeof IntersectionObserver === "undefined") {
			isCardVisibleRef.current = true
			setViewportPlaybackToken((token) => token + 1)
			return undefined
		}

		let wasVisible = false
		const observer = new IntersectionObserver(
			([entry]) => {
				const isVisible =
					entry.isIntersecting &&
					entry.intersectionRatio >= TWITCH_CARD_AUTOPLAY_THRESHOLD
				isCardVisibleRef.current = isVisible

				if (isVisible && !wasVisible) {
					setViewportPlaybackToken((token) => token + 1)
				}

				wasVisible = isVisible
			},
			{
				threshold: [0, TWITCH_CARD_AUTOPLAY_THRESHOLD],
			},
		)

		observer.observe(node)

		return () => {
			observer.disconnect()
		}
	}, [isFocusPresentation, stream.id, stream.platform])

	useEffect(() => {
		if (stream.platform !== "twitch") {
			return undefined
		}

		const checkCardVisibilityAndResume = () => {
			if (document.visibilityState !== "visible") {
				return
			}

			const isVisible = getCardVisibility()
			if (!isVisible) {
				return
			}

			isCardVisibleRef.current = true

			const now = Date.now()
			if (now - lastAppResumeAtRef.current < APP_RESUME_DEDUP_WINDOW_MS) {
				return
			}

			lastAppResumeAtRef.current = now
			setViewportPlaybackToken((token) => token + 1)
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				checkCardVisibilityAndResume()
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("focus", checkCardVisibilityAndResume)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", checkCardVisibilityAndResume)
		}
	}, [stream.platform])

	useEffect(() => {
		const isCinemaPrimaryTwitch =
			stream.platform === "twitch" &&
			isFocusPresentation &&
			focusTileRole === "primary"
		if (!isCinemaPrimaryTwitch) {
			for (const timeoutId of cinemaAutoplayTimeoutsRef.current) {
				window.clearTimeout(timeoutId)
			}
			cinemaAutoplayTimeoutsRef.current = []
			return undefined
		}

		const clearCinemaAutoplayTimeouts = () => {
			for (const timeoutId of cinemaAutoplayTimeoutsRef.current) {
				window.clearTimeout(timeoutId)
			}
			cinemaAutoplayTimeoutsRef.current = []
		}

		const scheduleCinemaPrimaryAutoplay = () => {
			if (document.visibilityState !== "visible") {
				return
			}

			clearCinemaAutoplayTimeouts()
			cinemaAutoplayTimeoutsRef.current =
				CINEMA_PRIMARY_AUTOPLAY_RETRY_DELAYS_MS.map((delayMs) =>
					window.setTimeout(() => {
						if (document.visibilityState !== "visible") {
							return
						}

						setViewportPlaybackToken((token) => token + 1)
					}, delayMs),
				)
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				scheduleCinemaPrimaryAutoplay()
			}
		}

		// Entering cinema mode should aggressively re-request playback
		// because Twitch can keep the player paused after layout transitions.
		scheduleCinemaPrimaryAutoplay()
		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("focus", scheduleCinemaPrimaryAutoplay)
		window.addEventListener("pageshow", scheduleCinemaPrimaryAutoplay)

		return () => {
			clearCinemaAutoplayTimeouts()
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", scheduleCinemaPrimaryAutoplay)
			window.removeEventListener("pageshow", scheduleCinemaPrimaryAutoplay)
		}
	}, [focusTileRole, isFocusPresentation, stream.platform])

	return (
		<article
			ref={articleRef}
			className={`relative flex h-full min-w-0 overflow-hidden ${
				isFocusPresentation
					? "group/focus-tile rounded-[1.7rem] border border-white/10 bg-slate-950/94 shadow-[0_28px_90px_rgba(2,6,23,0.62)]"
					: "rounded-[1.45rem] border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(22,18,55,0.96),rgba(10,14,32,0.98))] shadow-[0_24px_60px_rgba(8,15,35,0.48)]"
			} transition-[transform,box-shadow,opacity] duration-300 ${
				isDragging ? "z-20 rotate-[1deg] opacity-90" : ""
			}`}
			style={{ width: "100%" }}
		>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{!isFocusPresentation && (
					<div className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-400/16 px-3 py-2.5">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							{canReorderStreamMembership && (
								<button
									type="button"
									aria-label={dragHandleLabel}
									title={dragHandleLabel}
									className="stream-card-drag-handle inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-white/6 text-slate-300/72 touch-none select-none cursor-grab active:cursor-grabbing"
									{...dragHandleAttributes}
									{...dragHandleListeners}
								>
									<i className="fa-solid fa-grip-vertical" />
								</button>
							)}
							<div className="min-w-0">
								<div className="flex items-center gap-2 text-sm font-semibold text-white">
									<PlatformLogo platform={stream.platform} />
									<span className="truncate">{stream.title}</span>
								</div>
								<p className="m-0 truncate text-[0.72rem] uppercase tracking-[0.14em] text-slate-300/62">
									{stream.channelName}
								</p>
							</div>
						</div>

						<div className="flex shrink-0 items-center gap-2">
							{onFocus && (
								<button
									type="button"
									onClick={() => onFocus(stream.id)}
									aria-label={
										isFocused
											? `Minimize ${stream.title}`
											: `Focus ${stream.title}`
									}
									title={isFocused ? "Minimize" : "Focus stream"}
									className="stream-card-interactive inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-cyan-400/12 text-cyan-100 cursor-pointer transition-colors hover:bg-cyan-400/20"
								>
									<i
										className={`fa-solid ${
											isFocused ? "fa-minimize" : "fa-maximize"
										} text-[0.7rem]`}
									/>
								</button>
							)}

							{canManageStreamMembership && (
								<button
									type="button"
									onClick={() => onRemove(stream.id)}
									aria-label="Remove stream"
									title="Remove stream"
									className="stream-card-interactive inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-rose-500/82 text-white cursor-pointer"
								>
									<i className="fa-solid fa-xmark" />
								</button>
							)}
						</div>
					</div>
				)}

				<div
					className={`relative min-w-0 overflow-hidden bg-slate-950 ${
						isFocusPresentation
							? "min-h-0 flex-1"
							: fluidVideo
								? "mx-3 my-3 min-h-0 flex-1 rounded-[1rem]"
								: "mx-3 my-3 shrink-0 rounded-[1rem] transition-[height] duration-300"
					}`}
					style={
						isFocusPresentation || fluidVideo
							? undefined
							: { height: `${videoHeight}px` }
					}
				>
					<StreamPlayer
						stream={stream}
						volume={volume}
						muted={forcedMuted}
						cropToFill={shouldCropToFill}
						playbackToken={combinedPlaybackToken}
						onReady={onPlayerReady}
						loadSessionKey={loadSessionKey}
					/>

					{showEmbeddedFocusOverlay && (
						<div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
							<div className="flex items-start justify-between gap-3">
								<div
									className={`pointer-events-auto inline-flex max-w-[72%] items-center gap-2 rounded-full bg-slate-950/72 px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(2,6,23,0.28)] backdrop-blur transition-opacity duration-200 ${
										showCompanionHoverActions
											? "opacity-0 group-hover/focus-tile:opacity-100 group-focus-within/focus-tile:opacity-100"
											: "opacity-100"
									}`}
								>
									<PlatformLogo platform={stream.platform} />
									<span className="truncate">{stream.title}</span>
								</div>

								<div
									className={`flex items-center gap-2 transition-opacity duration-200 ${
										showCompanionHoverActions
											? "opacity-0 group-hover/focus-tile:opacity-100 group-focus-within/focus-tile:opacity-100"
											: "opacity-100"
									}`}
								>
									{focusTileRole === "companion" &&
										typeof onPromoteFocus === "function" && (
											<FocusActionButton
												icon="fa-up-right-and-down-left-from-center"
												label={`Promote ${stream.title}`}
												onClick={onPromoteFocus}
											/>
										)}
									{focusTileRole === "companion" &&
										!showPersistentBottomCompanionRemove &&
										typeof onRemoveFromFocus === "function" && (
											<FocusActionButton
												icon="fa-minus"
												label={`Remove ${stream.title} from cinema mode`}
												onClick={onRemoveFromFocus}
											/>
										)}
									{focusTileRole === "primary" &&
										typeof onExitFocus === "function" && (
											<FocusActionButton
												icon="fa-minimize"
												label="Close cinema mode"
												onClick={onExitFocus}
											/>
										)}
								</div>
							</div>

							{showPersistentBottomCompanionRemove && (
								<div className="flex w-full justify-end">
									<FocusActionButton
										icon="fa-minus"
										label={`Remove ${stream.title} from cinema mode`}
										onClick={onRemoveFromFocus}
									/>
								</div>
							)}

							<div className="flex items-end justify-end">
								<div
									className={`flex w-full items-end justify-end gap-3 transition-opacity duration-200 ${
										showFocusVolumeOnHover
											? "opacity-0 group-hover/focus-tile:opacity-100 group-focus-within/focus-tile:opacity-100"
											: "opacity-100"
									}`}
								>
									{showVolume && (
										<FocusVolumeControl
											streamTitle={stream.title}
											volume={volume}
											onChange={handleFocusVolumeChange}
										/>
									)}
								</div>
							</div>
						</div>
					)}
				</div>

				{!isFocusPresentation && chatExpanded && isChatCapable && (
					<div
						className="mx-3 mb-3 min-w-0 shrink-0 overflow-hidden rounded-[1rem] border border-cyan-400/14 bg-slate-950"
						style={{ height: `${inlineChatHeight}px` }}
					>
						<EmbeddedStreamChat
							stream={stream}
							title={`${stream.title} inline chat`}
							iframeClassName="h-full w-full border-0 bg-slate-950"
							fallbackClassName="flex h-full w-full items-center justify-center px-5 text-center text-sm text-slate-300/82"
						/>
					</div>
				)}

				{!isFocusPresentation && (
					<div className="mt-auto flex shrink-0 items-center gap-3 border-t border-cyan-400/14 px-3 py-2.5">
						<div className="min-w-0 flex-1 truncate text-[0.74rem] uppercase tracking-[0.14em] text-slate-300/65">
							{!canManageStreamMembership
								? "Managed by your Twitch follows"
								: stream.platform === "twitch"
									? "Native Twitch controls in player"
									: "YouTube volume available"}
						</div>

						<div className="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onClick={() => onEdit(stream.id)}
								className="stream-card-interactive shrink-0 whitespace-nowrap rounded-full bg-white/8 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-100 cursor-pointer transition-colors hover:bg-white/14"
							>
								<i className="fa-solid fa-pen mr-1.5" />
								Edit
							</button>

							{showVolume && (
								<label className="flex shrink-0 w-32 items-center gap-2 text-slate-300/74">
									<i className="fa-solid fa-volume-low text-[0.7rem]" />
									<input
										type="range"
										min="0"
										max="100"
										step="1"
										value={volume}
										onChange={(event) =>
											onVolumeChange(stream.id, Number(event.target.value))
										}
										className="stream-card-interactive h-1 w-full accent-cyan-400"
										aria-label={`Volume for ${stream.title}`}
									/>
								</label>
							)}

							{showInlineChatToggle ? (
								<button
									type="button"
									onClick={() => onToggleChat(stream.id)}
									className={`stream-card-interactive shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] cursor-pointer transition-colors ${
										chatExpanded
											? "bg-cyan-400/18 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
											: "bg-cyan-400/12 text-cyan-100 hover:bg-cyan-400/20"
									}`}
								>
									{chatExpanded ? "Hide Chat" : "Open Chat"}
								</button>
							) : showInlineChatHint ? (
								<div className="rounded-full bg-white/8 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-300/80">
									Live video ID needed
								</div>
							) : (
								<div className="rounded-full bg-cyan-400/12 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-100">
									{isChatCapable ? "Chat Ready" : "No Chat"}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</article>
	)
}

const StreamCard = memo(StreamCardComponent)
StreamCard.displayName = "StreamCard"

export default StreamCard
