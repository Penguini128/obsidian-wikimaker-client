import { App, Notice, Plugin, PluginSettingTab, requestUrl, Setting, TFile } from 'obsidian';
import moment from 'moment';

interface WikiMakerPluginSettings {
	wikiMakerServerURL: string;
	wikiMakerServerSecret : string;
}

const REQUEST_TIMEOUT_MS = 2000
const DEFAULT_SETTINGS: WikiMakerPluginSettings = {
	wikiMakerServerURL: '',
	wikiMakerServerSecret : ''
}

// Make an HTTP request through the Obsidian interface, but have a timeout failsafe
function fetchWithTimeout(url : string, secret : string , bodyContents : Record<string, string>, timeoutMs: number) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			resolve({ status : 404 });
		}, timeoutMs);
		const requestBody = JSON.stringify({
			secret : secret,
			content : bodyContents
		})
		requestUrl({url : url,
			method : 'POST',
			contentType : 'application/json',
			body: requestBody})
		.then((response) => {
			clearTimeout(timeout);
			resolve(response);
		})
	});
}

// Returns the TFile object of the current file, if the current file is a Markdown file, returning null otherwise
function getCurrentMarkdownFile(): TFile | null {
	const file = this.app.workspace.getActiveFile();
	if (file && file.extension === "md") {
		return file;
	}
	return null;
}

