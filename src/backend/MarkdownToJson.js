import {
	blockQuote,
	bold,
	h1,
	h2,
	h3,
	h4,
	h5,
	h6,
	inlineBreak,
	inlineCode,
	italic,
	newLine,
	orderedList,
	plainText,
	regularLine,
	strikethrough,
	unorderedList,
	table,
	codeBlock,
	hyperlink,
	wikilink,
	imageLink,
	inlineHyperlink, internalImage
} from "./MarkdownRegex";
import {Notice} from "obsidian";

const newStringConsumer = (string) => {
	return {
		string : string,
		startOfLine : true,
		bold : { name : 'bold', value : false },
		italic : { name : 'italic', value : false },
		strikethrough : { name : 'strikethrough', value : false },
		code : { name : 'code', value : false }
	}
}

export async function markdownToJson(path, markdown) {
	const stringConsumer = newStringConsumer(markdown);
	return await parseIntoObjects(stringConsumer, path)
}

// Returns the length of the prefix of 'stringConsumer' that matches 'regex'
function prefixMatch(stringConsumer, regex) {
	const match = regex.exec(stringConsumer.string);
	if (match === null) return 0
	if (match.index !== 0) return 0
	return match[0].length;
}

function firstMatch(stringConsumer, regex) {
	const match = regex.exec(stringConsumer.string);
	if (match === null) return [0, 0]
	return [match.index, match[0].length];
}

// Consumes and returns the prefix from 'stringConsumer' of length 'matchLength'
function consumePrefix(stringConsumer, length) {
    stringConsumer.startOfLine = false
    const match = stringConsumer.string.substring(0, length)
    stringConsumer.string = stringConsumer.string.substring(length)
	return match
}

// Consumes and returns the prefix from 'stringConsumer' of length 'matchLength'
function consumeMatch(stringConsumer, startMatch, matchLength) {
	stringConsumer.startOfLine = false
	const match = stringConsumer.string.substring(startMatch, startMatch + matchLength)
	stringConsumer.string = stringConsumer.string.substring(startMatch + matchLength)
	return match
}

async function parseIntoObjects(stringConsumer, path) {
	// Create top of page (with title)
    const pageObject = {
        type : 'div',
        children : [{
            type : 'title',
            children : [{
                type : 'p',
                content : path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
            }]
        }]
    }


	// Add each new HTML object to the list of children
	const pageContents = []
    while (stringConsumer.string.length > 0) {
        pageContents.push(blockElement(stringConsumer))
    }
	pageObject.children = pageObject.children.concat(pageContents);

	discoverInlineElements(pageObject)
	cleanJson(pageObject);

    return pageObject;
}

function blockElement(stringConsumer) {
	let blockType = 'empty'
	let blockContents = ''
	const blockTypes = [h1, h2, h3, h4, h5, h6, blockQuote, unorderedList, inlineBreak, newLine, orderedList, table, codeBlock, regularLine]

	for (let i = 0; i < blockTypes.length; i++) {
		const type = blockTypes[i]
		const matchIndices = firstMatch(stringConsumer, type.regex)
		if (matchIndices[1] > 0) {
			blockType = type.name
			blockContents = consumeMatch(stringConsumer, matchIndices[0], matchIndices[1])
			break
		}
	}

	if (blockType === 'empty') {
		stringConsumer.string = ''
	}

	let childValue;
	switch (blockType) {
		case 'blockquote-container':
			childValue = blockquoteChildren(newStringConsumer(blockContents))
			break
		case 'ul':
			blockType = 'container'
			childValue = unorderedListChildren(newStringConsumer(blockContents))
			break
		case 'ol':
			blockType = 'container'
			childValue = orderedListChildren(newStringConsumer(blockContents))
			break
		case 'table':
			childValue = tableChildren(blockContents)
			break
		case 'code-block':
			childValue = codeBlockChildren(blockContents)
			break
		default:
			childValue = inlineStyleElements(blockContents)

	}

	return {
		type : blockType,
		children : childValue,
		block : true
	}
}

