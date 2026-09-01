import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import PrivatePluginHubPlugin from '../main';
import { RegistryService } from '../services/RegistryService';
import { GitHubRegistryService } from '../services/GitHubRegistryService';

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
			text: 'Configure your private plugin sources. You can auto-discover plugins from GitHub accounts (no token required) and/or use a central registry.json file.',
			cls: 'setting-item-description'
		});

		// -------------------------------------------------------------
		// 1. GitHub Integration Section
		// -------------------------------------------------------------
		containerEl.createEl('h3', { text: 'GitHub Sources (No Token Required)' });
		containerEl.createEl('p', {
			text: 'Enter GitHub user or organization URLs/names (one per line). Public repositories matching plugin topics or naming conventions will be auto-detected.',
			cls: 'setting-item-description'
		});

		const githubSourcesValue = (this.plugin.settings.githubSources || []).join('\n');
		new Setting(containerEl)
			.setName('GitHub Usernames / URLs')
			.setDesc('e.g., https://github.com/hatomachi or hatomachi (one per line)')
			.addTextArea(text => {
				text.setPlaceholder('https://github.com/hatomachi\nyour-team-org')
					.setValue(githubSourcesValue)
					.onChange(async (value) => {
						const sources = value
							.split('\n')
							.map(s => s.trim())
							.filter(Boolean);
						this.plugin.settings.githubSources = sources;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
				text.inputEl.cols = 40;
			})
			.addButton(btn => btn
				.setButtonText('Test GitHub Sources')
				.setCta()
				.onClick(async () => {
					btn.setButtonText('Scanning...');
					btn.setDisabled(true);
					try {
						const sources = this.plugin.settings.githubSources || [];
						if (sources.length === 0) {
							new Notice('Please enter at least one GitHub account/URL first.');
							return;
						}

						let totalFound = 0;
						const pluginNames: string[] = [];

						for (const src of sources) {
							const plugins = await GitHubRegistryService.fetchPluginsFromAccount(
								src,
								this.plugin.settings,
								true // bypass cache for test
							);
							totalFound += plugins.length;
							plugins.forEach(p => pluginNames.push(`${p.name} (v${p.version})`));
						}

						if (totalFound > 0) {
							new Notice(`Success! Found ${totalFound} plugin(s):\n${pluginNames.join(', ')}`, 6000);
						} else {
							new Notice(`Connected to GitHub, but no Obsidian plugins matched current filters (topics: "${this.plugin.settings.filterTopics.join(', ')}", prefix: "${this.plugin.settings.filterPrefix}").`, 7000);
						}
					} catch (e) {
						new Notice(`GitHub Scan failed: ${(e as Error).message}`, 7000);
					} finally {
						btn.setButtonText('Test GitHub Sources');
						btn.setDisabled(false);
					}
				}));

		// Filter rules for GitHub discovery
		new Setting(containerEl)
			.setName('Discovery Topic Tags')
			.setDesc('GitHub repository topics used to identify Obsidian plugins (comma-separated).')
			.addText(text => text
				.setPlaceholder('obsidian-plugin, obsidian')
				.setValue((this.plugin.settings.filterTopics || ['obsidian-plugin', 'obsidian']).join(', '))
				.onChange(async (value) => {
					const topics = value.split(',').map(t => t.trim()).filter(Boolean);
					this.plugin.settings.filterTopics = topics;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Discovery Name Prefix')
			.setDesc('Repository name prefix used to identify plugins if topics are missing.')
			.addText(text => text
				.setPlaceholder('obsidian-')
				.setValue(this.plugin.settings.filterPrefix || 'obsidian-')
				.onChange(async (value) => {
					this.plugin.settings.filterPrefix = value.trim();
					await this.plugin.saveSettings();
				}));

		// -------------------------------------------------------------
		// 2. Custom Central Registry (Optional)
		// -------------------------------------------------------------
		containerEl.createEl('h3', { text: 'Custom Central Registry (Optional)' });

		new Setting(containerEl)
			.setName('Registry JSON URL')
			.setDesc('Optional URL pointing to a central static registry.json file (e.g. self-hosted Nginx/S3).')
			.addText(text => text
				.setPlaceholder('https://your-server.com/hub/registry.json')
				.setValue(this.plugin.settings.registryUrl || '')
				.onChange(async (value) => {
					this.plugin.settings.registryUrl = value.trim();
					await this.plugin.saveSettings();
				}))
			.addButton(btn => btn
				.setButtonText('Test Registry')
				.onClick(async () => {
					if (!this.plugin.settings.registryUrl) {
						new Notice('Please enter a Registry JSON URL first.');
						return;
					}
					btn.setButtonText('Testing...');
					btn.setDisabled(true);
					try {
						const registryService = new RegistryService(this.app);
						const plugins = await registryService.fetchRegistry(this.plugin.settings.registryUrl, this.plugin.settings.requestMode);
						new Notice(`Success! Connected to central registry with ${plugins.length} plugins.`);
					} catch (e) {
						new Notice(`Connection failed: ${(e as Error).message}`);
					} finally {
						btn.setButtonText('Test Registry');
						btn.setDisabled(false);
					}
				}));

		// -------------------------------------------------------------
		// 3. General & Connection Options
		// -------------------------------------------------------------
		containerEl.createEl('h3', { text: 'General & Connection' });

		new Setting(containerEl)
			.setName('Connection Mode')
			.setDesc('Select request connection mode. "Direct (Bypass System Proxy)" uses Node.js native HTTP/HTTPS modules to bypass system/OS proxy settings.')
			.addDropdown(dropdown => dropdown
				.addOption('default', 'Obsidian Default (System Proxy)')
				.addOption('direct', 'Direct (Bypass System Proxy)')
				.setValue(this.plugin.settings.requestMode || 'default')
				.onChange(async (value: string) => {
					this.plugin.settings.requestMode = value as 'default' | 'direct';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Check for Updates')
			.setDesc('Automatically check for plugin updates when Obsidian starts up.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoCheckUpdates)
				.onChange(async (value) => {
					this.plugin.settings.autoCheckUpdates = value;
					await this.plugin.saveSettings();
				}));
	}
}

