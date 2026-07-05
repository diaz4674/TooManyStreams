import { memo, useEffect, useRef } from "react"
import StreamPlayer from "../StreamPlayer"
import { getActiveStreamCrop } from "../../streamViews"
import { useViewportPlaybackToken } from "../../useViewportPlaybackToken"

function PlatformLogo({ platform }) {
	if (platform === "twitch") {
		return <i className="fa-brands fa-twitch text-violet-400" />
	}

	if (platform === "youtube") {
		return <i className="fa-brands fa-youtube text-red-400" />
	}

	return <i className="fa-solid fa-play text-slate-400" />
}

function TileActionButton({ icon, label, onClick, tone = "default" }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 cursor-pointer transition-colors ${
				tone === "danger"
					? "bg-rose-500/18 text-rose-100 hover:bg-rose-500/28"
					: "bg-cyan-400/12 text-cyan-100 hover:bg-cyan-400/20"
			}`}
		>
			<i className={`fa-solid ${icon} text-[0.78rem]`} />
		</button>
	)
}

/**
 * Lightweight mobile stream tile: a 16:9 player with all chrome BELOW the
 * video. Nothing may overlap the iframe — anything layered over a Twitch
 * embed (even transparent) trips Chrome's occlusion tracker and Twitch then
 * refuses autoplay (see StreamCard.jsx).
 */
function MobileStreamTileComponent({
	stream,
	playbackToken = 0,
	volume = 100,
	forcedMuted,
	onVolumeChange,
	onPress,
	pressLabel,
	actions = [],
	onPlayerReady,
	loadSessionKey,
}) {
	const tileRef = useRef(null)
	const viewportToken = useViewportPlaybackToken(tileRef, {
		enabled: stream.platform === "twitch",
	})
	const combinedPlaybackToken = playbackToken + viewportToken

	// Remember the last audible level so tapping unmute restores it instead of
	// a hard-coded default (mirrors StreamCard).
	const lastNonZeroVolumeRef = useRef(volume > 0 ? volume : 100)
	useEffect(() => {
		if (volume > 0) {
			lastNonZeroVolumeRef.current = volume
		}
	}, [volume])

	const showVolumeRow = typeof onVolumeChange === "function"
	const isMuted = volume === 0

	return (
		<article
			ref={tileRef}
			className="overflow-hidden rounded-[1.25rem] border border-cyan-400/16 bg-slate-950/80"
		>
			<div className="relative w-full bg-slate-950" style={{ aspectRatio: "16 / 9" }}>
				<StreamPlayer
					stream={stream}
					volume={volume}
					muted={forcedMuted}
					crop={getActiveStreamCrop(stream)}
					playbackToken={combinedPlaybackToken}
					onReady={onPlayerReady}
					loadSessionKey={loadSessionKey}
				/>
			</div>

			<div className="flex items-center gap-2 px-3 py-2.5">
				{typeof onPress === "function" ? (
					<button
						type="button"
						onClick={() => onPress(stream.id)}
						aria-label={pressLabel ?? `Watch ${stream.title}`}
						className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left cursor-pointer"
					>
						<PlatformLogo platform={stream.platform} />
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold text-white">
								{stream.title}
							</span>
							<span className="block truncate text-[0.68rem] uppercase tracking-[0.14em] text-slate-300/62">
								{stream.channelName}
							</span>
						</span>
					</button>
				) : (
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<PlatformLogo platform={stream.platform} />
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold text-white">
								{stream.title}
							</span>
							<span className="block truncate text-[0.68rem] uppercase tracking-[0.14em] text-slate-300/62">
								{stream.channelName}
							</span>
						</span>
					</div>
				)}

				<div className="flex shrink-0 items-center gap-1.5">
					{actions.map((action) => (
						<TileActionButton key={action.label} {...action} />
					))}
				</div>
			</div>

			{showVolumeRow && (
				<div className="flex items-center gap-2.5 border-t border-cyan-400/12 px-3 py-2">
					<button
						type="button"
						onClick={() =>
							onVolumeChange(
								stream.id,
								isMuted ? lastNonZeroVolumeRef.current || 100 : 0,
							)
						}
						aria-label={isMuted ? `Unmute ${stream.title}` : `Mute ${stream.title}`}
						aria-pressed={isMuted}
						className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-white/6 text-slate-200/85 cursor-pointer"
					>
						<i
							className={`fa-solid ${
								isMuted ? "fa-volume-xmark" : "fa-volume-low"
							} text-[0.72rem]`}
						/>
					</button>
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						value={volume}
						onChange={(event) =>
							onVolumeChange(stream.id, Number(event.target.value))
						}
						aria-label={`Volume for ${stream.title}`}
						className="h-1.5 min-w-0 flex-1 accent-cyan-400"
					/>
					<span className="w-8 shrink-0 text-right text-[0.66rem] font-bold uppercase tracking-[0.12em] text-slate-300/70">
						{volume}
					</span>
				</div>
			)}
		</article>
	)
}

const MobileStreamTile = memo(MobileStreamTileComponent)
export default MobileStreamTile
