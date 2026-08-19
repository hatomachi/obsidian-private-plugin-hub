#!/usr/bin/env python3
"""
Private Plugin Hub - Remote Registry Auto-Generator
Scans /hub/plugins/* for manifest.json files and builds registry.json
"""

import os
import json
import argparse
from datetime import datetime, timezone

def generate_registry(hub_dir, base_url):
    plugins_dir = os.path.join(hub_dir, "plugins")
    registry_file = os.path.join(hub_dir, "registry.json")

    if not os.path.exists(plugins_dir):
        os.makedirs(plugins_dir, exist_ok=True)

    plugins_list = []

    for item in sorted(os.listdir(plugins_dir)):
        plugin_folder = os.path.join(plugins_dir, item)
        if os.path.isdir(plugin_folder):
            manifest_path = os.path.join(plugin_folder, "manifest.json")
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        manifest = json.load(f)

                    plugin_id = manifest.get("id", item)
                    url = f"{base_url.rstrip('/')}/plugins/{plugin_id}/"

                    plugin_entry = {
                        "id": plugin_id,
                        "name": manifest.get("name", plugin_id),
                        "author": manifest.get("author", "Unknown"),
                        "version": manifest.get("version", "1.0.0"),
                        "minAppVersion": manifest.get("minAppVersion", "0.15.0"),
                        "description": manifest.get("description", ""),
                        "icon": manifest.get("icon", "plugin"),
                        "url": url,
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }

                    # Optional custom meta override
                    meta_path = os.path.join(plugin_folder, "meta.json")
                    if os.path.exists(meta_path):
                        with open(meta_path, "r", encoding="utf-8") as mf:
                            meta = json.load(mf)
                            plugin_entry.update(meta)

                    plugins_list.append(plugin_entry)
                    print(f"[+] Loaded plugin: {plugin_entry['name']} v{plugin_entry['version']}")
                except Exception as e:
                    print(f"[-] Error reading manifest in {plugin_folder}: {e}")

    registry_data = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "plugins": plugins_list
    }

    with open(registry_file, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Successfully generated registry.json with {len(plugins_list)} plugins at {registry_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate registry.json for Private Plugin Hub")
    parser.add_argument("--hub-dir", default="./hub", help="Path to base hub directory")
    parser.add_argument("--base-url", default="http://localhost:8888/hub", help="Public HTTP URL of hub")
    args = parser.parse_args()

    generate_registry(args.hub_dir, args.base_url)
