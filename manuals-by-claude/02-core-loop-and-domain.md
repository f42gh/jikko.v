# 02. 中核ループとドメインの核

## まず一言

Jikko のドメインを理解するとは、次の一つの問いに答えられることです。

> **「このアプリでは、何が起きたと言えるのか。何が起きたとは言えないのか。」**

observe に置いただけでは、**まだ判断していない**。
orient しただけでは、**まだ実行していない**。
act を通って初めて、**done に意味が出る**。

この区別を守り抜くことが、ドメインを守るということです。

---

## 1. OODA はただの比喩ではない

Jikko における OODA は、雰囲気づけの言葉ではありません。
**状態機械の規律**です。

```
observe → orient → (decide) → act → done
            ↑                   |
            └── タイムアウトで戻る ─┘
```

`decide` が丸括弧になっているのは、永続的なステータスではないからです。
これは後で詳しく説明します。

### `observe` — 置く。考えない。

```typescript
// src/domain/tasks/types.ts
export const createTaskInputSchema = z.object({
  title: z.string().min(1, "Title is required."),
  observeMemo: z.string().default(""),
});
```

observe に入力できるのは `title` と `observeMemo` だけです。

これは仕様ではなく**哲学**です。

「まだ判断を要求しない」ということを、型レベルで実装しています。
もし orient 段階の項目（roiScore・estimatedMinutes）を observe の入力に加えると、
着手の摩擦が上がり、Jikko は重い管理アプリになります。

**observe の本質：考える前に置けること。**

### `orient` — 意味を与える。

```typescript
export const orientTaskInputSchema = z.object({
  roiScore: z.number().min(1).max(5),
  estimatedMinutes: z.number().int().min(1),
  orientMemo: z.string().default(""),
});
```

orient で決めるのは `roiScore`（価値）と `estimatedMinutes`（コスト）だけです。

これも意図的な絞り込みです。初期 schema には `urgency`・`impact`・
`penaltyOfDelay` など 7 つ以上の入力項目がありました。
いまは 2 つに絞っています。なぜか。

**多すぎる入力は、判断の摩擦を増やすからです。**

orient は「意味づけ」です。「詳細な分類」ではありません。

### `decide` — ステータスではなく、処理。

`decide` がなぜステータスではないのか。

もし `decide` がステータスになったら、次のことが起きます：

1. 「decide」状態に入ったタスクを、どこで・何のために表示するか決めなければならない
2. orient → decide → act の遷移管理が増える
3. 「決まったが着手していない」という宙吊り状態が生まれる
4. UI が「decide 画面」を要求し始める

これは全部、**ドメインより UI が設計を引っ張っている**状態です。

```typescript
// src/domain/planning/select-next.ts — 現在の実装
export function selectNextTask(recommendations: Recommendation[]) {
  return recommendations[0] ?? null;
}
```

`decide` は、orient タスクのランキング結果から最初の 1 件を取り出すだけです。
ステータスではなく、関数です。

### `act` — 実行する。1 件だけ。

```typescript
// src/app/proto-state.ts
export async function startTask(taskId: string) {
  // orient かつ estimatedMinutes が確定していないと開始できない
  if (!task || task.status !== "orient" || task.estimatedMinutes === null) {
    return;
  }
  // ...
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) =>
      item.id === taskId ? updatedTask : ensureNotAct(item)  // ← 他の act を外す
    ),
  }));
}
```

`ensureNotAct` が示すように、act に入ると他のタスクは強制的に orient に戻されます。

これは `act は同時に 1 件だけ` という不変条件のコード実装です。

### `done` — act を経由した者だけ。

```typescript
export async function completeTask(taskId: string) {
  // act でないと complete できない
  if (!task || task.status !== "act") {
    return;
  }
  // ...
}
```

`completeTask` は `task.status !== "act"` をチェックして早期リターンします。
observe や orient のタスクは `done` に直接移行できません。

---

## 2. Task 型を解剖する

