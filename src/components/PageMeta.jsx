import { useEffect } from "react"
import { getCanonicalUrl, getSocialPreviewUrl } from "../env"

function ensureMeta(selector, attributes) {
	let tag = document.head.querySelector(selector)
	if (!tag) {
		tag = document.createElement("meta")
		for (const [name, value] of Object.entries(attributes)) {
			tag.setAttribute(name, value)
		}
		document.head.append(tag)
	}

	return tag
}

function ensureCanonicalLink() {
	let tag = document.head.querySelector('link[rel="canonical"]')
	if (!tag) {
		tag = document.createElement("link")
		tag.setAttribute("rel", "canonical")
		document.head.append(tag)
	}

	return tag
}

export default function PageMeta({
	title,
	description,
	path = "/",
	image = getSocialPreviewUrl(),
}) {
	useEffect(() => {
		const canonicalUrl = getCanonicalUrl(path)

		document.title = title

		ensureMeta('meta[name="description"]', {
			name: "description",
		}).setAttribute("content", description)

		ensureMeta('meta[property="og:title"]', {
			property: "og:title",
		}).setAttribute("content", title)
		ensureMeta('meta[property="og:description"]', {
			property: "og:description",
		}).setAttribute("content", description)
		ensureMeta('meta[property="og:url"]', {
			property: "og:url",
		}).setAttribute("content", canonicalUrl)
		ensureMeta('meta[property="og:image"]', {
			property: "og:image",
		}).setAttribute("content", image)

		ensureMeta('meta[name="twitter:title"]', {
			name: "twitter:title",
		}).setAttribute("content", title)
		ensureMeta('meta[name="twitter:description"]', {
			name: "twitter:description",
		}).setAttribute("content", description)
		ensureMeta('meta[name="twitter:image"]', {
			name: "twitter:image",
		}).setAttribute("content", image)

		ensureCanonicalLink().setAttribute("href", canonicalUrl)
	}, [description, image, path, title])

	return null
}
