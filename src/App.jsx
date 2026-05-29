import { Navigate, Route, Routes } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"
import HomePage from "./HomePage"
import PageMeta from "./components/PageMeta"
import SeoPage from "./components/SeoPage"

const watchMultipleTwitchStreamsStructuredData = [
	{
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: "Watch Multiple Twitch Streams at Once",
		url: "https://toomanystreams.app/watch-multiple-twitch-streams",
		description:
			"Learn how to watch multiple Twitch streams at once with TooManyStreams, a free multistream viewer for esports events, creator tournaments, and watch parties.",
	},
	{
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: [
			{
				"@type": "Question",
				name: "Can I watch multiple Twitch streams at once?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Yes. TooManyStreams lets you watch multiple Twitch streams in one browser tab so you can follow several creators or points of view at the same time.",
				},
			},
			{
				"@type": "Question",
				name: "What is the easiest way to watch multiple Twitch streams?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "The easiest approach is to use a dedicated multistream viewer. TooManyStreams keeps several Twitch streams visible together, lets you rearrange the layout, and helps you focus audio on the stream that matters most.",
				},
			},
			{
				"@type": "Question",
				name: "Can I focus on one Twitch stream without losing the others?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Yes. TooManyStreams includes cinema mode so you can emphasize one Twitch stream while keeping the rest of the wall available for context.",
				},
			},
		],
	},
]

function WatchMultipleTwitchStreamsPage() {
	return (
		<>
			<PageMeta
				title="Watch Multiple Twitch Streams at Once | Free Twitch Multistream Viewer"
				description="Watch multiple Twitch streams at once in one browser tab with TooManyStreams. Build a Twitch stream wall, follow several POVs, and control the main audio during esports, creator events, and watch parties."
				path="/watch-multiple-twitch-streams"
				structuredData={watchMultipleTwitchStreamsStructuredData}
			/>
			<SeoPage
				title="How to Watch Multiple Twitch Streams at Once"
				description="TooManyStreams is a free Twitch multistream viewer that helps you watch multiple Twitch streams at once in one browser tab, organize a stream wall, and stay on top of every live point of view."
				sections={[
					{
						heading: "Why Watch Multiple Twitch Streams?",
						body: "Watching multiple Twitch streams at once is useful for esports tournaments, creator competitions, community events, and live shows where every point of view tells a different part of the story. A dedicated multistream viewer helps you stay with the action without bouncing between tabs.",
					},
					{
						heading: "Use a Twitch Multistream Viewer Instead of Juggling Tabs",
						body: "If you want to watch multiple Twitch streams without constantly switching browser tabs, a Twitch multistream viewer is the cleanest setup. TooManyStreams keeps the creators, casters, and alternate POVs you care about together in one browser window so you can keep context during fast-moving live events.",
					},
					{
						heading: "Create Your Own Twitch Stream Wall",
						body: "TooManyStreams lets you build a Twitch stream wall in a single browser tab. Add creators to the wall, rearrange them with drag and drop, and keep the streams you care about visible together instead of scattering them across separate windows.",
					},
					{
						heading: "Follow Multiple Twitch POVs During Esports and Creator Events",
						body: "A multistream Twitch setup is especially useful when you want to track team comms, player perspectives, co-streams, and official broadcasts at the same time. Whether you are following a tournament, a watch party, or a creator competition, watching multiple Twitch streams at once helps you catch more of the story as it happens.",
					},
					{
						heading: "Control Audio Without Losing the Rest of the View",
						body: "When several Twitch streams are live at once, audio control matters. TooManyStreams helps you focus on one main stream for commentary or comms while you still watch the rest of the event unfold in the same layout.",
					},
					{
						heading: "Watch Multiple Twitch Streams for Free",
						body: "TooManyStreams is a free way to watch multiple Twitch streams in one browser tab. You can start with a simple wall, change the layout as the event evolves, and keep your most important Twitch streams in view without installing anything.",
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
		<>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route
					path="/watch-multiple-twitch-streams"
					element={<WatchMultipleTwitchStreamsPage />}
				/>
				<Route path="/multistream-viewer" element={<MultistreamViewerPage />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			<Analytics />
		</>
	)
}