function codeBlockChildren(blockContents) {
	let lines = blockContents.split('\n')
	if (lines[lines.length - 1] === '') lines = lines.slice(0, lines.length - 1)
	return lines.filter((line, index) => {
		return !(index === 0 || index >= lines.length - 1);
	}).map(line => ({
		type : 'text-line',
		block : true,
		children : [{
			type : 'p',
			content : line.length === 0 ? ' ' : line,
			block : true
		}]
	}))
}

function tableChildren(tableContents) {
	let rows = tableContents.split('\n')
	// const justifications = tableContents[1]
	rows = [rows[0]].concat(rows.slice(2))
	return rows.map((row, index) => ({
		type : 'tr',
		children : tableRow(row, index)
	}))
}

function tableRow(rowContent, index) {
	const cells = rowContent.split(/(?<!\\)\|/).slice(1, -1)

	return cells.map(cell => ({
		type : index === 0 ? 'th' : 'td',
		children : [tableCell(cell)]
	}))
}

function tableCell(rowContent) {
	const content = rowContent.trim()
	return {
		type : 'p',
		content : content.length > 0 ? content : ' '
	}
}

function blockquoteChildren(stringConsumer) {
	const quoteLines = stringConsumer.string.split('\n')
	return quoteLines.map((line) => quoteLine(newStringConsumer(line)));
}

function quoteLine(stringConsumer) {
    let objectChildren
    let matchLength;
    if ((matchLength = prefixMatch(stringConsumer, />[\t ]*/)) > 0) {
        consumePrefix(stringConsumer, matchLength)
		objectChildren = [quoteLine(stringConsumer)]
		return {
			type : 'blockquote',
			children : objectChildren
		}
    } else {
        objectChildren = inlineStyleElements(stringConsumer.string)
		return {
			type : 'container',
			children : objectChildren
		}
    }

}

function orderedListChildren(stringConsumer) {
	let string = stringConsumer.string
	const length = string.length;
	if (string.charAt(length - 1) === '\n') {
		string = string.substring(0, length- 1)
	}
	const listLines = string.split('\n')
	return listLines.map((line) => orderedListLine(newStringConsumer(line)));
}

function orderedListLine(stringConsumer) {
	const match = prefixMatch(stringConsumer, /^[\t ]/);
	const startNumber = /(?<=^[\t ]*)[0-9]+(?=\.)/.exec(stringConsumer.string)[0]
	if (match > 0) {
		consumePrefix(stringConsumer, match)
		return {
			type : 'ol',
			children : [orderedListLine(stringConsumer)],
			start : startNumber
		}
	} else {
		consumePrefix(stringConsumer, prefixMatch(stringConsumer, /[0-9]+\. /))
		return {
			type : 'ol',
			start : startNumber,
			children : [{
				type : 'li',
				children : inlineStyleElements(stringConsumer.string)
			}]
		}

	}
}

function unorderedListChildren(stringConsumer) {
	let string = stringConsumer.string
	const length = string.length;
	if (string.charAt(length - 1) === '\n') {
		string = string.substring(0, length- 1)
	}
	const listLines = string.split('\n')
	return listLines.map((line) => unorderedListLine(newStringConsumer(line)));
}

function unorderedListLine(stringConsumer) {
	const match = prefixMatch(stringConsumer, /^[\t ]/);
	if (match > 0) {
		consumePrefix(stringConsumer, match)
		return {
			type : 'ul',
			children : [unorderedListLine(stringConsumer)]
		}
	} else {
		consumePrefix(stringConsumer, prefixMatch(stringConsumer, /[+\-*] /))
		return {
			type : 'ul',
			children : [{
				type : 'li',
				children : inlineStyleElements(stringConsumer.string)
			}]
		}

	}
}


