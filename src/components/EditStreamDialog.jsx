import { useEffect, useRef, useState } from "react"

export default function EditStreamDialog({ stream, onClose, onSave }) {
	const [platform, setPlatform] = useState(stream.platform)
	const [channelName, setChannelName] = useState(stream.channelName)
	const [title, setTitle] = useState(stream.title)
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

		onSave(stream.id, {
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

	return (
		<div
			ref={backdropRef}
			onClick={handleBackdropClick}
			className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
		>
			<div className="w-[min(38rem,calc(100vw-2rem))] rounded-[1.4rem] border border-slate-400/20 bg-slate-900/95 text-slate-50 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
				<form onSubmit={handleSubmit} className="grid gap-5 p-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-violet-300">
								Edit Stream
							</p>
							<h2 className="mt-1 mb-1">Update {stream.title}</h2>
							<p className="m-0 text-sm text-slate-300/75">
								This saved channel entry updates in every project that uses it.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="rounded-2xl border-0 bg-white/8 px-5 py-3.5 font-bold text-white transition-all duration-300 cursor-pointer hover:-translate-y-px hover:bg-white/12"
						>
							Close
						</button>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<label className="grid gap-1.5 text-[0.95rem] text-slate-300/80">
							Platform
							<select
								value={platform}
								onChange={(event) => setPlatform(event.target.value)}
								required
								className="w-full rounded-[0.95rem] border border-slate-400/20 bg-slate-900/90 px-4 py-3.5 text-slate-50 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
							>
								<option value="twitch">Twitch</option>
								<option value="youtube">YouTube Live</option>
							</select>
						</label>

						<label className="grid gap-1.5 text-[0.95rem] text-slate-300/80">
							Stream title
							<input
								type="text"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								required
								autoComplete="off"
								className="w-full rounded-[0.95rem] border border-slate-400/20 bg-slate-900/90 px-4 py-3.5 text-slate-50 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
							/>
						</label>
					</div>

					<label className="grid gap-1.5 text-[0.95rem] text-slate-300/80">
						{channelLabel}
						<input
							type="text"
							value={channelName}
							onChange={(event) => setChannelName(event.target.value)}
							required
							autoComplete="off"
							placeholder={channelPlaceholder}
							className="w-full rounded-[0.95rem] border border-slate-400/20 bg-slate-900/90 px-4 py-3.5 text-slate-50 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
						/>
					</label>

					{platform === "youtube" && (
						<p className="-mt-2 mb-0 text-xs leading-5 text-slate-400">
							Channel IDs still work for playback. Live chat in this version
							needs a live YouTube watch/live URL or an 11-character video ID.
						</p>
					)}

					<div className="flex justify-end">
						<button
							type="submit"
							className="rounded-2xl border-0 bg-gradient-to-br from-fuchsia-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 cursor-pointer hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
						>
							Save Changes
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
