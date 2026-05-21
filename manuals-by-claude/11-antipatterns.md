# 11. よくある間違いのカタログ

## この章の目的

Jikko を育てるとき、または 0 から作るとき、
**AIアシスタント・ツール・自分自身がやりがちな間違い**を具体的に列挙します。

「どう直すか」だけでなく「なぜその間違いをするか」まで書きます。
原因を理解することで、同じ罠に落ちにくくなるからです。

---

## アンチパターン 1：`decide` を status にする

### どんな間違いか

```typescript
// ❌ decide を永続 status として追加してしまう
export const taskStatusSchema = z.enum([
  "observe",
  "orient",
  "decide",  // ← 追加してしまった
  "act",
  "done",
  "archived",
]);
```

### なぜやってしまうか

「observe → orient → decide → act → done」という OODA を文字通りに実装しようとするから。

### 何が起きるか

1. `decide` 状態のタスクを表示する「決定画面」が必要になる
2. `orient → decide` の遷移処理が必要になる
3. `decide → act` の遷移処理が必要になる
4. 「决定したが着手していない」という宙吊り状態が生まれる
5. `done` が「orient 経由」「decide 経由」「act 経由」の3種類になる

UI の都合でドメインが膨らむ典型例です。

### 正しい実装

```typescript
// ✅ decide はステータスではなく処理
// orient タスクに rankTasks() を適用した結果の先頭が「決定済み」
export const recommendation = derived(
  [orientTasks, activeTask],
  ([$orientTasks, $activeTask]) => {
    if ($activeTask) return scoreTask($activeTask, weights);
    return $orientTasks[0] ?? null;  // ← これが「decide」の実体
  },
);
```

---

## アンチパターン 2：observe に多くを要求する

### どんな間違いか

```typescript
// ❌ observe の入力に詳細情報を求める
export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  observeMemo: z.string().default(""),
  category: z.string(),          // ← 追加してしまった
  dueDate: z.string().nullable(), // ← 追加してしまった
  priority: z.number().min(1).max(3), // ← 追加してしまった
});
```

### なぜやってしまうか

「最初から情報が揃っていた方が便利」という直感。
また「後で入れるの面倒だから最初に全部入れてもらおう」という設計者側の都合。

### 何が起きるか

1. タスクを「置く」コストが上がる
2. ちょっとした思いつきをすぐ記録できなくなる
3. 「後で考えようと思ったが、入力が面倒で結局忘れた」が増える
4. Jikko が「重い管理アプリ」になる

### 正しい設計

```typescript
// ✅ observe は最低限
export const createTaskInputSchema = z.object({
  title: z.string().min(1, "Title is required."),
  observeMemo: z.string().default(""),
  // 以上！
});
```

詳細は orient 段階で入れればよい。
「まず置く、後で意味をつける」が Jikko の約束です。

---

## アンチパターン 3：AI に優先順位を委ねる

### どんな間違いか

```typescript
// ❌ Claude API などに優先順位を決めさせる
async function getRecommendation(tasks: Task[]): Promise<Task> {
  const response = await claude.message({
    content: `以下のタスクで今一番やるべきものを選んでください: ${JSON.stringify(tasks)}`,
  });
  return tasks.find(t => t.title === response.recommended) ?? tasks[0];
}
```

### なぜやってしまうか

「AI の方が賢い判断をするはず」という思い込み。
また「優先順位のアルゴリズムを考えるのが面倒」という回避。

### 何が起きるか

1. **ユーザが「なぜこれか」を理解できなくなる** → 着手力が落ちる
2. **同じタスクが毎回違う推薦を返すことがある** → 信頼が崩れる
3. **誤りを修正できない** → どこを変えればよいか分からない
4. **latency が増える** → 「今やるべき1件」を出すのに API 待機が必要になる
5. **オフラインで動かない** → Jikko のローカルファースト前提と矛盾する

### 正しい役割分担

```typescript
// ✅ スコアリングは決定論的なアルゴリズム（TypeScript）
export function rankTasks(tasks: Task[], weights: ScoreWeights): Recommendation[] {
  // 同じ入力 → 同じ出力が保証される
}

// ✅ AI は「分析の補助」に限定（Python helper）
// 判断の透明性と再現性を保つため、最終判断はアルゴリズム
```

---

## アンチパターン 4：DB スキーマをドメインの真実として扱う

### どんな間違いか

```typescript
// ❌ schema の列が増えたら、domain 型にも同じものを追加する
export const taskSchema = z.object({
  // ...
  urgency: z.number(),           // ← schema に urgency があるから追加してしまった
  impact: z.number(),            // ← schema に impact があるから追加してしまった
  penaltyOfDelay: z.number(),    // ← schema に penaltyOfDelay があるから追加してしまった
});
```

### なぜやってしまうか

「DB と型が一致していた方が管理しやすい」という直感。
Drizzle ORM を使うと `$inferSelect` で型が自動生成されるため、
それをそのまま domain 型として使いたくなる誘惑がある。

### 何が起きるか

1. DB の過去の設計が domain に漏れる
2. `urgency` の意味は何か、という混乱が生まれる
3. scoring エンジンがこれらを使い始めると、説明可能性が下がる
4. 「DB を整理しようとしたら domain も全部変わった」という連鎖変更

### 正しい設計

```typescript
// ✅ domain 型は意味から定義する（DB とは独立）
// ドメインに必要なフィールドだけを持つ

// ✅ 変換は adapter（repository）で吸収する
function parseTaskRow(row: RawTaskRow): Task {
  return taskSchema.parse({
    roiScore: readNullableNumber(row, "gain_score", "gainScore", "impact"),
    // ← urgency も impact も、ドメインでは roiScore として扱う
  });
}
```

