import WikiMakerClientPlugin from "../../../main";
import updateElement from "../ElementManager";
import {updateSyncStatusElement} from "./SyncStatusElement";
import {fetchWithTimeout} from "../../requests/FetchWithTimeout";
import {REQUEST_TIMEOUT_MS} from "../../Constants";
import {fileToRequestBody, getCurrentMarkdownFile, isPublishable} from "../../backend/FileManager";

let publishStatusElement : HTMLElement;

export async function updatePublishStatusElement(plugin : WikiMakerClientPlugin, syncStatusElement : HTMLElement) : Promise<boolean> {

	const file = getCurrentMarkdownFile(plugin)
	if (!file) return false;
	const publishable = await isPublishable(plugin, file)
	if (publishable) {
		updateElement(publishStatusElement, ['wikimaker-status-bar-status-red', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', 'Published to WikiMaker')
		syncStatusElement.show()
		await updateSyncStatusElement(plugin)
	} else {

		updateElement(publishStatusElement, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', 'Not published to WikiMaker')
		syncStatusElement.hide()

		await fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/remove-published-file`,
			plugin.settings.wikiMakerServerSecret,
			{name: file.name.replace(/\.md$/, '.json')},
			REQUEST_TIMEOUT_MS)

		const requestBody = await fileToRequestBody(file, plugin)
		const imageNames = JSON.parse(requestBody.images)

		for (const image of imageNames) {
			await fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/remove-published-file`,
				plugin.settings.wikiMakerServerSecret,
				{name: image.content.filename},
				REQUEST_TIMEOUT_MS)
		}
	}
	return publishable
}

function buildPublishStatusElement(plugin : WikiMakerClientPlugin) {
	publishStatusElement = plugin.addStatusBarItem();
	publishStatusElement.setText("WikiMaker")
	updateElement(publishStatusElement, [], 'wikimaker-status-bar-status-gray', 'Open Markdown File to view WikiMaker status')
}

export function getPublishStatusElement(plugin : WikiMakerClientPlugin) {
	if (!publishStatusElement) buildPublishStatusElement(plugin);
	return publishStatusElement
}
