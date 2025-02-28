import {fetchWithTimeout} from "../../requests/FetchWithTimeout";
import {Notice} from "obsidian";
import elementManager from "../ElementManager";
import {fileToSyncBody, getCurrentMarkdownFile} from "../../backend/FileManager";
import WikiMakerClientPlugin from "../../../main";
import updateElement from "../ElementManager";
import {REQUEST_TIMEOUT_MS} from "../../Constants";
import {syncPublishedFile} from "../../requests/Requests";

let wikimakerSyncStatusElement : HTMLElement;

function buildSyncStatusElement(plugin : WikiMakerClientPlugin) : HTMLElement {
	const wikimakerSyncStatusEl = plugin.addStatusBarItem();
	wikimakerSyncStatusEl.hide()
	wikimakerSyncStatusEl.setText("Pending...")
	elementManager(wikimakerSyncStatusEl, [], 'wikimaker-status-bar-status-red', 'WikiMaker Sync Status (click to sync)')
	wikimakerSyncStatusEl.onClickEvent(async () => {
		const file = getCurrentMarkdownFile(plugin);
		if (!file) return;
		syncPublishedFile(plugin, file)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					new Notice('Successfully published file')
					wikimakerSyncStatusEl.setText('Synced');
					elementManager(wikimakerSyncStatusEl, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', 'WikiMaker Sync Status (click to sync)')
					// @ts-ignore
				} else if (response.json.configFileFailsafe) {
					new Notice('Cannot publish WikiMaker website config files')
				}
			})
	})
	wikimakerSyncStatusElement = wikimakerSyncStatusEl;
	return wikimakerSyncStatusElement
}

export function getSyncStatusElement(plugin : WikiMakerClientPlugin) {
	if (!wikimakerSyncStatusElement) buildSyncStatusElement(plugin);
	return wikimakerSyncStatusElement
}

export async function updateSyncStatusElement(plugin : WikiMakerClientPlugin){
	const file = getCurrentMarkdownFile(plugin);
	if (!file) return;

	fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/get-file-sync-status`,
		plugin.settings.wikiMakerServerSecret,
		await fileToSyncBody(file, plugin),
		REQUEST_TIMEOUT_MS)
	.then(response => {
		// @ts-ignore
		if (response.status === 200) {
			// @ts-ignore
			const json : Record = response.json
			if (wikimakerSyncStatusElement === null) return
			if (json.syncStatus) {
				wikimakerSyncStatusElement.setText('Synced');
				updateElement(wikimakerSyncStatusElement, ['wikimaker-status-bar-status-red', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', '')
			} else {
				wikimakerSyncStatusElement.setText('Not Synced');
				updateElement(wikimakerSyncStatusElement, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', '')
			}
		}
	})
}

