# 06. 設計哲学・DDD・クリーンアーキテクチャ・守破離

## まず一言

DDD もクリーンアーキテクチャも、採点基準ではありません。

> **「守りたい体験のために、どの複雑さを受け入れ、どの複雑さを拒否するかを決める思考補助具」**

これを忘れると、用語が増えるが体験が守られない状態になります。
Jikko にとって最悪の状態です。

---

## 1. DDD を Jikko に翻訳する

### 1.1 ユビキタス言語：すでにある

DDD の出発点は「チーム内で意味が一致した言語を作る」ことです。

Jikko にはもうあります。

| 言葉 | 意味（Jikko 固有の定義） |
|---|---|
| `observe` | 判断前の置き場。考えない。まず置く。 |
| `orient` | 価値とコストが決まった、判断可能な状態 |
| `act` | 実行中。時間がカウントされる。1件だけ。 |
| `done` | act を経由した完了。実行なき完了は存在しない |
| `roiScore` | ユーザが自分で設定する価値評価（1〜5）|
| `estimatedMinutes` | ユーザが自分で設定するコスト見積もり |
| `recommendation` | 「今やるべき1件」とその理由を持つオブジェクト |
| `act_timed_out` | 時間切れ。失敗ではなく再観察の入口 |
| `whyNowSummary` | 推薦理由の文字列。説明責務の体現 |

**DDD の第一歩は、この言葉の意味をぶらさないことです。**

「todo」「task」「item」などの汎用語でコードを書き始めると、
すぐに「これはtodoのどの段階？」と迷い始めます。
Jikko では `observe`・`orient`・`act`・`done` が言語の核です。

### 1.2 エンティティとバリューオブジェクト

DDD の区別：
- **エンティティ**：同一性（ID）で区別される。状態が変わっても同じもの。
- **バリューオブジェクト**：値で定義される。コピーしても同じ。

Jikko で言うと：

| 概念 | 種別 | 理由 |
|---|---|---|
| `Task` | エンティティ | ID で区別される。observe から done まで同じタスク |
| `TaskEvent` | エンティティ | ID で区別される記録 |
| `Recommendation` | バリューオブジェクト | task + スコアのスナップショット |
| `ScoreWeights` | バリューオブジェクト | 値の組み合わせ |

`Recommendation` はバリューオブジェクトです。
同じ `task` と `weights` から再計算すれば同じ値が出る（決定論的）。
保存する必要はなく、いつでも再計算できます。

### 1.3 集約（Aggregate Root）

DDD の集約：一貫性の境界。外からは集約ルートを通じてしかアクセスできない。

Jikko では `Task` が集約ルートです。

- `TaskEvent` は `Task` にひもづく履歴
- 状態変化は必ず `Task` の操作を通じて行われる（`applyOrientTask` など）
- `TaskEvent` を直接操作することはない

現在の実装は「明示的な集約」として厳格に閉じているわけではありませんが、
概念上の中心が `Task` であることは一貫しています。

### 1.4 境界づけられた文脈（Bounded Context）

Jikko には少なくとも4つの文脈があります：

```
┌─────────────────────┐  ┌─────────────────────┐
│  Task Lifecycle     │  │  Scoring / Planning  │
│                     │  │                     │
│  observe/orient/act │  │  rankTasks          │
│  /done の状態機械   │  │  selectNextTask      │
│  + TaskEvent        │  │  Recommendation      │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│  History / Analysis │  │  Persistence        │
│                     │  │                     │
│  buildHistoryMetrics│  │  schema             │
│  buildAnalysisMetrics│ │  repository         │
│  buildSuggestions   │  │  TaskEvent の保存   │
└─────────────────────┘  └─────────────────────┘
```

今は 1 人用のローカルアプリなので、無理に分割する必要はありません。
しかし「文脈の違い」を意識するだけで、責務の混線は大幅に減ります。

---

## 2. クリーンアーキテクチャを Jikko に翻訳する

クリーンアーキテクチャの本質：**重要なものを外側の都合から守る。**

```
                    ┌─────────────────┐
                    │   domain/        │ ← 最も内側（最も守るべき）
                    │  tasks/types.ts  │
                    │  scoring/engine  │
                    │  planning/       │
                    └────────┬────────┘
                             │ 依存方向（内→外はNG）
              ┌──────────────▼──────────────┐
              │   app/ (application層)       │
              │   proto-state.ts            │
              │   (本来はここに application  │
              │    service が独立すべき)     │
              └──────────────┬──────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │   infra/                             │
          │   tasks-repository.ts (adapter)      │
          │   tauri.ts (adapter)                 │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │   外部システム                        │
          │   SQLite / localStorage / Tauri      │
          │   Python helper                      │
          └─────────────────────────────────────┘
```

**依存の方向は一方向：外側が内側に依存する。内側は外側を知らない。**

現在の Jikko はこの方向を守っています：

- `domain/tasks/types.ts` は Svelte も Drizzle も知らない
- `domain/scoring/engine.ts` は localStorage も SQLite も知らない
- `infra/db/schema.ts` は domain 型を `import` しない（逆は `import` する）

