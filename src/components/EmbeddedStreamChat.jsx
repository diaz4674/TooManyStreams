import {
	getStreamChatSrc,
	isMobileWebBrowser,
	isStreamChatCapable,
} from "../utils"

function ChatFallback({ message, className }) {
	return (
		<div
			className={
				className ??
				"flex h-full w-full items-center justify-center bg-slate-950 px-5 text-center text-sm text-slate-300/82"
			}
		>
			<p className="m-0 max-w-sm leading-6">{message}</p>
		</div>
	)
}

export default function EmbeddedStreamChat({
	stream,
	title,
	iframeClassName,
	fallbackClassName,
}) {
	if (!isStreamChatCapable(stream)) {
		return (
			<ChatFallback
				className={fallbackClassName}
				message={
					stream?.platform === "youtube"
						? "YouTube chat needs a live video URL or 11-character video ID for this stream."
						: "Chat is not available for this stream."
				}
			/>
		)
	}

	if (stream.platform === "youtube" && isMobileWebBrowser()) {
		return (
			<ChatFallback
				className={fallbackClassName}
				message="YouTube embedded live chat is not available on mobile web. Open this wall on desktop to view chat here."
			/>
		)
	}

	return (
		<iframe
			title={title}
			src={getStreamChatSrc(stream, { darkMode: true })}
			className={iframeClassName ?? "h-full w-full border-0 bg-slate-950"}
			loading="eager"
		/>
	)
}
