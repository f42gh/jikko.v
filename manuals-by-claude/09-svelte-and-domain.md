# 09. Svelte とドメインの翻訳層

## この章の目的

Svelte の `writable`・`derived`・`subscribe` は、どんな概念か。

「Svelte の使い方」の説明ではなく、
**Jikko のドメイン概念が Svelte の仕組みにどう翻訳されているか**を説明します。

---

## 1. Svelte store とは何か（Jikko で言うと）

Svelte の store は「観測できる値の箱」です。

- **writable store**：外から読んでも書いてもよい箱
- **readable store**：外から読めるが書けない箱（`subscribe` のみ）
- **derived store**：他の store から自動計算される読み取り専用の値

Jikko での使い方：

```typescript
// ❌ 外から直接書かせない（writable を export しない）
const state = writable<ProtoState>(initialState);

// ✅ 読み取りのみ export（subscribe だけ持つオブジェクト）
export const appState = { subscribe: state.subscribe };

// ✅ 自動計算値を export（derived）
export const observeTasks = derived(state, ($state) => ...);
```

**なぜ `state` を直接 export しないか：**

もし `export const state = writable(...)` として export すると、
どこからでも `state.set({...})` と `state.update(...)` が呼べます。

すると「タスクを追加するとき、永続化も必ず行う」という規律を守れなくなります。
`addTask()` 関数を通すことで、「永続化を忘れた更新」を防ぎます。

---

## 2. derived store はドメインの「ビュー」

```typescript
export const orientTasks = derived(state, ($state) =>
  rankTasks($state.tasks, $state.weights),
);
```

`orientTasks` は「orient 状態のタスクをスコアリングして並べたビュー」です。

データベースの VIEW に似ています。
テーブル（`state.tasks`）が変わると、VIEW（`orientTasks`）が自動的に変わります。

**derived store の自動更新：**

1. `addTask()` が呼ばれる
2. `commitState()` で `state` が更新される
3. Svelte が `state` の変化を検知
4. `state` に依存している `orientTasks` が再計算される
5. `orientTasks` に依存している `recommendation` が再計算される
6. `recommendation` を `$recommendation` で使っている UI が自動更新される

これは手動で「データが変わったら UI を更新する」という命令を一切書かなくてよい、
ということを意味します。

---

## 3. `$` プレフィックスは何か

```svelte
<!-- App.svelte -->
<script>
  import { recommendation } from "../app/proto-state";
</script>

<!-- $recommendation で最新値を自動購読 -->
{#if $recommendation}
  <h2>{$recommendation.task.title}</h2>
{/if}
```

`$recommendation` は「recommendation store の現在値を自動購読する」という
Svelte の糖衣構文です。

内部では：
```javascript
// Svelte コンパイラが展開する（概念的なコード）
let $recommendation;
const unsubscribe = recommendation.subscribe((value) => {
  $recommendation = value;
});
onDestroy(unsubscribe);
```

コンポーネントが破棄されると自動的に `unsubscribe` が呼ばれます（メモリリークなし）。

---

## 4. OODA の各ステップと Svelte の対応

| OODA | ドメイン操作 | store の変化 | UI への影響 |
|---|---|---|---|
| observe | `addTask()` | `state.tasks` に追加 | `observeTasks` に出現 |
| orient | `saveOrientation()` | `state.tasks` 内の task が更新 | `observeTasks` から消えて `orientTasks` に出現 |
| decide | `recommendation` | 自動（derived） | hero に表示 |
| act | `startTask()` | `state.tasks` 内の task が更新 | `activeTask` に出現、他の act が消える |
| done | `completeTask()` | `state.tasks` 内の task が更新 | `activeTask` が null に |

`decide` が derived で自動計算されていることに注目してください。
ユーザが「decide」のボタンを押す必要はありません。
orient タスクが存在する時点で、常に「今やるべき1件」が計算されています。

---

## 5. writable vs derived：何をどちらで持つか

### writable で持つべきもの

- ユーザが直接変更できる値
- 永続化が必要な値
- 外部から変化する値

Jikko では：`state`（tasks・events・weights）

### derived で持つべきもの

