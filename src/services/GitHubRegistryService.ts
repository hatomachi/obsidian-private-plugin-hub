import { HubPlugin, HubSettings } from '../types';
import { HttpClient } from './HttpClient';

interface GitHubRepoItem {
	name: string;
	full_name: string;
	description: string | null;
	topics?: string[];
	archived: boolean;
	disabled: boolean;
	pushed_at: string;
	updated_at: string;
	html_url: string;
	owner: {
		login: string;
	};
}

interface CacheEntry {
	timestamp: number;
	plugins: HubPlugin[];
}

export class GitHubRegistryService {
	private static cache = new Map<string, CacheEntry>();
	private static CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

	/**
	 * Clean and extract GitHub username/organization name from input.
	 * Handles formats like:
	 * - https://github.com/hatomachi
	 * - https://github.com/hatomachi/
	 * - github.com/hatomachi
	 * - @hatomachi
	 * - hatomachi
	 */
	static extractAccount(input: string): string {
		let cleaned = input.trim();
		if (!cleaned) return '';

		// Remove leading @
		if (cleaned.startsWith('@')) {
			cleaned = cleaned.substring(1).trim();
		}

		// Handle URLs
		if (cleaned.includes('github.com')) {
			try {
				if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
					cleaned = `https://${cleaned}`;
				}
				const url = new URL(cleaned);
				const parts = url.pathname.split('/').filter(Boolean);
				if (parts.length > 0) {
					return parts[0];
				}
			} catch (e) {
				// Fallback to regex matching
				const match = cleaned.match(/github\.com\/([a-zA-Z0-9_\-]+)/);
				if (match) return match[1];
			}
		}

		// If simple string without slashes
		const parts = cleaned.split('/').filter(Boolean);
		return parts[0] || cleaned;
	}

	/**
	 * Fetch Obsidian plugins published under a GitHub user/organization
	 */
	static async fetchPluginsFromAccount(
		accountInput: string,
		settings: HubSettings,
		bypassCache = false
	): Promise<HubPlugin[]> {
		const account = this.extractAccount(accountInput);
		if (!account) return [];

		const cacheKey = `github:${account.toLowerCase()}`;
		const now = Date.now();

		if (!bypassCache && this.cache.has(cacheKey)) {
			const entry = this.cache.get(cacheKey)!;
			if (now - entry.timestamp < this.CACHE_TTL_MS) {
				return entry.plugins;
			}
		}

		// 1. Fetch public repositories for this user (or org)
		const repos = await this.fetchUserRepositories(account, settings.requestMode);

		// 2. Filter repositories matching plugin criteria
		const candidateRepos = repos.filter(repo => {
			if (repo.archived || repo.disabled) return false;

			const topics = (repo.topics || []).map(t => t.toLowerCase());
			const filterTopics = settings.filterTopics.map(t => t.toLowerCase());

			// Match by topic
			const hasMatchingTopic = topics.some(t => filterTopics.includes(t));
			if (hasMatchingTopic) return true;

			// Match by prefix (e.g. "obsidian-")
			if (settings.filterPrefix && repo.name.toLowerCase().startsWith(settings.filterPrefix.toLowerCase())) {
				return true;
			}

			return false;
		});

		// 3. Inspect candidate repositories to find manifest.json
		const pluginPromises = candidateRepos.map(repo => this.inspectRepoForPlugin(repo, settings.requestMode));
		const results = await Promise.allSettled(pluginPromises);

		const plugins: HubPlugin[] = [];
		for (const res of results) {
			if (res.status === 'fulfilled' && res.value) {
				plugins.push(res.value);
			}
		}

		// Store in cache
		this.cache.set(cacheKey, {
			timestamp: now,
			plugins: plugins
		});

		return plugins;
	}

	/**
	 * Clear in-memory cache
	 */
	static clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Fetch public repositories from GitHub REST API
	 */
	private static async fetchUserRepositories(
		account: string,
		requestMode: 'default' | 'direct'
	): Promise<GitHubRepoItem[]> {
		const headers = {
			'Accept': 'application/vnd.github.v3+json',
			'User-Agent': 'ObsidianPrivatePluginHub'
		};

		// Try user repos first
		let userUrl = `https://api.github.com/users/${encodeURIComponent(account)}/repos?per_page=100&type=public&sort=updated`;
		try {
			const res = await HttpClient.request({ url: userUrl, headers }, requestMode);
			if (res.status === 200 && Array.isArray(res.json)) {
				return res.json;
			}

			// If 404, try organization repos
			if (res.status === 404) {
				const orgUrl = `https://api.github.com/orgs/${encodeURIComponent(account)}/repos?per_page=100&type=public&sort=updated`;
				const orgRes = await HttpClient.request({ url: orgUrl, headers }, requestMode);
				if (orgRes.status === 200 && Array.isArray(orgRes.json)) {
					return orgRes.json;
				}
			}

			if (res.status === 403) {
				throw new Error('GitHub API rate limit exceeded (60 requests/hour for unauthenticated requests). Please wait a while.');
			}

			throw new Error(`GitHub returned HTTP ${res.status} for account "${account}".`);
		} catch (error) {
			console.error(`[GitHubRegistryService] Failed to fetch repos for ${account}:`, error);
			throw error;
		}
	}

	/**
	 * Check if repository has manifest.json and build HubPlugin object.
	 * Manifest is fetched from raw CDN or latest release download without consuming GitHub API rate limits.
	 */
	private static async inspectRepoForPlugin(
		repo: GitHubRepoItem,
		requestMode: 'default' | 'direct'
	): Promise<HubPlugin | null> {
		const manifestUrls = [
			`https://raw.githubusercontent.com/${repo.full_name}/HEAD/manifest.json`,
			`https://github.com/${repo.full_name}/releases/latest/download/manifest.json`
		];

		let manifestData: any = null;

		for (const mUrl of manifestUrls) {
			try {
				const res = await HttpClient.request({ url: mUrl }, requestMode);
				if (res.status === 200 && res.text) {
					try {
						const parsed = typeof res.json === 'object' && res.json !== null ? res.json : JSON.parse(res.text);
						if (parsed && parsed.id && parsed.version) {
							manifestData = parsed;
							break;
						}
					} catch (e) {
						// JSON parse failed, try next
					}
				}
			} catch (e) {
				// Network error, try next
			}
		}

		if (!manifestData) {
			return null;
		}

		return {
			id: manifestData.id,
			name: manifestData.name || repo.name,
			author: manifestData.author || repo.owner?.login || '',
			version: manifestData.version,
			minAppVersion: manifestData.minAppVersion,
			description: manifestData.description || repo.description || '',
			icon: 'plugin',
			url: `https://github.com/${repo.full_name}/releases/latest/download/`,
			readmeUrl: `https://raw.githubusercontent.com/${repo.full_name}/HEAD/README.md`,
			githubUrl: repo.html_url || `https://github.com/${repo.full_name}`,
			sourceType: 'github',
			updatedAt: repo.pushed_at || repo.updated_at,
			tags: repo.topics || []
		};
	}
}
