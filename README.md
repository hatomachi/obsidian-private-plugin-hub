# Obsidian Private Plugin Hub 🔌

An internal/private plugin marketplace for Obsidian, replicating the official Community Plugins UI for seamless distribution and 1-click updates of non-community custom plugins within your team or company.

---

## ✨ Key Features

- **Official UI Replica**: Search, filter tabs (`All`, `Installed`, `Updates`), tags, and status badges matching official Obsidian community plugin browser.
- **1-Click Install & Update**: Download, install, enable, disable, or uninstall custom plugins with a single click.
- **Hot Reloading**: Automatically reloads updated plugins dynamically without restarting Obsidian.
- **Bulk Updates**: **"Update All"** button for updating all custom plugins at once.
- **Simple Hosting Backend**: Works with any standard static file server (Nginx, Caddy, S3, Cloudflare R2, EC2). No complex database or API required.
- **Automated Deployment**: 1-command deployment scripts for Windows (PowerShell) and macOS/Linux.

---

## 🚀 Client Installation Guide (For Team Members)

1. Download or build `manifest.json`, `main.js`, and `styles.css`.
2. Place them into your vault's plugin directory:
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

## 🛠️ Remote Server Structure & Registry Format

Host static files on Nginx or any Web server with CORS headers enabled (`Access-Control-Allow-Origin: *`).

### Remote Directory Layout
```text
https://your-server.com/hub/
  ├── registry.json
  └── plugins/
      ├── my-custom-plugin/
      │   ├── manifest.json
      │   ├── main.js
      │   └── styles.css
      └── another-plugin/
          ├── manifest.json
          ├── main.js
          └── styles.css
```

### `registry.json` Format Example
```json
{
  "updatedAt": "2026-08-19T22:00:00Z",
  "plugins": [
    {
      "id": "my-custom-plugin",
      "name": "My Custom Plugin",
      "author": "s-ikari",
      "version": "1.0.1",
      "minAppVersion": "0.15.0",
      "description": "Internal team productivity tool.",
      "icon": "sparkles",
      "url": "https://your-server.com/hub/plugins/my-custom-plugin/",
      "tags": ["productivity", "internal"]
    }
  ]
}
```

---

## 📦 Developer Deployment (1-Command Publish)

### Windows (PowerShell)
```powershell
.\scripts\publish.ps1 -ServerHost "your-ec2-domain.com"
```

### Server Side Registry Generator (Python)
Run on your remote server to auto-generate `registry.json`:
```bash
python3 scripts/update_registry.py --hub-dir /var/www/hub --base-url https://your-server.com/hub
```

---

## 🛠️ Building from Source

```bash
# Install dependencies
npm install

# Development watch mode
npm run dev

# Production build
npm run build
```

---

## 📄 License
MIT License
