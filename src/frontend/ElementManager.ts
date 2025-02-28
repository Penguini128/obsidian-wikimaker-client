// Update the visuals of an HTML element
export default function updateElement(element: HTMLElement, clears : string[], add : string, hoverText : string) : void {
	for (const clear of clears) {
		element.removeClass(clear)
	}
	element.addClass(add)
	if (hoverText !== '') element.setAttr('aria-label', hoverText);
}
