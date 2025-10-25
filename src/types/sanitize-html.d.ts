declare module 'sanitize-html' {
	function sanitizeHtml(dirty: string, options?: unknown): string;
	namespace sanitizeHtml {
		function simpleTransform(tagName: string, attribs: Record<string, string>): unknown;
	}
	export default sanitizeHtml;
}
