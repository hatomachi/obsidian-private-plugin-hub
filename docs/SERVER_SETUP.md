# Docker を使った自作リモートレジストリサーバーの構築ガイド 🐳

Private Plugin Hub で自作プラグインを配信するための静的ファイルサーバー（Nginx + CORS対応）を Docker で簡単に立ち上げる手順です。

---

## 📁 1. ディレクトリ構造

サーバー上に以下のディレクトリ構造を作成します。

```text
mock-server/
├── docker-compose.yml
├── nginx.conf
└── hub/
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

---

## ⚙️ 2. 設定ファイル

### `docker-compose.yml`
```yaml
services:
  private-plugin-hub-server:
    image: nginx:alpine
    container_name: private-plugin-hub-server
    ports:
      - "8888:80"  # 外部ポート:内部80
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./hub:/usr/share/nginx/html/hub
    restart: always
```

### `nginx.conf` (CORS許可設定必須)
Obsidianアプリ（クライアント）からの `requestUrl` や `fetch` を許可するため、CORSヘッダーを追加します。

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html registry.json;

        # CORS Headers for Obsidian API
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
```

---

## 🚀 3. サーバーの起動

```bash
docker compose up -d
```

起動後、ブラウザや `curl` でアクセス確認します：
```bash
curl http://localhost:8888/hub/registry.json
```

---

## 🔄 4. `registry.json` の全自動生成

サーバーの `hub/plugins/` 配下にプラグインフォルダを追加したら、以下の `update_registry.py` を実行するだけで `registry.json` が最新化されます。

```bash
python3 scripts/docker-server/update_registry.py --hub-dir ./hub --base-url http://your-server-ip:8888/hub
```
