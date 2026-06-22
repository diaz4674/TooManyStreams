import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	TwitchAuthorizationError,
	beginTwitchAuthorization,
	clearStoredTwitchSession,
	getTwitchClientId,
	searchTwitchChannels,
	validateTwitchSession,
} from "../twitchApi"

const SEARCH_DEBOUNCE_MS = 300
const TOKEN_VALIDATION_INTERVAL_MS = 60 * 60 * 1000

function getStreamKey(channelName) {
	return channelName.trim().toLowerCase()
}

function getTwitchChannelUrl(channelName) {
	return `https://www.twitch.tv/${encodeURIComponent(channelName)}`
}

function matchesSavedStream(stream, query) {
	const normalizedQuery = query.toLowerCase()
	return (
		stream.channelName.toLowerCase().includes(normalizedQuery) ||
		stream.title.toLowerCase().includes(normalizedQuery)
	)
}

export default function TwitchDiscovery({
	twitchSession,
	savedTwitchStreams,
	activeStreamIds,
	onAddExistingStream,
	onAddStream,
	onPreviewResult,
	onSessionChange,
	initialConnectionMessage = "",
}) {
	const configured = Boolean(getTwitchClientId())
	const [connectionState, setConnectionState] = useState(() =>
		twitchSession?.accessToken ? "checking" : "disconnected",
	)
	const [connectedName, setConnectedName] = useState("")
	const [connectionMessage, setConnectionMessage] = useState(
		initialConnectionMessage,
	)
	const [query, setQuery] = useState("")
	const [remoteResults, setRemoteResults] = useState([])
	const [loading, setLoading] = useState(false)
	const [searchMessage, setSearchMessage] = useState("")
	const [hasCompletedSearch, setHasCompletedSearch] = useState(false)
	const [open, setOpen] = useState(false)
	const containerRef = useRef(null)
	const requestSequenceRef = useRef(0)
	const token = twitchSession?.accessToken ?? ""

	const disconnect = useCallback((message = "") => {
		clearStoredTwitchSession()
		setConnectionState("disconnected")
		setConnectedName("")
		setConnectionMessage(message)
		setRemoteResults([])
		setLoading(false)
		setHasCompletedSearch(false)
		onSessionChange?.(null)
	}, [onSessionChange])

	useEffect(() => {
		if (!token) {
			setConnectionState("disconnected")
			setConnectedName("")
			return undefined
		}

		let disposed = false
		let currentController
		const validateConnection = async () => {
			currentController?.abort()
			currentController = new AbortController()

			try {
				const validation = await validateTwitchSession(
					twitchSession,
					currentController.signal,
				)
				if (!disposed) {
					setConnectionState("connected")
					setConnectedName(validation?.login ?? "")
					setConnectionMessage("")
					onSessionChange?.(validation)
				}
			} catch (error) {
				if (disposed || error.name === "AbortError") {
					return
				}

				if (error instanceof TwitchAuthorizationError) {
					disconnect(error.message)
					return
				}

				setConnectionState("connected")
				setConnectionMessage(error.message)
			}
		}

		void validateConnection()
		const intervalId = window.setInterval(
			validateConnection,
			TOKEN_VALIDATION_INTERVAL_MS,
		)

		return () => {
			disposed = true
			currentController?.abort()
			window.clearInterval(intervalId)
		}
	}, [disconnect, onSessionChange, token, twitchSession])

	useEffect(() => {
		setConnectionMessage(initialConnectionMessage)
	}, [initialConnectionMessage])

	useEffect(() => {
		const handlePointerDown = (event) => {
			if (!containerRef.current?.contains(event.target)) {
				setOpen(false)
			}
		}

		document.addEventListener("pointerdown", handlePointerDown)
		return () => document.removeEventListener("pointerdown", handlePointerDown)
	}, [])

	const activeStreamIdSet = useMemo(
		() => new Set(activeStreamIds),
		[activeStreamIds],
	)
	const trimmedQuery = query.trim()
	const localResults = useMemo(() => {
		if (trimmedQuery.length < 2) {
			return []
		}

		return savedTwitchStreams
			.filter((stream) => matchesSavedStream(stream, trimmedQuery))
			.map((stream) => ({
				channelName: getStreamKey(stream.channelName),
				title: stream.title,
				stream,
				thumbnailUrl: "",
				isLive: null,
			}))
	}, [savedTwitchStreams, trimmedQuery])

	useEffect(() => {
		if (
			trimmedQuery.length < 2 ||
			connectionState !== "connected" ||
			!twitchSession?.accessToken ||
			!configured
		) {
			setRemoteResults([])
			setLoading(false)
			setSearchMessage("")
			setHasCompletedSearch(false)
			return undefined
		}

		const requestSequence = requestSequenceRef.current + 1
		requestSequenceRef.current = requestSequence
		const controller = new AbortController()
		const timeoutId = window.setTimeout(async () => {
			setLoading(true)
			setSearchMessage("")
			setHasCompletedSearch(false)

			try {
				const results = await searchTwitchChannels(
					trimmedQuery,
					twitchSession,
					controller.signal,
				)
				if (requestSequence === requestSequenceRef.current) {
					setRemoteResults(results)
					setHasCompletedSearch(true)
				}
			} catch (error) {
				if (
					error.name === "AbortError" ||
					requestSequence !== requestSequenceRef.current
				) {
					return
				}

				setRemoteResults([])
				setHasCompletedSearch(true)
				if (error instanceof TwitchAuthorizationError) {
					disconnect("Your Twitch connection expired. Please reconnect.")
					return
				}

				setSearchMessage(error.message)
			} finally {
				if (requestSequence === requestSequenceRef.current) {
					setLoading(false)
				}
			}
		}, SEARCH_DEBOUNCE_MS)

		return () => {
			window.clearTimeout(timeoutId)
			controller.abort()
		}
	}, [configured, connectionState, disconnect, trimmedQuery, twitchSession])

	const mergedResults = useMemo(() => {
		const merged = new Map(
			localResults.map((result) => [result.channelName, result]),
		)

		for (const result of remoteResults) {
			const existing = merged.get(result.channelName)
			merged.set(
				result.channelName,
				existing ? { ...result, stream: existing.stream } : result,
			)
		}

		return [...merged.values()]
	}, [localResults, remoteResults])

	const handleAdd = (result) => {
		if (result.stream) {
			onAddExistingStream(result.stream.id)
		} else {
			onAddStream({
				platform: "twitch",
				channelName: result.channelName,
				title: result.title,
			})
		}

		setOpen(false)
	}

	const handlePreview = (result) => {
		if (!result.isLive) {
			return
		}

		onPreviewResult?.(result)
		setOpen(false)
	}

	const hasQuery = trimmedQuery.length >= 2
	const isConnected = connectionState === "connected"

	return (
		<section
			ref={containerRef}
			className="relative rounded-2xl border border-violet-400/16 bg-slate-950/48 p-3 shadow-[0_12px_36px_rgba(2,6,23,0.22)]"
		>
			<div className="flex flex-wrap items-center gap-3">
				<div className="shrink-0 px-1">
					<p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-violet-300">
						Discover Twitch
					</p>
					<p className="mt-0.5 mb-0 text-xs text-slate-300/72">
						{isConnected
							? `Connected${connectedName ? ` as ${connectedName}` : ""}`
							: "Connect to find live or offline channels"}
					</p>
				</div>

				{isConnected && (
					<div className="relative min-w-[16rem] flex-1">
						<i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-slate-400" />
						<input
							type="search"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value)
								setOpen(true)
							}}
							onFocus={() => setOpen(true)}
							autoComplete="off"
							placeholder="Search Twitch channels"
							aria-label="Search Twitch channels"
							className="w-full rounded-xl border border-white/10 bg-slate-900/86 py-3 pr-4 pl-10 text-sm text-white focus:outline-2 focus:outline-violet-400/75 focus:outline-offset-2"
						/>
					</div>
				)}

				<div className="ml-auto flex items-center gap-2">
					{!isConnected ? (
						<button
							type="button"
							onClick={beginTwitchAuthorization}
							disabled={!configured || connectionState === "checking"}
							className="rounded-xl border-0 bg-violet-500/24 px-4 py-3 text-sm font-bold text-violet-50 transition-colors cursor-pointer hover:bg-violet-500/34 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<i className="fa-brands fa-twitch mr-2" />
							{connectionState === "checking" ? "Connecting..." : "Connect Twitch"}
						</button>
					) : (
						<button
							type="button"
							onClick={() => disconnect()}
							className="rounded-xl border-0 bg-white/8 px-4 py-3 text-sm font-bold text-slate-100 transition-colors cursor-pointer hover:bg-white/12"
						>
							Disconnect
						</button>
					)}
				</div>
			</div>

			{!configured && (
				<p className="mt-3 mb-0 rounded-xl border border-amber-300/16 bg-amber-300/8 px-3 py-2 text-xs text-amber-100/86">
					Set `VITE_TWITCH_CLIENT_ID` to enable Twitch discovery locally.
				</p>
			)}
			{connectionMessage && (
				<p className="mt-3 mb-0 rounded-xl border border-amber-300/16 bg-amber-300/8 px-3 py-2 text-xs text-amber-100/86">
					{connectionMessage}
				</p>
			)}

			{isConnected && open && hasQuery && (
				<div className="absolute inset-x-3 top-[calc(100%-0.2rem)] z-40 mt-2 overflow-hidden rounded-2xl border border-slate-400/18 bg-slate-950/98 shadow-[0_28px_60px_rgba(0,0,0,0.5)]">
					<div className="flex items-center justify-between border-b border-white/8 px-4 py-3 text-xs text-slate-300/72">
						<span>Twitch channel results</span>
						{loading && <span>Searching...</span>}
					</div>

					{mergedResults.length > 0 ? (
						<div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
							{mergedResults.map((result) => {
								const alreadyAdded =
									result.stream && activeStreamIdSet.has(result.stream.id)

								return (
									<div
										key={result.channelName}
										className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/6"
									>
										{result.thumbnailUrl ? (
											<img
												src={result.thumbnailUrl}
												alt=""
												className="h-10 w-10 shrink-0 rounded-full object-cover"
											/>
										) : (
											<div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-500/16 text-violet-300">
												<i className="fa-brands fa-twitch" />
											</div>
										)}
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<a
													href={getTwitchChannelUrl(result.channelName)}
													target="_blank"
													rel="noreferrer"
													className="truncate text-sm font-bold text-white decoration-violet-300/80 underline-offset-4 transition-colors hover:text-violet-200 hover:underline"
													title={`Open ${result.title} on Twitch in a new tab`}
												>
													{result.title}
												</a>
												{result.isLive !== null && (
													<span
														className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${
															result.isLive
																? "bg-rose-500/18 text-rose-200"
																: "bg-slate-400/14 text-slate-300"
														}`}
													>
														{result.isLive ? "Live" : "Offline"}
													</span>
												)}
												<button
													type="button"
													disabled={!result.isLive}
													onClick={() => handlePreview(result)}
													title={
														result.isLive
															? `Preview ${result.title} in cinema mode`
															: "Preview available for live channels only"
													}
													className={`shrink-0 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider transition-colors ${
														result.isLive
															? "bg-cyan-400/14 text-cyan-100 cursor-pointer hover:bg-cyan-400/22"
															: "bg-white/6 text-slate-400 cursor-not-allowed"
													}`}
												>
													Preview
												</button>
											</div>
											<a
												href={getTwitchChannelUrl(result.channelName)}
												target="_blank"
												rel="noreferrer"
												className="inline-flex items-center gap-1 text-slate-300/68 transition-colors hover:text-violet-200"
												title={`Open @${result.channelName} on Twitch in a new tab`}
											>
												<small>@{result.channelName}</small>
												<i className="fa-solid fa-arrow-up-right-from-square text-[0.65rem] opacity-0 transition-opacity group-hover:opacity-70" />
											</a>
										</div>
										<button
											type="button"
											disabled={alreadyAdded}
											onClick={() => handleAdd(result)}
											className="shrink-0 rounded-full border-0 bg-violet-500/18 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-violet-100 transition-colors cursor-pointer hover:bg-violet-500/28 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-slate-400"
										>
											{alreadyAdded ? "Added" : "Add"}
										</button>
									</div>
								)
							})}
						</div>
					) : searchMessage ? (
						<p className="m-3 rounded-xl border border-rose-400/16 bg-rose-400/8 px-3 py-3 text-sm text-rose-100/90">
							{searchMessage}
						</p>
					) : hasCompletedSearch && !loading ? (
						<p className="m-3 rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-slate-300/72">
							No matching Twitch channel was found.
						</p>
					) : (
						<p className="m-3 px-3 py-3 text-sm text-slate-300/72">
							Looking for channels...
						</p>
					)}
				</div>
			)}
		</section>
	)
}
