# 03. 状態管理と UI フロー

## まず一言

UI を読むときにやってはいけないのは、「見た目のパーツ」だけを見ることです。

本当に見るべきは、

> **どの状態が、どの操作で、どんな約束を保ったまま変わるか。**

`proto-state.ts` と `App.svelte` は、Jikko の「鼓動」です。
この章では、その鼓動の仕組みを読み解きます。

---

## 1. 状態の3層モデル

Jikko の状態は、3つの層に分けて理解すると整理しやすいです。

```
┌─────────────────────────────────────────────┐
│  導出状態 (derived stores)                   │
│  observeTasks / orientTasks / activeTask /  │
│  recommendation                              │
│  ← セッション状態から自動計算される           │
├─────────────────────────────────────────────┤
│  セッション状態 (writable store)              │
│  state: { tasks, events, weights, boot }    │
│  ← アクション関数で更新される                 │
├─────────────────────────────────────────────┤
│  永続状態 (SQLite / localStorage)            │
│  ← tasksRepository が窓口                   │
└─────────────────────────────────────────────┘
```

**永続状態が唯一の真実。セッション状態はセッション中のキャッシュ。**

重要なのは、セッション状態を更新するときに必ず永続状態も更新することです。

```typescript
// proto-state.ts — addTask の例
export async function addTask(input: CreateTaskInput) {
  const task = createObservedTask(input);
  const event = createEvent(task.id, "created");

  await tasksRepository.createTask(task, event);  // ← 先に永続化

  commitState((current) => ({                     // ← その後でセッション状態更新
    ...current,
    tasks: [...current.tasks, task],
    events: [...current.events, event],
  }));
}
```

永続化を先に行い、セッション状態はその後で更新します。
これにより、永続化に失敗した場合はセッション状態も更新されません。

---

## 2. derived stores の設計

```typescript
// proto-state.ts — 全導出状態

// observe タスク（逆順：新しいものが先頭）
export const observeTasks = derived(state, ($state) =>
  $state.tasks.filter((task) => task.status === "observe").reverse(),
);

// orient タスク（スコアリングしてランキング済み）
export const orientTasks = derived(state, ($state) =>
  rankTasks($state.tasks, $state.weights),
);

// 実行中の act タスク（0 or 1 件）
export const activeTask = derived(state, ($state) =>
  $state.tasks.find((task) => task.status === "act") ?? null,
);

// 今やるべきタスク（最重要）
export const recommendation = derived(
  [state, orientTasks, activeTask],
  ([$state, $orientTasks, $activeTask]) => {
    if ($activeTask) {
      return scoreTask($activeTask, $state.weights);  // act 中はそれを前面に
    }
    return selectNextTask($orientTasks);              // なければランキング1位
  },
);
```

`recommendation` の設計は特に重要です。

`activeTask` があれば**それが最優先**で返ります。
これは「決めたあとにやり切る」という Jikko の約束のコード実装です。

もし `activeTask` があっても `selectNextTask` を呼んでいたら、
実行中にランキング上位のタスクに表示が切り替わり、「今やるべきこと」が揺れます。

---

## 3. `initializeApp` を読む

起動シーケンスは Jikko の設計をよく表しています。

```typescript
export async function initializeApp() {
  // フェーズ1: loading 開始
  markBoot("loading", 25, "保存データを読み込んでいます。");
  const seedData = await tasksRepository.load();

  // フェーズ2: 期限切れタスクの整合
  markBoot("loading", 60, "期限切れタスクを整えています。");
  const reconciled = await reconcileExpiredActs(seedData.tasks, seedData.events);

  // フェーズ3: ready
  state.set({
    ready: true,
    tasks: reconciled.tasks,
    // ...
  });
}
```

**フェーズ2（reconcile）が重要。**

単にデータを復元するだけでなく、「現時点の意味に照らして状態を再解釈」しています。

```typescript
async function reconcileExpiredActs(tasks: Task[], events: TaskEvent[]) {
  const expired = tasks.filter(
    (task) =>
      task.status === "act" &&
      task.actDueAt &&
      new Date(task.actDueAt).getTime() <= Date.now(),  // 期限を過ぎている
  );

  for (const task of expired) {
    // タイムアウトとして処理（orient に戻す）
    const updatedTask = applyTimeoutActTask(task, {
      roiScore: task.roiScore ?? 3,
      estimatedMinutes: task.estimatedMinutes ?? 25,
      orientMemo: task.orientMemo,
      progressNote: task.progressNote || "時間切れのため再評価へ戻しました。",
    });
    const event = createEvent(task.id, "act_timed_out", { automatic: true });
    await tasksRepository.updateTask(updatedTask, event);
    // ...
  }
}
```

アプリが閉じている間に期限が切れたタスクを、起動時に orient に戻します。
これはアプリとしての誠実さです：「閉じていたから見なかったことにする」ではなく、
「起動したとき、意味のある状態になっている」を保証します。

---

## 4. 主要アクション関数の完全解読

### `addTask`

```typescript
export async function addTask(input: CreateTaskInput) {
  const task = createObservedTask(input);          // factory で observe 生成
  const event = createEvent(task.id, "created");   // イベント記録
  await tasksRepository.createTask(task, event);   // 永続化
  commitState((current) => ({
    ...current,
    tasks: [...current.tasks, task],               // セッション状態に追加
    events: [...current.events, event],
  }));
}
```

注目：`createObservedTask` を呼んでいます。
直接オブジェクトリテラルで task を作っていないのは、factory の規律を使うためです。

### `saveOrientation`

