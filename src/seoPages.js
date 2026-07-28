// Shared definitions for the static SEO landing pages. Used by the client
// routes in App.jsx and by scripts/prerender.mjs, which bakes each page into
// static HTML at build time so crawlers get full content without running JS.

export const seoPages = [
	{
		path: "/watch-multiple-twitch-streams",
		metaTitle:
			"Watch Multiple Twitch Streams at Once | Free Twitch Multistream Viewer",
		metaDescription:
			"Watch multiple Twitch streams at once in one browser tab with TooManyStreams. Build a Twitch stream wall, follow several POVs, and control the main audio during esports, creator events, and watch parties.",
		structuredData: [
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
		],
		page: {
			title: "How to Watch Multiple Twitch Streams at Once",
			description:
				"TooManyStreams is a free Twitch multistream viewer that helps you watch multiple Twitch streams at once in one browser tab, organize a stream wall, and stay on top of every live point of view.",
			sections: [
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
					heading:
						"Follow Multiple Twitch POVs During Esports and Creator Events",
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
			],
		},
	},
	{
		path: "/multistream-viewer",
		metaTitle: "Multi-Stream Viewer for Twitch and YouTube - TooManyStreams",
		metaDescription:
			"TooManyStreams is a free multistream viewer for Twitch and YouTube. Watch multiple creators at once, organize a stream wall, and keep live events in one browser tab.",
		structuredData: [
			{
				"@context": "https://schema.org",
				"@type": "WebPage",
				name: "Multi-Stream Viewer for Twitch and YouTube",
				url: "https://toomanystreams.app/multistream-viewer",
				description:
					"TooManyStreams is a free multistream viewer for Twitch and YouTube. Watch multiple creators at once, organize a stream wall, and keep live events in one browser tab.",
			},
		],
		page: {
			title: "Multi-Stream Viewer for Twitch and YouTube",
			description:
				"TooManyStreams is a free multistream viewer that helps you watch Twitch and YouTube streams together in one browser tab. Build a stream wall, reorganize your layout, and follow live events more easily.",
			sections: [
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
			],
		},
	},
	{
		path: "/multiwatch",
		metaTitle: "Multiwatch - Watch Multiple Twitch & YouTube Streams Free",
		metaDescription:
			"Multiwatch multiple Twitch and YouTube streams at once with TooManyStreams, a free multiwatch tool. Build a stream wall, switch audio between streams, and multiwatch live events in one browser tab.",
		structuredData: [
			{
				"@context": "https://schema.org",
				"@type": "WebPage",
				name: "Multiwatch - Watch Multiple Twitch & YouTube Streams",
				url: "https://toomanystreams.app/multiwatch",
				description:
					"TooManyStreams is a free multiwatch tool for watching multiple Twitch and YouTube streams at once in one browser tab.",
			},
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: [
					{
						"@type": "Question",
						name: "What does multiwatch mean?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Multiwatch means watching multiple live streams at the same time instead of switching between separate tabs or windows. A multiwatch tool arranges several streams in one layout so you can follow all of them together.",
						},
					},
					{
						"@type": "Question",
						name: "Is there a free multiwatch app for Twitch and YouTube?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Yes. TooManyStreams is a free multiwatch app that works with both Twitch and YouTube. Add the channels you want, arrange them into a stream wall, and multiwatch them together in one browser tab.",
						},
					},
					{
						"@type": "Question",
						name: "Can I multiwatch and still control which stream has audio?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Yes. TooManyStreams lets you pick a main stream for audio while you multiwatch the rest, so you can follow commentary or comms without losing sight of the other streams.",
						},
					},
					{
						"@type": "Question",
						name: "Do I need to install anything to multiwatch streams?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "No. TooManyStreams runs entirely in your browser, so you can start a multiwatch session immediately without installing an app or browser extension.",
						},
					},
				],
			},
		],
		page: {
			title: "Multiwatch Multiple Twitch & YouTube Streams at Once",
			description:
				"TooManyStreams is a free multiwatch tool that lets you watch multiple Twitch and YouTube streams together in one browser tab. Build a stream wall, control audio, and multiwatch live events without juggling tabs.",
			sections: [
				{
					heading: "What Is Multiwatch?",
					body: "Multiwatch is the practice of watching several live streams at the same time in one place, instead of flipping between separate browser tabs. A good multiwatch setup keeps every stream visible so you never lose track of what is happening across an event.",
				},
				{
					heading: "TooManyStreams: A Free Multiwatch Tool",
					body: "TooManyStreams gives you a free way to multiwatch Twitch and YouTube streams together. Add the channels you care about, drop them into a stream wall, and keep everything visible in a single browser tab instead of juggling windows.",
				},
				{
					heading: "Build Your Own Multiwatch Stream Wall",
					body: "Every multiwatch session is different. TooManyStreams lets you add and remove streams, drag them into the layout you want, and reshape your stream wall as an event evolves, so your multiwatch view always matches what you are following.",
				},
				{
					heading: "Multiwatch Esports, Tournaments, and Creator Events",
					body: "Multiwatch setups shine during esports tournaments, creator collabs, and community events with several points of view. TooManyStreams keeps casters, players, and official broadcasts together so you can multiwatch the full story as it happens.",
				},
				{
					heading: "Switch Audio Without Breaking Your Multiwatch View",
					body: "When you multiwatch multiple streams, only one can have your attention at a time. TooManyStreams lets you set a main stream for audio while the rest keep playing silently in view, so you can focus without shrinking your multiwatch layout.",
				},
				{
					heading: "Start Multiwatching for Free",
					body: "There is nothing to install to multiwatch with TooManyStreams. Open your browser, add your streams, and start multiwatching Twitch and YouTube together in seconds, for free.",
				},
			],
		},
	},
	{
		path: "/multitwitch-alternative",
		metaTitle: "MultiTwitch Alternative - Watch Multiple Twitch & YouTube Streams",
		metaDescription:
			"Looking for a MultiTwitch alternative? TooManyStreams is a free multi-stream viewer for Twitch and YouTube with a draggable stream wall, layout controls, and audio switching in one browser tab.",
		structuredData: [
			{
				"@context": "https://schema.org",
				"@type": "WebPage",
				name: "MultiTwitch Alternative for Twitch and YouTube",
				url: "https://toomanystreams.app/multitwitch-alternative",
				description:
					"TooManyStreams is a free, independent alternative to MultiTwitch for watching multiple Twitch and YouTube streams at once.",
			},
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: [
					{
						"@type": "Question",
						name: "What is MultiTwitch?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "MultiTwitch (multitwitch.tv) is a website that arranges several Twitch streams side by side so you can watch them together instead of switching tabs.",
						},
					},
					{
						"@type": "Question",
						name: "Is TooManyStreams affiliated with MultiTwitch?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "No. TooManyStreams is an independent project and is not affiliated with or endorsed by multitwitch.tv. It is built as a free alternative for people who want more layout control and YouTube support.",
						},
					},
					{
						"@type": "Question",
						name: "What does TooManyStreams offer that a basic MultiTwitch setup does not?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "TooManyStreams supports both Twitch and YouTube in the same stream wall, lets you drag and drop streams into a custom layout, save and share your setup, and pick which stream has the main audio.",
						},
					},
					{
						"@type": "Question",
						name: "Is TooManyStreams free to use?",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Yes. TooManyStreams runs entirely in your browser and is free to use, with no account or installation required to start watching multiple streams.",
						},
					},
				],
			},
		],
		page: {
			title: "A Free MultiTwitch Alternative for Twitch and YouTube",
			description:
				"TooManyStreams is a free, independent alternative to MultiTwitch. Watch multiple Twitch and YouTube streams together, build a custom stream wall, and control audio, all in one browser tab.",
			sections: [
				{
					heading: "What Is MultiTwitch?",
					body: "MultiTwitch (multitwitch.tv) is a well-known site for watching several Twitch streams side by side in one browser window. It solves a real problem: following multiple creators or POVs without a wall of separate tabs.",
				},
				{
					heading: "TooManyStreams: An Independent MultiTwitch Alternative",
					body: "TooManyStreams is not affiliated with MultiTwitch. It is a separate, free project built for people who want the same core idea, watching multiple streams at once, with more control over layout, platforms, and audio.",
				},
				{
					heading: "Twitch and YouTube in the Same Stream Wall",
					body: "Unlike a Twitch-only multi-stream setup, TooManyStreams lets you mix Twitch and YouTube channels in the same view. That matters for events where creators stream on different platforms but you still want everything in one place.",
				},
				{
					heading: "Drag, Drop, and Resize Your Layout",
					body: "TooManyStreams lets you rearrange your stream wall with drag and drop instead of a fixed grid. Resize, reorder, and rebuild your layout as an event changes, so your view always matches what is happening.",
				},
				{
					heading: "Save and Share Your Stream Wall",
					body: "Build a layout once and come back to it, or share it with someone else so they see the same streams in the same arrangement. That is useful for recurring watch parties or recommending a setup to friends.",
				},
				{
					heading: "Choose Which Stream Has Audio",
					body: "With several streams playing at once, TooManyStreams lets you pick one main stream for audio while the rest stay visible, so you always know what is happening even when your attention is on a single feed.",
				},
				{
					heading: "Try a Free MultiTwitch Alternative",
					body: "If you are searching for a MultiTwitch alternative that also handles YouTube and gives you more layout control, TooManyStreams is free to try with no installation or account required.",
				},
			],
		},
	},
]
