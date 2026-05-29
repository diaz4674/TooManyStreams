import { useEffect, useMemo, useRef, useState } from "react"
import { Virtuoso } from "react-virtuoso"

function matchesExistingStream(stream, searchValue, platform) {
	if (!searchValue) {
		return true
	}

	if (platform && stream.platform !== platform) {
		return false
	}

	const normalizedValue = searchValue.toLowerCase()
	return (
		stream.title.toLowerCase().includes(normalizedValue) ||
		stream.channelName.toLowerCase().includes(normalizedValue)
	)
}

export default function AddStreamDialog({
	projectName,
	existingStreams,
	onClose,
	onAddExistingStream,
	onAddStream,
	onLoadSamples,
}) {
	const [platform, setPlatform] = useState("twitch")
	const [channelName, setChannelName] = useState("")
	const [title, setTitle] = useState("")
	const backdropRef = useRef(null)

	useEffect(() => {
		const handleEsc = (event) => {
			if (event.key === "Escape") onClose()
		}
		document.addEventListener("keydown", handleEsc)
		return () => document.removeEventListener("keydown", handleEsc)
	}, [onClose])

	const handleSubmit = (event) => {
		event.preventDefault()
		const trimmedChannel = channelName.trim()
		const trimmedTitle = title.trim()
		if (!trimmedChannel || !trimmedTitle) return

		onAddStream({
			platform,
			channelName: trimmedChannel,
			title: trimmedTitle,
		})
		onClose()
	}

	const handleBackdropClick = (event) => {
		if (event.target === backdropRef.current) onClose()
	}

	const channelLabel =
		platform === "youtube" ? "Channel ID or video URL" : "Channel name"
	const channelPlaceholder =
		platform === "youtube"
			? "https://www.youtube.com/watch?v=... or UC..."
			: "pokimane"
	const searchValue = `${title} ${channelName}`.trim()
	const matchingExistingStreams = useMemo(
		() =>
			existingStreams.filter((stream) =>
				matchesExistingStream(stream, searchValue, platform),
			),
		[existingStreams, platform, searchValue],
	)

	return (
		<div
			ref={backdropRef}
			onClick={handleBackdropClick}
			className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 backdrop-blur-sm p-4"
		>
			<div className="w-[min(44rem,calc(100vw-2rem))] border border-slate-400/20 rounded-[1.4rem] bg-slate-900/95 text-slate-50 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
				<form onSubmit={handleSubmit} className="grid gap-5 p-5">
					<div className="flex justify-between items-start gap-4">
						<div>
							<p className="m-0 text-violet-300 text-sm font-bold tracking-[0.14em] uppercase">
								Add Stream
							</p>
							<h2 className="mt-1 mb-1">Add a stream to {projectName}</h2>
							<p className="m-0 text-sm text-slate-300/75">
								Reuse something from your library or create a new channel entry
								for this project.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="border-0 rounded-2xl px-5 py-3.5 font-bold text-white bg-white/8 hover:-translate-y-px hover:bg-white/12 transition-all duration-300 cursor-pointer"
						>
							Close
						</button>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<label className="grid gap-1.5 text-slate-300/80 text-[0.95rem]">
							Platform
							<select
								value={platform}
								onChange={(event) => setPlatform(event.target.value)}
								required
								className="w-full px-4 py-3.5 border border-slate-400/20 rounded-[0.95rem] text-slate-50 bg-slate-900/90 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
							>
								<option value="twitch">Twitch</option>
								<option value="youtube">YouTube Live</option>
							</select>
						</label>

						<label className="grid gap-1.5 text-slate-300/80 text-[0.95rem]">
							Stream title
							<input
								type="text"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								required
								autoComplete="off"
								placeholder="Pokimane"
								className="w-full px-4 py-3.5 border border-slate-400/20 rounded-[0.95rem] text-slate-50 bg-slate-900/90 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
							/>
						</label>
					</div>

					<label className="grid gap-1.5 text-slate-300/80 text-[0.95rem]">
						{channelLabel}
						<input
							type="text"
							value={channelName}
							onChange={(event) => setChannelName(event.target.value)}
							required
							autoComplete="off"
							placeholder={channelPlaceholder}
							className="w-full px-4 py-3.5 border border-slate-400/20 rounded-[0.95rem] text-slate-50 bg-slate-900/90 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
						/>
					</label>

					{platform === "youtube" && (
						<p className="-mt-2 mb-0 text-xs leading-5 text-slate-400">
							Channel IDs still work for playback. Live chat in this version
							needs a live YouTube watch/live URL or an 11-character video ID.
						</p>
					)}

					{existingStreams.length > 0 && (
						<section className="grid gap-3 rounded-[1.2rem] border border-cyan-400/16 bg-slate-950/45 p-4">
							<div>
								<p className="m-0 text-cyan-300 text-sm font-bold tracking-[0.14em] uppercase">
									Reuse Existing
								</p>
								<p className="mt-1 mb-0 text-sm text-slate-300/75">
									These channels are already saved in your library but not in
									this project yet.
								</p>
							</div>

							{matchingExistingStreams.length > 0 ? (
								<div className="h-[min(20rem,45vh)]">
									<Virtuoso
										data={matchingExistingStreams}
										itemContent={(_, stream) => (
											<div className="pb-2 last:pb-0">
												<button
													type="button"
													onClick={() => {
														onAddExistingStream(stream.id)
														onClose()
													}}
													className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left text-white transition-all duration-200 hover:-translate-y-px hover:bg-white/8 cursor-pointer"
												>
													<span className="min-w-0">
														<strong className="block truncate">
															{stream.title}
														</strong>
														<small className="block truncate text-slate-300/65">
															{stream.platform === "youtube"
																? "YouTube"
																: "Twitch"}{" "}
															| {stream.channelName}
														</small>
													</span>
													<span className="shrink-0 rounded-full bg-cyan-400/14 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-200">
														Add
													</span>
												</button>
											</div>
										)}
									/>
								</div>
							) : (
								<div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-300/70">
									No saved streams match the details you&apos;ve entered yet.
								</div>
							)}
						</section>
					)}
					<div className="flex justify-between gap-3 max-[760px]:flex-col">
						<button
							type="button"
							onClick={() => {
								onLoadSamples()
								onClose()
							}}
							className="border-0 rounded-2xl px-5 py-3.5 font-bold text-white bg-white/8 hover:-translate-y-px hover:bg-white/12 transition-all duration-300 cursor-pointer"
						>
							Add Sample Streams
						</button>
						<button
							type="submit"
							className="border-0 rounded-2xl px-5 py-3.5 font-bold text-white bg-gradient-to-br from-fuchsia-600 to-violet-600 shadow-[0_18px_30px_rgba(124,58,237,0.28)] hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)] transition-all duration-300 cursor-pointer"
						>
							Save to Project
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
