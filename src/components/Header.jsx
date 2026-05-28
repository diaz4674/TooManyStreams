import logoSrc from "../../assets/logo.png"
import { MAX_COLUMN_OPTIONS } from "../store"
import TwitchDiscovery from "./TwitchDiscovery"

export default function Header({
	projectCount,
	activeProjectName,
	streamCount,
	twitchStreamCount,
	twitchSession,
	savedTwitchStreams,
	activeStreamIds,
	chatOpen,
	layoutMode,
	maxColumns,
	onToggleChat,
	onSetLayoutMode,
	onSetMaxColumns,
	onOpenDialog,
	onOpenProjects,
	onAddExistingStream,
	onAddStream,
	onTwitchSessionChange,
	twitchConnectionMessage,
}) {
	const chatSummary =
		twitchStreamCount === 0
			? "No Twitch chats in this wall yet"
			: `${twitchStreamCount} ${twitchStreamCount === 1 ? "Twitch stream" : "Twitch streams"} ready for chat`

	return (
		<header className="mb-5 grid gap-4">
			<div className="flex items-start justify-between gap-4 max-md:flex-col">
				<div className="max-w-[54rem]">
					<img
						src={logoSrc}
						alt="TooManyStreams"
						className="h-auto w-[min(34rem,100%)] max-w-full drop-shadow-[0_14px_32px_rgba(8,15,35,0.28)]"
					/>
					<h1 className="mt-1 mb-1.5 max-w-[54rem] text-[clamp(2rem,4vw,3.15rem)] leading-[0.95] tracking-tight">
						Watch Multiple Twitch and YouTube Streams at Once
					</h1>
					<p className="m-0 max-w-3xl text-base text-slate-300/84">
						TooManyStreams is a free multi-stream viewer that lets you build
						your own stream wall, watch multiple Twitch and YouTube streams in
						one browser tab, switch the main audio, rearrange streams, and
						follow live events without the tab circus. See the{" "}
						<a
							href="https://www.youtube.com/watch?v=x1ilDPXPVVg"
							target="_blank"
							rel="noreferrer"
							className="font-semibold text-cyan-300 underline decoration-cyan-400/60 underline-offset-3 transition-colors hover:text-cyan-200"
						>
							inspiration and some of the features showcase on YouTube
						</a>
						.
					</p>
					<div className="mt-5 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={onOpenDialog}
							className="inline-flex items-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-fuchsia-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 cursor-pointer hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
						>
							<i className="fa-solid fa-play" />
							Start Watching
						</button>
					</div>
					<p className="mt-4 mb-0 text-base text-slate-300/76">
						{activeProjectName}
						{" | "}
						{streamCount} {streamCount === 1 ? "stream" : "streams"}
						{" | "}
						{chatSummary}
						{" | "}
						{layoutMode === "matrix"
							? "Matrix mode shows a clean video-only wall."
							: "Connected Twitch streams sort live first."}
					</p>
				</div>

				<div className="flex flex-wrap justify-end gap-3.5 max-md:w-full max-md:justify-stretch">
					<button
						type="button"
						onClick={onOpenProjects}
						className="inline-flex items-center gap-2 rounded-2xl border-0 bg-white/8 px-4 py-3.5 font-bold text-white transition-all duration-300 cursor-pointer hover:-translate-y-px hover:bg-white/12"
					>
						<i className="fa-solid fa-folder-tree text-cyan-300" />
						<span className="truncate max-w-44">{activeProjectName}</span>
						<span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.72rem] text-slate-300">
							{projectCount}
						</span>
					</button>

					<div className="flex rounded-2xl bg-white/8 p-1">
						<button
							type="button"
							onClick={() => onSetLayoutMode("auto")}
							className={`rounded-[1rem] border-0 px-4 py-3 text-sm font-bold transition-all duration-300 cursor-pointer ${
								layoutMode === "auto"
									? "bg-white/14 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
									: "bg-transparent text-slate-300/78 hover:bg-white/8 hover:text-white"
							}`}
						>
							<i className="fa-solid fa-grip mr-2 text-cyan-300" />
							Auto Wall
						</button>
						<button
							type="button"
							onClick={() => onSetLayoutMode("matrix")}
							className={`rounded-[1rem] border-0 px-4 py-3 text-sm font-bold transition-all duration-300 cursor-pointer ${
								layoutMode === "matrix"
									? "bg-cyan-400/18 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
									: "bg-transparent text-slate-300/78 hover:bg-white/8 hover:text-white"
							}`}
						>
							<i className="fa-solid fa-border-all mr-2 text-cyan-300" />
							Matrix Mode
						</button>
					</div>

					<button
						type="button"
						onClick={onToggleChat}
						disabled={twitchStreamCount === 0}
						className={`rounded-2xl border-0 px-5 py-3.5 font-bold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
							chatOpen
								? "bg-cyan-400/18 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
								: "bg-white/8"
						} hover:-translate-y-px hover:bg-white/12`}
					>
						<i
							className={`fa-solid ${chatOpen ? "fa-comments" : "fa-comment"} mr-2`}
						/>
						{chatOpen ? "Hide Chat" : "Show Chat"}
					</button>

					<button
						type="button"
						onClick={onOpenDialog}
						className="inline-flex items-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-fuchsia-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 cursor-pointer hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)] max-md:w-full max-md:justify-center disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-[0_18px_30px_rgba(124,58,237,0.28)]"
					>
						<i className="fa-solid fa-plus" />
						Add Stream
					</button>
				</div>
			</div>

			<TwitchDiscovery
				twitchSession={twitchSession}
				savedTwitchStreams={savedTwitchStreams}
				activeStreamIds={activeStreamIds}
				onAddExistingStream={onAddExistingStream}
				onAddStream={onAddStream}
				onSessionChange={onTwitchSessionChange}
				initialConnectionMessage={twitchConnectionMessage}
			/>

			<section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/16 bg-slate-950/42 px-4 py-3 shadow-[0_12px_36px_rgba(2,6,23,0.18)]">
				<div>
					<p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-300">
						Cards per row
					</p>
					<p className="mt-1 mb-0 text-xs text-slate-300/72">
						Choose the maximum; narrow windows automatically use fewer columns.
					</p>
				</div>
				<div
					className="inline-flex rounded-xl bg-white/8 p-1"
					role="group"
					aria-label="Cards per row"
				>
					{MAX_COLUMN_OPTIONS.map((columnCount) => (
						<button
							key={columnCount}
							type="button"
							onClick={() => onSetMaxColumns(columnCount)}
							aria-pressed={maxColumns === columnCount}
							className={`rounded-lg border-0 px-5 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
								maxColumns === columnCount
									? "bg-cyan-400/18 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
									: "bg-transparent text-slate-300/78 hover:bg-white/8 hover:text-white"
							}`}
						>
							{columnCount}
						</button>
					))}
				</div>
			</section>
		</header>
	)
}
