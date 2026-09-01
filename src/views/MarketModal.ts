import { App, Modal, Notice, setIcon } from 'obsidian';
import { HubPlugin, HubSettings, PluginInstallStatus } from '../types';
import { RegistryService } from '../services/RegistryService';
import { InstallerService } from '../services/InstallerService';

export class MarketModal extends Modal {
	private settings: HubSettings;
	private registryService: RegistryService;
	private installerService: InstallerService;

	private plugins: HubPlugin[] = [];
	private filteredPlugins: HubPlugin[] = [];
	private searchQuery: string = '';
	private currentTab: 'all' | 'installed' | 'updates' = 'all';

	private listContainerEl!: HTMLElement;
	private searchInputEl!: HTMLInputElement;
	private statsContainerEl!: HTMLElement;
	private updateAllBtnEl!: HTMLButtonElement;
	private isLoading: boolean = false;

	constructor(app: App, settings: HubSettings) {
		super(app);
		this.settings = settings;
		this.registryService = new RegistryService(app);
		this.installerService = new InstallerService(app);
	}

	async onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass('private-hub-modal');
		contentEl.empty();

		this.buildHeader(contentEl);
		this.buildControls(contentEl);

		// Container for plugin list
		this.listContainerEl = contentEl.createDiv({ cls: 'private-hub-plugin-list' });

		await this.loadRegistryData();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Build top modal header
	 */
	private buildHeader(parentEl: HTMLElement) {
		const headerEl = parentEl.createDiv({ cls: 'private-hub-header' });
		
		const titleContainer = headerEl.createDiv({ cls: 'private-hub-title-container' });
		const iconEl = titleContainer.createDiv({ cls: 'private-hub-title-icon' });
		setIcon(iconEl, 'layout-grid');
		
		const textContainer = titleContainer.createDiv();
		textContainer.createEl('h2', { text: 'Private Plugin Hub', cls: 'private-hub-title' });
		textContainer.createEl('span', { 
			text: 'Custom internal plugin marketplace for your team', 
			cls: 'private-hub-subtitle' 
		});

		this.statsContainerEl = headerEl.createDiv({ cls: 'private-hub-stats' });
	}

