# 08. Jikko を 0 から再建するための設計ノート

## この章の目的

「コードを模写する」ではなく「判断基準を継承して、自分で書く」ための章です。

もし Jikko を完全にゼロから書き直すとしたら、何をどの順番で作りますか。
私が設計者なら、こう進めます。

---

## 1. 最初の1週間で作るもの（5項目）

```
1. Task 型と状態遷移の不変条件
2. scoreTask 関数（スコアリングエンジン）
3. Svelte store（writable + derived）
4. 最小の UI（hero + capture form）
5. localStorage 永続化
```

**この週が終わると：observe → orient → act → done の中核ループが動く。**

この5項目以外に入れないもの：

```
入れない理由を書く方が大事

❌ DB（SQLite）→ まず localStorage で十分。DB は永続化が必要になったとき
❌ Tauri（デスクトップ化）→ ブラウザで動けばよい最初の週
❌ analysis / suggestions → 履歴が溜まってから作る
❌ Python helper → 最後
❌ テーマ・CSS 凝った実装 → 機能が動いてから
❌ 複数コンポーネント分割 → まず App.svelte 一枚で
```

---

## 2. 第1週の実装順序

### Step 1: Task 型を書く（所要時間：1時間）

```typescript
// src/domain/tasks/types.ts

import { z } from "zod";

export const taskStatusSchema = z.enum([
  "observe",
  "orient",
  "act",
  "done",
  "archived",
]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: taskStatusSchema,
  parentTaskId: z.string().nullable(),
  observeMemo: z.string().default(""),
  orientMemo: z.string().default(""),
  roiScore: z.number().min(1).max(5).nullable(),
  estimatedMinutes: z.number().int().min(1).nullable(),
  actStartedAt: z.string().nullable(),
  actDueAt: z.string().nullable(),
  progressNote: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  observeMemo: z.string().default(""),
});

export const orientTaskInputSchema = z.object({
  roiScore: z.number().min(1).max(5),
  estimatedMinutes: z.number().int().min(1),
  orientMemo: z.string().default(""),
});

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type OrientTaskInput = z.infer<typeof orientTaskInputSchema>;
```

**この型が完成すれば、Jikko が世界をどう切り取るかが決まります。**

### Step 2: factory と domain 操作を書く（所要時間：2時間）

```typescript
// src/domain/tasks/factory.ts

import type { CreateTaskInput, Task } from "./types";

export function createObservedTask(
  input: CreateTaskInput,
  parentTaskId: string | null = null,
): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: input.title,
    status: "observe",
    parentTaskId,
    observeMemo: input.observeMemo,
    orientMemo: "",
    roiScore: null,
    estimatedMinutes: null,
    actStartedAt: null,
    actDueAt: null,
    progressNote: "",
    createdAt: now,
    updatedAt: now,
  };
}
```

```typescript
// src/domain/tasks/operations.ts
// （現行 repo では proto-state.ts にあるが、本来はここにあるべき）

import type { Task } from "./types";
import type { OrientTaskInput } from "./types";

export function applyOrient(task: Task, input: OrientTaskInput): Task {
  return {
    ...task,
    status: "orient",
    roiScore: input.roiScore,
    estimatedMinutes: input.estimatedMinutes,
    orientMemo: input.orientMemo,
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyStartAct(task: Task): Task {
  const now = new Date();
  const estimatedMinutes = task.estimatedMinutes ?? 25;
  const actDueAt = new Date(now.getTime() + estimatedMinutes * 60_000).toISOString();
  return {
    ...task,
    status: "act",
    actStartedAt: now.toISOString(),
    actDueAt,
    updatedAt: now.toISOString(),
  };
}

export function applyComplete(task: Task): Task {
  return {
    ...task,
    status: "done",
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyTimeout(task: Task, progressNote: string): Task {
  return {
    ...task,
    status: "orient",
    progressNote,
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

// 不変条件：1件だけが act に
export function ensureOnlyOneAct(tasks: Task[], newActId: string): Task[] {
  return tasks.map((task) => {
    if (task.id === newActId || task.status !== "act") return task;
    return { ...task, status: "orient", actStartedAt: null, actDueAt: null };
  });
}
```

**注目：現行 repo では `applyOrientTask`・`applyStartActTask`・`applyCompleteActTask`・
`applyTimeoutActTask` は `proto-state.ts` に散らばっています。
0 から書くなら、ドメイン操作は `domain/tasks/operations.ts` に集めた方が明確です。**