```typescript
// src/domain/tasks/types.ts — 全体
export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required."),
  status: taskStatusSchema,                        // ← OODAライフサイクル
  parentTaskId: z.string().nullable(),             // ← 将来の分解サポート
  observeMemo: z.string().default(""),             // ← observe段階のメモ
  orientMemo: z.string().default(""),              // ← orient段階のメモ
  roiScore: z.number().min(1).max(5).nullable(),   // ← 価値評価（orient以降）
  estimatedMinutes: z.number().int().min(1).nullable(), // ← コスト（orient以降）
  actStartedAt: z.string().nullable(),             // ← act開始時刻（実行痕跡）
  actDueAt: z.string().nullable(),                 // ← 期限（タイムアウト判定用）
  progressNote: z.string().default(""),            // ← 実行中メモ（タイムアウト時保持）
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

各フィールドを「役割」で分類すると、設計の意図が見えます：

| フィールド | 役割 | どのステータスで有意か |
|---|---|---|
| `id`, `title`, `createdAt`, `updatedAt` | 存在証明 | 全ステータス |
| `status` | OODA ライフサイクル | 全ステータス |
| `parentTaskId` | 分解の記録 | 全ステータス |
| `observeMemo` | 最初の気づきのメモ | observe〜 |
| `orientMemo` | 意味づけのメモ | orient〜 |
| `roiScore`, `estimatedMinutes` | スコアリングの材料 | orient〜（null可） |
| `actStartedAt`, `actDueAt` | 実行時刻の記録 | act のみ有意 |
| `progressNote` | 実行中の記録、タイムアウト時の材料 | act〜 |

`roiScore` と `estimatedMinutes` が `nullable()` なのも重要です。
observe タスクはスコアを持たなくてよい。だから null が正しい。

---

## 3. factory.ts の哲学

```typescript
// src/domain/tasks/factory.ts — 全体
export function createObservedTask(
  input: CreateTaskInput,
  parentTaskId: string | null = null
): Task {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: input.title,
    status: "observe",              // ← 必ず observe から始まる
    parentTaskId,
    observeMemo: input.observeMemo,
    orientMemo: "",                 // ← orient段階はまだ空
    roiScore: null,                 // ← スコアはまだない
    estimatedMinutes: null,         // ← コストはまだない
    actStartedAt: null,
    actDueAt: null,
    progressNote: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
```

この 21 行の関数が守っていること：

1. **全ての新規タスクは `observe` から始まる**（status: "observe" が必ず入る）
2. **スコアリング材料はまだない**（roiScore: null, estimatedMinutes: null）
3. **実行痕跡はまだない**（actStartedAt: null, actDueAt: null）

これは「工場」です。Task オブジェクトを生成する唯一の責任を持ちます。
直接 `{ id: crypto.randomUUID(), status: "observe", ... }` と書かずに、
factory 関数を通す理由は、**初期化の規律をコードで保証するため**です。

---

## 4. TaskEvent は何のためにあるか

```typescript
// src/infra/db/types.ts
export type TaskEvent = {
  id: string;
  taskId: string;
  eventType:
    | "created"
    | "oriented"
    | "reoriented"
    | "decided"
    | "act_started"
    | "act_timed_out"
    | "completed"
    | "decomposed"
    | "archived";
  payloadJson: string;
  createdAt: string;
};
```

TaskEvent は「履歴」ではありません。
正確には、**「何が起きたかの証明」** です。

例として `completed` イベントのペイロードを見てみましょう：

```typescript
// src/app/proto-state.ts — completeTask 内
const event = createEvent(taskId, "completed", {
  actualMinutes: calculateActualMinutes(task.actStartedAt),  // 実際にかかった時間
  estimatedMinutes: task.estimatedMinutes,                   // 見積もった時間
  roiScore: task.roiScore,                                   // 当時の価値評価
});
```

なぜ `actualMinutes` と `estimatedMinutes` の両方を記録するのか。

後から `analysis/metrics.ts` で「見積もりと実績の差分」を計算するためです。
見積もりが楽観的すぎたかどうか、という判断精度の改善ループを作っています。

---

## 5. `act_timed_out` を失敗にしない思想

```typescript
// src/app/proto-state.ts — timeoutTask
export async function timeoutTask(taskId: string, input: TimeoutActInput) {
  // ...
  const updatedTask = applyTimeoutActTask(task, input);
  const event = createEvent(taskId, "act_timed_out", input);
  // ...
}

function applyTimeoutActTask(task: Task, input: TimeoutActInput): Task {
  return {
    ...task,
    status: "orient",        // ← orient に戻す（done にはしない）
    roiScore: input.roiScore,
    estimatedMinutes: input.estimatedMinutes,
    orientMemo: input.orientMemo,
    progressNote: input.progressNote,  // ← 進捗メモは保持する
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}
```

タイムアウトは `done` ではなく `orient` に戻ります。
`progressNote` は保持されます。

これは非常に大事な設計判断です。

タイムアウトは失敗ではなく、**再見積もりの材料**です。

- 見積もりが大きすぎた → より小さい `estimatedMinutes` で再設定
- 文脈が悪かった → `progressNote` に残して次の act の材料に
- 分割が甘かった → 子タスクに分解して再挑戦

ここに「ユーザを裁かない」という姿勢が埋め込まれています。

---

## 6. scoring と planning の役割分担

```
rankTasks() → Recommendation[]  （評価して並べる）
    ↓
selectNextTask() → Recommendation | null  （最終1件を選ぶ）
```

なぜ分けるのか。

現在の `selectNextTask` は `recommendations[0]` を返すだけです。
しかし将来、次のような「選び方の戦略」が必要になる可能性があります：

- 直前にタイムアウトしたタスクは今日は避ける
- 同スコアなら、より短いものを選ぶ
- 連続して長時間タスクが並ぶのを避ける

これらの「選び方の戦略」は `scoring` の責務ではなく `planning` の責務です。

今は 1 行の関数ですが、この分離は**意味のある境界**です。

---

## 7. DDD 的に見るなら

Jikko にはすでに「ユビキタス言語」があります。

| 言葉 | 意味 |
|---|---|
| `observe` | まだ判断されていない置き場 |
| `orient` | 価値と コストが決まった、ランキング可能な状態 |
| `act` | 実行中。時間がカウントされている |
| `done` | 実行を経て完了した |
| `roiScore` | 価値の主観的評価（1〜5） |
| `estimatedMinutes` | 必要時間の見積もり |
| `recommendation` | 今やるべきとシステムが判断したタスク＋その理由 |
| `act_timed_out` | 時間切れ。失敗ではなく再観察の入口 |

DDD の第一歩は、用語を外から輸入することではありません。
**すでにある言葉の意味をぶらさないこと**です。

---

## 章末の鍛錬課題

### 課題 1：フィールド分類

`Task` 型の各フィールドを、次の3分類に振り分けてください。

- **状態遷移に必要なフィールド**
- **スコアリング・説明責務のためのフィールド**
- **実行痕跡・履歴のためのフィールド**

答えは「正解」よりも「理由」が大事です。

### 課題 2：`decide` を status にした悪影響

`decide` という status を追加した場合、コードレベルで何が変わりますか。
`proto-state.ts` に何行の変更が必要で、何の問題が生まれますか。

### 課題 3：タイムアウトの再設計

もし「タイムアウトは失敗」として実装するとしたら、どう変わりますか。
`applyTimeoutActTask` の代わりに `applyFailActTask` を書いてみてください。
そして「何を失うか」を書いてください。
