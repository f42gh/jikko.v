# jikko ブリッジ

## 目的

このファイルは、ユーザの意図と実装判断をつなぐための agent 向け操作ガイドです。

agent はこのファイルを使って、次を行うこと。

- ユーザの依頼の奥にある本当の目的を推論する
- 曖昧または危険な実装前提に対して問い直す
- プロダクト判断と技術判断の整合を保つ
- 技術選定をユーザが納得できる形で説明する

## 言語ルール

- ユーザが読む文は日本語で書く
- agent 専用の内部メモだけ英語を許容する

## プロダクトの核

jikko は汎用的な Todo アプリではありません。

中核となる約束は次です。

- ユーザの認知負荷を最大限下げる
- ユーザに「今やるべきこと」を提示する
- なぜ今そのタスクをやる価値があるのかを説明する
- 実際に着手し、完了できる確率を高める
- 完了履歴を自信・報酬・長期的なリターンの実感へ変換する

## 現在のプロダクト前提

これらの前提は、実装判断よりも優先して扱うこと。

- 当面のユーザは 1 人だけである
- v1 では認証は不要である
- データは各ユーザがローカルで保持・管理する
- システムは認知負荷の最小化を最優先する
- タスクは実行可能な最小単位まで分割されるべきである
- タスク分解そのものがプロダクトループの一部であり、OODA の Observe に相当する

## 依頼から推論すべきこと

ユーザが機能を要求したとき、それを単純な CRUD 要求として扱わないこと。

必ず、その要求が次のどれに影響するかを確認すること。

- 優先順位決定の質
- 説明への信頼
- タスク着手のしやすさ
- タスク完了のしやすさ
- 迷いと意思決定疲れの削減
- 進捗と報酬の可視化による長期継続

## 問い直しの観点

依頼の粒度が粗い場合は、次の観点で実装対象を整理すること。

- この機能は、今やるべきことの判断に本当に役立つか
- 認知負荷を減らすか、それとも判断項目を増やすか
- ユーザが信頼できるだけの決定論性と説明可能性があるか
- 今実装すべきか、それとも中核ループ完成後に回すべきか
- プロダクト価値のための機能か、それとも単に作りやすいだけの機能か

中核ループを強化しない機能には、必要に応じて異議を唱えること。

## 守るべき中核ループ

最優先のループは次です。

1. タスクを入力または分解する
2. 文脈と重みづけを見積もる（roiScore / estimatedMinutes）
3. 今やるべきタスクを順位付けして選ぶ
4. 推奨理由を誠実かつ納得感のある形で説明する
5. 着手しやすい状態まで誘導する
6. 完了・報酬・結果を記録する
7. 進捗を自信と ROI としてユーザへ返す

新機能がこのループを弱めるなら、再検討すること。

## OODA 状態機械

Task の status は OODA の正式なライフサイクルとして扱う。

- **observe** — 置き場。入力は title と observeMemo だけ。ランキング対象外
- **orient** — 意味づけの段階。roiScore と estimatedMinutes をここで決める
- **act** — 実行中。actStartedAt と actDueAt を持つ。同時に 1 件だけ
- **done** — act を経由したタスクだけが到達できる

「decide」は永続 status ではなく、orient タスクのランキング処理として実装する。

actDueAt を過ぎたタスクは `act_timed_out` イベントを残して orient に戻す。失敗ではなく再見積もりの入口。

## 実装マップ

### 画面・UI を変えたいとき

- `src/app/App.svelte`
  - observe dock（キャプチャ入力・タスク一覧）、hero（タスク詳細・ボタン）、rank dock（ランキング）が変わる
  - act / 非 act の条件分岐、カウントダウン、ROI/時間ダイヤルの見せ方が変わる

### 状態・データフローを変えたいとき

- `src/app/proto-state.ts`
  - Svelte stores の定義、各アクション関数（addTask / saveOrientation / startTask / completeTask / timeoutTask）が変わる
  - 起動時の reconcile（期限切れ act の復帰）もここ

### 優先順位ロジックを変えたいとき

