import {Notice} from "obsidian";
import updateElement from "../ElementManager";
import {fetchWithTimeout} from "../../requests/FetchWithTimeout";
import {REQUEST_TIMEOUT_MS} from "../../Constants";
import WikiMakerClientPlugin from "../../../main";

let serverConnectionRibbonElement : HTMLElement;

function buildConnectionRibbonElement(plugin : WikiMakerClientPlugin) : void {
	serverConnectionRibbonElement = plugin.addRibbonIcon('router', 'WikiMaker Server Status: Trying to connect...', (evt: MouseEvent) => {
		new Notice('Attempting to connect to WikiMaker server...');
		updateElement(serverConnectionRibbonElement, ['ribbon-server-status-connected', 'ribbon-server-status-disconnected'], 'ribbon-server-status-trying', '')
		fetchWithTimeout(`${plugin.settings.wikiMakerServerURL}/test-connection`, plugin.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					updateElement(serverConnectionRibbonElement, ['ribbon-server-status-trying'], 'ribbon-server-status-connected', 'WikiMaker Server Status: Connected')
					new Notice(`Connected to ${plugin.settings.wikiMakerServerURL}`)
				} else {
					updateElement(serverConnectionRibbonElement, ['ribbon-server-status-trying'], 'ribbon-server-status-disconnected', 'WikiMaker Server Status: Not connected')
					new Notice(`Unable to connect to ${plugin.settings.wikiMakerServerURL}`)
				}
			})
	});
	serverConnectionRibbonElement.addClass('ribbon-server-status-trying');
	serverConnectionRibbonElement.click()
}

export function getConnectionRibbonElement(plugin : WikiMakerClientPlugin) {
	if (!serverConnectionRibbonElement) buildConnectionRibbonElement(plugin);
	return serverConnectionRibbonElement
}

