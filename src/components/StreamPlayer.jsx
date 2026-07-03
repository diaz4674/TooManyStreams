import {
	memo,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import { getEmbedSrc, getTwitchParent } from "../utils"
import { areCropsEqual, getCropFrameLayout, isFullCrop } from "../streamViews"

let twitchSdkPromise
let youtubeSdkPromise
const EMBED_ASPECT_RATIO = 16 / 9
const TWITCH_MIN_AUTOPLAY_WIDTH_PX = 400
const TWITCH_MIN_AUTOPLAY_HEIGHT_PX = 300
const TWITCH_PLAYBACK_RECOVERY_WINDOW_MS = 12000
const TWITCH_PLAYBACK_RETRY_DELAY_MS = 250
const TWITCH_TAB_RESUME_RETRY_DELAYS_MS = [0, 320, 900, 1700]
const YOUTUBE_READY_TIMEOUT_MS = 7000
const YOUTUBE_RECOVERY_RETRY_DELAYS_MS = [0, 320, 900, 1700]
const YOUTUBE_REBUILD_FALLBACK_DELAY_MS = 2800

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
			top: "0",
			right: "0",
			bottom: "0",
			left: "0",
			width: "100%",
			height: "100%",
			border: "0",
			display: "block",
			transform: "none",
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

// Renders children (the embed) on an oversized virtual 16:9 frame clipped so
// only the crop rect is visible — an OBS-style crop that never reloads the
// player when the rect changes.
function CropViewport({ crop, children }) {
	const containerRef = useRef(null)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

	useEffect(() => {
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
	}, [])

	const layout = useMemo(
		() =>
			getCropFrameLayout({
				containerWidth: containerSize.width,
				containerHeight: containerSize.height,
				crop,
			}),
		[containerSize.height, containerSize.width, crop],
	)

	return (
		<div ref={containerRef} className="absolute inset-0 bg-slate-950">
			{layout && (
				<div
					className="absolute overflow-hidden"
					style={{
						left: `${layout.content.left}px`,
						top: `${layout.content.top}px`,
						width: `${layout.content.width}px`,
						height: `${layout.content.height}px`,
					}}
				>
					<div
						className="absolute"
						style={{
							left: `${layout.frame.left}px`,
							top: `${layout.frame.top}px`,
							width: `${layout.frame.width}px`,
							height: `${layout.frame.height}px`,
						}}
					>
						{children}
					</div>
				</div>
			)}
		</div>
	)
}

function TwitchEmbed({
	stream,
	volume = 100,
	muted = false,
	shouldAutoplay = true,
	showControls = false,
	playbackToken = 0,
	onReady,
	loadSessionKey,
}) {
	// Twitch's `controls` flag is construction-only (there is no setControls),
	// so toggling it means rebuilding the player. Encoding it in the DOM id
	// forces that rebuild when the tile enters/leaves cinema mode.
	const controlsKey = showControls ? "controls" : "chromeless"
	// Unique per mounted instance: the same stream can play in the grid and the
	// crop editor at once, and duplicate DOM ids would make the SDK grab (and
	// later destroy) the wrong container.
	const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
	const playerId = `twitch-player-${stream.id}-${instanceId}-${controlsKey}`
	const containerRef = useRef(null)
	const playerRef = useRef(null)
	const readyRef = useRef(false)
	const mutedRef = useRef(muted)
	const volumeRef = useRef(volume)
	// Twitch renders chromeless (controls: false), so the app volume slider is
	// the only audio affordance. Autoplay stays muted until the user touches it.
	const userVolumeIntentRef = useRef(false)
	const lastVolumeRef = useRef(volume)
	const playbackTokenRef = useRef(playbackToken)
	const pendingPlaybackRef = useRef({
		token: 0,
		deadline: 0,
	})
	const resumePlaybackTokenRef = useRef(0)
	const resumeAttemptIdRef = useRef(0)
	const resumeRetryTimeoutsRef = useRef([])
	const retryTimeoutRef = useRef(null)
	const [sdkFailed, setSdkFailed] = useState(false)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const containerSizeRef = useRef(containerSize)
	const readySignalSentRef = useRef(false)
	mutedRef.current = muted
	volumeRef.current = volume
	playbackTokenRef.current = playbackToken
	containerSizeRef.current = containerSize
	// The fallback iframe has no SDK bridge, so it always starts muted to keep
	// autoplay working.
	const iframeSrc = getEmbedSrc(stream, {
		muted: true,
		autoplay: shouldAutoplay,
	})

	useEffect(() => {
		readySignalSentRef.current = false
		userVolumeIntentRef.current = false
		lastVolumeRef.current = volumeRef.current
	}, [loadSessionKey, stream.channelName, stream.id])

	useEffect(() => {
		if (volume !== lastVolumeRef.current) {
			userVolumeIntentRef.current = true
			lastVolumeRef.current = volume
		}
	}, [volume])

	const applyAudioSettings = useCallback(() => {
		const player = playerRef.current
		if (!player || !readyRef.current) {
			return
		}

		const nextVolume = volumeRef.current
		player.setVolume?.(Math.min(Math.max(nextVolume / 100, 0), 1))
		player.setMuted(
			Boolean(mutedRef.current) ||
				nextVolume === 0 ||
				!userVolumeIntentRef.current,
		)
	}, [])

	const notifyReady = useCallback(() => {
		if (readySignalSentRef.current) {
			return
		}

		readySignalSentRef.current = true
		onReady?.(stream.id, loadSessionKey)
	}, [loadSessionKey, onReady, stream.id])

	const syncPlayerFrame = useCallback(() => {
		const iframe = containerRef.current?.querySelector("iframe")
		if (!iframe) {
			return
		}

		const nextSize = containerSizeRef.current
		iframe.width = String(
			Math.max(TWITCH_MIN_AUTOPLAY_WIDTH_PX, Math.round(nextSize.width || 0)),
		)
		iframe.height = String(
			Math.max(
				TWITCH_MIN_AUTOPLAY_HEIGHT_PX,
				Math.round(nextSize.height || 0),
			),
		)
		iframe.style.display = "block"
		iframe.style.width = "100%"
		iframe.style.height = "100%"
		iframe.style.border = "0"
	}, [])

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

				// Already playing: stop nudging. Every play() call re-shows the
				// Twitch title overlay and resets its fade-out timer.
				if (typeof player.isPaused === "function" && !player.isPaused()) {
					clearPendingPlaybackRequest()
					return
				}

				player.setMuted(true)
				player.play()

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

			const player = playerRef.current
			if (
				readyRef.current &&
				player &&
				typeof player.isPaused === "function" &&
				!player.isPaused()
			) {
				// Playback is already running; re-requesting it only flashes the
				// Twitch title overlay.
				clearPendingPlaybackRequest()
				return
			}

			pendingPlaybackRef.current = {
				token,
				deadline: Date.now() + TWITCH_PLAYBACK_RECOVERY_WINDOW_MS,
			}

			if (readyRef.current && player) {
				player.setMuted(true)
				player.play()
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
				player = new Twitch.Player(playerId, {
					autoplay: shouldAutoplay,
					channel: stream.channelName,
					// Chromeless in the grid so the channel info overlay never
					// pins on load; native controls only in cinema mode, where the
					// user wants pause/quality/clip/fullscreen.
					controls: showControls,
					height: Math.max(
						TWITCH_MIN_AUTOPLAY_HEIGHT_PX,
						Math.round(containerSize.height || 0),
					),
					// Always construct muted so autoplay is never blocked; the real
					// audio state is applied on READY.
					muted: true,
					parent: [getTwitchParent()],
					width: Math.max(
						TWITCH_MIN_AUTOPLAY_WIDTH_PX,
						Math.round(containerSize.width || 0),
					),
				})
				playerRef.current = player
				handleReady = () => {
					if (cancelled) {
						return
					}

					readyRef.current = true
					applyAudioSettings()
					syncPlayerFrame()
					notifyReady()

					if (playbackTokenRef.current > 0) {
						startPendingPlaybackRequest(playbackTokenRef.current)
					}
				}
				handlePlaying = () => {
					clearPendingPlaybackRequest()
					// Playback nudges force-mute; restore the user's chosen audio
					// once the stream is actually playing. Skip when native
					// controls are shown so we don't override the user's own
					// volume/mute clicks on the Twitch UI.
					if (!showControls) {
						applyAudioSettings()
					}
				}
				handlePause = () => {
					const pendingToken = pendingPlaybackRef.current.token
					if (pendingToken > 0 && Date.now() < pendingPlaybackRef.current.deadline) {
						startPendingPlaybackRequest(pendingToken)
						return
					}

					if (playbackTokenRef.current <= 0) {
						clearPendingPlaybackRequest()
						return
					}

					startPendingPlaybackRequest(playbackTokenRef.current)
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
		applyAudioSettings,
		clearPendingPlaybackRequest,
		clearResumeRetryRequests,
		notifyReady,
		playerId,
		shouldAutoplay,
		showControls,
		startPendingPlaybackRequest,
		stream.channelName,
		syncPlayerFrame,
	])

	useEffect(() => {
		applyAudioSettings()
	}, [applyAudioSettings, muted, volume])

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
		if (!readyRef.current) {
			return
		}

		syncPlayerFrame()
	}, [containerSize.height, containerSize.width, syncPlayerFrame])

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
	const [playerBuildKey, setPlayerBuildKey] = useState(0)
	const [sdkFailed, setSdkFailed] = useState(false)
	const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
	const iframeId = `youtube-player-${stream.id}-${instanceId}-${playerBuildKey}`
	const mountRef = useRef(null)
	const playerRef = useRef(null)
	const readyRef = useRef(false)
	const readySignalSentRef = useRef(false)
	const readyTimeoutRef = useRef(null)
	const recoveryTimeoutsRef = useRef([])
	const recoveryRebuildTimeoutRef = useRef(null)
	const recoveryAttemptIdRef = useRef(0)
	const userVolumeIntentRef = useRef(false)
	const lastVolumeRef = useRef(volume)
	const lastPlaybackTokenRef = useRef(playbackToken)
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
		setSdkFailed(false)
		setPlayerBuildKey(0)
		userVolumeIntentRef.current = false
		lastVolumeRef.current = volume
		lastPlaybackTokenRef.current = playbackToken
	}, [loadSessionKey, stream.channelName, stream.id])

	useEffect(() => {
		if (volume !== lastVolumeRef.current) {
			userVolumeIntentRef.current = true
			lastVolumeRef.current = volume
			return
		}

		lastVolumeRef.current = volume
	}, [volume])

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

		iframe.style.inset = ""
		iframe.style.top = ""
		iframe.style.right = ""
		iframe.style.bottom = ""
		iframe.style.left = ""
		iframe.style.width = ""
		iframe.style.height = ""
		iframe.style.transform = ""

		Object.assign(iframe.style, nextFrameStyle)
	}

	const clearReadyTimeout = useCallback(() => {
		window.clearTimeout(readyTimeoutRef.current)
		readyTimeoutRef.current = null
	}, [])

	const clearRecoveryTimeouts = useCallback(() => {
		for (const timeoutId of recoveryTimeoutsRef.current) {
			window.clearTimeout(timeoutId)
		}
		recoveryTimeoutsRef.current = []
		window.clearTimeout(recoveryRebuildTimeoutRef.current)
		recoveryRebuildTimeoutRef.current = null
	}, [])

	const requestPlayerRebuild = useCallback(() => {
		clearReadyTimeout()
		clearRecoveryTimeouts()
		readyRef.current = false
		setPlayerBuildKey((key) => key + 1)
	}, [clearReadyTimeout, clearRecoveryTimeouts])

	const applyPlayerSettings = useCallback((player, options = {}) => {
		if (!player) {
			return
		}

		const settings = settingsRef.current
		player.setVolume?.(settings.volume)

		if (
			options.forceMuted ||
			settings.muted ||
			settings.volume === 0 ||
			(!userVolumeIntentRef.current && settings.shouldAutoplay)
		) {
			player.mute?.()
		} else {
			player.unMute?.()
		}

		if (settings.shouldAutoplay || options.forceMuted) {
			player.playVideo?.()
		}
	}, [])

	const schedulePlaybackRecovery = useCallback(
		(options = {}) => {
			if (document.visibilityState !== "visible") {
				return
			}

			recoveryAttemptIdRef.current += 1
			const attemptId = recoveryAttemptIdRef.current
			clearRecoveryTimeouts()

			recoveryTimeoutsRef.current = YOUTUBE_RECOVERY_RETRY_DELAYS_MS.map(
				(delayMs) =>
					window.setTimeout(() => {
						if (
							attemptId !== recoveryAttemptIdRef.current ||
							!readyRef.current ||
							!playerRef.current ||
							document.visibilityState !== "visible"
						) {
							return
						}

						// Skip redundant play requests once playback is running so the
						// YouTube overlay can fade out instead of flashing.
						if (
							playerRef.current.getPlayerState?.() ===
							window.YT?.PlayerState?.PLAYING
						) {
							return
						}

						applyPlayerSettings(playerRef.current, options)
					}, delayMs),
			)

			recoveryRebuildTimeoutRef.current = window.setTimeout(() => {
				if (
					attemptId !== recoveryAttemptIdRef.current ||
					!readyRef.current ||
					!playerRef.current ||
					document.visibilityState !== "visible"
				) {
					return
				}

				const playerState = playerRef.current.getPlayerState?.()
				const stableStates = [
					window.YT?.PlayerState?.PLAYING,
					window.YT?.PlayerState?.BUFFERING,
					window.YT?.PlayerState?.CUED,
				]

				if (stableStates.includes(playerState)) {
					return
				}

				requestPlayerRebuild()
			}, YOUTUBE_REBUILD_FALLBACK_DELAY_MS)
		},
		[applyPlayerSettings, clearRecoveryTimeouts, requestPlayerRebuild],
	)

	useEffect(() => {
		let cancelled = false
		let player = null
		const mountNode = mountRef.current

		readyRef.current = false
		setSdkFailed(false)
		clearReadyTimeout()
		clearRecoveryTimeouts()
		if (!mountNode) {
			return undefined
		}
		mountNode.replaceChildren()
		readyTimeoutRef.current = window.setTimeout(() => {
			if (!readyRef.current && !cancelled) {
				requestPlayerRebuild()
			}
		}, YOUTUBE_READY_TIMEOUT_MS)

		loadYouTubeSdk()
			.then((YT) => {
				if (cancelled) {
					return
				}

				const iframe = document.createElement("iframe")
				iframe.id = iframeId
				iframe.src = iframeSrc
				iframe.title = `${stream.title} stream`
				iframe.allowFullscreen = true
				iframe.allow = "autoplay; fullscreen; picture-in-picture"
				iframe.loading = "eager"
				iframe.className = "bg-slate-950"
				Object.assign(iframe.style, frameStyle)
				mountNode.replaceChildren(iframe)

				player = new YT.Player(iframe, {
					events: {
						onReady: (event) => {
							const settings = settingsRef.current
							clearReadyTimeout()
							readyRef.current = true
							playerRef.current = event.target
							syncIframeStyles(event.target, settings.frameStyle)
							notifyReady()
							applyPlayerSettings(event.target)

							if (settings.shouldAutoplay || settings.playbackToken > 0) {
								schedulePlaybackRecovery({
									forceMuted: settings.playbackToken > 0,
								})
							}
						},
						onError: () => {
							if (!cancelled) {
								requestPlayerRebuild()
							}
						},
					},
				})
				playerRef.current = player
			})
			.catch(() => {
				if (!cancelled) {
					clearReadyTimeout()
					clearRecoveryTimeouts()
					setSdkFailed(true)
				}
			})

		return () => {
			cancelled = true
			readyRef.current = false
			clearReadyTimeout()
			clearRecoveryTimeouts()
			if (typeof player?.destroy === "function") {
				player.destroy()
			}
			mountNode.replaceChildren()
			playerRef.current = null
		}
	}, [
		applyPlayerSettings,
		clearReadyTimeout,
		clearRecoveryTimeouts,
		iframeId,
		notifyReady,
		requestPlayerRebuild,
		schedulePlaybackRecovery,
		stream.id,
	])

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

		applyPlayerSettings(player)
		if (shouldAutoplay) {
			schedulePlaybackRecovery()
			return
		}

		clearRecoveryTimeouts()
	}, [
		applyPlayerSettings,
		clearRecoveryTimeouts,
		muted,
		playbackToken,
		schedulePlaybackRecovery,
		shouldAutoplay,
		volume,
	])

	useEffect(() => {
		const player = playerRef.current
		const previousPlaybackToken = lastPlaybackTokenRef.current
		lastPlaybackTokenRef.current = playbackToken
		if (
			playbackToken <= 0 ||
			playbackToken === previousPlaybackToken ||
			!player ||
			!readyRef.current
		) {
			return
		}

		schedulePlaybackRecovery({ forceMuted: true })
	}, [playbackToken, schedulePlaybackRecovery])

	useEffect(() => {
		if (!shouldAutoplay) {
			clearRecoveryTimeouts()
			return undefined
		}

		const handleTabResume = () => {
			if (!readyRef.current || !playerRef.current) {
				return
			}

			schedulePlaybackRecovery({
				forceMuted: settingsRef.current.playbackToken > 0,
			})
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				handleTabResume()
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("focus", handleTabResume)
		window.addEventListener("pageshow", handleTabResume)

		return () => {
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			)
			window.removeEventListener("focus", handleTabResume)
			window.removeEventListener("pageshow", handleTabResume)
		}
	}, [clearRecoveryTimeouts, schedulePlaybackRecovery, shouldAutoplay])

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 overflow-hidden bg-slate-950"
		>
			{sdkFailed ? (
				<iframe
					key={`${iframeId}-fallback`}
					className="bg-slate-950"
					style={frameStyle}
					src={iframeSrc}
					title={`${stream.title} stream`}
					allowFullScreen
					allow="autoplay; fullscreen; picture-in-picture"
					loading="eager"
					onLoad={notifyReady}
				/>
			) : (
				<div
					key={iframeId}
					ref={mountRef}
					className="absolute inset-0 bg-slate-950"
				/>
			)}
		</div>
	)
}

