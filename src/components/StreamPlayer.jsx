import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getEmbedSrc, getTwitchParent } from "../utils"

let twitchSdkPromise
let youtubeSdkPromise
const EMBED_ASPECT_RATIO = 16 / 9
const TWITCH_MIN_AUTOPLAY_WIDTH_PX = 400
const TWITCH_MIN_AUTOPLAY_HEIGHT_PX = 300
const TWITCH_PLAYBACK_RECOVERY_WINDOW_MS = 1600
const TWITCH_PLAYBACK_RETRY_DELAY_MS = 250
const TWITCH_TAB_RESUME_RETRY_DELAYS_MS = [0, 320, 900, 1700]
const TWITCH_TAB_RESUME_REBUILD_FALLBACK_DELAY_MS = 2800

function loadTwitchSdk() {
	if (window.Twitch?.Player) {
		return Promise.resolve(window.Twitch)
	}

	if (!twitchSdkPromise) {
		twitchSdkPromise = new Promise((resolve, reject) => {
			const finishLoading = () => {
				if (window.Twitch?.Player) {
					resolve(window.Twitch)
					return
				}

				reject(new Error("Twitch player SDK failed to initialize."))
			}
			let script = document.querySelector(
				'script[data-twitch-player-sdk="true"]',
			)

			if (!script) {
				script = document.createElement("script")
				script.src = "https://player.twitch.tv/js/embed/v1.js"
				script.async = true
				script.dataset.twitchPlayerSdk = "true"
			}

			script.addEventListener("load", finishLoading, { once: true })
			script.addEventListener(
				"error",
				() => reject(new Error("Twitch player SDK failed to load.")),
				{ once: true },
			)

			if (!script.isConnected) {
				document.head.append(script)
			}
		})
	}

	return twitchSdkPromise
}

function loadYouTubeSdk() {
	if (window.YT?.Player) {
		return Promise.resolve(window.YT)
	}

	if (!youtubeSdkPromise) {
		youtubeSdkPromise = new Promise((resolve, reject) => {
			const previousReady = window.onYouTubeIframeAPIReady
			window.onYouTubeIframeAPIReady = () => {
				previousReady?.()
				if (window.YT?.Player) {
					resolve(window.YT)
					return
				}
				reject(new Error("YouTube player SDK failed to initialize."))
			}

			const existingScript = document.querySelector(
				'script[data-youtube-player-sdk="true"]',
			)

			if (existingScript) {
				existingScript.addEventListener(
					"error",
					() => reject(new Error("YouTube player SDK failed to load.")),
					{ once: true },
				)
				return
			}

			const script = document.createElement("script")
			script.src = "https://www.youtube.com/iframe_api"
			script.async = true
			script.dataset.youtubePlayerSdk = "true"
			script.addEventListener(
				"error",
				() => reject(new Error("YouTube player SDK failed to load.")),
				{ once: true },
			)
			document.head.append(script)
		})
	}

	return youtubeSdkPromise
}

function getCoverFrameStyle(containerSize, cropToFill) {
	if (!cropToFill || containerSize.width <= 0 || containerSize.height <= 0) {
		return {
			position: "absolute",
			inset: "0",
			width: "100%",
			height: "100%",
			border: "0",
			display: "block",
		}
	}

	const containerAspectRatio = containerSize.width / containerSize.height

	if (containerAspectRatio < EMBED_ASPECT_RATIO) {
		return {
			position: "absolute",
			top: "0",
			left: "50%",
			width: `${(EMBED_ASPECT_RATIO / containerAspectRatio) * 100}%`,
			height: "100%",
			border: "0",
			display: "block",
			transform: "translateX(-50%)",
		}
	}

	return {
		position: "absolute",
		top: "50%",
		left: "0",
		width: "100%",
		height: `${(containerAspectRatio / EMBED_ASPECT_RATIO) * 100}%`,
		border: "0",
		display: "block",
		transform: "translateY(-50%)",
	}
}

