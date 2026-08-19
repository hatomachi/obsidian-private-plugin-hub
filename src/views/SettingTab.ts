import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import PrivatePluginHubPlugin from '../main';
import { RegistryService } from '../services/RegistryService';

export class SettingTab extends PluginSettingTab {
	plugin: PrivatePluginHubPlugin;

	constructor(app: App, plugin: PrivatePluginHubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Private Plugin Hub Settings' });
		containerEl.createEl('p', { 
			text: 'Configure your private/custom plugin repository settings here. Team members can download and update custom plugins hosted on your server.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Registry JSON URL')
			.setDesc('The remote URL pointing to your central registry.json file.')
			.addText(text => text
				.setPlaceholder('https://your-server.com/hub/registry.json')
				.setValue(this.plugin.settings.registryUrl)
				.onChange(async (value) => {
					this.plugin.settings.registryUrl = value.trim();
					await this.plugin.saveSettings();
				}))
			.addButton(btn => btn
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					btn.setButtonText('Testing...');
					btn.setDisabled(true);
					try {
						const registryService = new RegistryService(this.app);
						const plugins = await registryService.fetchRegistry(this.plugin.settings.registryUrl);
						new Notice(`Success! Connected to registry with ${plugins.length} plugins.`);
					} catch (e) {
						new Notice(`Connection failed: ${(e as Error).message}`);
					} finally {
						btn.setButtonText('Test Connection');
						btn.setDisabled(false);
					}
				}));

		new Setting(containerEl)
			.setName('Auto Check for Updates')
			.setDesc('Automatically check for updates when Obsidian starts up.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoCheckUpdates)
				.onChange(async (value) => {
					this.plugin.settings.autoCheckUpdates = value;
					await this.plugin.saveSettings();
				}));
	}
}
