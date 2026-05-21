# 07. コードリーディング完全解剖

## この章の目的

01〜06 章は「何を・なぜ」を語りました。
この章は「どうやって・行レベルで」を語ります。

コードを実際に自分で書くために、各ファイルの「なぜこう書いてあるのか」を
行単位で説明します。

---

## 1. `src/domain/tasks/types.ts` 完全解剖

```typescript
import { z } from "zod";
```

Zod を使っています。Zod は「TypeScript の型とバリデーションを同時に定義する」ライブラリです。
`z.object({...}).parse(data)` でバリデーションと型安全な変換が同時に行えます。

```typescript
export const taskStatusSchema = z.enum(["observe", "orient", "act", "done", "archived"]);
```

ステータスを `string` ではなく `z.enum` で定義しています。
これにより：
- `type TaskStatus = "observe" | "orient" | "act" | "done" | "archived"` が自動導出される
- それ以外の文字列が入ると実行時にエラーになる

`archived` は UI でまだ使われていませんが、将来「タスクを消さずにアーカイブ」する際に使います。

```typescript
export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required."),
```

`title` は `min(1)` で空文字を禁止しています。
これは「タイトルのないタスクを作れない」という不変条件です。

```typescript
  roiScore: z.number().min(1).max(5).nullable(),
  estimatedMinutes: z.number().int().min(1).nullable(),
```

`nullable()` がポイントです。
`observe` タスクはスコアを持たない（まだ orient されていない）ので、`null` が正当な値です。
`nullable()` なしだと、observe タスクを作るたびにダミー値を入れる必要があり、
「スコアがある = orient済み」という区別が失われます。

```typescript
export const createTaskInputSchema = z.object({
  title: z.string().min(1, "Title is required."),
  observeMemo: z.string().default(""),
});
```

`createTaskInputSchema` は `taskSchema` の部分集合です。
新規作成に必要な入力だけを定義しています。

なぜ `taskSchema` 全体を使わないのか：
- `id`・`createdAt`・`updatedAt` はシステムが生成する（ユーザ入力ではない）
- `roiScore`・`estimatedMinutes` はまだ入力しない

```typescript
export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
```

`z.infer<typeof ...>` で TypeScript 型を自動導出します。
手動で `type Task = {...}` を書く必要がなく、スキーマと型が常に一致します。

---

## 2. `src/domain/tasks/factory.ts` 完全解剖

```typescript
import type { CreateTaskInput, Task } from "./types";
```

`import type` は型のみのインポートです。
実行時に削除され、バンドルサイズを節約します。

```typescript
export function createObservedTask(
  input: CreateTaskInput,
  parentTaskId: string | null = null
): Task {
```

`parentTaskId` のデフォルト値が `null` です。
通常のタスク作成では `parentTaskId` を渡しません（分解タスクを作るときだけ渡す）。

```typescript
  const timestamp = new Date().toISOString();
```

`createdAt` と `updatedAt` を同じ `timestamp` にしています。
`new Date()` を2回呼ぶと、わずかに異なる値になる可能性があります。
1回呼んで使い回すことで、新規作成時は `createdAt === updatedAt` が保証されます。

```typescript
  return {
    id: crypto.randomUUID(),
```

`crypto.randomUUID()` はブラウザ・Node.js・Deno で標準的に使える UUID 生成です。
外部ライブラリ不要。

```typescript
    status: "observe",
```

**ここが factory の核心です。**
どんな引数が来ても、必ず `status: "observe"` で始まります。
呼び出し元が `status` を渡せる構造になっていません。

```typescript
    roiScore: null,
    estimatedMinutes: null,
    actStartedAt: null,
    actDueAt: null,
    progressNote: "",
```

null と空文字の使い分けに注目してください：
- `roiScore: null` — 「まだ設定されていない」という意味
- `progressNote: ""` — 「空のメモ」という意味

null は「不在」、空文字は「存在するが内容がない」です。

---

## 3. `src/domain/scoring/engine.ts` 完全解剖

```typescript
import { defaultScoreWeights } from "./defaults";
import type { Recommendation, ScoreWeights } from "./types";
import type { Task } from "../tasks/types";
```

`engine.ts` は `domain/tasks/types.ts` を `import` しています（依存が domain 内に閉じる）。
`infra/` や `app/` は `import` していません（正しい依存方向）。

```typescript
export function scoreTask(
  task: Task,
  weights: ScoreWeights = defaultScoreWeights,
): Recommendation {
```

