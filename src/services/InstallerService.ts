import { App, requestUrl, Notice } from 'obsidian';
import { HubPlugin } from '../types';

export class InstallerService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get absolute vault relative path to target plugin folder
	 */
	getPluginPath(pluginId: string): string {
		const configDir = this.app.vault.configDir || '.obsidian';
		return `${configDir}/plugins/${pluginId}`;
	}

	/**
	 * Download and install or update a custom plugin
	 */
	async installOrUpdatePlugin(plugin: HubPlugin): Promise<boolean> {
		const pluginDir = this.getPluginPath(plugin.id);
		const adapter = this.app.vault.adapter;

		try {
			new Notice(`Downloading ${plugin.name} v${plugin.version}...`);

			// 1. Ensure plugin directory exists
			if (!(await adapter.exists(pluginDir))) {
				await adapter.mkdir(pluginDir);
			}

			// Ensure base URL ends with trailing slash
			const baseUrl = plugin.url.endsWith('/') ? plugin.url : `${plugin.url}/`;

			// 2. Fetch manifest.json
			const manifestUrl = `${baseUrl}manifest.json?t=${Date.now()}`;
			const manifestRes = await requestUrl({ url: manifestUrl });
			if (manifestRes.status !== 200) {
				throw new Error(`Failed to download manifest.json (HTTP ${manifestRes.status})`);
			}
			await adapter.write(`${pluginDir}/manifest.json`, manifestRes.text);

			// 3. Fetch main.js
			const mainJsUrl = `${baseUrl}main.js?t=${Date.now()}`;
			const mainJsRes = await requestUrl({ url: mainJsUrl });
			if (mainJsRes.status !== 200) {
				throw new Error(`Failed to download main.js (HTTP ${mainJsRes.status})`);
			}
			await adapter.write(`${pluginDir}/main.js`, mainJsRes.text);

			// 4. Fetch styles.css (Optional)
			try {
				const stylesUrl = `${baseUrl}styles.css?t=${Date.now()}`;
				const stylesRes = await requestUrl({ url: stylesUrl });
				if (stylesRes.status === 200 && stylesRes.text) {
					await adapter.write(`${pluginDir}/styles.css`, stylesRes.text);
				}
			} catch (e) {
				// Ignore missing styles.css
			}

			// 5. Reload plugin manifests in Obsidian
			const pluginsApi = (this.app as any).plugins;
			if (pluginsApi) {
				await pluginsApi.loadManifests();

				// If already enabled, reload the plugin dynamically
				if (pluginsApi.enabledPlugins && pluginsApi.enabledPlugins.has(plugin.id)) {
					new Notice(`Reloading ${plugin.name}...`);
					await pluginsApi.disablePluginAndSave(plugin.id);
					await pluginsApi.enablePluginAndSave(plugin.id);
				} else {
					// Automatically enable on first install
					await pluginsApi.enablePluginAndSave(plugin.id);
				}
			}

			new Notice(`Successfully installed ${plugin.name} v${plugin.version}!`);
			return true;
		} catch (error) {
			console.error(`[PrivatePluginHub] Installation failed for ${plugin.id}:`, error);
			new Notice(`Failed to install ${plugin.name}: ${(error as Error).message}`);
			return false;
		}
	}

	/**
	 * Enable plugin
	 */
	async enablePlugin(pluginId: string): Promise<void> {
		const pluginsApi = (this.app as any).plugins;
		if (pluginsApi) {
			await pluginsApi.enablePluginAndSave(pluginId);
			new Notice(`Enabled plugin: ${pluginId}`);
		}
	}

	/**
	 * Disable plugin
	 */
	async disablePlugin(pluginId: string): Promise<void> {
		const pluginsApi = (this.app as any).plugins;
		if (pluginsApi) {
			await pluginsApi.disablePluginAndSave(pluginId);
			new Notice(`Disabled plugin: ${pluginId}`);
		}
	}

	/**
	 * Uninstall plugin
	 */
	async uninstallPlugin(pluginId: string): Promise<boolean> {
		const pluginsApi = (this.app as any).plugins;
		const pluginDir = this.getPluginPath(pluginId);
		const adapter = this.app.vault.adapter;

		try {
			if (pluginsApi && pluginsApi.enabledPlugins.has(pluginId)) {
				await pluginsApi.disablePluginAndSave(pluginId);
			}

			if (await adapter.exists(pluginDir)) {
				await adapter.rmdir(pluginDir, true);
			}

			if (pluginsApi) {
				await pluginsApi.loadManifests();
			}

			new Notice(`Uninstalled plugin: ${pluginId}`);
			return true;
		} catch (error) {
			console.error(`[PrivatePluginHub] Uninstall failed for ${pluginId}:`, error);
			new Notice(`Failed to uninstall plugin: ${pluginId}`);
			return false;
		}
	}
}
