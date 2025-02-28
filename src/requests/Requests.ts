import WikiMakerClientPlugin from "../../main";
import {fetchWithTimeout} from "./FetchWithTimeout";
import {fileToRequestBody, imageToRequestBody} from "../backend/FileManager";
import {REQUEST_TIMEOUT_MS} from "../Constants";
import {Notice, TFile} from "obsidian";
import moment from "moment";


export async function syncPublishedFile(plugin : WikiMakerClientPlugin, file : TFile) {

	const requestBody = await fileToRequestBody(file, plugin)
	const imageNames = JSON.parse(requestBody.images)
	await syncImageFiles(imageNames, plugin)

	return fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/sync-published-file`,
		plugin.settings.wikiMakerServerSecret,
		requestBody,
		REQUEST_TIMEOUT_MS)
}

export async function syncImageFiles(images: any[], plugin : WikiMakerClientPlugin) {
	if (images.length > 0) {
		const imageFiles = []
		for (const image of images) {
			const file : TFile | null = plugin.app.vault.getFileByPath(image.content.path)
			// @ts-ignore
			imageFiles.push(file)
		}
		for (const image of imageFiles) {
			if (!image) continue

			const imageRequestBody = await imageToRequestBody(image, plugin)

			await fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/sync-image-file`,
				plugin.settings.wikiMakerServerSecret,
				imageRequestBody,
				REQUEST_TIMEOUT_MS)
		}
	}
}