`weights` にデフォルト値があります。
通常は `scoreTask(task)` で呼べますが、`weights` を渡して重みを調整するテストも書けます。
これがテスタビリティを意識した設計です。

```typescript
  const roi = (task.roiScore ?? 1) * weights.roi;
```

`?? 1` は「roiScore が null なら 1 を使う」です。
`|| 1` との違い：`|| 1` は `roiScore = 0` のときも `1` になります。
`??` は `null` と `undefined` のときだけ右辺を使います。

`roiScore = 0` は「価値がゼロ」という意味のある値です（今の schema では min(1) なので
実際には 0 は入りませんが、型レベルでは考慮すべきです）。

```typescript
  const effortPenalty = calculateEffortPenalty(task.estimatedMinutes) * weights.effortPenalty;
```

`calculateEffortPenalty` は別関数に切り出されています。
`scoreTask` の中に直接書かなかった理由：
- 単独でテストできる
- `priorityScore` の計算式から「ペナルティの計算ロジック」を分離して読みやすい

```typescript
  const priorityScore = roi - effortPenalty;
  const expectedRoi = roi / Math.max(effortPenalty, 0.5);
```

`Math.max(effortPenalty, 0.5)` — なぜ 0.5 でクランプするのか。

もし `effortPenalty = 0` になると（weights が 0 の場合など）、`roi / 0` で `Infinity` になります。
最小を 0.5 にすることで、`expectedRoi` が異常値にならないようにしています。

```typescript
  return {
    task,
    priorityScore,
    expectedRoi,
    whyNowSummary: buildWhyNowSummary({ roi, effortPenalty }),
    breakdown: { roi, effortPenalty },
  };
}
```

`breakdown` を返すのは説明責務のためです。
`priorityScore` だけ返したら「なぜこのスコアか」が分からない。
`roi` と `effortPenalty` を内訳として返すことで、UI が「ROI 7.0 / Cost 2.88」と表示できます。

```typescript
export function rankTasks(
  tasks: Task[],
  weights: ScoreWeights = defaultScoreWeights,
): Recommendation[] {
  return tasks
    .filter(
      (task) =>
        task.status === "orient" &&
        task.roiScore !== null &&
        task.estimatedMinutes !== null,
    )
    .map((task) => scoreTask(task, weights))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}
```

`filter` → `map` → `sort` の 3 ステップ。

`filter` の条件が3つあります：
1. `status === "orient"` — observe や act はランキング対象外
2. `roiScore !== null` — スコア未設定はランキングに乗せない
3. `estimatedMinutes !== null` — コスト未設定もランキングに乗せない

2と3を別に確認しているのは、「orient だがまだ入力が完成していないタスク」が
存在しうるからです（将来的な部分 orient のケース）。

```typescript
function buildWhyNowSummary(breakdown: Recommendation["breakdown"]) {
  return `ROI ${breakdown.roi.toFixed(1)} / Cost ${breakdown.effortPenalty.toFixed(1)}`;
}
```

`Recommendation["breakdown"]` という型の書き方に注目してください。
`Recommendation` 型の `breakdown` フィールドの型を直接参照しています。
別途 `type Breakdown = { roi: number; effortPenalty: number }` を定義しなくてもよい。

---

## 4. `src/app/proto-state.ts` の核心部分解剖

### writable store の定義

```typescript
const state = writable<ProtoState>(initialState);
```

`state` は小文字・非 export です。外から直接操作できません。

```typescript
export const appState = {
  subscribe: state.subscribe,
};
```

`appState` は `subscribe` しか持っていません。
外から読めるが、外から直接 `set` できない構造です（Svelte の readable store パターン）。

### derived の連鎖

```typescript
export const orientTasks = derived(state, ($state) =>
  rankTasks($state.tasks, $state.weights),
);

export const recommendation = derived(
  [state, orientTasks, activeTask],
  ([$state, $orientTasks, $activeTask]) => {
    if ($activeTask) {
      return scoreTask($activeTask, $state.weights);
    }
    return selectNextTask($orientTasks);
  },
);
```

`recommendation` は `[state, orientTasks, activeTask]` に依存しています。
このうちどれか一つが変化したら、`recommendation` が再計算されます。

`orientTasks` は `state` から derived されています。
つまり `state` が変わると `orientTasks` が変わり、`recommendation` も変わります。

この自動再計算が Svelte の reactive の本質です。

### `commitState` パターン

