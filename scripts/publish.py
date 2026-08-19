#!/usr/bin/env python3
"""
Private Plugin Hub - Cross-platform Plugin Deployment Sample Tool (Python)

Usage:
    # 1. Publish single plugin from current directory:
    python3 publish.py

    # 2. Publish plugin from specific path to local Docker hub:
    python3 publish.py --plugin-dir /path/to/my-plugin --dest-hub /path/to/mock-server/hub

    # 3. Simulate remote version bump (for testing update flow):
    python3 publish.py --bump 1.0.2
"""

import os
import sys
import shutil
import json
import subprocess
import argparse
from datetime import datetime, timezone

def run_cmd(cmd, cwd=None):
    print(f"Executing: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0:
        print(f"Command failed with exit code: {res.returncode}")
        sys.exit(res.returncode)

def update_registry(hub_dir, base_url):
    plugins_dir = os.path.join(hub_dir, "plugins")
    registry_file = os.path.join(hub_dir, "registry.json")

    os.makedirs(plugins_dir, exist_ok=True)
    plugins_list = []

    for item in sorted(os.listdir(plugins_dir)):
        folder = os.path.join(plugins_dir, item)
        if os.path.isdir(folder):
            manifest_path = os.path.join(folder, "manifest.json")
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
                        "description": manifest.get("description", "Custom Obsidian Plugin"),
                        "icon": manifest.get("icon", "plugin"),
                        "url": url,
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }
                    plugins_list.append(plugin_entry)
                except Exception as e:
                    print(f"Failed to parse manifest for {item}: {e}")

    registry_data = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "plugins": plugins_list
    }

    with open(registry_file, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Registry updated! Total {len(plugins_list)} plugins registered.")

def publish_plugin(plugin_dir, dest_hub, bump_version=None, base_url="http://localhost:8888/hub"):
    manifest_path = os.path.join(plugin_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        print(f"Error: manifest.json not found in {plugin_dir}")
        sys.exit(1)

    # 1. Run build if package.json exists
    if os.path.exists(os.path.join(plugin_dir, "package.json")):
        print("🔨 Building plugin (npm run build)...")
        run_cmd("npm run build", cwd=plugin_dir)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    plugin_id = manifest.get("id")
    if not plugin_id:
        print("Error: 'id' field missing in manifest.json")
        sys.exit(1)

    version = bump_version if bump_version else manifest.get("version", "1.0.0")

    dest_plugin_dir = os.path.join(dest_hub, "plugins", plugin_id)
    os.makedirs(dest_plugin_dir, exist_ok=True)

    # Copy files
    files = ["manifest.json", "main.js", "styles.css"]
    copied = []
    for fname in files:
        src = os.path.join(plugin_dir, fname)
        if os.path.exists(src):
            dest = os.path.join(dest_plugin_dir, fname)
            shutil.copy2(src, dest)
            copied.append(fname)

    # Update manifest.json in remote if version was bumped
    if bump_version:
        remote_manifest_path = os.path.join(dest_plugin_dir, "manifest.json")
        with open(remote_manifest_path, "r+", encoding="utf-8") as f:
            m = json.load(f)
            m["version"] = bump_version
            f.seek(0)
            json.dump(m, f, indent=2)
            f.truncate()

    print(f"📦 Published '{plugin_id}' v{version} ({', '.join(copied)}) to {dest_plugin_dir}")

    # Update registry.json
    update_registry(dest_hub, base_url)

def main():
    parser = argparse.ArgumentParser(description="Publish custom plugin to Private Plugin Hub")
    parser.add_argument("--plugin-dir", default=".", help="Path to plugin root folder (default: current dir)")
    parser.add_argument("--dest-hub", default="./scripts/docker-server/hub", help="Path to server hub folder")
    parser.add_argument("--base-url", default="http://localhost:8888/hub", help="Public HTTP URL of registry")
    parser.add_argument("--bump", help="Simulate remote version bump")
    args = parser.parse_args()

    publish_plugin(args.plugin_dir, args.dest_hub, args.bump, args.base_url)

if __name__ == "__main__":
    main()
