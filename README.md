# Obsidian Private Plugin Hub 🔌

An internal/private plugin marketplace for Obsidian, replicating the official Community Plugins UI for seamless distribution and 1-click updates of non-community custom plugins within your team or company.

---

## ✨ Key Features

- **GitHub Auto-Discovery (No Token Required)**: Simply specify GitHub usernames or URLs (e.g., `https://github.com/hatomachi`). Public Obsidian plugins are automatically discovered via GitHub Topics or repository naming conventions.
- **Direct GitHub Releases Install**: Download and install `manifest.json`, `main.js`, and `styles.css` directly from GitHub Releases with 1-click.
- **Official UI Replica**: Search, filter tabs (`All`, `Installed`, `Updates`), tags, and status badges matching official Obsidian community plugin browser.
- **1-Click Install & Update**: Download, install, enable, disable, or uninstall custom plugins with a single click.
- **Hot Reloading**: Automatically reloads updated plugins dynamically without restarting Obsidian.
- **Bulk Updates**: **"Update All"** button for updating all custom plugins at once.
- **Flexible Backend**: Supports GitHub accounts/organizations as well as static file servers (Nginx, Caddy, S3, Docker).
- **Automated Deployment**: Cross-platform deployment tools (`publish.py` and `publish.ps1`).

---

## 🚀 Client Installation & Setup Guide

1. Download the latest `obsidian-private-plugin-hub.zip` from [GitHub Releases](https://github.com/hatomachi/obsidian-private-plugin-hub/releases).
2. Extract into your vault's plugin directory:
   ```text
   .obsidian/plugins/obsidian-private-plugin-hub/
   ```
3. Open Obsidian, go to **Settings -> Community plugins**, turn off Restricted mode, and enable **Private Plugin Hub**.
4. Open **Settings -> Private Plugin Hub** and configure your sources:
   - **GitHub Sources (Recommended)**: Enter your GitHub username or URL (e.g. `https://github.com/hatomachi`). No personal access token is required.
   - **Optional Central Registry**: Enter your static `registry.json` URL if your team hosts plugins on a private server.
5. Click the **Private Plugin Hub** icon in the left ribbon or run command `Open Private Plugin Hub` from the Command Palette (`Cmd/Ctrl + P`).

---

## 🏷️ How to Flag / Publish Your Plugin Repositories on GitHub

To make your custom Obsidian plugins discoverable by Private Plugin Hub:

1. **Add GitHub Topics (Recommended)**: In your GitHub repository's **About** section (gear icon on the right), add topic tag `obsidian-plugin` or `obsidian`.
2. **Or Use Naming Prefix**: Name your repository starting with `obsidian-` (e.g. `obsidian-todo-calendar`).
3. **Publish Releases**: Create a GitHub Release attaching `manifest.json`, `main.js`, and optionally `styles.css` (or use GitHub Actions release workflow).


---

## 🐳 Server Setup Guide (Docker & Nginx)

For complete instructions on setting up a CORS-enabled Nginx static file server using Docker, see [docs/SERVER_SETUP.md](docs/SERVER_SETUP.md).

Quick start with Docker Compose:
```bash
cd scripts/docker-server
docker compose up -d
```

---

## 📦 Developer Deployment (1-Command Publish)

### Cross-platform Python Script (`scripts/publish.py`)
Run from your custom plugin project directory to build and deploy to your remote/local hub:

```bash
# Publish plugin from current directory
python3 scripts/publish.py --dest-hub /path/to/server/hub --base-url http://your-server:8888/hub

# Simulate version bump (e.g., test update flow)
python3 scripts/publish.py --bump 1.0.2
```

---

## 🛠️ Building from Source

```bash
# Install dependencies
npm install

# Production build
npm run build
```

---

## 📄 License
MIT License
