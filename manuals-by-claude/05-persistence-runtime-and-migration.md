# 05. 永続化、ランタイム、移行の現実

## まず一言

この章は正直な告白から始まります。

> **DB スキーマは現在、ドメインの真実ではありません。**

`src/infra/db/schema.ts` の `tasks` テーブルには、
今の domain 型では使われていない列が大量に残っています。

これは失敗ではなく「設計の歴史」です。
しかし、「どれが現役でどれが過去の残骸か」を理解しないと、
改修のたびに混乱します。この章でその地図を示します。

---

## 1. ランタイム切り替えの仕組み

Jikko は起動環境によって保存先を切り替えます。

```typescript
// src/infra/system/tauri.ts — わずか1行の重要な判定
export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
```

```typescript
// src/infra/db/repositories/tasks-repository.ts
export const tasksRepository = {
  async load() {
    if (isTauriRuntime()) {
      return loadFromTauri();    // SQLite
    }
    return loadFromLocalStorage();  // localStorage
  },
  // ...
};
```

| 環境 | 保存先 | 用途 |
|---|---|---|
| Tauri (デスクトップ) | SQLite（Drizzle ORM） | 本番利用 |
| Web (ブラウザ) | localStorage | 開発・プロトタイプ |

**`localStorage` fallback は恥ではありません。**

web 環境でブラウザだけで素早く動作確認できるのは、開発速度に直接影響します。
Jikko のような「まず中核ループを試したい」段階では非常に有効です。

---

## 2. `tasks-repository.ts` の全容解読

repository は、domain 層と永続化層の「折衝役」です。

### `loadFromTauri`

```typescript
async function loadFromTauri(): Promise<SeedData> {
  // Tauri コマンド経由で SQL を直接実行
  const storedTasks = await invoke<RawTaskRow[]>("select_sql", {
    sql: "SELECT * FROM tasks ORDER BY created_at DESC",
    params: [],
  });
  const storedEvents = await invoke<RawTaskEventRow[]>("select_sql", {
    sql: "SELECT * FROM task_events ORDER BY created_at DESC",
    params: [],
  });

  if (storedTasks.length > 0) {
    return {
      tasks: [...storedTasks].reverse().map(parseTaskRow),  // 古→新の順に戻す
      events: [...storedEvents].reverse().map(parseTaskEventRow),
    };
  }

  // データが空の場合はシードデータを挿入
  await db.insert(tasks).values(seedDemoData.tasks.map(mapTaskRecord));
  await db.insert(taskEvents).values(seedDemoData.events);
  return { tasks: [...seedDemoData.tasks], events: [...seedDemoData.events] };
}
```

`invoke("select_sql", ...)` は Drizzle ORM を使わずに直接 Rust コマンドを呼んでいます。
Drizzle の型安全なクエリ（`db.select().from(tasks)...`）も定義されていますが、
Tauri の環境では SQLite への直接アクセスに Rust コマンドを使っています。

### `mapTaskRecord` — domain → DB の変換

```typescript
function mapTaskRecord(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.observeMemo,    // ← description に observeMemo をマップ
    status: task.status,
    parentTaskId: task.parentTaskId,
    effortEstimate: normalizeEffortEstimate(task.estimatedMinutes),  // ← 旧列にも書く
    urgency: task.roiScore ?? 3,      // ← 旧列に roiScore を代理で書く
    impact: task.roiScore ?? 3,       // ← 旧列に roiScore を代理で書く
    penaltyOfDelay: task.roiScore ?? 3,
    momentumGain: task.roiScore ?? 3,
    emotionalResistance: 2,           // ← 固定値（もう意味をなしていない）
    energyRequired: normalizeEnergyRequired(task.estimatedMinutes),
    dueAt: null,
    observeMemo: task.observeMemo,
    orientMemo: task.orientMemo,
    painScore: null,
    gainScore: task.roiScore,         // ← gainScore が実際に使われる列
    deadlineAt: null,
    estimatedMinutes: task.estimatedMinutes,
    actStartedAt: task.actStartedAt,
    actDueAt: task.actDueAt,
    progressNote: task.progressNote,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
```

**この関数が「旧 schema との互換コスト」の全てを引き受けています。**

`urgency`・`impact`・`penaltyOfDelay`・`momentumGain` には全て `roiScore` の値を書いています。
これは「旧 schema を持つ DB でも壊れないようにする」ための暫定措置です。

### `parseTaskRow` — DB → domain の変換

```typescript
function parseTaskRow(row: RawTaskRow): Task {
  return taskSchema.parse({
    id: readString(row, "id"),
    title: readString(row, "title"),
    status: normalizeTaskStatus(readString(row, "status")),
    parentTaskId: readNullableString(row, "parent_task_id", "parentTaskId"),
    observeMemo: readNullableString(row, "observe_memo", "observeMemo", "description") ?? "",
    orientMemo: readNullableString(row, "orient_memo", "orientMemo") ?? "",
    roiScore: readNullableNumber(row, "gain_score", "gainScore", "impact"),  // ← 複数列を試す
    estimatedMinutes: readNullableNumber(row, "estimated_minutes", "estimatedMinutes"),
    // ...
  });
}
```

`readNullableString(row, "observe_memo", "observeMemo", "description")` は、
3つのキーを順番に試しています。列名が変わっても（旧: `description`、新: `observe_memo`）
どちらからでも読めるようにしています。

`roiScore: readNullableNumber(row, "gain_score", "gainScore", "impact")` も同様で、
`gain_score`・`gainScore`・`impact` のどれかから読みます。