function StreamPlayerComponent({
	stream,
	volume = 100,
	cropToFill = false,
	crop = null,
	muted,
	shouldAutoplay,
	showTwitchControls = false,
	playbackToken = 0,
	onReady,
	loadSessionKey,
}) {
	const activeCrop = crop && !isFullCrop(crop) ? crop : null
	let embed = null

	if (stream.platform === "twitch") {
		embed = (
			<TwitchEmbed
				stream={stream}
				volume={volume}
				cropToFill={activeCrop ? false : cropToFill}
				muted={muted ?? false}
				shouldAutoplay={shouldAutoplay ?? true}
				showControls={showTwitchControls}
				playbackToken={playbackToken}
				onReady={onReady}
				loadSessionKey={loadSessionKey}
			/>
		)
	}

	if (stream.platform === "youtube") {
		embed = (
			<YouTubeEmbed
				stream={stream}
				volume={volume}
				cropToFill={activeCrop ? false : cropToFill}
				muted={muted ?? false}
				shouldAutoplay={shouldAutoplay ?? true}
				playbackToken={playbackToken}
				onReady={onReady}
				loadSessionKey={loadSessionKey}
			/>
		)
	}

	if (!embed) {
		return null
	}

	return activeCrop ? <CropViewport crop={activeCrop}>{embed}</CropViewport> : embed
}

const StreamPlayer = memo(
	StreamPlayerComponent,
	(previousProps, nextProps) =>
		previousProps.cropToFill === nextProps.cropToFill &&
		areCropsEqual(previousProps.crop ?? null, nextProps.crop ?? null) &&
		previousProps.volume === nextProps.volume &&
		previousProps.muted === nextProps.muted &&
		previousProps.shouldAutoplay === nextProps.shouldAutoplay &&
		previousProps.showTwitchControls === nextProps.showTwitchControls &&
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