function useEmbedViewport(cropToFill) {
	const containerRef = useRef(null)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

	useEffect(() => {
		if (!cropToFill) {
			return undefined
		}

		const node = containerRef.current
		if (!node) {
			return undefined
		}

		const updateSize = () => {
			const rect = node.getBoundingClientRect()
			setContainerSize({
				width: rect.width,
				height: rect.height,
			})
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
	}, [cropToFill])

	const frameStyle = useMemo(
		() => getCoverFrameStyle(containerSize, cropToFill),
		[containerSize, cropToFill],
	)

	return { containerRef, frameStyle }
}

function TwitchEmbed({
	stream,
	muted = true,
	shouldAutoplay = true,
	playbackToken = 0,
	onReady,
	loadSessionKey,
}) {
	const [playerBuildKey, setPlayerBuildKey] = useState(0)
	const playerId = `twitch-player-${stream.id}-${playerBuildKey}`
	const containerRef = useRef(null)
	const playerRef = useRef(null)
	const readyRef = useRef(false)
	const mutedRef = useRef(muted)
	const playbackTokenRef = useRef(playbackToken)
	const builtAtEligibleSizeRef = useRef(false)
	const pendingPlaybackRef = useRef({
		token: 0,
		deadline: 0,
	})
	const resumePlaybackTokenRef = useRef(0)
	const resumeAttemptIdRef = useRef(0)
	const resumeRetryTimeoutsRef = useRef([])
	const resumeRebuildTimeoutRef = useRef(null)
	const retryTimeoutRef = useRef(null)
	const [sdkFailed, setSdkFailed] = useState(false)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const readySignalSentRef = useRef(false)
	mutedRef.current = muted
	playbackTokenRef.current = playbackToken
	const meetsAutoplaySizeRequirement =
		containerSize.width >= TWITCH_MIN_AUTOPLAY_WIDTH_PX &&
		containerSize.height >= TWITCH_MIN_AUTOPLAY_HEIGHT_PX
	const iframeSrc = getEmbedSrc(stream, {
		muted,
		autoplay: shouldAutoplay,
	})

	useEffect(() => {
		readySignalSentRef.current = false
	}, [loadSessionKey, stream.channelName, stream.id])

	const notifyReady = useCallback(() => {
		if (readySignalSentRef.current) {
			return
		}

		readySignalSentRef.current = true
		onReady?.(stream.id, loadSessionKey)
	}, [loadSessionKey, onReady, stream.id])

	useEffect(() => {
		const node = containerRef.current
		if (!node) {
			return undefined
		}

		const updateSize = () => {
			const rect = node.getBoundingClientRect()
			setContainerSize({
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			})
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

	const clearPendingPlaybackRequest = useCallback(() => {
		pendingPlaybackRef.current = {
			token: 0,
			deadline: 0,
		}
		window.clearTimeout(retryTimeoutRef.current)
		retryTimeoutRef.current = null
	}, [])

	const clearResumeRetryRequests = useCallback(() => {
		for (const timeoutId of resumeRetryTimeoutsRef.current) {
			window.clearTimeout(timeoutId)
		}
		resumeRetryTimeoutsRef.current = []
		window.clearTimeout(resumeRebuildTimeoutRef.current)
		resumeRebuildTimeoutRef.current = null
	}, [])

	const schedulePendingPlaybackCheck = useCallback(
		(token) => {
			window.clearTimeout(retryTimeoutRef.current)
			retryTimeoutRef.current = window.setTimeout(() => {
				if (pendingPlaybackRef.current.token !== token) {
					return
				}

				if (Date.now() >= pendingPlaybackRef.current.deadline) {
					clearPendingPlaybackRequest()
					return
				}

				const player = playerRef.current
				if (!player || !readyRef.current) {
					schedulePendingPlaybackCheck(token)
					return
				}

				if (player.isPaused?.()) {
					player.setMuted(true)
					player.play()
				}

				schedulePendingPlaybackCheck(token)
			}, TWITCH_PLAYBACK_RETRY_DELAY_MS)
		},
		[clearPendingPlaybackRequest],
	)

	const startPendingPlaybackRequest = useCallback(
		(token) => {
			if (token <= 0) {
				clearPendingPlaybackRequest()
				return
			}

			pendingPlaybackRef.current = {
				token,
				deadline: Date.now() + TWITCH_PLAYBACK_RECOVERY_WINDOW_MS,
			}

			if (readyRef.current && playerRef.current) {
				playerRef.current.setMuted(true)
				playerRef.current.play()
			}

			schedulePendingPlaybackCheck(token)
		},
		[
			clearPendingPlaybackRequest,
			schedulePendingPlaybackCheck,
		],
	)

	useEffect(() => {
		let cancelled = false
		let player = null
		let Twitch = null
		let handleReady = null
		let handlePlaying = null
		let handlePause = null
		let handlePlaybackBlocked = null

		setSdkFailed(false)
		loadTwitchSdk()
			.then((loadedTwitch) => {
				if (cancelled) {
					return
				}

				Twitch = loadedTwitch
				builtAtEligibleSizeRef.current = meetsAutoplaySizeRequirement
				player = new Twitch.Player(playerId, {
					autoplay: shouldAutoplay,
					channel: stream.channelName,
					height: meetsAutoplaySizeRequirement
						? Math.max(
								TWITCH_MIN_AUTOPLAY_HEIGHT_PX,
								containerSize.height,
							)
						: "100%",
					muted: mutedRef.current,
					parent: [getTwitchParent()],
					width: meetsAutoplaySizeRequirement
						? Math.max(TWITCH_MIN_AUTOPLAY_WIDTH_PX, containerSize.width)
						: "100%",
				})
				playerRef.current = player
				handleReady = () => {
					if (cancelled) {
						return
					}

					readyRef.current = true
					player.setMuted(Boolean(mutedRef.current))
					notifyReady()

					if (playbackTokenRef.current > 0) {
						startPendingPlaybackRequest(playbackTokenRef.current)
					}
				}
				handlePlaying = () => {
					if (
						pendingPlaybackRef.current.token > 0 &&
						Date.now() >= pendingPlaybackRef.current.deadline
					) {
						clearPendingPlaybackRequest()
					}
				}
				handlePause = () => {
					const pendingToken = pendingPlaybackRef.current.token
					if (
						pendingToken <= 0 ||
						Date.now() >= pendingPlaybackRef.current.deadline
					) {
						clearPendingPlaybackRequest()
						return
					}

					startPendingPlaybackRequest(pendingToken)
				}
				handlePlaybackBlocked = () => {
					const pendingToken = pendingPlaybackRef.current.token
					if (pendingToken > 0) {
						startPendingPlaybackRequest(pendingToken)
					}
				}
				player.addEventListener(Twitch.Player.READY, handleReady)
				player.addEventListener(Twitch.Player.PLAYING, handlePlaying)
				player.addEventListener(Twitch.Player.PAUSE, handlePause)
				player.addEventListener(
					Twitch.Player.PLAYBACK_BLOCKED,
					handlePlaybackBlocked,
				)
			})
			.catch(() => {
				if (!cancelled) {
					setSdkFailed(true)
				}
			})

		return () => {
			cancelled = true
			readyRef.current = false
			if (player && Twitch && typeof player.removeEventListener === "function") {
				player.removeEventListener(Twitch.Player.READY, handleReady)
				player.removeEventListener(Twitch.Player.PLAYING, handlePlaying)
				player.removeEventListener(Twitch.Player.PAUSE, handlePause)
				player.removeEventListener(
					Twitch.Player.PLAYBACK_BLOCKED,
					handlePlaybackBlocked,
				)
			}
			clearPendingPlaybackRequest()
			clearResumeRetryRequests()
			if (typeof player?.destroy === "function") {
				player.destroy()
			} else {
				document.getElementById(playerId)?.replaceChildren()
			}
			playerRef.current = null
		}
	}, [
		clearPendingPlaybackRequest,
		clearResumeRetryRequests,
		containerSize.height,
		containerSize.width,
		meetsAutoplaySizeRequirement,
		notifyReady,
		playerId,
		shouldAutoplay,
		startPendingPlaybackRequest,
		stream.channelName,
	])

	useEffect(() => {
		if (!readyRef.current) {
			return
		}

		playerRef.current?.setMuted(Boolean(muted))
	}, [muted])

	useEffect(() => {
		const player = playerRef.current
		if (playbackToken <= 0 || !player || !readyRef.current) {
			return
		}

		// Entering cinema mode is an explicit muted playback request.
		startPendingPlaybackRequest(playbackToken)
	}, [playbackToken, startPendingPlaybackRequest])

	useEffect(() => {
		if (!shouldAutoplay) {
			clearResumeRetryRequests()
			return undefined
		}

		const scheduleTabResumePlayback = () => {
			if (document.visibilityState !== "visible") {
				return
			}

			resumeAttemptIdRef.current += 1
			const attemptId = resumeAttemptIdRef.current
			clearResumeRetryRequests()
			resumeRetryTimeoutsRef.current = TWITCH_TAB_RESUME_RETRY_DELAYS_MS.map(
				(delayMs) =>
					window.setTimeout(() => {
						if (
							document.visibilityState !== "visible" ||
							!readyRef.current ||
							!playerRef.current ||
							attemptId !== resumeAttemptIdRef.current
						) {
							return
						}

						resumePlaybackTokenRef.current += 1
						startPendingPlaybackRequest(
							100_000 + resumePlaybackTokenRef.current,
						)
					}, delayMs),
			)

			resumeRebuildTimeoutRef.current = window.setTimeout(() => {
				if (
					document.visibilityState !== "visible" ||
					attemptId !== resumeAttemptIdRef.current ||
					!readyRef.current
				) {
					return
				}

				const player = playerRef.current
				if (!player || !player.isPaused?.()) {
					return
				}

				setPlayerBuildKey((key) => key + 1)
			}, TWITCH_TAB_RESUME_REBUILD_FALLBACK_DELAY_MS)
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				scheduleTabResumePlayback()
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("focus", scheduleTabResumePlayback)
		window.addEventListener("pageshow", scheduleTabResumePlayback)

		return () => {
			clearResumeRetryRequests()
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			)
			window.removeEventListener("focus", scheduleTabResumePlayback)
			window.removeEventListener("pageshow", scheduleTabResumePlayback)
		}
	}, [
		clearResumeRetryRequests,
		shouldAutoplay,
		startPendingPlaybackRequest,
	])

	useEffect(() => {
		if (
			playbackToken <= 0 ||
			!meetsAutoplaySizeRequirement ||
			builtAtEligibleSizeRef.current
		) {
			return
		}

		setPlayerBuildKey((key) => key + 1)
	}, [meetsAutoplaySizeRequirement, playbackToken])

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 overflow-hidden bg-slate-950"
		>
			{sdkFailed ? (
				<iframe
					key={`${stream.id}-${muted ? "muted" : "live"}-${playbackToken}`}
					className="absolute inset-0 h-full w-full border-0 bg-slate-950"
					src={iframeSrc}
					title={`${stream.title} stream`}
					allowFullScreen
					allow="autoplay; fullscreen; picture-in-picture"
					loading="eager"
					onLoad={notifyReady}
				/>
			) : (
				<div id={playerId} className="absolute inset-0 h-full w-full" />
			)}
		</div>
	)
}

function YouTubeEmbed({
	stream,
	volume,
	cropToFill = false,
	muted = false,
	shouldAutoplay = true,
	playbackToken = 0,
	onReady,
	loadSessionKey,
}) {
	const iframeId = `youtube-player-${stream.id}`
	const playerRef = useRef(null)
	const readyRef = useRef(false)
	const readySignalSentRef = useRef(false)
	const skipInitialAudioSyncRef = useRef(true)
	const settingsRef = useRef({
		frameStyle: null,
		muted,
		playbackToken,
		shouldAutoplay,
		volume,
	})
	const { containerRef, frameStyle } = useEmbedViewport(cropToFill)
	const iframeSrc = getEmbedSrc(stream, {
		muted,
		autoplay: shouldAutoplay,
		apiEnabled: true,
	})
	settingsRef.current = {
		frameStyle,
		muted,
		playbackToken,
		shouldAutoplay,
		volume,
	}

	useEffect(() => {
		readySignalSentRef.current = false
		skipInitialAudioSyncRef.current = true
	}, [loadSessionKey, stream.channelName, stream.id])

	const notifyReady = useCallback(() => {
		if (readySignalSentRef.current) {
			return
		}

		readySignalSentRef.current = true
		onReady?.(stream.id, loadSessionKey)
	}, [loadSessionKey, onReady, stream.id])

	const syncIframeStyles = (player, nextFrameStyle) => {
		const iframe = player?.getIframe?.()
		if (!iframe) {
			return
		}

		Object.assign(iframe.style, nextFrameStyle)
	}

	useEffect(() => {
		let cancelled = false

		loadYouTubeSdk()
			.then((YT) => {
				if (cancelled) {
					return
				}

				playerRef.current = new YT.Player(iframeId, {
					events: {
						onReady: (event) => {
							const settings = settingsRef.current
							readyRef.current = true
							syncIframeStyles(event.target, settings.frameStyle)
							event.target.setVolume(settings.volume)
							notifyReady()

							if (settings.playbackToken > 0) {
								event.target.mute()
								event.target.playVideo?.()
								return
							}

							// Start YouTube streams silently on first load so they
							// do not immediately blare audio before the user chooses.
							event.target.mute()
							if (settings.shouldAutoplay) {
								event.target.playVideo?.()
							}
						},
					},
				})
			})
			.catch(() => {})

		return () => {
			cancelled = true
			readyRef.current = false
			if (typeof playerRef.current?.destroy === "function") {
				playerRef.current.destroy()
			}
			playerRef.current = null
		}
	}, [iframeId, iframeSrc, notifyReady, stream.id])

	useEffect(() => {
		const player = playerRef.current
		if (!player || !readyRef.current) {
			return
		}

		syncIframeStyles(player, frameStyle)
	}, [frameStyle])

	useEffect(() => {
		const player = playerRef.current
		if (!player || !readyRef.current) {
			return
		}

		player.setVolume(volume)
		if (
			skipInitialAudioSyncRef.current &&
			!muted &&
			volume > 0 &&
			playbackToken <= 0
		) {
			skipInitialAudioSyncRef.current = false
			if (shouldAutoplay) {
				player.playVideo?.()
			}
			return
		}

		skipInitialAudioSyncRef.current = false
		if (muted || volume === 0) {
			player.mute()
			if (shouldAutoplay) {
				player.playVideo?.()
			}
			return
		}

		player.unMute()
		if (shouldAutoplay) {
			player.playVideo?.()
		}
	}, [muted, playbackToken, shouldAutoplay, volume])

	useEffect(() => {
		const player = playerRef.current
		if (playbackToken <= 0 || !player || !readyRef.current) {
			return
		}

		// Entering cinema mode is an explicit muted playback request.
		player.mute()
		player.playVideo?.()
	}, [playbackToken])

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 overflow-hidden bg-slate-950"
		>
			<iframe
				id={iframeId}
				className="bg-slate-950"
				style={frameStyle}
				src={iframeSrc}
				title={`${stream.title} stream`}
				allowFullScreen
				allow="autoplay; fullscreen; picture-in-picture"
				loading="eager"
				onLoad={notifyReady}
			/>
		</div>
	)
}

function StreamPlayerComponent({
	stream,
	volume = 100,
	cropToFill = false,
	muted,
	shouldAutoplay,
	playbackToken = 0,
	onReady,
	loadSessionKey,
}) {
	if (stream.platform === "twitch") {
		return (
			<TwitchEmbed
				stream={stream}
				cropToFill={cropToFill}
				muted={muted ?? true}
				shouldAutoplay={shouldAutoplay ?? true}
				playbackToken={playbackToken}
				onReady={onReady}
				loadSessionKey={loadSessionKey}
			/>
		)
	}

	if (stream.platform === "youtube") {
		return (
			<YouTubeEmbed
				stream={stream}
				volume={volume}
				cropToFill={cropToFill}
				muted={muted ?? false}
				shouldAutoplay={shouldAutoplay ?? true}
				playbackToken={playbackToken}
				onReady={onReady}
				loadSessionKey={loadSessionKey}
			/>
		)
	}

	return null
}

const StreamPlayer = memo(
	StreamPlayerComponent,
	(previousProps, nextProps) =>
		previousProps.cropToFill === nextProps.cropToFill &&
		previousProps.volume === nextProps.volume &&
		previousProps.muted === nextProps.muted &&
		previousProps.shouldAutoplay === nextProps.shouldAutoplay &&
		previousProps.playbackToken === nextProps.playbackToken &&
		previousProps.onReady === nextProps.onReady &&
		previousProps.loadSessionKey === nextProps.loadSessionKey &&
		previousProps.stream.id === nextProps.stream.id &&
		previousProps.stream.platform === nextProps.stream.platform &&
		previousProps.stream.channelName === nextProps.stream.channelName &&
		previousProps.stream.title === nextProps.stream.title,
)

StreamPlayer.displayName = "StreamPlayer"

export default StreamPlayer
