import { App } from 'obsidian';
import { HubPlugin, HubSettings, RegistryManifest, PluginInstallStatus, InstalledPluginInfo } from '../types';
import { HttpClient } from './HttpClient';
import { GitHubRegistryService } from './GitHubRegistryService';

export class RegistryService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Fetch all plugins from all configured sources (Registry JSON and GitHub accounts)
	 */
	async fetchAllPlugins(settings: HubSettings, bypassCache = false): Promise<HubPlugin[]> {
		const pluginMap = new Map<string, HubPlugin>();
		const errors: string[] = [];

		// 1. Fetch from custom registryUrl if set
		if (settings.registryUrl && settings.registryUrl.trim().length > 0) {
			try {
				const registryPlugins = await this.fetchRegistry(settings.registryUrl.trim(), settings.requestMode);
				registryPlugins.forEach(p => {
					p.sourceType = 'registry';
					pluginMap.set(p.id, p);
				});
			} catch (e) {
				console.warn('[PrivatePluginHub] Failed to fetch custom registry:', e);
				errors.push(`Custom Registry: ${(e as Error).message}`);
			}
		}

		// 2. Fetch from each GitHub source
		if (settings.githubSources && settings.githubSources.length > 0) {
			for (const source of settings.githubSources) {
				const cleaned = source.trim();
				if (!cleaned) continue;

				try {
					const ghPlugins = await GitHubRegistryService.fetchPluginsFromAccount(cleaned, settings, bypassCache);
					ghPlugins.forEach(p => {
						// If plugin ID not yet in map, or if remote version is newer
						if (!pluginMap.has(p.id)) {
							pluginMap.set(p.id, p);
						} else {
							const existing = pluginMap.get(p.id)!;
							if (this.isVersionNewer(p.version, existing.version)) {
								pluginMap.set(p.id, p);
							}
						}
					});
				} catch (e) {
					console.warn(`[PrivatePluginHub] Failed to fetch plugins from GitHub source "${cleaned}":`, e);
					errors.push(`GitHub (${cleaned}): ${(e as Error).message}`);
				}
			}
		}

		// If no sources at all were configured
		const hasConfiguredSources = (settings.registryUrl && settings.registryUrl.trim().length > 0) ||
			(settings.githubSources && settings.githubSources.some(s => s.trim().length > 0));

		if (!hasConfiguredSources) {
			throw new Error("No registry URL or GitHub sources configured. Please configure in settings.");
		}

		// If everything failed and no plugins were fetched, throw error with details
		if (pluginMap.size === 0 && errors.length > 0) {
			throw new Error(errors.join('\n'));
		}

		return Array.from(pluginMap.values());
	}

	/**
	 * Fetch the remote registry manifest
	 */
	async fetchRegistry(registryUrl: string, requestMode: 'default' | 'direct' = 'default'): Promise<HubPlugin[]> {
		if (!registryUrl) {
			throw new Error("Registry URL is not configured.");
		}

		try {
			const response = await HttpClient.request({
				url: registryUrl,
				method: 'GET',
				headers: {
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache'
				}
			}, requestMode);

			if (response.status !== 200) {
				throw new Error(`Failed to fetch registry (HTTP ${response.status})`);
			}

			const data: RegistryManifest = response.json;
			return data.plugins || [];
		} catch (error) {
			console.error("[PrivatePluginHub] Error fetching registry:", error);
			throw error;
		}
	}

	/**
	 * Get local plugin status for a given plugin ID
	 */
	getLocalPluginInfo(pluginId: string): InstalledPluginInfo | null {
		// Access obsidian internal plugins API
		const pluginsApi = (this.app as any).plugins;
		if (!pluginsApi) return null;

		const manifests = pluginsApi.manifests || {};
		const enabledPlugins: Set<string> = pluginsApi.enabledPlugins || new Set();

		const manifest = manifests[pluginId];
		if (!manifest) {
			return null;
		}

		return {
			id: pluginId,
			manifestVersion: manifest.version,
			enabled: enabledPlugins.has(pluginId)
		};
	}

	/**
	 * Determine current installation status of a remote plugin
	 */
	getPluginStatus(remotePlugin: HubPlugin): PluginInstallStatus {
		const localInfo = this.getLocalPluginInfo(remotePlugin.id);
		if (!localInfo) {
			return 'not_installed';
		}

		if (!localInfo.enabled) {
			return 'disabled';
		}

		const localVer = localInfo.manifestVersion || '0.0.0';
		const remoteVer = remotePlugin.version || '0.0.0';

		if (this.isVersionNewer(remoteVer, localVer)) {
			return 'update_available';
		}

		return 'installed';
	}

	/**
	 * Compare two version strings (SemVer compliant or string comparison fallback)
	 */
	isVersionNewer(remoteVer: string, localVer: string): boolean {
		if (remoteVer === localVer) return false;

		const cleanRemote = remoteVer.replace(/^v/, '').split('.').map(Number);
		const cleanLocal = localVer.replace(/^v/, '').split('.').map(Number);

		const maxLength = Math.max(cleanRemote.length, cleanLocal.length);

		for (let i = 0; i < maxLength; i++) {
			const r = cleanRemote[i] || 0;
			const l = cleanLocal[i] || 0;
			if (r > l) return true;
			if (r < l) return false;
		}

		return false;
	}
}