- `src/domain/scoring/engine.ts` — priorityScore / expectedRoi / whyNowSummary の計算
- `src/domain/scoring/defaults.ts` — weights の基本値
- `src/domain/scoring/types.ts` — スコアリングで扱う構造
- `src/domain/planning/select-next.ts` — ランキング上位から最終 1 件を選ぶロジック

優先順位ロジックを変えると、hero の推奨タスク・rank dock の順序・recommendation が同時に変わる。

### タスクの構造を変えたいとき

- `src/domain/tasks/types.ts` — Task 型・バリデーション・入力型
- `src/domain/tasks/factory.ts` — 新規作成時の初期値
- `src/infra/db/schema.ts` — SQLite の永続化構造

task 属性を変える場合は、スコアリング・DB スキーマ・proto-state のアクション関数を同時に見直すこと。

### 履歴・分析を変えたいとき

- `src/domain/history/metrics.ts` — 完了数・ROI などの集計ロジック
- `src/domain/analysis/metrics.ts` — 見積もり差分・補正候補の生成
- `src/domain/analysis/suggestions.ts` — 補正提案の生成
- `src/infra/system/analysis-helper.ts` — Python 補助プロセスへの橋渡し

Analysis は単なるダッシュボードではない。目的は判断の質を後から点検して、次の ROI 設定とタスク選定を少し良くすること。

### DB を変えたいとき

- `src/infra/db/schema.ts` — SQLite 上の保存構造
- `src/infra/db/client.ts` — DB 接続
- `src/infra/db/repositories/tasks-repository.ts` — 永続化 API
- `drizzle.config.ts` — マイグレーション設定

DB スキーマを変える場合は、`domain/tasks/types.ts` と `proto-state.ts` のアクション関数も必ず追随させること。

### Tauri / ローカルアプリ挙動を変えたいとき

- `src-tauri/src/main.rs` — SQLite 初期化・Tauri commands・ローカル挙動
- `src-tauri/tauri.conf.json` — アプリ名・ウィンドウ設定・ビルド設定
- `src-tauri/capabilities/default.json` — Tauri 権限の範囲

### テストを変えたいとき

- `src/domain/scoring/engine.test.ts` — スコアリングロジックの期待値
- `src/domain/analysis/metrics.test.ts` — 見積もり差分と補正候補の期待値
- `tests/e2e/app.spec.ts` — 中核ループの UI 動作検証
- `vite.config.ts` — Vitest の対象・実行条件
- `playwright.config.ts` — E2E の実行条件

## 実装変更時の基本ルール

| 変えたいもの | 見るファイル |
|---|---|
| 画面だけ | `src/app/App.svelte` |
| 状態・アクション | `src/app/proto-state.ts` |
| 優先順位ロジック | `src/domain/scoring/*` + `src/domain/planning/*` |
| タスク構造 | `src/domain/tasks/*` + `src/infra/db/schema.ts` |
| 履歴・ROI | `src/domain/history/*` + `src/domain/analysis/*` |
| 永続化 | `src/infra/db/*` + `src-tauri/src/main.rs` |

jikko では `入力 → スコアリング → 推奨 → 完了 → 履歴` がつながっているため、局所的な修正でも影響範囲を横断確認すること。

## 技術判断の説明順序

実装判断を説明するときは、先にプロダクト上の意味から説明すること。

1. この判断がどのユーザ課題を解決するか
2. なぜ一見わかりやすい別案よりよいのか
3. どんな複雑さを避けられるのか
4. 何を後回しにできるのか

## 意思決定ルール

2 つの実装案がどちらも成立するなら、次をより満たす方を選ぶこと。

- 認知負荷をより減らせる
- より透明である
- ローカルで反復しやすい
- スコアリングロジックを検査しやすい
- 中核ループへの勢いを保てる

## v1 で避けるもの

ユーザが明示的に求め、かつ強いプロダクト上の理由がない限り、次は避けること。

- 複数人コラボレーション
- SaaS 前提の構成
- 複雑な認証フロー
- 不透明な AI ベース優先順位付け
- モバイルネイティブ先行
- マイクロサービス
- 重い実験基盤