function inlineStyleElements(lineContents) {
	lineContents = lineContents.replace('\n', '')
	const stringConsumer = newStringConsumer(lineContents)

	// Add each new HTML object to the list of children
	const lineElements = []

	while (stringConsumer.string.length > 0) {

        const bestMatch = {
			regex: null,
			text: null
		}
		const inlinePatterns = [
			italic,
			bold,
			strikethrough,
			inlineCode
		]

		for (let i = 0; i < inlinePatterns.length; i++) {
			const value = inlinePatterns[i]
			const match = prefixMatch(stringConsumer, value.regex)
			if (match > 0) {
				bestMatch.regex = value
				bestMatch.text = stringConsumer.string.substring(0, match)
			}
		}

        if (bestMatch.text) {
            consumePrefix(stringConsumer, bestMatch.text.length)
            switch (bestMatch.regex.name) {
                case 'italic':
                    stringConsumer.italic.value = !stringConsumer.italic.value
                    break
				case 'bold':
					stringConsumer.bold.value = !stringConsumer.bold.value
					break
				case 'strikethrough':
					stringConsumer.strikethrough.value = !stringConsumer.strikethrough.value
					break
				case 'code':
					stringConsumer.code.value = !stringConsumer.code.value
					break
            }
        }
		lineElements.push(textStyling(stringConsumer))
    }



    return lineElements
}

function textStyling(stringConsumer) {
	const element = {
		type: 'p',
		children : [],
		content : ''
	}
	let current = element

	const fields = [
		stringConsumer.italic,
		stringConsumer.bold,
		stringConsumer.strikethrough,
		stringConsumer.code
	]

	for (let i = 0; i < fields.length; i++) {
		const json = fields[i]
		if (json.value) {
			current.type = json.name
			const newElement = {
				type : 'p',
				children : [],
				content : ''
			}
			// @ts-ignore
			current.children = [newElement]
			current = newElement
		}
	}

	if (stringConsumer.code.value) {
		current.content = consumeInlineCode(stringConsumer)
	} else {
		current.content = consumePlainText(stringConsumer)
	}
	stringConsumer.code.value = false
	return element
}


function discoverInlineElements(htmlElement) {
	let newChildren = []
	htmlElement.children?.forEach(child => {
		if (child.type === 'p') {
			newChildren = newChildren.concat(findInlines(child.content))
		} else {
			discoverInlineElements(child)
			newChildren.push(child)
		}
	})
	htmlElement.children = newChildren
}

function findInlines(string) {
	const stringConsumer = newStringConsumer(string)
	const newInlines = []
	const finalPassInlines = [hyperlink, wikilink, imageLink, inlineHyperlink, internalImage]

	let allFound = false
	while (!allFound) {
		allFound = true

		const bestMatch = {
			startIndex : 999999999,
			matchLength : -1,
			pattern : null
		}

		finalPassInlines.forEach(value => {
			const matchInfo = firstMatch(stringConsumer, value.regex)
			if (matchInfo[1] > 0 && matchInfo[0] < bestMatch.startIndex) {
				bestMatch.startIndex = matchInfo[0]
				bestMatch.matchLength = matchInfo[1]
				bestMatch.pattern  = value
			}
		})

		if (bestMatch.pattern) {
			allFound = false
			if (bestMatch.startIndex > 0) {
				newInlines.push({
					type : 'p',
					content : stringConsumer.string.substring(0, bestMatch.startIndex)
				})
			}
			let foundContent
			let match = consumeMatch(stringConsumer, bestMatch.startIndex, bestMatch.matchLength)
			switch (bestMatch.pattern) {
				case hyperlink:
					foundContent = hyperlinkContent(match)
					break
				case wikilink:
					foundContent = wikilinkContent(match)
					break
				case imageLink:
					foundContent = imageLinkContent(match)
					break
				case inlineHyperlink:
					foundContent = inlineHyperlinkContent(match)
					break
				case internalImage:
					foundContent = internalImageContent(match)
			}

			newInlines.push({
				type : bestMatch.pattern.name,
				content : foundContent
			})
		}

	}

	newInlines.push({
		type : 'p',
		content : stringConsumer.string
	})
	return newInlines
}

