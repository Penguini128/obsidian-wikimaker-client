import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import updateElement from "./src/frontend/ElementManager";
import {getCurrentMarkdownFile} from "./src/backend/FileManager";
import { getSyncStatusElement} from "./src/frontend/status-elements/SyncStatusElement";
import {getPublishStatusElement, updatePublishStatusElement} from "./src/frontend/status-elements/PublishStatusElement";
import {getConnectionRibbonElement} from "./src/frontend/ribbon-elements/ServerConnetionElement";
import {getVaultSyncRibbonElement} from "./src/frontend/ribbon-elements/VaultSyncElement";
import {getUploadConfigRibbonElement} from "./src/frontend/ribbon-elements/UploadConfigElement";

interface WikiMakerPluginSettings {
	wikiMakerServerURL: string;
	wikiMakerServerSecret : string;
}

const DEFAULT_SETTINGS: WikiMakerPluginSettings = {
	wikiMakerServerURL: '',
	wikiMakerServerSecret : ''
}


export default class WikiMakerClientPlugin extends Plugin {
	settings: WikiMakerPluginSettings;

	async onload() {
		await this.loadSettings();

		getConnectionRibbonElement(this)
		getVaultSyncRibbonElement(this)
		getUploadConfigRibbonElement(this)
		const wikimakerPublishStatusElement = getPublishStatusElement(this)
		const wikimakerSyncStatusElement = getSyncStatusElement(this)

		if (getCurrentMarkdownFile(this)) {
			await updatePublishStatusElement(this, wikimakerSyncStatusElement)
		}


		this.app.vault.on('modify', () => {
			updatePublishStatusElement(this, wikimakerSyncStatusElement)
			wikimakerSyncStatusElement.setText('Not Synced');
			updateElement(wikimakerSyncStatusElement, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', '')
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				if (leaf && leaf.view && leaf.view.getViewType() === "markdown") {
					await updatePublishStatusElement(this, wikimakerSyncStatusElement)
				} else if (leaf?.view?.getViewType() !== "file-explorer") {
					updateElement(wikimakerPublishStatusElement, ['wikimaker-status-elements-status-green', 'wikimaker-status-elements-status-red'], 'wikimaker-status-elements-status-gray', 'Open Markdown File to view WikiMaker status')
					wikimakerSyncStatusElement.hide()
				}
			})
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new WikiMakerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


// Plugin settings configuration
class WikiMakerSettingTab extends PluginSettingTab {
	plugin: WikiMakerClientPlugin;

	constructor(app: App, plugin: WikiMakerClientPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('WikiMaker Server URL')
			.setDesc('The URL where your WikiMaker server is being hosted')
			.addText(text => text
				.setPlaceholder('Server URL')
				.setValue(this.plugin.settings.wikiMakerServerURL)
				.onChange(async (value) => {
					this.plugin.settings.wikiMakerServerURL = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('WikiMaker Server Secret')
			.setDesc('DO NOT SHARE. The \'password\' that must be passed with all communications to your WikiMaker server')
			.addText(text => text
				.setPlaceholder('Secret')
				.setValue(this.plugin.settings.wikiMakerServerSecret)
				.onChange(async (value) => {
					this.plugin.settings.wikiMakerServerSecret = value;
					await this.plugin.saveSettings();
				}));


	}
}