### Step 3: scoring を書く（所要時間：1時間）

```typescript
// src/domain/scoring/types.ts

import type { Task } from "../tasks/types";

export type ScoreWeights = {
  roi: number;
  effortPenalty: number;
};

export type Recommendation = {
  task: Task;
  priorityScore: number;
  expectedRoi: number;
  whyNowSummary: string;
  breakdown: { roi: number; effortPenalty: number };
};
```

```typescript
// src/domain/scoring/engine.ts

import type { Task } from "../tasks/types";
import type { Recommendation, ScoreWeights } from "./types";

export const DEFAULT_WEIGHTS: ScoreWeights = {
  roi: 1.4,
  effortPenalty: 0.8,
};

export function scoreTask(task: Task, weights = DEFAULT_WEIGHTS): Recommendation {
  const roi = (task.roiScore ?? 1) * weights.roi;
  const effortPenalty = calcEffortPenalty(task.estimatedMinutes) * weights.effortPenalty;
  const priorityScore = roi - effortPenalty;
  const expectedRoi = roi / Math.max(effortPenalty, 0.5);

  return {
    task,
    priorityScore,
    expectedRoi,
    whyNowSummary: buildSummary(roi, effortPenalty),
    breakdown: { roi, effortPenalty },
  };
}

export function rankTasks(tasks: Task[], weights = DEFAULT_WEIGHTS): Recommendation[] {
  return tasks
    .filter(
      (t) => t.status === "orient" && t.roiScore !== null && t.estimatedMinutes !== null,
    )
    .map((t) => scoreTask(t, weights))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function calcEffortPenalty(minutes: number | null): number {
  return Math.max(1, (minutes ?? 25) / 25);
}

function buildSummary(roi: number, cost: number): string {
  return `ROI ${roi.toFixed(1)} / Cost ${cost.toFixed(1)}`;
}
```

### Step 4: Svelte store を書く（所要時間：3時間）

```typescript
// src/app/state.ts
// （現行の proto-state.ts を整理したバージョン）

import { derived, get, writable } from "svelte/store";
import { createObservedTask } from "../domain/tasks/factory";
import {
  applyComplete,
  applyOrient,
  applyStartAct,
  applyTimeout,
  ensureOnlyOneAct,
} from "../domain/tasks/operations";
import { rankTasks, scoreTask, DEFAULT_WEIGHTS } from "../domain/scoring/engine";
import type { CreateTaskInput, OrientTaskInput, Task } from "../domain/tasks/types";

// ─── 状態定義 ───────────────────────────────

type AppState = {
  tasks: Task[];
  weights: typeof DEFAULT_WEIGHTS;
};

const _state = writable<AppState>({
  tasks: [],
  weights: DEFAULT_WEIGHTS,
});

// ─── 読み取り専用ビュー ───────────────────────

export const observeTasks = derived(_state, ($s) =>
  $s.tasks.filter((t) => t.status === "observe").reverse(),
);

export const orientTasks = derived(_state, ($s) =>
  rankTasks($s.tasks, $s.weights),
);

export const activeTask = derived(_state, ($s) =>
  $s.tasks.find((t) => t.status === "act") ?? null,
);

export const recommendation = derived(
  [orientTasks, activeTask, _state],
  ([$orientTasks, $active, $s]) => {
    if ($active) return scoreTask($active, $s.weights);
    return $orientTasks[0] ?? null;
  },
);

// ─── ユースケース（アクション） ──────────────

export function addTask(input: CreateTaskInput) {
  const task = createObservedTask(input);
  _state.update((s) => ({ ...s, tasks: [...s.tasks, task] }));
}

export function orientTask(taskId: string, input: OrientTaskInput) {
  _state.update((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId ? applyOrient(t, input) : t)),
  }));
}

export function startTask(taskId: string) {
  _state.update((s) => {
    const task = s.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "orient" || task.estimatedMinutes === null) return s;
    const updated = applyStartAct(task);
    return { ...s, tasks: ensureOnlyOneAct(s.tasks.map((t) => (t.id === taskId ? updated : t)), taskId) };
  });
}

export function completeTask(taskId: string) {
  _state.update((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId && t.status === "act" ? applyComplete(t) : t)),
  }));
}

export function timeoutTask(taskId: string, progressNote: string) {
  _state.update((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId && t.status === "act" ? applyTimeout(t, progressNote) : t)),
  }));
}
```

