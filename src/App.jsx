import { Navigate, Route, Routes } from "react-router-dom"
import HomePage from "./HomePage"
import PageMeta from "./components/PageMeta"
import SeoPage from "./components/SeoPage"

function WatchMultipleTwitchStreamsPage() {
	return (
		<>
			<PageMeta
				title="Watch Multiple Twitch Streams at Once - TooManyStreams"
				description="Watch multiple Twitch streams in one browser tab with TooManyStreams. Build a stream wall, follow multiple POVs, and control the main audio during esports events and creator shows."
				path="/watch-multiple-twitch-streams"
			/>
			<SeoPage
				title="How to Watch Multiple Twitch Streams at Once"
				description="TooManyStreams makes it easy to watch multiple Twitch streams in one browser tab. Create a stream wall, follow multiple POVs, and choose which stream controls the main audio."
				sections={[
					{
						heading: "Why Watch Multiple Twitch Streams?",
						body: "Watching multiple Twitch streams at once is useful for esports tournaments, creator competitions, community events, and live shows where every point of view tells a different part of the story. A dedicated multistream viewer helps you stay with the action without bouncing between tabs.",
					},
					{
						heading: "Create Your Own Twitch Stream Wall",
						body: "TooManyStreams lets you build a Twitch stream wall in a single browser tab. Add creators to the wall, rearrange them with drag and drop, and keep the streams you care about visible together instead of scattering them across separate windows.",
					},
					{
						heading: "Control Audio Without Losing the Rest of the View",
						body: "When several streams are live at once, audio control matters. TooManyStreams helps you focus on one main stream for commentary or comms while you still watch the rest of the event unfold in the same layout.",
					},
				]}
			/>
		</>
	)
}

function MultistreamViewerPage() {
	return (
		<>
			<PageMeta
				title="Multi-Stream Viewer for Twitch and YouTube - TooManyStreams"
				description="TooManyStreams is a free multistream viewer for Twitch and YouTube. Watch multiple creators at once, organize a stream wall, and keep live events in one browser tab."
				path="/multistream-viewer"
			/>
			<SeoPage
				title="Multi-Stream Viewer for Twitch and YouTube"
				description="TooManyStreams is a free multistream viewer that helps you watch Twitch and YouTube streams together in one browser tab. Build a stream wall, reorganize your layout, and follow live events more easily."
				sections={[
					{
						heading: "One Browser Tab, Multiple Live Streams",
						body: "A multistream viewer removes the friction of opening and managing a stack of tabs during live events. TooManyStreams keeps multiple Twitch and YouTube streams in one place so you can follow the creators, casters, and side angles that matter most.",
					},
					{
						heading: "Organize Your Stream Wall Your Way",
						body: "Different events demand different layouts. TooManyStreams lets you build a custom stream wall, rearrange streams as the action shifts, and keep your favorite creators on screen without constantly resizing browser windows.",
					},
					{
						heading: "Better For Esports, Watch Parties, and Creator Events",
						body: "Whether you are tracking an esports bracket, watching a creator tournament, or following multiple live perspectives at once, TooManyStreams gives you a cleaner way to stay locked in on the full event without missing context.",
					},
				]}
			/>
		</>
	)
}

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<HomePage />} />
			<Route
				path="/watch-multiple-twitch-streams"
				element={<WatchMultipleTwitchStreamsPage />}
			/>
			<Route path="/multistream-viewer" element={<MultistreamViewerPage />} />
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	)
}
