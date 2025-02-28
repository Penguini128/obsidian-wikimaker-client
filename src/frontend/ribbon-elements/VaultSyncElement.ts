import {Notice} from "obsidian";
import updateElement from "../ElementManager";
import {fetchWithTimeout} from "../../requests/FetchWithTimeout";
import {REQUEST_TIMEOUT_MS} from "../../Constants";
import {fileToSyncBody, isPublishable} from "../../backend/FileManager";
import WikiMakerClientPlugin from "../../../main";
import {syncPublishedFile} from "../../requests/Requests";

let vaultSyncRibbonElement : HTMLElement;

function buildVaultSyncRibbonElement(plugin : WikiMakerClientPlugin) : void {
	vaultSyncRibbonElement = plugin.addRibbonIcon('refresh-ccw', 'Sync Vault with WikiMaker', async (evt : MouseEvent) => {
		new Notice("Syncing vault with WikiMaker server...")
		updateElement(vaultSyncRibbonElement, ['ribbon-full-sync-icon-pending'], 'ribbon-full-sync-icon-syncing', 'WikiMaker vault sync in progress...')
		const files = plugin.app.vault.getFiles();
		let errorOccurred = false
		for (const file of files) {
			if (errorOccurred) break
			if (file.extension === "md" && await isPublishable(plugin, file)) {
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
							if (!json.syncStatus) {
								syncPublishedFile(plugin, file)
							}
						} else {
							new Notice('Sync failed. Please try again.')
							updateElement(vaultSyncRibbonElement, ['ribbon-full-sync-icon-syncing'], 'ribbon-full-sync-icon-pending', 'Sync Vault with WikiMaker')
							errorOccurred = true
							return
						}
					})

			}
		}

		if (!errorOccurred) {
			new Notice('Sync complete')
			updateElement(vaultSyncRibbonElement, ['ribbon-full-sync-icon-syncing'], 'ribbon-full-sync-icon-pending', 'Sync Vault with WikiMaker')
		}

	})
	vaultSyncRibbonElement.addClass('ribbon-full-sync-icon-pending')
}

export function getVaultSyncRibbonElement(plugin : WikiMakerClientPlugin) {
	if (!vaultSyncRibbonElement) buildVaultSyncRibbonElement(plugin);
	return vaultSyncRibbonElement
}
