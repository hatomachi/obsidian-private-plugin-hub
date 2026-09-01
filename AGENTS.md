# AGENTS.md - Project Context & Rules for AI Agents

このリポジトリは **Obsidian カスタムプラグイン: Private Plugin Hub (`obsidian-private-plugin-hub`)** の開発プロジェクトです。
GitHub アカウント連携によるプラグイン自動検出、Releases からの 1-Click インストール・更新、社内静的レジストリ連携機能を提供します。

AI エージェントがセッションを跨いで追加開発・バグ修正・機能拡張を行う際は、以下のルールおよび開発指針を遵守してください。

---

## 1. ビルドおよび検証用 Vault への自動反映ルール（最重要）

コード変更や機能追加を行いビルドした後は、**必ず検証用 Vault に成果物 (`main.js`, `manifest.json`, `styles.css`) をコピー** してください。

### 検証用 Vault の情報
- **パス**: `/Users/s-ikari/work/playground/test-vault`
- **プラグイン配置先**: `/Users/s-ikari/work/playground/test-vault/.obsidian/plugins/obsidian-private-plugin-hub/`

### ビルド & コピーコマンド
```bash
npm run build:vault
```
※ 個別に実行する場合:
```bash
npm run build && mkdir -p /Users/s-ikari/work/playground/test-vault/.obsidian/plugins/obsidian-private-plugin-hub && cp main.js manifest.json styles.css /Users/s-ikari/work/playground/test-vault/.obsidian/plugins/obsidian-private-plugin-hub/
```

---

## 2. コアアーキテクチャ & 設計方針

1. **GitHub Token不要（Unauthenticated API）アーキテクチャ**
   - リポジトリ探索は `https://api.github.com/users/{username}/repos`（または `/orgs/`）で 1 ユーザーあたり **たった 1 回** の API コールで最大 100 件取得。
   - `manifest.json` やプラグイン本体（`main.js`, `styles.css`）の取得は GitHub API を使わず、**GitHub raw CDN (`raw.githubusercontent.com`)** および **Releases Direct Download (`github.com/.../releases/latest/download/...`)** を使用（API レートリミット枠を消費しない）。
   - `GitHubRegistryService` にて 15 分間の TTL メモリキャッシュを保持。

2. **プラグイン自動検出のハイブリッド判定**
   - **GitHub Topics**: `obsidian-plugin` または `obsidian`
   - **名前プレフィックス**: `obsidian-*`
   - **Manifest 検知**: リポジトリまたは最新 Release に `manifest.json` が存在することを確認

3. **HTTP 通信とリダイレクト追従 (`HttpClient.ts`)**
   - Obsidian の `requestUrl`（Default モード）に加え、Node.js ネイティブの `nodeDirectRequest`（Direct モード / プロキシ迂回）でも HTTP 301/302/307/308 リダイレクト（GitHub Releases CDN への遷移）を最大 5 回まで追従する。

4. **1-Click インストール・ホットリロード (`InstallerService.ts`)**
   - `.obsidian/plugins/{id}/` に直接配置後、Obsidian 内部 API (`app.plugins`) を通じてリロード・有効化を行う。

---

## 3. 主要ファイル構成

- `src/types.ts`: データ構造定義（`HubPlugin`, `HubSettings`, `PluginInstallStatus` など）
- `src/services/GitHubRegistryService.ts`: GitHub リポジトリ探索・プラグイン判定・メタデータ取得
- `src/services/RegistryService.ts`: GitHub ソースと中央 `registry.json` の統合集約
- `src/services/HttpClient.ts`: リダイレクト対応 HTTP クライアント
- `src/services/InstallerService.ts`: プラグインのダウンロード・配置・ホットリロード・アンインストール
- `src/views/MarketModal.ts`: プラグイン一覧・検索・タブ切り替え・インストール/アップデート UI
- `src/views/SettingTab.ts`: 設定タブ UI（GitHub ソース入力、接続テスト、トピック/プレフィックス設定）
- `src/main.ts`: プラグインエントリポイント（リボンアイコン、コマンド、起動時更新チェック）
