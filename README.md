# jikko

jikko は、単なる Todo アプリではなく、`今やるべきことを明確にし、納得感のある理由とともに着手を支援する` ためのローカルファーストアプリです。

このリポジトリには、v1 の技術要件に沿った `Tauri + React + TypeScript + SQLite` ベースの土台実装が入っています。

## 現在の状態

現時点では、次の土台が実装されています。

- `Tauri` によるデスクトップアプリ基盤
- `React + TypeScript + Vite` によるフロントエンド
- `Tailwind CSS` による UI スタイリング
- `SQLite + Drizzle ORM` を前提とした DB スキーマ
- 決定論的な優先順位エンジンの初版
- `Now / Inbox / Plan / History / Settings` の主要画面骨格
- `Vitest` による優先順位ロジックのテスト
- `Playwright` の E2E 雛形

ただし、現状の UI はまだ `seedDemoData` を利用して動く段階です。永続 DB との完全接続は次の実装フェーズです。

## 設計文書

このリポジトリでは、次の文書を基準にしています。

- [TECH_STACK.md](./TECH_STACK.md)
  - 正式な技術要件定義書
- [design_01.md](./design_01.md)
  - v1 の設計図
- [BRIDGE.md](./BRIDGE.md)
  - ユーザ意図と実装判断をつなぐための運用文書
- [jikko.md](./jikko.md)
  - プロダクトの原案メモ

## 採用技術

v1 の正式採用技術は次です。

- Runtime: `Tauri`
- Frontend: `React` + `TypeScript` + `Vite`
- UI: `Tailwind CSS`
- Database: `SQLite`
- DB layer: `Drizzle ORM`
- Validation: `Zod`
- Forms: `React Hook Form`
- State management: `Zustand`
- Charts: `Recharts`
- Testing: `Vitest` + `Playwright`

## ディレクトリ構成

主要構成は次です。

```text
src/
  app/
    components/
    screens/
  domain/
    tasks/
    scoring/
    history/
    planning/
  infra/
    db/
    system/
  state/
src-tauri/
  src/
  capabilities/
```

責務は次のとおりです。

- `src/app`
  - 画面、レイアウト、UI コンポーネント
- `src/domain`
  - 中核ロジック
- `src/infra`
  - DB、Tauri 連携、外部境界
- `src/state`
  - セッション状態と導出状態
- `src-tauri`
  - デスクトップホスト、SQLite 実行、アプリ設定

## セットアップ

前提:

- Node.js
- npm
- Rust
- Cargo

依存インストール:

```bash
npm install
```

## 開発コマンド

Web フロントの開発サーバ:

```bash
npm run dev
```

Tauri アプリの起動:

```bash
npm run tauri dev
```

フロントエンドのビルド:

```bash
npm run build
```

単体テスト:

```bash
npm test
```

E2E テスト:

```bash
npm run e2e
```

Drizzle のコード生成:

```bash
npm run db:generate
```

Drizzle マイグレーション:

```bash
npm run db:migrate
```

## 実装済みの主な要素

### 1. 優先順位エンジン

`src/domain/scoring/engine.ts` に、決定論的なスコア計算の初版があります。

現在の入力要素:

- urgency
- impact
- penaltyOfDelay
- momentumGain
- effortEstimate
- emotionalResistance
- energyRequired

出力:

- `priorityScore`
- `expectedRoi`
- `whyNowSummary`

### 2. 主要画面

現在の主要画面は次です。

- `Now`
  - 今やるべきタスクを 1 件提示
- `Inbox`
  - タスク追加
- `Plan`
  - ランキング一覧
- `History`
  - 完了数、擬似 ROI、トレンド表示
- `Settings`
  - スコア重みの編集

### 3. Tauri ホスト

`src-tauri/src/main.rs` では、次を行っています。

- ローカル SQLite ファイルの初期化
- 必要テーブルの作成
- SQL 実行用コマンドの公開

## 現在の制約

現時点では、次はまだ未完成です。

- UI と SQLite 永続化の本接続
- `task_events` と `task_score_snapshots` の完全保存
- 実データに基づく履歴分析
- ローカル通知
- バックアップ/エクスポート
- AI 補助機能

つまり、`設計に沿った骨格は揃っているが、永続化と中核ループの配線はまだ途中` です。

## 確認済みのこと

このリポジトリでは、次の確認を実施済みです。

- `npm test`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

## 次にやること

優先度の高い次工程は次です。

1. `task-store` を seed 依存から SQLite 永続化へ切り替える
2. `task_events` と `task_score_snapshots` を実保存する
3. `Now` 画面の推奨結果を DB ベースで再計算する
4. 完了イベントと `History` を実データ接続する
5. `npm run tauri dev` で実運用に近い流れを固める

## 方針

jikko は、SaaS 前提ではなく `自分専用のローカルアプリ` として始めます。

そのため、初期フェーズでは次を優先します。

- 認知負荷を減らすこと
- 信頼できる優先順位を出すこと
- 着手しやすくすること
- 完了の積み上げを見えるようにすること

複数ユーザ対応、認証、クラウド同期、ブラックボックスな AI 優先順位付けは v1 の対象外です。
