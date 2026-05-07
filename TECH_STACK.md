# jikko 技術スタック

## 採用スタック

| 役割 | 採用技術 |
|---|---|
| アプリ実行基盤 | Tauri |
| フロントエンド | Svelte 4 + TypeScript + Vite |
| スタイリング | カスタム CSS |
| DB | SQLite |
| DB レイヤー | Drizzle ORM |
| バリデーション | Zod |
| 状態管理 | Svelte stores（writable / derived） |
| 単体・結合テスト | Vitest |
| E2E テスト | Playwright |
| 補助分析プロセス | Python（Tauri 経由の単発実行） |

> package.json に React 依存が残っているが、現在のビルドターゲットは Svelte のみ。React 関連依存は整理予定。

## 採用理由

**Tauri** — ローカルアプリとしての配布・SQLite 連携・OS 連携に最適。認証不要・ローカルファースト前提に整合する。将来の通知・バックアップ・ファイル操作への拡張もしやすい。

**Svelte** — 実装量が少なく、状態の流れが直接的。`今この 1 件` に集中する画面構造との相性が良い。React からの移行は、task-store 一極集中の解消と UI 実装量の削減を主目的として実施した。

**SQLite + Drizzle** — 単独利用・ローカル保存に最適。抽象化が過剰にならず、スキーマと SQL の見通しを保ちやすい。

## モジュール構成

```
src/
├── app/
│   ├── App.svelte        # メイン UI（現行 proto、単一ファイル）
│   └── proto-state.ts    # Svelte stores（状態管理の本体）
├── domain/
│   ├── tasks/            # Task 型定義・ファクトリ・状態遷移
│   ├── scoring/          # 優先順位計算・スコア内訳
│   ├── planning/         # 次タスク選定
│   ├── history/          # 完了履歴・指標集計
│   └── analysis/         # 見積もり差分診断・補助プロセス連携
├── infra/
│   ├── db/               # SQLite スキーマ・Repository・マイグレーション
│   └── system/           # Tauri 連携・補助プロセス呼び出し
└── state/                # React 版の残骸。移行完了後に削除予定
```

`domain/` と `infra/` は UI フレームワークに依存しない純粋な TypeScript 層。UI が変わっても再利用できる。

## データモデル

### Task（domain 型が真実）

```ts
type Task = {
  id: string
  title: string
  status: "observe" | "orient" | "act" | "done" | "archived"
  parentTaskId: string | null
  observeMemo: string
  orientMemo: string
  roiScore: number | null      // 1〜5
  estimatedMinutes: number | null  // 10 / 25 / 45 / 90
  actStartedAt: string | null
  actDueAt: string | null
  progressNote: string
  createdAt: string
  updatedAt: string
}
```

DB スキーマ（`src/infra/db/schema.ts`）には旧設計の属性（urgency / impact / penaltyOfDelay 等）が残っているが、domain 型では使わない。スキーマの整理は別途行う。

### TaskEvent（イベント型）

```
created | oriented | reoriented | act_started | act_timed_out | completed
```

## 状態管理

Svelte stores で 3 層に分離する。

1. **永続状態** — SQLite に保存（`tasksRepository` 経由）
2. **セッション状態** — `state` writable store（tasks・events・weights）
3. **導出状態** — derived stores（`observeTasks` / `orientTasks` / `activeTask` / `recommendation`）

状態の真実は SQLite に置く。Svelte stores はセッション中のキャッシュ。

## スコアリングエンジン

`src/domain/scoring/engine.ts` に実装。

```ts
effortPenalty = max(1, estimatedMinutes / 25)
priorityScore = roiScore * weights.roi - effortPenalty * weights.effortPenalty
expectedRoi   = roi / max(effortPenalty, 0.5)
```

ランキング対象：`status === "orient"` かつ `roiScore` と `estimatedMinutes` が非 null のタスク。

## 補助分析プロセス（Python）

- TypeScript → Tauri → Python の単発実行
- 履歴診断・ROI 差分分析・将来の最適化計算に限定
- Python が失敗しても UI は止まらない（TypeScript 側がフォールバック）
- 優先順位決定の本体は TypeScript に残す

## テスト

- **Vitest** — ドメインロジック（scoring / tasks / history / analysis）の自動検証
- **Playwright** — 中核ループの UI 動作検証（タスク追加・着手・完了・履歴反映）

## 対象外（v1）

- 複数ユーザ・クラウド同期・認証
- モバイルネイティブ
- マイクロサービス分割
- リアルタイム共同編集
- 重い通知ルールエンジン
- ブラックボックスな AI 優先順位決定