足りないのは `application layer` の明示だけです。
現在は `proto-state.ts` がその役を兼務しています。

### 現状の正直な評価

```
✅ domain の独立性：良い
✅ infra の adapter 役割：良い
✅ 依存方向：正しい方向
⚠️ application layer：proto-state.ts に混在（過渡期）
⚠️ domain 操作関数：proto-state.ts に定義（将来は domain/ に移すべき）
```

---

## 3. よりよいソフトウェアとは何か

よくある誤解：
- ファイル数が多い = 良い設計
- 抽象クラスがある = 良い設計
- ディレクトリが綺麗 = 良い設計

**本当に大事な4つ：**

### 3.1 意味が壊れにくい

小さな変更でドメインの約束が崩れないこと。

Jikko で言えば：「act を追加したら、既存の act が自動的に orient に戻る」という
不変条件が `ensureNotAct` で保証されている。
新しいコードがここを呼ばないと不変条件が崩れる。

### 3.2 読んだときに意図が追える

なぜこの構造なのかを、未来の自分が説明できること。

Jikko で言えば：`select-next.ts` がなぜ 1 行なのかを説明できること。
（答え：scoring と最終選定の責務を分けているから。将来の選定戦略の追加に備えて。）

### 3.3 誤りが局所化する

ミスしたときに、被害範囲が読めること。

Jikko で言えば：スコアリングのバグは `engine.ts` に閉じる。
`proto-state.ts` のバグはセッション状態の更新に閉じる。
`schema.ts` の変更は `tasks-repository.ts` の変換関数に影響する。

### 3.4 進化の余地がある

今は未完成でも、次の一手を打ちやすいこと。

`select-next.ts` が 1 行だからこそ、ここを膨らませて選定戦略を追加できます。
`whyNowSummary` が文字列だからこそ、中身だけを改善できます。

---

## 4. 守破離

### 守（まず守る）

「守」は模倣ではなく、**不変条件を体に入れること**です。

Jikko で守るべき不変条件：

```typescript
// 1. observe はランキング対象外
rankTasks: タスクを filter して status === "orient" のみ対象

// 2. act は同時に 1 件だけ
startTask: ensureNotAct(item) で他の act を外す

// 3. done は act を経由する
completeTask: task.status !== "act" なら return

// 4. orient してから act
startTask: task.status !== "orient" なら return

// 5. スコアは決定論的
scoreTask: 同じ入力 → 同じ出力（ランダム・AI なし）
```

これらをコードから読み取って、自分の実装でも守れる状態になること。
それが「守」の達成です。

### 破（根拠を持って壊す）

「破」は改善です。何かを壊すことではなく、**不変条件を保ったまま弱い部分を強化すること**。

壊してよいものの例：

```
proto-state.ts の責務過多
  → application service を分離
  → ただし「addTask は observe から始まる」という不変条件は守る

App.svelte の肥大化
  → boot panel を分離
  → ただし「hero が recommendation を前面に出す」という動作は守る

DB schema の旧列
  → 段階的に削除
  → ただし既存データが失われないことは守る

whyNowSummary の単純さ
  → 3層説明に強化
  → ただし決定論的であることは守る
```

「破」において核を壊してしまうと、それは設計改善ではなく解体です。

### 離（自分の言葉で判断する）

「離」は、この repo の形に縛られない段階です。

- あなた自身が「observe / orient / act / done のどこが Jikko の核か」を説明できる
- あなた自身が「なぜ AI に委ねないか」を自分の言葉で語れる
- あなた自身が「priorityScore の式を変えるべき状況」を判断できる

この段階で初めて「自分の Jikko」になります。

---

## 5. 設計の悪い抽象化と良い抽象化

### 悪い抽象化

```
❌ 実体のない service 名（TaskManagementService など）
❌ まだ安定していない責務の無理な分離
❌ domain の都合ではなくフレームワーク都合の命名
❌ "将来のため" と言いながら現在を読みにくくする抽象化
❌ 抽象クラスの過剰な使用（TypeScript では interface で十分なことが多い）
```

### 良い抽象化

```
✅ OODA の状態境界（observe/orient/act/done の明確な区別）
✅ scoring と planning の分離（評価と最終選定の責務分離）
✅ domain と persistence の変換境界（mapTaskRecord / parseTaskRow）
✅ runtime 差分を isTauriRuntime() に閉じ込めること
✅ factory 関数による初期化の規律化（createObservedTask）
```

**良い抽象化は、意味に沿った分離です。**
見た目のカテゴリ分けではなく、変更理由が同じもの・違うものを分けます。

---

## 章末の鍛錬課題

### 課題 1：ユビキタス言語の定義

Jikko のユビキタス言語を 8 個挙げ、それぞれを「Jikko 固有の意味」で定義してください。
汎用の定義ではなく、「Jikko では」という限定で書くことが大事です。

### 課題 2：守るべき不変条件

この章で挙げた5つの不変条件を、コードで「どこが担保しているか」を
ファイル名と関数名で示してください。

### 課題 3：守破離の自己評価

今のあなたは守破離のどの段階ですか。
「守」の段階なら、どの不変条件がまだ体に入っていないですか。
「破」に進む前に、何を確認しますか。