**これは「旧データとの互換を adapter で吸収する」パターンの実例です。**

---

## 3. schema の現役列と旧列の地図

```typescript
// src/infra/db/schema.ts — tasks テーブル

// ✅ 現役：domain Task 型に直接対応する列
id, title, status, parentTaskId
observeMemo, orientMemo
estimatedMinutes
actStartedAt, actDueAt
progressNote
createdAt, updatedAt

// ⚠️ 過渡期：現役だが domain の呼び名と違う
description  → observeMemo の旧名（まだ読み書きされる）
gainScore    → roiScore の旧名（まだ読み書きされる）

// 🗑️ 旧列：現在の domain では意味がなく、互換のためだけに存在
effortEstimate     （旧コスト評価。normalizeEffortEstimate で計算されて書かれるだけ）
urgency            （旧緊急度。roiScore の代理値が書かれる）
impact             （旧影響度。roiScore の代理値が書かれる）
penaltyOfDelay     （旧遅延コスト。roiScore の代理値が書かれる）
momentumGain       （旧モメンタム。roiScore の代理値が書かれる）
emotionalResistance（旧感情的抵抗。固定値 2 が書かれる）
energyRequired     （旧エネルギー消費。normalizeEnergyRequired で計算）
dueAt              （旧期限。null が書かれる）
painScore          （旧苦痛スコア。null が書かれる）
deadlineAt         （旧デッドライン。null が書かれる）
```

**旧列が残っている理由：既存の SQLite ファイルとの互換性。**

もし旧列を削除してマイグレーションしようとすると、
古い DB ファイルを持つユーザのデータが読めなくなる危険があります。

---

## 4. `normalizeTaskStatus` — 旧ステータス名の互換

```typescript
function normalizeTaskStatus(status: string): Task["status"] {
  switch (status) {
    case "observe":
    case "orient":
    case "act":
    case "done":
    case "archived":
      return status;          // 現行ステータスはそのまま
    case "pending":
      return "observe";       // 旧 "pending" → 現 "observe"
    case "active":
    case "doing":
    case "in_progress":
      return "act";           // 旧 "doing" etc → 現 "act"
    case "completed":
      return "done";          // 旧 "completed" → 現 "done"
    default:
      return "observe";       // 不明なステータスは observe へ
  }
}
```

これも adapter がドメインを守っている例です。

DB には旧ステータス名で保存されたデータがあっても、
domain 層には現在の OODA ステータスしか渡りません。

---

## 5. Tauri 側の schema 初期化

```rust
// src-tauri/src/main.rs（一部）
fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            -- ... 旧列も全て含む
            urgency INTEGER NOT NULL DEFAULT 3,
            impact INTEGER NOT NULL DEFAULT 3,
            -- ...
        )"
    )?;
}
```

Rust 側でも SQLite の schema 初期化を行っています。
これは Drizzle の schema 定義と二重化しています。

**問題点：**
- 列を追加するとき、Drizzle schema と Rust の SQL の両方を変える必要がある
- どちらかを忘れると、データが正しく保存されない

**将来の解決策の候補：**
1. Rust 側を source of truth にして、Drizzle は読み取りのみに使う
2. Drizzle migration ファイルを source of truth にして、Rust は読み込むだけ
3. どちらかを廃止する

今はどちらも動いているが、長期的には整理が必要です。

---

## 6. migration の考え方

旧列を削除する migration を組むなら、この順番で：

```
Step 1: 現行 code path で使っている列を特定する（上の地図を参照）

Step 2: 削除候補列への書き込みをまず止める（mapTaskRecord から削除）
         → この時点で既存データが壊れないことを確認

Step 3: 削除候補列からの読み取りフォールバックを整理する（parseTaskRow）
         → 旧列がなくても正しく読めることを確認

Step 4: Drizzle schema から旧列を削除

Step 5: Rust 側の schema 初期化から旧列を削除

Step 6: SQLite の実ファイルに対して ALTER TABLE ... DROP COLUMN
         （SQLite 3.35.0 以降でサポート）
```

**急がない。破壊的な操作は最後。**

---

## 7. localStorage は廃止対象ではない

```typescript
async function loadFromLocalStorage(): Promise<SeedData> {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw) as SeedData;
  }
  // なければシードデータで初期化
  const initial = { tasks: [...seedDemoData.tasks], events: [...seedDemoData.events] };
  saveToLocalStorage(initial);
  return initial;
}
```

localStorage 版は domain 型のオブジェクトをそのまま JSON 保存しています。
これは DB の schema 変換が不要なため、**domain が変わったときに追随コストがゼロ**です。

開発中に schema を頻繁に変えるなら、localStorage が一番速い。
Tauri 版は実際の SQLite 保存テストに使う、という使い分けができます。

---

## 章末の鍛錬課題

### 課題 1：adapter の役割理解

`mapTaskRecord` と `parseTaskRow` がそれぞれ「何を守っているか」を
1文で説明してください。ヒント：どちらの方向の変換か、何を汚染から守るか。

### 課題 2：旧列の棚卸し

`src/infra/db/schema.ts` を開き、上の「現役列 / 過渡期 / 旧列」の分類を
自分で再確認してください。私の分類と違う箇所があれば、理由を書いてください。

### 課題 3：migration 計画

`painScore` 列を削除する migration を組む場合、
Step 1〜6 のどのステップで何をするかを具体的に書いてください。
`mapTaskRecord` と `parseTaskRow` をどう変更しますか。
