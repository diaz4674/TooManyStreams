import * as React from "react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"

const searchParams =
	typeof window === "undefined"
		? new URLSearchParams()
		: new URLSearchParams(window.location.search)

if (import.meta.env.DEV && searchParams.has("wdyr")) {
	const whyDidYouRenderModule = await import(
		"@welldone-software/why-did-you-render"
	)
	whyDidYouRenderModule.default(React, {
		trackAllPureComponents: false,
		include: [/StreamCard/],
	})
}

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
)
