# Obsidian Private Plugin Hub 🔌

An internal/private plugin marketplace for Obsidian, replicating the official Community Plugins UI for seamless distribution and 1-click updates of non-community custom plugins within your team or company.

---

## ✨ Key Features

- **Official UI Replica**: Search, filter tabs (`All`, `Installed`, `Updates`), tags, and status badges matching official Obsidian community plugin browser.
- **1-Click Install & Update**: Download, install, enable, disable, or uninstall custom plugins with a single click.
- **Hot Reloading**: Automatically reloads updated plugins dynamically without restarting Obsidian.
- **Bulk Updates**: **"Update All"** button for updating all custom plugins at once.
- **Simple Hosting Backend**: Works with any standard static file server (Nginx, Caddy, S3, Cloudflare R2, Docker). No complex database or API required.
- **Automated Deployment**: Cross-platform deployment tools (`publish.py` and `publish.ps1`).

---

## 🚀 Client Installation Guide (For Team Members)

1. Download the latest `obsidian-private-plugin-hub.zip` from [GitHub Releases](https://github.com/hatomachi/obsidian-private-plugin-hub/releases).
2. Extract into your vault's plugin directory:
   ```text
   .obsidian/plugins/obsidian-private-plugin-hub/
   ```
3. Open Obsidian, go to **Settings -> Community plugins**, turn off Restricted mode, and enable **Private Plugin Hub**.
4. Open **Settings -> Private Plugin Hub** and enter your team's central `registry.json` URL:
   ```text
   https://your-server.com/hub/registry.json
   ```
5. Click the **Private Plugin Hub** icon in the left ribbon or run command `Open Private Plugin Hub` from the Command Palette (`Cmd/Ctrl + P`).

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
