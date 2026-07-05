import MobileStreamTile from "./MobileStreamTile"

/**
 * "Streams" tab of the mobile cinema view: every project stream that is not
 * part of the current focus set, previewing muted. Tapping a tile swaps it in
 * as the main stream (enterFocus — the old main returns to this list and the
 * tapped stream's saved companions are restored).
 */
export default function MobileStreamsTab({
	streams,
	streamVolumes,
	onVolumeChange,
	onWatchStream,
	onPlayerReady,
	loadSessionKey,
}) {
	if (streams.length === 0) {
		return (
			<p className="m-0 px-4 py-8 text-center text-sm text-slate-300/72">
				Every stream in this project is already on screen. Add more streams
				from the header to see them here.
			</p>
		)
	}

	return (
		<div className="flex flex-col gap-3 p-3">
			{streams.map((stream) => (
				<MobileStreamTile
					key={stream.id}
					stream={stream}
					volume={streamVolumes[stream.id] ?? 100}
					onVolumeChange={onVolumeChange}
					onPress={onWatchStream}
					pressLabel={`Watch ${stream.title}`}
					actions={[
						{
							icon: "fa-maximize",
							label: `Watch ${stream.title}`,
							onClick: () => onWatchStream(stream.id),
						},
					]}
					onPlayerReady={onPlayerReady}
					loadSessionKey={loadSessionKey}
				/>
			))}
		</div>
	)
}
