# jikko

jikko は、`今やるべきことを 1 件に絞って着手を助ける` ローカルファーストのデスクトップアプリです。

汎用 Todo アプリのように情報を並べることより、次の 1 手を迷わず選べることを優先します。  
タスクを OODA の流れで扱い、`observe -> orient -> act -> done` の中核ループを軽く回し続けることを目標にしています。

## 何をするアプリか

jikko の約束は次です。

- 今やるべきことを 1 件だけ前に出す
- なぜ今それをやるのかを、理解できる基準で示す
- 着手と完了の摩擦を下げる
- 完了履歴を自信と ROI の実感に変える

現在の UI は、1 画面の Svelte proto として構成されています。

- `hero`
  - いま注目している 1 件を表示し、ROI・見積もり時間・メモ・開始/完了を扱う
- `observe dock`
  - まだ意味づけ前のタスク置き場
- `rank dock`
  - orient 済みタスクを優先順位順に並べる

## 現在の技術構成

- Desktop runtime: `Tauri`
- Frontend: `Svelte 4` + `TypeScript` + `Vite`
- Styling: カスタム CSS
- Persistence: `SQLite` + `Drizzle ORM`
- Validation: `Zod`
- Tests: `Vitest` + `Playwright`
- Analysis helper: `Python` を Tauri 経由で単発実行

Web で起動したときは `localStorage`、Tauri で起動したときは `SQLite` を使います。

## 中核ループ

1. タスクを追加する `observe`
2. ROI と見積もり時間を与える `orient`
3. 優先順位を計算して、今やるべき 1 件を選ぶ
4. 着手する `act`
5. 完了または時間切れを記録する
6. 履歴を次の判断に返す

優先順位計算は決定論的です。現行の主入力は次の 2 つです。

- `roiScore` - 1 から 5
- `estimatedMinutes` - `10 / 25 / 45 / 90`

詳細な設計意図は [DESIGN.md](/Users/f42/dev/jikko.v/DESIGN.md) と [BRIDGE.md](/Users/f42/dev/jikko.v/BRIDGE.md) を参照してください。

## 主要ファイル

```text
src/
  app/
    App.svelte        # 現行 UI
    proto-state.ts    # Svelte stores と状態遷移
  domain/
    tasks/            # Task 型と生成
    scoring/          # 優先順位計算
    planning/         # 次にやる 1 件の選定
    history/          # 履歴集計
    analysis/         # 見積もり差分分析
  infra/
    db/               # SQLite / Drizzle
    system/           # Tauri と補助プロセス連携
src-tauri/
  src/main.rs         # デスクトップホスト
```

設計と実装の対応づけは [TECH_STACK.md](/Users/f42/dev/jikko.v/TECH_STACK.md) にまとめています。

## セットアップ

前提:

- Node.js
- npm
- Rust
- Cargo

依存を入れます。

```bash
npm install
```

## 開発コマンド

Web 開発サーバ:

```bash
npm run dev
```

Tauri アプリ起動:

```bash
npm run tauri dev
```

ビルド:

```bash
npm run build
```

unit test:

```bash
npm test
```

E2E test:

```bash
npm run e2e
```

Playwright のブラウザが未導入なら、最初に次が必要です。

```bash
npx playwright install
```

## 現状の注意点

- 現行 UI は Svelte proto で、まず中核ループの速さと透明性を優先している
- DB スキーマには旧設計由来の列が一部残っているが、現行の domain 型では使わない値がある
- Python 補助分析は補助であり、優先順位決定の本体は TypeScript 側に残している
- 複数ユーザ、クラウド同期、認証、ブラックボックスな AI 優先順位付けは v1 の対象外

## 参照文書

- [BRIDGE.md](/Users/f42/dev/jikko.v/BRIDGE.md)
  - agent 向けの判断ガイドと実装マップ
- [DESIGN.md](/Users/f42/dev/jikko.v/DESIGN.md)
  - プロダクトビジョンと UX 原則
- [TECH_STACK.md](/Users/f42/dev/jikko.v/TECH_STACK.md)
  - 採用技術、モジュール構成、データモデル
- [notes/tauri.md](/Users/f42/dev/jikko.v/notes/tauri.md)
  - Tauri 実装メモ
