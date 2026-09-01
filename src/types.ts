export interface HubPlugin {
	id: string;
	name: string;
	author: string;
	version: string;
	minAppVersion?: string;
	description: string;
	icon?: string;
	url: string; // Base URL where manifest.json, main.js, styles.css are hosted
	readmeUrl?: string;
	githubUrl?: string; // Web URL to GitHub repository if applicable
	sourceType?: 'registry' | 'github';
	downloads?: number;
	updatedAt?: string;
	tags?: string[];
}

export interface RegistryManifest {
	updatedAt: string;
	plugins: HubPlugin[];
}

export type PluginInstallStatus = 
	| 'not_installed'
	| 'installed'
	| 'update_available'
	| 'disabled';

export interface InstalledPluginInfo {
	id: string;
	manifestVersion?: string;
	enabled: boolean;
}

export interface HubSettings {
	registryUrl: string;
	githubSources: string[];
	filterTopics: string[];
	filterPrefix: string;
	autoCheckUpdates: boolean;
	showExperimental: boolean;
	requestMode: 'default' | 'direct';
}

export const DEFAULT_SETTINGS: HubSettings = {
	registryUrl: "",
	githubSources: ["https://github.com/hatomachi"],
	filterTopics: ["obsidian-plugin", "obsidian"],
	filterPrefix: "obsidian-",
	autoCheckUpdates: true,
	showExperimental: false,
	requestMode: 'default'
};

