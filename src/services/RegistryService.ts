import { App, requestUrl } from 'obsidian';
import { HubPlugin, RegistryManifest, PluginInstallStatus, InstalledPluginInfo } from '../types';

export class RegistryService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Fetch the remote registry manifest
	 */
	async fetchRegistry(registryUrl: string): Promise<HubPlugin[]> {
		if (!registryUrl) {
			throw new Error("Registry URL is not configured.");
		}

		try {
			const response = await requestUrl({
				url: registryUrl,
				method: 'GET',
				headers: {
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache'
				}
			});

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
