// Syncs the contents of a file with the WikiMaker server
import {Notice, TFile} from "obsidian";
import moment from "moment";
import WikiMakerClientPlugin from "../../main";
import {markdownToJson} from "./MarkdownToJson";
import {internalImage} from "./MarkdownRegex";

export async function fileToRequestBody(file : TFile, plugin : WikiMakerClientPlugin ) : Promise<Record<string, string>> {
	const fileStats = await plugin.app.vault.adapter.stat(file.path)
	const lastModified = moment(fileStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
	const fileContents = await plugin.app.vault.read(file)
	const markdownJson = await markdownToJson(file.path, fileContents)
	const internalImages = getInternalImages(markdownJson, plugin.app.vault.getFiles())

	const jsonFilePath = file.path.replace(/\.md$/, '.json')
	const jsonFileName = file.name.replace(/\.md$/, '.json')
	return {
		"name": jsonFileName,
		"path": jsonFilePath,
		"lastModified": lastModified,
		"markdown": JSON.stringify(markdownJson),
		"images" : JSON.stringify(internalImages)
	}
}

export async function imageToRequestBody(image : TFile, plugin : WikiMakerClientPlugin) : Promise<Record<string, string>>{
	const imageStats = await plugin.app.vault.adapter.stat(image.path)
	const lastModified = moment(imageStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
	const arrayBuffer = await plugin.app.vault.readBinary(image)
	const base64Image = arrayBufferToBase64(arrayBuffer)

	const jsonFilePath = image.path.replace(/\.md$/, '.json')
	const jsonFileName = image.name.replace(/\.md$/, '.json')
	return {
		"name": jsonFileName,
		"path": jsonFilePath,
		"lastModified": lastModified,
		"base64" : base64Image,
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	bytes.forEach(byte => binary += String.fromCharCode(byte));
	return btoa(binary);
}

function getInternalImages(jsonObject : any, files : TFile[]) {
	let images: any[] = []
	if (jsonObject.type === internalImage.name) {
		jsonObject.content.path = files.find(file => file.name === jsonObject.content.filename)?.path;
		images.push(jsonObject)
	} else {
		jsonObject.children?.forEach((child: never) => {
			images = images.concat(getInternalImages(child, files))
		})
	}
	return images
}

export async function fileToSyncBody(file : TFile, plugin : WikiMakerClientPlugin ) : Promise<Record<string, string>> {
	const fileStats = await plugin.app.vault.adapter.stat(file.path)
	const lastModified = moment(fileStats?.mtime).format('YYYY-MM-DD HH:mm:ss');
	const jsonPath = file.path.replace(/\.md$/, '.json')
	const jsonName = file.name.replace(/\.md$/, '.json')
	return {
		"name" : jsonName,
		"path" : jsonPath,
		"lastModified" : lastModified
	}
}

// Returns the TFile object of the current file, if the current file is a Markdown file, returning null otherwise
export function getCurrentMarkdownFile(plugin : WikiMakerClientPlugin): TFile | null {
	const file = plugin.app.workspace.getActiveFile();
	if (file && file.extension === "md") {
		return file;
	}
	return null;
}

// Returns an array of string tags contained within the file
async function getFileTags(plugin : WikiMakerClientPlugin, file: TFile) : Promise<string[]> {
	const metadata = plugin.app.metadataCache.getFileCache(file);
	const frontTags = metadata?.frontmatter?.tags || [];

	let allTags: string[] = [];

	// Collect front tags
	if (typeof frontTags === "string") {
		allTags.push(frontTags);
	} else if (Array.isArray(frontTags)) {
		allTags = allTags.concat(frontTags);
	}

	// Collect inline tags
	const content = await plugin.app.vault.read(file);
	const inlineTags = content.match(/#[^\s#]+/g) || [];

	allTags = allTags.concat(inlineTags);
	return allTags;
}

// Returns true if the passed file contains the '#wikimaker' tag and should be published
export async function isPublishable(plugin : WikiMakerClientPlugin, file: TFile | null): Promise<boolean> {
	if (!file) return false
	return await getFileTags(plugin, file).then(tags => {
		return tags.includes('#wikimaker');
	})
}
