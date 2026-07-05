import StreamChatSidebar from "../StreamChatSidebar"
import MobileStreamsTab from "./MobileStreamsTab"
import MobileMultiviewTab from "./MobileMultiviewTab"
import { MOBILE_TOP_BAR_PX } from "./MobileMainPlayerFrame"

function TopBarButton({ icon, label, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 bg-white/8 text-slate-100 cursor-pointer transition-colors hover:bg-white/16"
		>
			<i className={`fa-solid ${icon} text-[0.8rem]`} />
		</button>
	)
}

function TabButton({ id, label, count, isActive, onSelect }) {
	return (
		<button
			type="button"
			onClick={() => onSelect(id)}
			aria-pressed={isActive}
			className={`flex-1 rounded-full border-0 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors ${
				isActive
					? "bg-cyan-400/20 text-cyan-50"
					: "bg-transparent text-slate-300/78 hover:bg-white/8"
			}`}
		>
			{label}
			{typeof count === "number" && count > 0 && (
				<span className="ml-1.5 rounded-full bg-white/12 px-1.5 py-0.5 text-[0.6rem]">
					{count}
				</span>
			)}
		</button>
	)
}

/**
 * Full-screen mobile cinema chrome: top bar, a spacer where the (separately
 * rendered, position:fixed) main player frame sits, the tab strip, and the
 * tab panels. The player is a sibling ABOVE the scroll container, so scrolled
 * content can never pass under the iframe (no Twitch occlusion).
 *
 * All three tab panels stay mounted (inactive ones get `hidden`) so the chat
 * iframe and companion players survive tab switches; hidden Twitch players
 * pause and the viewport-token nudges them back when revealed.
 */
export default function MobileCinemaView({
	primaryStream,
	frameHeight,
	activeTab,
	onSelectTab,
	chatStreams,
	activeChatStreamId,
	onSelectChatStream,
	otherStreams,
	onWatchStream,
	companionStreams,
	availableStreams,
	canAddCompanion,
	streamVolumes,
	companionPlaybackToken,
	onAddCompanion,
	onRemoveCompanion,
	onPromoteCompanion,
	onVolumeChange,
	onClose,
	onEnterPip,
	onFullscreen,
	canFullscreen,
	onPlayerReady,
	loadSessionKey,
}) {
	return (
		<div
			className="fixed inset-0 z-[60] flex flex-col bg-slate-950"
			style={{ height: "100dvh" }}
		>
			<div
				className="flex shrink-0 items-center gap-2 px-2"
				style={{ height: `${MOBILE_TOP_BAR_PX}px` }}
			>
				<TopBarButton
					icon="fa-chevron-down"
					label="Close and return to the wall"
					onClick={onClose}
				/>
				<span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
					{primaryStream.title}
				</span>
				{canFullscreen && (
					<TopBarButton
						icon="fa-expand"
						label={`Fullscreen ${primaryStream.title}`}
						onClick={onFullscreen}
					/>
				)}
				<TopBarButton
					icon="fa-down-left-and-up-right-to-center"
					label="Minimize to mini player"
					onClick={onEnterPip}
				/>
			</div>

			{/* The main player frame (position:fixed, rendered by MobileHomeView)
			    occupies this slot. */}
			<div className="shrink-0" style={{ height: `${frameHeight}px` }} />

			<div className="flex shrink-0 gap-1 border-b border-white/8 px-2 py-2">
				<TabButton
					id="chat"
					label="Chat"
					isActive={activeTab === "chat"}
					onSelect={onSelectTab}
				/>
				<TabButton
					id="streams"
					label="Streams"
					count={otherStreams.length}
					isActive={activeTab === "streams"}
					onSelect={onSelectTab}
				/>
				<TabButton
					id="multiview"
					label="Multiview"
					count={companionStreams.length}
					isActive={activeTab === "multiview"}
					onSelect={onSelectTab}
				/>
			</div>

			<div className="relative min-h-0 flex-1">
				<div className={`h-full p-2 ${activeTab === "chat" ? "" : "hidden"}`}>
					{chatStreams.length > 0 ? (
						<StreamChatSidebar
							streams={chatStreams}
							activeStreamId={activeChatStreamId}
							onSelectStream={onSelectChatStream}
							variant="overlay"
						/>
					) : (
						<p className="m-0 px-4 py-8 text-center text-sm text-slate-300/72">
							{primaryStream.platform === "youtube"
								? "YouTube needs a live video URL for chat. Edit the stream and paste the full live URL to enable it."
								: "No chat is available for the streams on screen."}
						</p>
					)}
				</div>

				<div
					className={`h-full overflow-y-auto ${
						activeTab === "streams" ? "" : "hidden"
					}`}
				>
					<MobileStreamsTab
						streams={otherStreams}
						streamVolumes={streamVolumes}
						onVolumeChange={onVolumeChange}
						onWatchStream={onWatchStream}
						onPlayerReady={onPlayerReady}
						loadSessionKey={loadSessionKey}
					/>
				</div>

				<div
					className={`h-full overflow-y-auto ${
						activeTab === "multiview" ? "" : "hidden"
					}`}
				>
					<MobileMultiviewTab
						companionStreams={companionStreams}
						availableStreams={availableStreams}
						canAddCompanion={canAddCompanion}
						streamVolumes={streamVolumes}
						companionPlaybackToken={companionPlaybackToken}
						onAddCompanion={onAddCompanion}
						onRemoveCompanion={onRemoveCompanion}
						onPromoteCompanion={onPromoteCompanion}
						onVolumeChange={onVolumeChange}
						onPlayerReady={onPlayerReady}
						loadSessionKey={loadSessionKey}
					/>
				</div>
			</div>
		</div>
	)
}