	/**
	 * Build search bar, tabs, and action buttons
	 */
	private buildControls(parentEl: HTMLElement) {
		const controlsEl = parentEl.createDiv({ cls: 'private-hub-controls' });

		// Search Input
		const searchWrapper = controlsEl.createDiv({ cls: 'private-hub-search-wrapper' });
		const searchIcon = searchWrapper.createDiv({ cls: 'private-hub-search-icon' });
		setIcon(searchIcon, 'search');
		
		this.searchInputEl = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: 'Search plugins or authors...',
			cls: 'private-hub-search-input'
		});
		this.searchInputEl.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.applyFilters();
		});

		// Filter Tabs
		const tabsEl = controlsEl.createDiv({ cls: 'private-hub-tabs' });
		
		const tabs: Array<{ id: 'all' | 'installed' | 'updates'; label: string }> = [
			{ id: 'all', label: 'All Plugins' },
			{ id: 'installed', label: 'Installed' },
			{ id: 'updates', label: 'Updates' }
		];

		tabs.forEach(tab => {
			const tabBtn = tabsEl.createEl('button', {
				text: tab.label,
				cls: `private-hub-tab ${this.currentTab === tab.id ? 'is-active' : ''}`
			});
			tabBtn.addEventListener('click', () => {
				tabsEl.querySelectorAll('.private-hub-tab').forEach(el => el.removeClass('is-active'));
				tabBtn.addClass('is-active');
				this.currentTab = tab.id;
				this.applyFilters();
			});
		});

		// Action Buttons Container
		const actionsEl = controlsEl.createDiv({ cls: 'private-hub-actions' });

		// Refresh Button
		// Refresh Button
		const refreshBtn = actionsEl.createEl('button', {
			cls: 'mod-neutral private-hub-btn',
			title: 'Check for updates'
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.createSpan({ text: ' Refresh' });
		refreshBtn.addEventListener('click', async () => {
			refreshBtn.addClass('is-loading');
			await this.loadRegistryData(true);
			refreshBtn.removeClass('is-loading');
		});

		// Update All Button
		this.updateAllBtnEl = actionsEl.createEl('button', {
			cls: 'mod-cta private-hub-btn',
			title: 'Update all available plugins'
		});
		setIcon(this.updateAllBtnEl, 'download-cloud');
		this.updateAllBtnEl.createSpan({ text: ' Update All' });
		this.updateAllBtnEl.style.display = 'none'; // Initially hidden
		this.updateAllBtnEl.addEventListener('click', () => this.handleUpdateAll());
	}

	/**
	 * Load registry and GitHub plugins from configured sources
	 */
	private async loadRegistryData(bypassCache = false) {
		this.isLoading = true;
		this.renderLoadingState();

		try {
			this.plugins = await this.registryService.fetchAllPlugins(this.settings, bypassCache);
			this.applyFilters();
		} catch (error) {
			this.renderErrorState((error as Error).message);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Filter plugins based on tab and search query
	 */
	private applyFilters() {
		const updatesAvailableCount = this.plugins.filter(p => this.registryService.getPluginStatus(p) === 'update_available').length;
		const installedCount = this.plugins.filter(p => {
			const s = this.registryService.getPluginStatus(p);
			return s === 'installed' || s === 'update_available' || s === 'disabled';
		}).length;

		// Update Stats in Header
		this.statsContainerEl.setText(`${this.plugins.length} Available | ${installedCount} Installed | ${updatesAvailableCount} Updates`);

		// Show/Hide Update All Button
		if (updatesAvailableCount > 0) {
			this.updateAllBtnEl.style.display = 'inline-flex';
		} else {
			this.updateAllBtnEl.style.display = 'none';
		}

		this.filteredPlugins = this.plugins.filter(plugin => {
			const status = this.registryService.getPluginStatus(plugin);

			// Tab filtering
			if (this.currentTab === 'installed' && (status === 'not_installed')) {
				return false;
			}
			if (this.currentTab === 'updates' && status !== 'update_available') {
				return false;
			}

			// Search query filtering
			if (this.searchQuery) {
				const q = this.searchQuery;
				const matchesName = plugin.name.toLowerCase().includes(q);
				const matchesAuthor = plugin.author.toLowerCase().includes(q);
				const matchesDesc = plugin.description.toLowerCase().includes(q);
				const matchesTags = plugin.tags ? plugin.tags.some(t => t.toLowerCase().includes(q)) : false;
				return matchesName || matchesAuthor || matchesDesc || matchesTags;
			}

			return true;
		});

		this.renderPluginList();
	}

	/**
	 * Render loading state
	 */
	private renderLoadingState() {
		this.listContainerEl.empty();
		const loader = this.listContainerEl.createDiv({ cls: 'private-hub-loading' });
		const spinner = loader.createDiv({ cls: 'private-hub-spinner' });
		setIcon(spinner, 'loader-2');
		loader.createDiv({ text: 'Fetching custom plugins registry...' });
	}

	/**
	 * Render error state
	 */
	private renderErrorState(message: string) {
		this.listContainerEl.empty();
		const errEl = this.listContainerEl.createDiv({ cls: 'private-hub-error' });
		const errIcon = errEl.createDiv({ cls: 'private-hub-error-icon' });
		setIcon(errIcon, 'alert-triangle');
		errEl.createEl('h4', { text: 'Failed to load plugins' });
		errEl.createEl('p', { text: message });

		const sourcesList: string[] = [];
		if (this.settings.githubSources && this.settings.githubSources.length > 0) {
			sourcesList.push(`GitHub: ${this.settings.githubSources.join(', ')}`);
		}
		if (this.settings.registryUrl) {
			sourcesList.push(`Registry: ${this.settings.registryUrl}`);
		}

		if (sourcesList.length > 0) {
			errEl.createEl('p', { text: `Configured Sources: ${sourcesList.join(' | ')}`, cls: 'private-hub-url-hint' });
		} else {
			errEl.createEl('p', { text: 'No sources configured. Please configure GitHub accounts or Registry URL in Settings.', cls: 'private-hub-url-hint' });
		}
	}

	/**
	 * Render plugin list cards
	 */
	private renderPluginList() {
		this.listContainerEl.empty();

		if (this.filteredPlugins.length === 0) {
			const emptyEl = this.listContainerEl.createDiv({ cls: 'private-hub-empty' });
			setIcon(emptyEl.createDiv({ cls: 'private-hub-empty-icon' }), 'box');
			emptyEl.createDiv({ text: 'No matching plugins found.', cls: 'private-hub-empty-text' });
			return;
		}

		const gridEl = this.listContainerEl.createDiv({ cls: 'private-hub-grid' });

		this.filteredPlugins.forEach(plugin => {
			this.renderPluginCard(gridEl, plugin);
		});
	}

	/**
	 * Render single plugin card UI
	 */
	private renderPluginCard(parentEl: HTMLElement, plugin: HubPlugin) {
		const card = parentEl.createDiv({ cls: 'private-hub-card' });
		const status = this.registryService.getPluginStatus(plugin);
		const localInfo = this.registryService.getLocalPluginInfo(plugin.id);

		// Header row with Icon and Title
		const cardHeader = card.createDiv({ cls: 'private-hub-card-header' });
		
		const iconContainer = cardHeader.createDiv({ cls: 'private-hub-card-icon' });
		setIcon(iconContainer, plugin.icon || 'plugin');

		const titleBlock = cardHeader.createDiv({ cls: 'private-hub-card-title-block' });
		
		const titleRow = titleBlock.createDiv({ cls: 'private-hub-card-title-row' });
		titleRow.createEl('span', { text: plugin.name, cls: 'private-hub-card-title' });

		// Version & Status Badges
		const metaRow = titleBlock.createDiv({ cls: 'private-hub-card-meta' });
		metaRow.createEl('span', { text: `by ${plugin.author}`, cls: 'private-hub-author' });
		metaRow.createEl('span', { text: `•  v${plugin.version}`, cls: 'private-hub-version' });

		if (status === 'update_available') {
			const updateBadge = metaRow.createEl('span', { 
				text: `Update to v${plugin.version}`, 
				cls: 'private-hub-badge badge-update' 
			});
			if (localInfo?.manifestVersion) {
				updateBadge.title = `Installed: v${localInfo.manifestVersion}`;
			}
		} else if (status === 'installed') {
			metaRow.createEl('span', { text: 'Installed', cls: 'private-hub-badge badge-installed' });
		} else if (status === 'disabled') {
			metaRow.createEl('span', { text: 'Disabled', cls: 'private-hub-badge badge-disabled' });
		}

		if (plugin.sourceType === 'github') {
			metaRow.createEl('span', { text: 'GitHub', cls: 'private-hub-badge badge-github' });
		}

		// Description
		card.createEl('p', { text: plugin.description, cls: 'private-hub-card-desc' });

		// Card Footer Actions
		const cardFooter = card.createDiv({ cls: 'private-hub-card-footer' });

		// Left side tags
		const tagsEl = cardFooter.createDiv({ cls: 'private-hub-card-tags' });
		if (plugin.tags && plugin.tags.length > 0) {
			plugin.tags.forEach(tag => {
				tagsEl.createEl('span', { text: tag, cls: 'private-hub-tag' });
			});
		}

		// Right side buttons
		const btnGroup = cardFooter.createDiv({ cls: 'private-hub-card-buttons' });

		// GitHub repo link button
		if (plugin.githubUrl) {
			const ghBtn = btnGroup.createEl('button', {
				cls: 'mod-neutral private-hub-action-btn-icon',
				title: 'View repository on GitHub'
			});
			setIcon(ghBtn, 'github');
			ghBtn.addEventListener('click', () => {
				window.open(plugin.githubUrl, '_blank');
			});
		}

		if (status === 'not_installed') {
			const installBtn = btnGroup.createEl('button', {
				text: 'Install',
				cls: 'mod-cta private-hub-action-btn'
			});
			installBtn.addEventListener('click', async () => {
				installBtn.disabled = true;
				installBtn.setText('Installing...');
				const success = await this.installerService.installOrUpdatePlugin(plugin, this.settings.requestMode);
				if (success) {
					this.applyFilters();
				} else {
					installBtn.disabled = false;
					installBtn.setText('Install');
				}
			});
		} else if (status === 'update_available') {
			const updateBtn = btnGroup.createEl('button', {
				text: 'Update',
				cls: 'mod-cta private-hub-action-btn is-update'
			});
			setIcon(updateBtn, 'arrow-up-circle');
			updateBtn.createSpan({ text: ' Update' });
			updateBtn.addEventListener('click', async () => {
				updateBtn.disabled = true;
				updateBtn.setText('Updating...');
				const success = await this.installerService.installOrUpdatePlugin(plugin, this.settings.requestMode);
				if (success) {
					this.applyFilters();
				} else {
					updateBtn.disabled = false;
					updateBtn.setText('Update');
				}
			});
		} else {
			// Installed or Disabled
			if (status === 'disabled') {
				const enableBtn = btnGroup.createEl('button', {
					text: 'Enable',
					cls: 'mod-cta private-hub-action-btn'
				});
				enableBtn.addEventListener('click', async () => {
					await this.installerService.enablePlugin(plugin.id);
					this.applyFilters();
				});
			} else {
				const disableBtn = btnGroup.createEl('button', {
					text: 'Disable',
					cls: 'private-hub-action-btn'
				});
				disableBtn.addEventListener('click', async () => {
					await this.installerService.disablePlugin(plugin.id);
					this.applyFilters();
				});
			}

			const uninstallBtn = btnGroup.createEl('button', {
				cls: 'mod-warning private-hub-action-btn-icon',
				title: 'Uninstall plugin'
			});
			setIcon(uninstallBtn, 'trash-2');
			uninstallBtn.addEventListener('click', async () => {
				if (confirm(`Are you sure you want to uninstall ${plugin.name}?`)) {
					await this.installerService.uninstallPlugin(plugin.id);
					this.applyFilters();
				}
			});
		}
	}

	/**
	 * Handle Update All action
	 */
	private async handleUpdateAll() {
		const updatePlugins = this.plugins.filter(p => this.registryService.getPluginStatus(p) === 'update_available');
		if (updatePlugins.length === 0) return;

		this.updateAllBtnEl.disabled = true;
		this.updateAllBtnEl.setText('Updating All...');

		let successCount = 0;
		for (const plugin of updatePlugins) {
			const ok = await this.installerService.installOrUpdatePlugin(plugin, this.settings.requestMode);
			if (ok) successCount++;
		}

		new Notice(`Updated ${successCount} / ${updatePlugins.length} plugins!`);
		this.applyFilters();
	}
}
