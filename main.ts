import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	requestUrl,
	Setting, TFile
} from 'obsidian';

import moment from 'moment';

// Remember to rename these classes and interfaces!


interface WikiMakerPluginSettings {
	wikiMakerServerURL: string;
	wikiMakerServerSecret : string;
}

const DEFAULT_SETTINGS: WikiMakerPluginSettings = {
	wikiMakerServerURL: '',
	wikiMakerServerSecret : ''
}

const REQUEST_TIMEOUT_MS = 2000

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

function getCurrentMarkdownFile(): TFile | null {
	const file = this.app.workspace.getActiveFile();
	if (file && file.extension === "md") {
		return file;
	}
	return null;
}

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

async function getCurrentFilePublishableStatus() : Promise<boolean> {
	const file = getCurrentMarkdownFile()
	if (!file) return false
	return getFileTags(file).then(tags => {
		return tags.includes('#wikimaker');
	})
}

export default class WikiMakerClientPlugin extends Plugin {
	settings: WikiMakerPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const serverStatusEl = this.addRibbonIcon('router', 'WikiMaker Server Status: Trying to connect...', (evt: MouseEvent) => {
			new Notice('Attempting to connect to WikiMaker server...');
			serverStatusEl.removeClass('ribbon-server-status-connected');
			serverStatusEl.removeClass('ribbon-server-status-disconnected');
			serverStatusEl.addClass('ribbon-server-status-trying');
			attemptServerConnect()
		});
		serverStatusEl.addClass('ribbon-server-status-trying');

		const attemptServerConnect = () => {
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/test-connection`, this.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
			.then(response => {
				// @ts-ignore
				if (response.status === 200) {
					serverStatusEl.removeClass('ribbon-server-status-trying');
					serverStatusEl.addClass('ribbon-server-status-connected')
					serverStatusEl.setAttr('aria-label', 'WikiMaker Server Status: Connected');
					new Notice(`Connected to ${this.settings.wikiMakerServerURL}`)
				} else {
					serverStatusEl.removeClass('ribbon-server-status-trying');
					serverStatusEl.addClass('ribbon-server-status-disconnected')
					serverStatusEl.setAttr('aria-label', 'WikiMaker Server Status: Not connected');
				}
			})
		}
		attemptServerConnect()

		const uploadConfigEl = this.addRibbonIcon('arrow-up-from-line', 'Upload WikiMaker Config Files', (evt : MouseEvent) => {
			new Notice("Attempting to upload config files...")
			fetchWithTimeout(this.settings.wikiMakerServerURL, this.settings.wikiMakerServerSecret, {}, REQUEST_TIMEOUT_MS)
				.then(response => {
					// @ts-ignore
					if (response.status === 200) {
						new Notice('Upload success!')
					} else {
						new Notice('Upload failed. Check server status')
					}
				})
		})

		const wikimakerPublishStatusEl = this.addStatusBarItem();
		wikimakerPublishStatusEl.setText("WikiMaker")
		wikimakerPublishStatusEl.setAttr('aria-label', 'Open Markdown File to view WikiMaker status (click to refresh)');
		wikimakerPublishStatusEl.addClass('wikimaker-status-bar-status-gray');
		wikimakerPublishStatusEl.onClickEvent(async () => {
			if (!await updatePublishElement()) {
				const file = getCurrentMarkdownFile()
				if (!file) return
				const requestBody = {
					name : file.name
				}
				fetchWithTimeout(`${this.settings.wikiMakerServerURL}/remove-published-file`,
				this.settings.wikiMakerServerSecret,
				requestBody,
				REQUEST_TIMEOUT_MS)
				.then(response => {
					// @ts-ignore
					if (response.status === 200) {
						new Notice('Successfully unpublished file')
					}
				})
			}
			new Notice('Refreshed WikiMaker publish status')
		})

		const wikimakerSyncStatusEl = this.addStatusBarItem();
		wikimakerSyncStatusEl.hide()
		wikimakerSyncStatusEl.setText("Pending...")
		wikimakerSyncStatusEl.setAttr('aria-label', 'WikiMaker Sync Status (click to sync)');
		wikimakerSyncStatusEl.addClass('wikimaker-status-bar-status-gray');
		wikimakerSyncStatusEl.onClickEvent(async () => {
			const file = getCurrentMarkdownFile();
			if (!file) return;
			const fileStats = await this.app.vault.adapter.stat(file.path)
			const lastModified = moment(fileStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
			const markdown = await this.app.vault.read(file)
			const requestBody = {
				"name" : file.name,
				"path" : file.path,
				"lastModified" : lastModified,
				"markdown" : markdown
			}
			fetchWithTimeout(`${this.settings.wikiMakerServerURL}/sync-published-file`,
				this.settings.wikiMakerServerSecret,
				requestBody,
				REQUEST_TIMEOUT_MS)
				.then(response => {
					// @ts-ignore
					if (response.status === 200) {
						new Notice('Successfully published file')
						wikimakerSyncStatusEl.setText('Synced');
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-red')
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-gray')
						wikimakerSyncStatusEl.addClass('wikimaker-status-bar-status-green');
					}
				})
		})


		const updatePublishElement = async () => {
			return await getCurrentFilePublishableStatus()
				.then(publishable => {
					if (publishable) {
						wikimakerPublishStatusEl.setAttr('aria-label', 'Published to WikiMaker');
						wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-red')
						wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-gray')
						wikimakerPublishStatusEl.addClass('wikimaker-status-bar-status-green');
						wikimakerSyncStatusEl.show()
						updateSyncElement()
					} else {
						wikimakerPublishStatusEl.setAttr('aria-label', 'Not published to WikiMaker');
						wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-green')
						wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-gray')
						wikimakerPublishStatusEl.addClass('wikimaker-status-bar-status-red');
						wikimakerSyncStatusEl.hide()

						const file = getCurrentMarkdownFile()
						if (!file) return
						const requestBody = {
							name : file.name
						}
						fetchWithTimeout(`${this.settings.wikiMakerServerURL}/remove-published-file`,
						this.settings.wikiMakerServerSecret,
						requestBody,
						REQUEST_TIMEOUT_MS)
					}
					return publishable
				})
		}

		const updateSyncElement = async () => {
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
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-red')
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-gray')
						wikimakerSyncStatusEl.addClass('wikimaker-status-bar-status-green');
					} else {
						wikimakerSyncStatusEl.setText('Not Synced');
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-green')
						wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-gray')
						wikimakerSyncStatusEl.addClass('wikimaker-status-bar-status-red');
					}
				}
			})
		}

		this.app.vault.on('modify', () => {
			updatePublishElement()

			wikimakerSyncStatusEl.setText('Not Synced');
			wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-green')
			wikimakerSyncStatusEl.removeClass('wikimaker-status-bar-status-gray')
			wikimakerSyncStatusEl.addClass('wikimaker-status-bar-status-red');
		});


		await updatePublishElement()
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				if (leaf && leaf.view && leaf.view.getViewType() === "markdown") {
					await updatePublishElement()
				} else if (leaf?.view?.getViewType() !== "file-explorer") {
					wikimakerPublishStatusEl.setAttr('aria-label', 'Open Markdown File to view WikiMaker status');
					wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-green')
					wikimakerPublishStatusEl.removeClass('wikimaker-status-bar-status-red')
					wikimakerPublishStatusEl.addClass('wikimaker-status-bar-status-gray');
					wikimakerSyncStatusEl.hide()
				}
			})
		);

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

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
