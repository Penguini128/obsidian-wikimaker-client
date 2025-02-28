import WikiMakerClientPlugin from "../../../main";
import {Notice} from "obsidian";
import {fetchWithTimeout} from "../../requests/FetchWithTimeout";
import {REQUEST_TIMEOUT_MS} from "../../Constants";

let uploadConfigRibbonElement : HTMLElement;

function buildUploadConfigRibbonElement(plugin : WikiMakerClientPlugin) : void {
	uploadConfigRibbonElement = plugin.addRibbonIcon('arrow-up-from-line', 'Upload WikiMaker Config Files', async (evt : MouseEvent) => {
		new Notice("Attempting to upload config files...")
		fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/test-connection`, plugin.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					new Notice('Upload success! (Placeholder)')
				} else {
					new Notice('Upload failed. Check server status')
				}
			})
	})
}

export function getUploadConfigRibbonElement(plugin : WikiMakerClientPlugin) {
	if (!uploadConfigRibbonElement) buildUploadConfigRibbonElement(plugin);
	return uploadConfigRibbonElement
}
