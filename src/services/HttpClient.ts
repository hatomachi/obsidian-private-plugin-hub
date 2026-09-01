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

		let response: RequestUrlResponse;
		try {
			if (mode === 'direct') {
				response = await this.nodeDirectRequest(options);
			} else {
				// Default mode using Obsidian requestUrl (uses Electron Chromium network stack)
				// Set throw: false so we can inspect headers and body on 4xx/5xx responses
				response = await requestUrl({ throw: false, ...options });
			}
		} catch (error) {
			console.error(`[PrivatePluginHub:HTTP] Network request failed for ${options.url} (Mode: ${mode}):`, error);
			throw error;
		}

		if (response.status >= 400) {
			this.logDiagnostic(options.url, mode, response);
		}

		return response;
	}

	/**
	 * Output diagnostic log to DevTools console when HTTP request fails (status >= 400)
	 */
	private static logDiagnostic(url: string, mode: string, res: RequestUrlResponse): void {
		const headers = res.headers || {};
		const text = res.text || '';

		// Check GitHub API rate limit headers and body
		const remaining = headers['x-ratelimit-remaining'];
		const limit = headers['x-ratelimit-limit'];
		const reset = headers['x-ratelimit-reset'];
		const isRateLimit = remaining === '0' || text.includes('API rate limit exceeded');

		// Check proxy headers and HTML block page
		const serverHeader = headers['server'] || '';
		const viaHeader = headers['via'] || '';
		const contentType = headers['content-type'] || '';
		const isHtmlBlock = contentType.includes('text/html') && (text.includes('Blocked') || text.includes('Forbidden') || text.includes('Filter') || text.includes('Policy') || text.includes('Proxy') || text.includes('Zscaler'));
		const isKnownProxy = /zscaler|squid|bluecoat|envoy|nginx|apache/i.test(serverHeader) || Boolean(viaHeader);

		let cause = `HTTP ${res.status}`;
		if (res.status === 403) {
			if (isRateLimit) {
				const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : 'unknown';
				cause = `[GitHub API Rate Limit Exceeded] Remaining: 0 / ${limit || 60}, Resets at: ${resetTime}`;
			} else if (isKnownProxy || isHtmlBlock) {
				cause = `[Corporate Proxy / Security Filter Block] Server: "${serverHeader || 'unknown'}", Via: "${viaHeader || 'none'}"`;
			} else {
				cause = `[HTTP 403 Forbidden] Access denied or blocked by server/WAF.`;
			}
		}

		console.group(`[PrivatePluginHub:HTTP] HTTP ${res.status} on ${url} (Mode: ${mode})`);
		console.warn(`Diagnosis: ${cause}`);
		console.log('URL:', url);
		console.log('Mode:', mode);
		console.log('Status:', res.status);
		console.log('Headers:', headers);
		if (text) {
			console.log('Body Preview:', text.length > 500 ? text.slice(0, 500) + '...' : text);
		}
		console.groupEnd();
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

