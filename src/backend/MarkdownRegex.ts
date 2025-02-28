export const h1 = {name : 'h1', regex : /(?<=^# ).*(?:\n|$)/}
export const h2 = {name : 'h2', regex : /(?<=^## ).*(?:\n|$)/}
export const h3 = {name : 'h3', regex : /(?<=^### ).*(?:\n|$)/}
export const h4 = {name : 'h4', regex : /(?<=^#### ).*(?:\n|$)/}
export const h5 = {name : 'h5', regex : /(?<=^##### ).*(?:\n|$)/}
export const h6 = {name : 'h6', regex : /(?<=^###### ).*(?:\n|$)/}
export const blockQuote = { name : 'blockquote-container', regex : /^>.*(?:\n>?.*)*?(?:\n[\n#]|$)/}
export const newLine = {name : 'new-line', regex : /^[\t ]*(?:\n|$)/ }
export const regularLine = {name : 'text-line', regex : /^.*(?:\n|$)/ }
export const inlineBreak = {name : 'inline-break', regex : /^[\t ]*(?:(?:-[\t ]*){3,}|(?:\*[\t ]*){3,}|(?:_[\t ]*){3,})(?:\n|$)/ }
export const unorderedList = {name : 'ul', regex :/^([\t ]*[*\-+] .*(?:\n|$))+/}
export const orderedList = {name: 'ol', regex : /^([\t ]*([0-9]+\.) .*(?:\n|$))+/}
export const codeBlock = {name : 'code-block', regex : /^[\t ]*```(.|\n)*?\n[\t ]*```[\t ]*(?:\n|$)/}
export const table = {name : 'table', regex : /^[\t ]*\|(?:[^|\n]*\|)+[\t ]*\n[\t ]*(?:\| *:?-+:? *)+(?:\|[\t ]*\n[\t ]*(?:\|[^|\n]+)+)+\|[\t ]*\n/}


export const italic = { name : 'italic', regex : /^[_*]/ }
export const bold = { name : 'bold', regex : /^__|\*\*/ }
export const strikethrough = { name : 'strikethrough', regex : /^~~/ }
export const inlineCode = { name : 'code', regex : /^`/ }
export const plainText = {name : 'p', regex : /^(?:[^*_\n`~]|\\[*_`]|~(?!~))+/}

export const hyperlink = { name : 'external-link', regex : /\[[^[]*?]\(.+?\)/ }
export const wikilink = { name : 'internal-link', regex : /(?<!!)\[\[.+?]]/ }
export const imageLink = { name : 'image-link', regex : /!\[.*?]\(.+?\)/ }
export const internalImage = { name : 'internal-image', regex : /!\[\[.+?]]/ }
export const inlineHyperlink = { name : 'external-link', regex : /(?:https?:\/\/)?[a-zA-Z0-9-]+\.[a-zA-Z0-9-]{2,}(?:\/[A-Za-z0-9-._~:?#[\]@!$&'()*+,;%=]+)+\/?/ }


