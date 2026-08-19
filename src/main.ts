import { Plugin, Notice } from 'obsidian';
import { HubSettings, DEFAULT_SETTINGS } from './types';
import { MarketModal } from './views/MarketModal';
import { SettingTab } from './views/SettingTab';
import { RegistryService } from './services/RegistryService';

export default class PrivatePluginHubPlugin extends Plugin {
	settings: HubSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Add Ribbon Icon on the left sidebar
		const ribbonIconEl = this.addRibbonIcon('layout-grid', 'Private Plugin Hub', () => {
			this.openMarketModal();
		});
		ribbonIconEl.addClass('private-plugin-hub-ribbon-class');

		// Add Command to Command Palette
		this.addCommand({
			id: 'open-private-plugin-hub',
			name: 'Open Private Plugin Hub',
			callback: () => {
				this.openMarketModal();
			}
		});

		// Add Setting Tab
		this.addSettingTab(new SettingTab(this.app, this));

		// Check updates on startup if enabled
		if (this.settings.autoCheckUpdates && this.settings.registryUrl) {
			this.app.workspace.onLayoutReady(() => {
				this.checkForUpdatesOnStartup();
			});
		}
	}

	onunload() {
		// Cleanup if necessary
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	openMarketModal() {
		new MarketModal(this.app, this.settings).open();
	}

	private async checkForUpdatesOnStartup() {
		try {
			const service = new RegistryService(this.app);
			const plugins = await service.fetchRegistry(this.settings.registryUrl);
			
			const updates = plugins.filter(p => service.getPluginStatus(p) === 'update_available');
			if (updates.length > 0) {
				const notice = new Notice(
					`Private Plugin Hub: ${updates.length} custom plugin update(s) available! Click to view.`,
					8000
				);
				// Make notice clickable
				(notice as any).noticeEl.style.cursor = 'pointer';
				(notice as any).noticeEl.addEventListener('click', () => {
					this.openMarketModal();
				});
			}
		} catch (error) {
			// Quietly log startup check errors
			console.debug("[PrivatePluginHub] Startup check error:", error);
		}
	}
}
