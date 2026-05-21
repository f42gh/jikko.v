# 10. テストを読む・テストを書く

## まず一言

テストは「動くことを確認する手順」ではありません。

> **テストは「仕様の形式化」です。「何であるべきか」を、実行可能な形で書いたもの。**

だからテストを読むと、その機能の「意図」が分かります。
そしてテストを書くことは、「意図を明文化する練習」です。

---

## 1. 現行テストの全体像

```
src/domain/scoring/engine.test.ts    スコアリングのロジックテスト
src/domain/analysis/metrics.test.ts  分析指標の計算テスト
tests/e2e/app.spec.ts                中核ループの E2E テスト
```

テストが3箇所にあるのは偶然ではありません。それぞれ役割が違います：

| ファイル | テスト対象 | 検証する問い |
|---|---|---|
| `engine.test.ts` | 純粋関数 | スコア計算は正しいか |
| `metrics.test.ts` | 純粋関数 | 分析指標は正しいか |
| `app.spec.ts` | UI + state + infra の統合 | 中核ループが動くか |

---

## 2. `engine.test.ts` を読む

```typescript
// src/domain/scoring/engine.test.ts

import { describe, expect, it } from "vitest";
import { rankTasks, scoreTask } from "./engine";
import type { Task } from "../tasks/types";

const baseTask: Task = {
  id: "task",
  title: "Important task",
  status: "orient",
  parentTaskId: null,
  observeMemo: "",
  orientMemo: "",
  roiScore: 5,
  estimatedMinutes: 30,
  actStartedAt: null,
  actDueAt: null,
  progressNote: "",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
};

describe("scoreTask", () => {
  it("produces a positive priority for a high-value task", () => {
    const recommendation = scoreTask(baseTask);

    expect(recommendation.priorityScore).toBeGreaterThan(5);
    expect(recommendation.expectedRoi).toBeGreaterThan(2);
    expect(recommendation.whyNowSummary).toContain("ROI");
  });

  it("ranks only orient tasks", () => {
    const ranked = rankTasks([
      baseTask,
      { ...baseTask, id: "observe-task", status: "observe" },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.task.id).toBe("task");
  });
});
```

### このテストが「仕様」として語っていること

**テスト1：**「高価値タスク（roiScore=5, 30分）のスコアは5より大きい」

実際に計算すると：
```
roi = 5 * 1.4 = 7.0
effortPenalty = max(1, 30/25) * 0.8 = 1.2 * 0.8 = 0.96
priorityScore = 7.0 - 0.96 = 6.04  ← 5より大きい ✅
expectedRoi = 7.0 / max(0.96, 0.5) = 7.0 / 0.96 ≈ 7.29  ← 2より大きい ✅
```

**テスト2：**「observe タスクはランキングに含まれない」

これはドメインの不変条件のテストです。
`rankTasks` が「observe をフィルタする」という仕様の形式化です。

### テストに何が書かれていないか

現行テストには欠けているものがあります：

```typescript
// 書かれていないが、あるべきテスト

it("roiScore が null のタスクはランキングに含まれない", () => {
  const nullScoreTask: Task = { ...baseTask, roiScore: null };
  expect(rankTasks([nullScoreTask])).toHaveLength(0);
});

it("estimatedMinutes が null のタスクはランキングに含まれない", () => {
  const nullMinutesTask: Task = { ...baseTask, estimatedMinutes: null };
  expect(rankTasks([nullMinutesTask])).toHaveLength(0);
});

it("effortPenalty の最小値は1（25分以下は全て同じ）", () => {
  const shortTask = { ...baseTask, estimatedMinutes: 10 };
  const mediumTask = { ...baseTask, estimatedMinutes: 25 };
  const shortScore = scoreTask(shortTask);
  const mediumScore = scoreTask(mediumTask);
  expect(shortScore.priorityScore).toBe(mediumScore.priorityScore);
});

it("ランキング順序は priorityScore の降順", () => {
  const highRoi = { ...baseTask, id: "high", roiScore: 5, estimatedMinutes: 25 };
  const lowRoi = { ...baseTask, id: "low", roiScore: 2, estimatedMinutes: 25 };
  const ranked = rankTasks([lowRoi, highRoi]);
  expect(ranked[0]?.task.id).toBe("high");
});
```

---

## 3. 良いテストの書き方

### 3.1 テスト名は「仕様の一文」として書く

```typescript
// ❌ 実装の説明
it("scoreTask calculates roi and effortPenalty", () => {...});

// ✅ 仕様の宣言
it("高価値かつ短時間タスクは高スコアになる", () => {...});
it("observe タスクはランキング対象にならない", () => {...});
it("タイムアウト後のタスクは orient に戻る", () => {...});
```

テスト名を見ただけで「何が仕様か」が分かるのが良いテストです。

### 3.2 pure function は Unit Test で、状態遷移は Integration Test で