- 他の値から計算できる値
- 「真実の単一ソース（single source of truth）」から導出される値
- 何かが変わったら自動的に変わるべき値

Jikko では：`observeTasks`・`orientTasks`・`activeTask`・`recommendation`

**同じデータを writable と derived の両方で持ってはいけません。**

例えば、`orientTasksStore = writable([])` を別に作って、
`addTask()` のたびに手動で更新すると、`state.tasks` との同期がずれるリスクがあります。

derived を使えば、`state.tasks` が唯一の真実であり続けます。

---

## 6. Svelte の reactivity とドメインの一貫性

Svelte の reactivity は「どのデータが変わったか」を自動追跡します。
これと「ドメインの一貫性を保つ」という要求は、よく噛み合います。

例：`startTask()` を呼ぶと

```typescript
commitState((snapshot) => ({
  ...snapshot,
  tasks: snapshot.tasks.map((item) =>
    item.id === taskId ? updatedTask : ensureNotAct(item)
  ),
}));
```

この一つの `state.update` で：
- 指定タスクが `act` になる
- 他の `act` タスクが `orient` に戻る（不変条件の保持）
- `activeTask` derived が自動更新される（1件だけになる）
- `recommendation` derived が自動更新される（act を前面に）
- UI が自動更新される

**手動で「UI を更新する」コードは一行も書いていません。**

これが Svelte + 不変オブジェクト更新 + derived store の組み合わせの力です。

---

## 7. 典型的な間違いパターン

### ❌ store の外で状態を持つ

```svelte
<script>
  let localTasks = []; // ← store と分離したローカル状態

  function refresh() {
    // store から手動でコピーする必要が生まれる
    localTasks = $state.tasks.filter(...);
  }
</script>
```

`localTasks` と `$state.tasks` がズレる可能性があります。
derived store を使えばこの問題は起きません。

### ❌ derived の中で副作用を起こす

```typescript
export const recommendation = derived(state, ($state) => {
  const rec = selectNextTask(...);
  saveToLocalStorage({ current: rec }); // ← 副作用！
  return rec;
});
```

derived は「計算」だけに使います。副作用はアクション関数に。

### ❌ 過度な store 分割

```typescript
// ❌ タスクを種別ごとに separate store に
export const observeTasksStore = writable<Task[]>([]);
export const orientTasksStore = writable<Task[]>([]);
export const actTaskStore = writable<Task | null>(null);
```

これらが全て同期していることを手動で保証しなければなりません。
`state.tasks` を1つの writable で持ち、derived でビューを作る方が確実です。

---

## 8. Svelte の `get()` と `$` の使い分け

```typescript
// TypeScript ファイル（.ts）の中では $ が使えない
import { get } from "svelte/store";

const currentState = get(state);
const currentRec = get(recommendation);
```

```svelte
<!-- .svelte ファイルの中では $ が使える -->
<script>
  $: console.log($recommendation); // reactive statement
</script>
```

`get()` は「今この瞬間の値を読む」スナップショット取得です。
store の変化を追いかけません。

アクション関数の中では `get(state)` を使います：

```typescript
export async function saveOrientation(taskId: string, input: OrientTaskInput) {
  const current = get(state);  // 現在の状態のスナップショットを取る
  const task = current.tasks.find((item) => item.id === taskId);
  // ...
}
```

---

## 章末の鍛錬課題

### 課題 1：derived の自作

`state` から「今日中に期限が切れる act タスク」を取り出す derived store を書いてください。

```typescript
export const expiringToday = derived(state, ($state) => {
  // 今日の23:59:59 を超える actDueAt を持つ act タスクを返す
  // ...
});
```

### 課題 2：store の依存関係の図

`proto-state.ts` の全 export store と関数について、
「何が何に依存しているか」を矢印で示した図を書いてください。

例：`orientTasks` → `state`（state が変わると orientTasks が変わる）

### 課題 3：Svelte でない場合を考える

もし Svelte ではなく素の React を使ったとして、
`derived` に相当するものをどう書きますか。
`useMemo` と `useEffect` のどちらを使いますか。それはなぜですか。