---

## アンチパターン 5：`App.svelte` を「すぐ分割」したくなる

### どんな間違いか

```
// ❌ ファイルが大きいからという理由で分割する
App.svelte → HeroSection.svelte
           + ObserveDock.svelte
           + RankDock.svelte
           + TaskCard.svelte
           + OrientForm.svelte
           + ActControls.svelte
           + BootPanel.svelte
```

### なぜやってしまうか

「大きいファイル = 悪い設計」という先入観。
また「コンポーネントを分けると再利用できる」という期待。

### 何が起きるか

1. 状態遷移の意味が複数ファイルに散らばる
2. 「どのコンポーネントがどの store を読むか」の依存が複雑になる
3. 「hero の orient フォームと rank dock の選択が連動する」という動作が
   コンポーネント境界をまたいで難しくなる
4. ファイルをまたいで追いかけないと一連の流れが読めなくなる

### 正しい判断基準

分割するときの問いは「大きいか小さいか」ではなく：

> **この部品は独立した意味のかたまりか？変更理由が他と違うか？**

```
✅ 今すぐ分けてよい：boot panel（起動シーケンスだけの関心）
✅ 今すぐ分けてよい：capture form（observe 入力だけの関心）
❌ まだ分けない：hero（act と orient の表示が密接に関連）
❌ まだ分けない：rank dock（hero との選択連携が必要）
```

---

## アンチパターン 6：`proto-state.ts` をすぐ大量分割する

### どんな間違いか

```typescript
// ❌ 全部分けてしまう
import { addTask } from "./services/TaskService";
import { orientTask } from "./services/OrientService";
import { startTask } from "./services/ActService";
import { computeRecommendation } from "./services/RecommendationService";
import { bootApp } from "./services/BootService";
import { StateManager } from "./state/StateManager";
import { TaskProjection } from "./state/TaskProjection";
```

### なぜやってしまうか

「クリーンアーキテクチャを実装したい」という意欲。
または「proto のままでは恥ずかしい」という美意識。

### 何が起きるか

1. 責務の境界がまだ安定していないのに固定してしまう
2. 後から境界が違うと分かったとき、大きなリファクタリングが必要
3. コードを読むためにファイルを何個も開く必要がある
4. 「最初は proto で良かったが、分割しすぎて読みにくくなった」という本末転倒

### 正しい分割タイミング

分割は「責務の境界が安定した」と確信できてから。

```
安定した境界から順に分けるなら：
1. domain 操作関数（applyOrient 等） → src/domain/tasks/operations.ts
2. boot orchestration → src/app/boot.ts
3. application service（addTask等） → src/app/use-cases/
```

---

## アンチパターン 7：テストなしで大きなリファクタリングをする

### どんな間違いか

「`proto-state.ts` をきれいに分割する」というリファクタリングを、
既存のテストなしで行う。

### なぜやってしまうか

テストを書くのが面倒。または「簡単なリファクタリングだから大丈夫」という過信。

### 何が起きるか

1. リファクタリング後に「何かが壊れた」と分かるが、どこが壊れたか特定が難しい
2. 「動いている気がする」が、実は corner case が壊れていた
3. 後から発見した時点でロールバックが難しい

### 正しい進め方

```
1. リファクタリング前に、現在の動作をテストで記録する
2. テストが全部通ることを確認する
3. リファクタリングする
4. テストが全部通ることを再確認する
```

domain logic の純粋関数はテストしやすいので、まずここから始めます。

---

## アンチパターン 8：完全な設計を最初から作ろうとする

### どんな間違いか

「まず完璧な設計を決めてから実装する」という進め方。

- 完璧な型定義を作る
- 完璧なディレクトリ構造を作る
- 完璧な抽象化を作る
- その後に実装する

### なぜやってしまうか

「土台がしっかりしていた方が後が楽」という期待。
また「後で変えると大変」という恐れ。

### 何が起きるか

1. 実装してみると、設計段階では見えなかった問題が出る
2. 完璧な設計の大部分が書き直しになる
3. 最初から完璧を目指したがために、「少し変える」ことへの心理的コストが高い

### 正しい進め方

> **最初は「動く最小の実装」、その後「意味に沿った整理」**

```
Week 1: 中核ループが動く（proto-state.ts は大きくてよい）
Week 2: 動くことを確認しながら、安定した境界を分離する
Week 3: テストを追加しながら、domain 操作を整理する
...
```

Jikko 自体がこの進め方で作られています。
proto-state.ts が大きいのは「失敗」ではなく「進行中」です。

---

## 章末の鍛錬課題

### 課題 1：アンチパターンの発見

この repo のコードを読んで、上記以外の「将来罠になりそうな部分」を1つ見つけてください。
「なぜ罠か」「どう改善するか」も書いてください。

### 課題 2：アンチパターン 1 の実装

アンチパターン 1（`decide` を status にする）を実際に実装してみてください。
`types.ts` と `proto-state.ts` を変更して、動かしてみてください。

その後、「何が大変だったか」を書いてください。
体験することで、なぜアンチパターンなのかが分かります。

### 課題 3：自分の傾向を知る

上記8つのアンチパターンを読んで、「自分が一番やりそうなパターン」を選んでください。
なぜそのパターンに陥りそうなのか、自分の傾向と照らし合わせて書いてください。