// Returns an array of string tags contained within the file
async function getFileTags(file: TFile) : Promise<string[]> {
	const metadata = this.app.metadataCache.getFileCache(file);
	const frontmatterTags = metadata?.frontmatter?.tags || [];

	let allTags: string[] = [];

	// Collect frontmatter tags
	if (typeof frontmatterTags === "string") {
		allTags.push(frontmatterTags);
	} else if (Array.isArray(frontmatterTags)) {
		allTags = allTags.concat(frontmatterTags);
	}

	// Collect inline tags
	const content = await this.app.vault.read(file);
	const inlineTags = content.match(/#[^\s#]+/g) || [];

	allTags = allTags.concat(inlineTags);

	return allTags;
}

// Returns true if the passed file contains the '#wikimaker' tag and should be published
async function filePublishableStatus(file: TFile | null): Promise<boolean> {
	if (!file) return false
	return await getFileTags(file).then(tags => {
		return tags.includes('#wikimaker');
	})
}

// Update the visuals of an HTML element
function updateElement(element: HTMLElement, clears : string[], add : string, hoverText : string) : void {
	element.addClass(add)
	for (const clear of clears) {
		element.removeClass(clear)
	}
	if (hoverText !== '') element.setAttr('aria-label', hoverText);
}

// Syncs the contents of a file with the WikiMaker server
async function syncRequestBodyFromFile(file : TFile) {
	const fileStats = await this.app.vault.adapter.stat(file.path)
	const lastModified = moment(fileStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
	const markdown = await this.app.vault.read(file)
	return {
		"name": file.name,
		"path": file.path,
		"lastModified": lastModified,
		"markdown": markdown
	}
}

// Removes a published file from the WikiMaker server
async function removePublishedFile(file: TFile | null) : Promise<unknown> {
	if (!file) return new Promise<unknown>((resolve, reject) => {})
	const requestBody = { name : file.name }
	return await fetchWithTimeout(`${this.settings.wikiMakerServerURL}/remove-published-file`,
		this.settings.wikiMakerServerSecret,
		requestBody,
		REQUEST_TIMEOUT_MS)
}

export default class WikiMakerClientPlugin extends Plugin {
	settings: WikiMakerPluginSettings;

	async onload() {
		await this.loadSettings();

		// Ribbon element for display current server connection status
		const serverStatusEl = this.addRibbonIcon('router', 'WikiMaker Server Status: Trying to connect...', (evt: MouseEvent) => {
			new Notice('Attempting to connect to WikiMaker server...');
			updateElement(serverStatusEl, ['ribbon-server-status-connected', 'ribbon-server-status-disconnected'], 'ribbon-server-status-trying', '')
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/test-connection`, this.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
				.then(response => {
					// @ts-ignore
					if (response.status === 200) {
						updateElement(serverStatusEl, ['ribbon-server-status-trying'], 'ribbon-server-status-connected', 'WikiMaker Server Status: Connected')
						new Notice(`Connected to ${this.settings.wikiMakerServerURL}`)
					} else {
						updateElement(serverStatusEl, ['ribbon-server-status-trying'], 'ribbon-server-status-disconnected', 'WikiMaker Server Status: Not connected')
						new Notice(`Unable to connect to ${this.settings.wikiMakerServerURL}`)
					}
				})
		});
		serverStatusEl.addClass('ribbon-server-status-trying');
		serverStatusEl.click()

		const fullSyncRibbonEl = this.addRibbonIcon('refresh-ccw', 'Sync Vault with WikiMaker', (evt : MouseEvent) => {
			new Notice("Syncing vault with WikiMaker server...")
			updateElement(fullSyncRibbonEl, ['ribbon-full-sync-icon-pending'], 'ribbon-full-sync-icon-syncing', 'WikiMaker vault sync in progress...')
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/reset-published-pages`, this.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
			.then(async response => {
				// @ts-ignore
				if (response.status === 200) {
					const files = this.app.vault.getFiles();
					for (const file of files) {
						if (file.extension === "md" && await filePublishableStatus(file)) {
							if (!file) return;
							await fetchWithTimeout(`${this.settings.wikiMakerServerURL}/sync-published-file`,
								this.settings.wikiMakerServerSecret,
								await syncRequestBodyFromFile(file),
								REQUEST_TIMEOUT_MS)
						}
					}
					await updateSyncStatusElement()
					new Notice('Sync complete')
					updateElement(fullSyncRibbonEl, ['ribbon-full-sync-icon-syncing'], 'ribbon-full-sync-icon-pending', 'Sync Vault with WikiMaker')
				} else {
					new Notice('Sync failed. Please try again.')
					updateElement(fullSyncRibbonEl, ['ribbon-full-sync-icon-syncing'], 'ribbon-full-sync-icon-pending', 'Sync Vault with WikiMaker')
				}
			})
		})
		fullSyncRibbonEl.addClass('ribbon-full-sync-icon-pending')

		const uploadConfigEl = this.addRibbonIcon('arrow-up-from-line', 'Upload WikiMaker Config Files', (evt : MouseEvent) => {
			new Notice("Attempting to upload config files...")
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/test-connection`, this.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
				.then(response => {
					// @ts-ignore
					if (response.status === 200) {
						new Notice('Upload success! (Placeholder)')
					} else {
						new Notice('Upload failed. Check server status')
					}
				})
		})

		const wikimakerPublishStatusEl = this.addStatusBarItem();
		wikimakerPublishStatusEl.setText("WikiMaker")
		updateElement(wikimakerPublishStatusEl, [], 'wikimaker-status-bar-status-gray', 'Open Markdown File to view WikiMaker status')

		const wikimakerSyncStatusEl = this.addStatusBarItem();
		wikimakerSyncStatusEl.hide()
		wikimakerSyncStatusEl.setText("Pending...")
		updateElement(wikimakerSyncStatusEl, [], 'wikimaker-status-bar-status-gray', 'WikiMaker Sync Status (click to sync)')
		wikimakerSyncStatusEl.onClickEvent(async () => {
			const file = getCurrentMarkdownFile();
			if (!file) return;
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/sync-published-file`,
				this.settings.wikiMakerServerSecret,
				await syncRequestBodyFromFile(file),
				REQUEST_TIMEOUT_MS)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					new Notice('Successfully published file')
					wikimakerSyncStatusEl.setText('Synced');
					updateElement(wikimakerSyncStatusEl, ['wikimaker-status-bar-status-red', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', 'WikiMaker Sync Status (click to sync)')
				// @ts-ignore
				} else if (response.json.configFileFailsafe) {
					new Notice('Cannot publish WikiMaker website config files')
				}
			})
		})


		const updatePublishElement = async () => {
			return await filePublishableStatus(getCurrentMarkdownFile())
				.then(publishable => {
					if (publishable) {
						updateElement(wikimakerPublishStatusEl, ['wikimaker-status-bar-status-red', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', 'Published to WikiMaker')
						wikimakerSyncStatusEl.show()
						updateSyncStatusElement()
					} else {
						updateElement(wikimakerPublishStatusEl, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', 'Not published to WikiMaker')
						wikimakerSyncStatusEl.hide()
						removePublishedFile(getCurrentMarkdownFile())
					}
					return publishable
				})
		}

		const updateSyncStatusElement = async () => {
			const file = getCurrentMarkdownFile();
			if (!file) return;
			const fileStats = await this.app.vault.adapter.stat(file.path)
			const lastModified = moment(fileStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
			const requestBody = {
				"name" : file.name,
				"path" : file.path,
				"lastModified" : lastModified
			}
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/get-file-sync-status`,
				this.settings.wikiMakerServerSecret,
				requestBody,
				REQUEST_TIMEOUT_MS)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					// @ts-ignore
					const json : Record = response.json
					if (json.syncStatus) {
						wikimakerSyncStatusEl.setText('Synced');
						updateElement(wikimakerSyncStatusEl, ['wikimaker-status-bar-status-red', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-green', '')
					} else {
						wikimakerSyncStatusEl.setText('Not Synced');
						updateElement(wikimakerSyncStatusEl, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', '')
					}
				}
			})
		}

		this.app.vault.on('modify', () => {
			updatePublishElement()
			wikimakerSyncStatusEl.setText('Not Synced');
			updateElement(wikimakerSyncStatusEl, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-gray'], 'wikimaker-status-bar-status-red', '')
		});

		if (getCurrentMarkdownFile()) {
			await updatePublishElement()
		}
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				if (leaf && leaf.view && leaf.view.getViewType() === "markdown") {
					await updatePublishElement()
				} else if (leaf?.view?.getViewType() !== "file-explorer") {
					updateElement(wikimakerPublishStatusEl, ['wikimaker-status-bar-status-green', 'wikimaker-status-bar-status-red'], 'wikimaker-status-bar-status-gray', 'Open Markdown File to view WikiMaker status')
					wikimakerSyncStatusEl.hide()
				}
			})
		);


		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

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
class SampleSettingTab extends PluginSettingTab {
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
