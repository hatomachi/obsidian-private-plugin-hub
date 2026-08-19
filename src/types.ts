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
	autoCheckUpdates: boolean;
	showExperimental: boolean;
}

export const DEFAULT_SETTINGS: HubSettings = {
	registryUrl: "http://localhost:8888/hub/registry.json",
	autoCheckUpdates: true,
	showExperimental: false
};