```typescript
// Unit test（純粋関数）
it("scoreTask: roiScore=5, 30分 → priorityScore が 6.04 になる", () => {
  const result = scoreTask({ ...baseTask, roiScore: 5, estimatedMinutes: 30 });
  expect(result.priorityScore).toBeCloseTo(6.04, 2);
});

// Integration test（状態遷移を含む）
it("addTask → orientTask → startTask の流れで act になる", async () => {
  // store を初期化して、一連の操作を実行
  // 最終的に activeTask が存在することを確認
});
```

### 3.3 不変条件をテストする

```typescript
// ドメインの不変条件のテスト
it("startTask を呼ぶと他の act タスクが orient に戻る", () => {
  // 既に act のタスクがある状態で startTask を呼ぶ
  // その後、act タスクが1件だけになっていることを確認
});

it("completeTask は act タスクにしか適用できない", () => {
  const observeTask = { ...baseTask, status: "observe" };
  // completeTask を呼んでも状態が変わらないことを確認
});
```

---

## 4. テスト対象とテストしない対象

### テストすべきもの

```
✅ domain logic（純粋関数）
   - scoreTask / rankTasks
   - applyOrient / applyStartAct / applyComplete / applyTimeout
   - buildAnalysisMetrics / buildSuggestions

✅ 状態遷移の不変条件
   - observe はランキング対象外
   - act は同時に1件だけ
   - done は act を経由する

✅ エッジケース
   - roiScore が null
   - estimatedMinutes が null
   - 空の task 配列
   - act が0件の状態での completeTask
```

### テストしなくてよいもの

```
❌ UI コンポーネントの見た目
   → ピクセルレベルのテストは壊れやすい

❌ Svelte の reactivity の動き自体
   → これは Svelte フレームワークの責任

❌ localStorage / SQLite の実際の読み書き
   → これは Playwright の E2E テストでカバー

❌ `isTauriRuntime()` の結果
   → これは環境依存で単体テストでは制御しにくい
```

---

## 5. テストを書く手順

### Step 1：テストしたい「仕様」を先に日本語で書く

```
スコアリングエンジンの仕様：
1. roiScore が高く estimatedMinutes が短いタスクのスコアが高い
2. observe タスクはランキングに含まれない
3. roiScore や estimatedMinutes が null のタスクはランキングに含まれない
4. 同スコアのタスクは入力順で安定して並ぶ（後で調べる必要あり）
```

### Step 2：仕様をテストコードに翻訳する

```typescript
describe("rankTasks", () => {
  it("observe タスクはランキングに含まれない", () => {
    const orientTask: Task = { ...base, status: "orient", roiScore: 5, estimatedMinutes: 25 };
    const observeTask: Task = { ...base, id: "obs", status: "observe" };
    const ranked = rankTasks([orientTask, observeTask]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].task.id).toBe(orientTask.id);
  });

  it("roiScore が null のタスクはランキングに含まれない", () => {
    const task: Task = { ...base, status: "orient", roiScore: null };
    expect(rankTasks([task])).toHaveLength(0);
  });
});
```

### Step 3：テストを実行して失敗することを確認する

テストを書いたら、まず実行して「失敗する」ことを確認します。
これを TDD（テスト駆動開発）では「Red」と呼びます。

テストが最初から通る場合は、テスト自体が間違っている可能性があります。

### Step 4：最小の実装でテストを通す

### Step 5：リファクタリングする

---

## 6. E2E テストと Unit テストの役割分担

```
Unit test（Vitest）：
  domain logic が「正しい値を計算するか」を検証する
  実行速度：ミリ秒
  テスト数：多い

E2E test（Playwright）：
  「ユーザが観点から操作して、意図通りに動くか」を検証する
  実行速度：秒〜分
  テスト数：少ない（中核ループの主要フローのみ）
```

`tests/e2e/app.spec.ts` は「タスクを追加して orient して start して complete できる」
という中核フローを検証しています。

Unit test が全て通っても E2E が落ちることはあります。
逆に E2E が通っていても Unit test が落ちることもあります。
両方必要です。

---

## 章末の鍛錬課題

### 課題 1：欠けているテストを書く

`engine.test.ts` に、次のテストを追加してください：

1. `estimatedMinutes` が null のタスクはランキングに含まれない
2. `effortPenalty` の計算：10分・25分・45分・90分で値が変わる（または変わらない）
3. ランキング順序が `priorityScore` の降順になっている

### 課題 2：`applyTimeout` のテスト

`applyTimeout(task, progressNote)` 関数のテストを3つ書いてください。
ヒント：状態が `orient` に戻ること、`actStartedAt` が null になること、
`progressNote` が保持されることを検証する。

### 課題 3：仕様の形式化

Jikko の「act は同時に1件だけ」という不変条件を、
テストコードとして形式化してください。
どの関数をテスト対象にするか、どんな状態を作って何を検証するかを書いてください。