**注目：この version では永続化を省いています。**
まず「中核ループが動く」を確認してから、localStorage を追加します。

---

## 3. 第2週：永続化と Tauri の追加

第1週で中核ループが動いたら、第2週で永続化を追加します。

```typescript
// src/infra/repository.ts（最小版）

const KEY = "jikko.v1";

export type PersistedState = {
  tasks: Task[];
};

export function load(): PersistedState {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { tasks: [] };
}

export function save(state: PersistedState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
```

`state.ts` に永続化を組み込む：

```typescript
// state.ts に追加

export async function initialize() {
  const persisted = load();
  _state.set({ tasks: persisted.tasks, weights: DEFAULT_WEIGHTS });
}

// 各アクションの後で save を呼ぶ
export function addTask(input: CreateTaskInput) {
  const task = createObservedTask(input);
  _state.update((s) => {
    const next = { ...s, tasks: [...s.tasks, task] };
    save({ tasks: next.tasks });  // ← 永続化
    return next;
  });
}
```

---

## 4. 第3週：UI を整える

最小の UI は次の構造で：

```svelte
<!-- src/App.svelte（最小版） -->
<script lang="ts">
  import { recommendation, observeTasks, orientTasks } from "./app/state";
  import { addTask, orientTask, startTask, completeTask } from "./app/state";

  let captureTitle = "";
  let selectedId: string | null = null;
</script>

<!-- HERO: 今やるべきこと -->
{#if $recommendation}
  <section class="hero">
    <h2>{$recommendation.task.title}</h2>
    <p>{$recommendation.whyNowSummary}</p>
    <button on:click={() => startTask($recommendation.task.id)}>着手する</button>
    <button on:click={() => completeTask($recommendation.task.id)}>完了</button>
  </section>
{/if}

<!-- OBSERVE DOCK: 置き場 -->
<section class="observe-dock">
  <input bind:value={captureTitle} placeholder="タスクを追加..." />
  <button on:click={() => { addTask({ title: captureTitle }); captureTitle = ""; }}>
    追加
  </button>

  {#each $observeTasks as task}
    <div on:click={() => (selectedId = task.id)}>{task.title}</div>
  {/each}
</section>

<!-- RANK DOCK: 候補一覧 -->
<section class="rank-dock">
  {#each $orientTasks as rec}
    <div>{rec.task.title} — {rec.priorityScore.toFixed(1)}</div>
  {/each}
</section>
```

**スタイルは後でよい。動くことが先。**

---

## 5. 0から書くときの判断原則

### 型から書く

型を先に書くと、実装の曖昧さが消えます。
「Task に何が必要か」を先に決めることで、後の実装が迷いません。

### 純粋関数から書く

`scoreTask`・`applyOrient` などの pure function（入力が同じなら出力が同じ）を先に完成させ、
副作用（store の更新・永続化）は後から繋げます。

テストが書きやすく、バグの局所化がしやすいためです。

### 最小の UI で中核ループを回す

綺麗な UI を作る前に、「observe に入れて、orient して、act にして、complete できる」
という中核ループが動くことを確認します。

見た目が悪くてもよい。動くことが先。

### 永続化は後

localStorage や SQLite は後から追加できます。
最初は `_state` の中だけで動かせば、ページをリロードするとデータが消えますが、
それは開発中は許容できます。

---

## 章末の鍛錬課題

### 課題 1：Step 1 の実装

`src/domain/tasks/types.ts` を見ないで、Step 1 の型定義を書いてください。
Zod を使わずに TypeScript の `type` だけで書いてもかまいません。

書いた後、元のコードと比較して「見落としていたもの」を書いてください。

### 課題 2：`ensureOnlyOneAct` のテスト

`ensureOnlyOneAct(tasks, newActId)` 関数の単体テストを3つ書いてください：

1. 既存の act が存在する場合 → 新しい act が入り、古いものが orient に戻る
2. 既存の act がない場合 → 変化なし
3. 複数の act が存在していた場合（不整合状態） → 指定以外は全て orient に戻る

### 課題 3：永続化の統合

Step 4 の `state.ts` に `initialize()` と localStorage への保存を組み込んでください。
ただし、ページをリロードしてもタスクが残るようにしてください。

（現行 repo の `tasks-repository.ts` の localStorage 実装を参考にしてよいです）
