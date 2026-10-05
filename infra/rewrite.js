// CloudFront Function (viewer request). The site is built as one HTML file per
// page (blog.html, blog/<slug>.html) but links to clean URLs (/blog,
// /blog/<slug>), so map one onto the other before the request reaches S3.
function handler(event) {
	var request = event.request;
	var uri = request.uri;

	if (uri.length > 1 && uri.endsWith('/')) {
		uri = uri.slice(0, -1);
	}

	// "/" is served by the distribution's default root object, and anything
	// with a file extension (assets, images, __data.json) is already a real key.
	var lastSegment = uri.slice(uri.lastIndexOf('/') + 1);
	if (uri !== '/' && lastSegment.indexOf('.') === -1) {
		uri += '.html';
	}

	request.uri = uri;
	return request;
}
