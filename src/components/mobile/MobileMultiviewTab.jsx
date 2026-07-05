import { useState } from "react"
import MobileStreamTile from "./MobileStreamTile"

function PlatformLogo({ platform }) {
	if (platform === "twitch") {
		return <i className="fa-brands fa-twitch text-violet-400" />
	}

	if (platform === "youtube") {
		return <i className="fa-brands fa-youtube text-red-400" />
	}

	return <i className="fa-solid fa-play text-slate-400" />
}

/**
 * "Multiview" tab: the focus companions stacked below the pinned main player.
 * Adds/removes/promotes go through the wall store, which persists the
 * arrangement per main stream (multiwatch.wall.focus) — so companions survive
 * reloads automatically.
 *
 * The add sheet is absolutely positioned INSIDE the tab panel (not fixed over
 * the page) so it never covers the main player's Twitch iframe — overlap
 * would make Twitch pause playback (occlusion tracker).
 */
export default function MobileMultiviewTab({
	companionStreams,
	availableStreams,
	canAddCompanion,
	streamVolumes,
	companionPlaybackToken,
	onAddCompanion,
	onRemoveCompanion,
	onPromoteCompanion,
	onVolumeChange,
	onPlayerReady,
	loadSessionKey,
}) {
	const [sheetOpen, setSheetOpen] = useState(false)

	const handleAdd = (streamId) => {
		onAddCompanion(streamId)
		setSheetOpen(false)
	}

	return (
		<div className="relative min-h-full">
			<div className="flex flex-col gap-3 p-3 pb-24">
				{companionStreams.length === 0 && (
					<p className="m-0 px-4 py-6 text-center text-sm text-slate-300/72">
						Add companion streams to watch alongside your main stream. They
						are saved with it, so they come back after a reload.
					</p>
				)}

				{companionStreams.map((stream) => (
					<MobileStreamTile
						key={stream.id}
						stream={stream}
						playbackToken={companionPlaybackToken}
						volume={streamVolumes[stream.id] ?? 100}
						onVolumeChange={onVolumeChange}
						actions={[
							{
								icon: "fa-up-right-and-down-left-from-center",
								label: `Make ${stream.title} the main stream`,
								onClick: () => onPromoteCompanion(stream.id),
							},
							{
								icon: "fa-minus",
								label: `Remove ${stream.title} from multiview`,
								onClick: () => onRemoveCompanion(stream.id),
								tone: "danger",
							},
						]}
						onPlayerReady={onPlayerReady}
						loadSessionKey={loadSessionKey}
					/>
				))}

				<button
					type="button"
					onClick={() => setSheetOpen(true)}
					disabled={!canAddCompanion || availableStreams.length === 0}
					className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/32 bg-cyan-400/6 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-cyan-100 cursor-pointer transition-colors hover:bg-cyan-400/12 disabled:cursor-not-allowed disabled:opacity-45"
				>
					<i className="fa-solid fa-plus" />
					Add Stream
				</button>
			</div>

			{sheetOpen && (
				<div className="absolute inset-0 z-10">
					<button
						type="button"
						aria-label="Close stream picker"
						onClick={() => setSheetOpen(false)}
						className="absolute inset-0 h-full w-full border-0 bg-slate-950/72"
					/>
					<div className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-[1.4rem] border border-b-0 border-cyan-400/18 bg-slate-950/98 pb-4">
						<div className="sticky top-0 flex items-center justify-between gap-3 border-b border-white/8 bg-slate-950/98 px-4 py-3">
							<span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-100">
								Add to Multiview
							</span>
							<button
								type="button"
								onClick={() => setSheetOpen(false)}
								className="rounded-full border-0 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white cursor-pointer hover:bg-white/16"
							>
								Close
							</button>
						</div>
						<ul className="m-0 flex list-none flex-col gap-1 p-2">
							{availableStreams.map((stream) => (
								<li key={stream.id}>
									<button
										type="button"
										onClick={() => handleAdd(stream.id)}
										className="flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-white/8"
									>
										<PlatformLogo platform={stream.platform} />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-semibold text-white">
												{stream.title}
											</span>
											<span className="block truncate text-[0.68rem] uppercase tracking-[0.14em] text-slate-300/62">
												{stream.channelName}
											</span>
										</span>
										<i className="fa-solid fa-plus shrink-0 text-[0.72rem] text-cyan-200/85" />
									</button>
								</li>
							))}
							{availableStreams.length === 0 && (
								<li className="px-4 py-6 text-center text-sm text-slate-300/72">
									Every project stream is already in this multiview.
								</li>
							)}
						</ul>
					</div>
				</div>
			)}
		</div>
	)
}