```typescript
function commitState(update: (current: ProtoState) => ProtoState) {
  state.update((current) => update(current));
}
```

`state.update` を直接呼ぶ代わりに、`commitState` を通します。

理由：
1. `state` は非 export なので、`commitState` が唯一の更新窓口
2. 将来ここにミドルウェア（ログ・副作用）を追加しやすい
3. 引数が関数なので、常に最新の state を取って変換できる

```typescript
commitState((current) => ({
  ...current,        // スプレッドで全フィールドをコピー
  tasks: [...current.tasks, task],  // tasks だけ新配列で上書き
}));
```

不変更新（immutable update）パターンです。
元の `current.tasks` は変更せず、新しい配列を作って置き換えます。
これにより Svelte の reactivity が検知できます（参照が変わるから）。

---

## 5. `src/infra/db/repositories/tasks-repository.ts` の核心部分解剖

### `readNullableNumber` の必要性

```typescript
function readNullableNumber(row: Record<string, unknown>, ...keys: string[]) {
  const value = readValue(row, ...keys);
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;  // Infinity や NaN は null へ
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
```

なぜこんなに複雑なのか。

SQLite から返る値は型保証がありません（`Record<string, unknown>`）。
数値として保存しても、Rust の `invoke` 経由で返ると文字列になる場合があります。
また `""` や `null` や `undefined` を全部 `null` として扱う必要があります。

`Number.isFinite(value)` で `Infinity`・`-Infinity`・`NaN` を除外しています。

### `normalizeTaskStatus` の意図

```typescript
function normalizeTaskStatus(status: string): Task["status"] {
  switch (status) {
    case "observe": case "orient": case "act": case "done": case "archived":
      return status;
    case "pending":   return "observe";  // 旧名
    case "active":
    case "doing":
    case "in_progress": return "act";    // 旧名群
    case "completed":   return "done";   // 旧名
    default:            return "observe";
  }
}
```

DB に「pending」「doing」「completed」という旧ステータス名が残っていても、
domain 層に渡る前に現在の OODA 言語に変換します。

`default: return "observe"` は「不明なステータスは observe に戻す」という防衛的な設計です。
「不明なら crash する」という選択もありましたが、「とりあえず observe に戻す」ことで
古いデータが混入してもアプリが止まりません。

---

## 6. `src/domain/analysis/suggestions.ts` の読み方

```typescript
if (summary.timeoutRate >= 0.35) {
  suggestions.push({
    id: "raise-effort-penalty",
    kind: "weight",
    title: "時間見積もりが強気です",
    summary: `時間切れ率が ${Math.round(summary.timeoutRate * 100)}% あります。
              effortPenalty を ${weights.effortPenalty.toFixed(1)} から
              ${(weights.effortPenalty + 0.2).toFixed(1)} へ上げる候補です。`,
    impactLabel: "開始前に短いタスクを上へ寄せる",
    recommendedWeights: {
      effortPenalty: roundToTenth(weights.effortPenalty + 0.2),
    },
  });
}
```

この関数の重要な設計原則：

1. **提案するだけで強制しない** — `recommendedWeights` はユーザが採用するかどうか選ぶ
2. **数値を出す** — `timeoutRate * 100`% を文字列に含めて根拠を示す
3. **具体的な変化量を出す** — `0.8 → 1.0` という具体的な変更案
4. **影響を言語化する** — `impactLabel` で何が変わるか一言で示す

これも「説明可能性は UX である」の実装です。

---

## 章末の鍛錬課題

### 課題 1：`scoreTask` を書き直す

`src/domain/scoring/engine.ts` の `scoreTask` を見ないで、
同じシグネチャで同じ動作をする関数を自分で書いてください。

書いた後で比較して、違う部分があれば「なぜ元の実装そうなっているか」を考えてください。

### 課題 2：`createObservedTask` の拡張

`createObservedTask` を修正して、`dueAt: string | null` フィールドを
`observeMemo` と同じく observe 時に入力できるように変更してください。

ただし、`Task` 型にも `dueAt` を追加する必要があります。
`taskSchema`・`createTaskInputSchema`・`factory.ts` の3ファイルを変更してください。

### 課題 3：`rankTasks` のバグを見つける

`rankTasks` に次の問題があると仮定してください：
「同スコアのタスクが毎回ランダムな順序で並ぶ」

JavaScript の `Array.sort` はなぜこれが起きうるのでしょうか。
どう修正すると安定したソートになりますか。