```typescript
export async function saveOrientation(taskId: string, input: OrientTaskInput) {
  const current = get(state);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task) { return; }

  const updatedTask = applyOrientTask(task, input);

  // observe から orient なら "oriented"、orient から orient なら "reoriented"
  const event = createEvent(
    taskId,
    task.status === "observe" ? "oriented" : "reoriented",
    input
  );
  // ...
}
```

イベント種別が `oriented` と `reoriented` で分かれています。
これは後の分析で「最初に orient した」と「再評価した」を区別するためです。

### `startTask`

```typescript
export async function startTask(taskId: string) {
  const task = current.tasks.find((item) => item.id === taskId);

  // ガード：orient で estimatedMinutes が確定していないと開始できない
  if (!task || task.status !== "orient" || task.estimatedMinutes === null) {
    return;
  }

  const updatedTask = applyStartActTask(task);
  // ...
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) =>
      item.id === taskId ? updatedTask : ensureNotAct(item)  // ← 核心
    ),
  }));
}
```

`ensureNotAct` が `act は 1 件だけ` の不変条件を保証しています。

```typescript
function ensureNotAct(task: Task): Task {
  if (task.status !== "act") { return task; }
  return {
    ...task,
    status: "orient",    // act を orient に戻す
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}
```

---

## 5. `proto-state.ts` の責務問題

正直に言います。このファイルは**責務が多すぎます**。

現在やっていること：
1. Svelte writable store の定義（状態ストア）
2. derived stores の定義（計算済みビュー）
3. boot orchestration（起動シーケンス）
4. application service（addTask / saveOrientation / startTask...）
5. repository 呼び出し（永続化へのアクセス）
6. domain 操作関数（applyOrientTask / applyStartActTask...）
7. utility 関数（createEvent / formatBootError...）

`proto` とついているのはそのためです。プロトタイプとして早く動かすために
一箇所に集めており、それは合理的な選択でした。

しかし、**将来的にはここを分割する必要があります**。

分割するとしたら、安定した境界から順に：

```
1. applyOrientTask 等の純粋ドメイン操作関数
   → src/domain/tasks/operations.ts へ

2. boot orchestration
   → src/app/boot.ts へ

3. application service 層
   → src/app/use-cases/ または src/app/services/ へ

4. derived stores は残す（Svelte の関心として）
```

**今はまだ分割しなくてよい。** ただし、何がどこにあるかを
意識したままコードを読めることが大事です。

---

## 6. UI の3領域

`App.svelte` の画面は、3つの領域で構成されています。

```
┌──────────────────────────────────────────────┐
│                    HERO                       │
│  今の主役。activeTask または recommendation   │
│  を詳細表示。判断と着手の場。                  │
│                                               │
│  [着手する]  [完了]  [時間切れ]               │
└──────────────────────────────────────────────┘
┌─────────────────┐  ┌────────────────────────┐
│  OBSERVE DOCK   │  │     RANK DOCK          │
│                 │  │                        │
│  observe状態の  │  │  orient済み候補の       │
│  タスク一覧     │  │  スコア順ランキング      │
│  ＋キャプチャ   │  │                        │
│  入力フォーム   │  │  （hero を支える比較材料）│
└─────────────────┘  └────────────────────────┘
```

**hero は「詳細表示」ではなく「判断と着手の場」**です。

なぜ重要か：もし hero を単なる「選択タスクの詳細」として実装すると、
「どのタスクを選んで表示するか」がユーザの手動操作になります。
Jikko の設計では、hero は `recommendation` を自動的に前面に出します。

### `focusTask` の決定ロジック

```typescript
// App.svelte の概念（実際の実装を読んでください）
const focusTask =
  selectedTaskId があれば → そのタスク     // ユーザの明示選択を尊重
  activeTask があれば → activeTask          // 実行中のものを優先
  recommendation があれば → そのタスク     // 推薦を前面に
  observeTasks[0] があれば → それ          // 最後の手段
```

優先順位の意味：
- ユーザが明示的に選んだものは尊重する（自律性の尊重）
- しかし選んでいなければ、中核ループが自然に前進する向きで表示

---

## 7. App.svelte は大きいが、悪い大きさではない

現時点で `App.svelte` は大きいファイルです。
これを見て「すぐ分割しよう」と思うのは早計です。

proto 段階で一つのファイルに集めているメリット：
- 状態遷移の意味が画面から直接見える
- 条件分岐が近くにある
- 改修のたびにファイルを飛び回らない

**問題になるのは、「意味のかたまり」ではなく「見た目の部品都合」で分割し始めたとき**です。

いずれ分割するとしたら、この順番で：

```
1. boot panel（起動状態の表示）
2. hero の act 表示 / orient 表示の差分
3. capture form（observe 入力フォーム）
4. recommendation 表示部
```

store の大量分割より先に、「どの責務が安定しているか」を見極めることが先です。

---

## 章末の鍛錬課題

### 課題 1：アクション関数の地図

`proto-state.ts` の export 関数を一覧にし、
それぞれが「どのドメイン状態をどう変えるか」を1行で書いてください。

### 課題 2：`recommendation` の意味

`recommendation` が `activeTask` を優先する設計は、
ユーザ体験として何を保証していますか。
逆に「常に orient 1位を返す」設計にした場合、何が起きますか。

### 課題 3：分割の判断

`proto-state.ts` を「明日分割するとしたら」と仮定して、
「今すぐ分けられる部分」と「まだ分けない方がいい部分」を判断してください。
その判断の根拠も書いてください。
