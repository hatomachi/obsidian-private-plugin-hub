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
			this.logDiagnostic(options.url, mode, response, options);
		}

		return response;
	}

	/**
	 * Case-insensitive header lookup helper
	 */
	static getHeader(headers: Record<string, string> = {}, name: string): string | undefined {
		const target = name.toLowerCase();
		for (const key of Object.keys(headers)) {
			if (key.toLowerCase() === target) {
				return headers[key];
			}
		}
		return undefined;
	}

	/**
	 * Output high-visibility diagnostic log to DevTools console when HTTP request fails (status >= 400)
	 */
	private static logDiagnostic(url: string, mode: string, res: RequestUrlResponse, options?: RequestUrlParam): void {
		const headers = res.headers || {};
		const text = res.text || '';
		const method = options?.method || 'GET';

		// GitHub API rate limit headers (case-insensitive)
		const remaining = this.getHeader(headers, 'x-ratelimit-remaining');
		const limit = this.getHeader(headers, 'x-ratelimit-limit');
		const reset = this.getHeader(headers, 'x-ratelimit-reset');
		const used = this.getHeader(headers, 'x-ratelimit-used');
		const isRateLimit = remaining === '0' ||
			res.status === 429 ||
			text.includes('API rate limit exceeded') ||
			text.includes('rate limit');

		// Proxy headers and HTML block page detection
		const serverHeader = this.getHeader(headers, 'server') || '';
		const viaHeader = this.getHeader(headers, 'via') || '';
		const contentType = this.getHeader(headers, 'content-type') || '';
		const isHtmlBlock = contentType.includes('text/html') && (
			text.includes('Blocked') || text.includes('Forbidden') || text.includes('Filter') ||
			text.includes('Policy') || text.includes('Proxy') || text.includes('Zscaler')
		);
		const isKnownProxy = /zscaler|squid|bluecoat|envoy|nginx|apache/i.test(serverHeader) || Boolean(viaHeader);

		let cause = `HTTP ${res.status}`;
		let suggestion = 'Check network connection or server status.';
		let resetSummary = '';

		if (reset) {
			const resetEpochMs = parseInt(reset, 10) * 1000;
			if (!isNaN(resetEpochMs)) {
				const resetDate = new Date(resetEpochMs);
				const diffMs = resetEpochMs - Date.now();
				const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));
				resetSummary = `${resetDate.toLocaleTimeString()} (in ~${minutesLeft} min)`;
			}
		}

		if (res.status === 403 || res.status === 429) {
			if (isRateLimit) {
				cause = `[GitHub API Rate Limit Exceeded] Rate limit reached (${remaining ?? '0'} / ${limit ?? '60'} remaining)`;
				suggestion = `Wait until rate limit resets at ${resetSummary || 'next hour'} OR configure a GitHub Personal Access Token (PAT) in Settings to increase limit to 5,000 req/h.`;
			} else if (text.includes('Bad credentials')) {
				cause = `[GitHub Authentication Failed] Invalid or expired GitHub Personal Access Token.`;
				suggestion = 'Verify or update your GitHub Token in Private Plugin Hub settings.';
			} else if (isKnownProxy || isHtmlBlock) {
				cause = `[Corporate Proxy / Security Filter Block] Blocked by proxy or security gateway (Server: "${serverHeader || 'unknown'}", Via: "${viaHeader || 'none'}").`;
				suggestion = 'Switch Connection Mode to "Direct (Bypass System Proxy)" in plugin settings.';
			} else {
				cause = `[HTTP 403 Forbidden] Access denied or restricted by remote server/WAF.`;
				suggestion = 'Check if repository or URL is accessible from browser, or if token permissions are sufficient.';
			}
		} else if (res.status === 404) {
			cause = `[HTTP 404 Not Found] Target repository or endpoint does not exist.`;
			suggestion = 'Confirm that the GitHub username/organization or repository name is spelled correctly.';
		}

		// Prepare response body preview
		let bodyPreview = text.trim();
		if (bodyPreview.length > 600) {
			bodyPreview = bodyPreview.slice(0, 600) + '... (truncated)';
		}

		// 1. High-visibility console.error (guaranteed to be visible even with "Errors only" filter)
		console.error(
			`[PrivatePluginHub:HTTP] ❌ HTTP ${res.status} on ${method} ${url}\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`📌 Cause: ${cause}\n` +
			`🌐 Request: ${method} ${url} (Mode: ${mode})\n` +
			(limit ? `⏱️ GitHub Rate Limit: Remaining ${remaining ?? '0'} / ${limit}${resetSummary ? ` (Resets at: ${resetSummary})` : ''}${used ? `, Used: ${used}` : ''}\n` : '') +
			`💡 Suggestion: ${suggestion}\n` +
			(bodyPreview ? `📄 Response Body:\n${bodyPreview}\n` : '') +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
		);

		// 2. Expandable details group for full debugging inspection
		console.groupCollapsed(`[PrivatePluginHub:HTTP] 🔍 Inspect Raw Response Details (${url})`);
		console.log('Request URL:', url);
		console.log('Request Method:', method);
		console.log('Connection Mode:', mode);
		console.log('Response Status:', res.status);
		console.log('Response Headers:', headers);
		console.log('Full Body:', text);
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