function inlineHyperlinkContent(string) {
	return {
		'text' : string,
		'url' : string
	}
}

function internalImageContent(string) {
	const imageContents = string.substring(3, string.length - 2).trim()
	const imageParts = imageContents.replace('\\|', '|').split('|')
	const imageFileName = imageParts[0]
	const imageSize = imageParts.length > 1 ? imageParts[1].split('x') : undefined

	return {
		'filename' : imageFileName,
		'width': imageSize[0] !== undefined ? imageSize[0] + 'px': undefined,
		'height': imageSize[0] !== undefined && imageSize.length > 1 ? imageSize[1] + 'px' : undefined,
	}
}

function imageLinkContent(imageMarkdown) {
    const imageTextPattern = /(?<=\[).*?(?=])/
    const imageUrlPattern = /(?<=\().*?(?=\))/
    let imageParts = imageMarkdown.match(imageTextPattern)[0].replace('\\|', '|').split('|')
    let imageUrl = imageMarkdown.match(imageUrlPattern)[0].split(' ')[0]

	const imageText = imageParts[0].replace('\\<', '<').replace('\\[', '[')
	const imageSize = imageParts.length > 1 ? imageParts[1].split('x') : undefined

    if (imageUrl && imageText) {
        return {
            'text' : imageText,
            'url' : imageUrl.trim(),
			'width': imageSize[0] !== undefined ? imageSize[0] + 'px': undefined,
			'height': imageSize[0] !== undefined && imageSize.length > 1 ? imageSize[1] + 'px' : undefined,
        }
    }
}

function hyperlinkContent(hyperlinkMarkdown) {
	const hyperlinkTextPattern = /(?<=\[).*?(?=])/
	const hyperlinkUrlPattern = /(?<=\().*?(?=\))/
	let hyperlinkText = hyperlinkMarkdown.match(hyperlinkTextPattern)
	hyperlinkText = hyperlinkText[0].replace('\\<', '<').replace('\\[', '[')
	let hyperlinkUrl = hyperlinkMarkdown.match(hyperlinkUrlPattern)[0]
	if (hyperlinkUrl && hyperlinkText) {
		return {
			'text' : hyperlinkText,
			'url' : hyperlinkUrl.trim()
		}
	}
}

function wikilinkContent(wikilinkMarkdown) {
    const wikilinkPattern = /(?<=\[\[).+?(?=]])/
    let wikilinkParts = wikilinkMarkdown.match(wikilinkPattern)[0].split(/(?<!\\)\|/)
    return {
        'text' : wikilinkParts.length > 1 ? wikilinkParts[1] : wikilinkParts[0],
        'url' : wikilinkParts[0].trim()
    }
}

function consumePlainText(stringConsumer) {
	const match = prefixMatch(stringConsumer, plainText.regex)
	if (match === 0) {
		return ''
	} else {
		return consumePrefix(stringConsumer, match)
	}
}

function consumeInlineCode(stringConsumer) {
    const pattern = /.*?((?<!\\)`|\n|$)/
    let matchLength = 0
    let matchString = ''
    if ((matchLength = prefixMatch(stringConsumer, pattern)) > 0) {
		matchString = stringConsumer.string.substring(0, matchLength)
		if (matchString.charAt(matchLength - 1) === '`') {
			matchString = matchString.substring(0, matchLength - 1)
		}
		consumePrefix(stringConsumer, matchLength)
	}
    return matchString
}

// @ts-ignore
function cleanJson(jsonObject) {
	if (jsonObject.type === 'p') {
		// @ts-ignore
		return jsonObject.content.length > 0
	} else {
		// @ts-ignore
		jsonObject.children = jsonObject.children?.filter(child => cleanJson(child))
		return jsonObject.children?.length !== 0 || jsonObject.block;
	}
}
