import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export class HttpClient {
	/**
	 * Perform HTTP request based on mode ('default' | 'direct')
	 */
	static async request(param: RequestUrlParam | string, mode: 'default' | 'direct' = 'default'): Promise<RequestUrlResponse> {
		const options: RequestUrlParam = typeof param === 'string' ? { url: param } : param;

		if (mode === 'direct') {
			return this.nodeDirectRequest(options);
		}

		// Default mode using Obsidian requestUrl (uses Electron Chromium network stack)
		return requestUrl(options);
	}

	/**
	 * Direct HTTP/HTTPS request using Node.js native http/https modules.
	 * Bypasses Electron/Chromium system proxy settings and follows redirects.
	 */
	private static nodeDirectRequest(options: RequestUrlParam, redirectCount = 0): Promise<RequestUrlResponse> {
		const MAX_REDIRECTS = 5;

		return new Promise((resolve, reject) => {
			if (redirectCount > MAX_REDIRECTS) {
				return reject(new Error(`Too many redirects (limit ${MAX_REDIRECTS})`));
			}

			try {
				const parsedUrl = new URL(options.url);
				const isHttps = parsedUrl.protocol === 'https:';
				const client = isHttps ? https : http;

				const headers: Record<string, string> = {
					'User-Agent': 'ObsidianPrivatePluginHub',
					...(options.headers || {})
				};

				const reqOptions: http.RequestOptions = {
					hostname: parsedUrl.hostname,
					port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80),
					path: parsedUrl.pathname + parsedUrl.search,
					method: options.method || 'GET',
					headers: headers
				};

				const req = client.request(reqOptions, (res) => {
					// Handle HTTP redirects (301, 302, 303, 307, 308)
					if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
						const nextUrl = new URL(res.headers.location, options.url).toString();
						res.resume(); // Discard response data
						const nextOptions: RequestUrlParam = {
							...options,
							url: nextUrl,
							// For 303 or 302 after POST, switch to GET
							method: (res.statusCode === 303 || (res.statusCode === 302 && options.method !== 'HEAD')) ? 'GET' : options.method
						};
						return resolve(this.nodeDirectRequest(nextOptions, redirectCount + 1));
					}

					const chunks: Buffer[] = [];

					res.on('data', (chunk) => {
						chunks.push(chunk);
					});

					res.on('end', () => {
						const buffer = Buffer.concat(chunks);
						const text = buffer.toString('utf8');
						let json: any = null;
						try {
							json = JSON.parse(text);
						} catch (e) {
							// Not JSON, leave null
						}

						const responseHeaders: Record<string, string> = {};
						for (const [key, value] of Object.entries(res.headers)) {
							if (value !== undefined) {
								responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
							}
						}

						// ArrayBuffer conversion
						const arrayBuffer = buffer.buffer.slice(
							buffer.byteOffset,
							buffer.byteOffset + buffer.byteLength
						);

						resolve({
							status: res.statusCode || 200,
							headers: responseHeaders,
							text: text,
							json: json,
							arrayBuffer: arrayBuffer
						});
					});
				});

				req.on('error', (err) => {
					reject(err);
				});

				if (options.body) {
					if (typeof options.body === 'string') {
						req.write(options.body);
					} else if (options.body instanceof ArrayBuffer) {
						req.write(Buffer.from(options.body));
					}
				}

				req.end();
			} catch (err) {
				reject(err);
			}
		});
	}
}

