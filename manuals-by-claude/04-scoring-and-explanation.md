# 04. スコアリングと説明可能性

## まず一言

Jikko のスコアリングで大事なのは「精度」ではありません。

> **「なぜ今これなのか」を、ユーザが自分で理解できること。**

説明できない推薦は、どれだけ精密でも Jikko では無価値です。
逆に、単純でも説明できる推薦は、着手力を生みます。

---

## 1. スコアリングの全体構造

```
入力:
  roiScore (1〜5)        ← ユーザが設定する「価値評価」
  estimatedMinutes       ← ユーザが設定する「コスト見積もり」
  weights (roi, effortPenalty)  ← システムのデフォルト重み

計算:
  roi = roiScore * weights.roi
  effortPenalty = max(1, estimatedMinutes / 25) * weights.effortPenalty
  priorityScore = roi - effortPenalty
  expectedRoi = roi / max(effortPenalty, 0.5)

出力:
  priorityScore    ← ランキング基準値
  expectedRoi      ← リターン効率（ROI / コスト）
  whyNowSummary    ← 説明文字列
  breakdown        ← { roi, effortPenalty }（内訳）
```

---

## 2. コードを読む

```typescript
// src/domain/scoring/engine.ts

export function scoreTask(
  task: Task,
  weights: ScoreWeights = defaultScoreWeights,
): Recommendation {
  const roi = (task.roiScore ?? 1) * weights.roi;
  const effortPenalty = calculateEffortPenalty(task.estimatedMinutes) * weights.effortPenalty;

  const priorityScore = roi - effortPenalty;
  const expectedRoi = roi / Math.max(effortPenalty, 0.5);

  return {
    task,
    priorityScore,
    expectedRoi,
    whyNowSummary: buildWhyNowSummary({ roi, effortPenalty }),
    breakdown: { roi, effortPenalty },
  };
}

function calculateEffortPenalty(estimatedMinutes: number | null) {
  if (!estimatedMinutes) {
    return 1;  // デフォルトペナルティ
  }
  return Math.max(1, estimatedMinutes / 25);  // 25分を基準に1以上
}
```

```typescript
// src/domain/scoring/defaults.ts
export const defaultScoreWeights: ScoreWeights = {
  roi: 1.4,
  effortPenalty: 0.8,
};
```

---

## 3. 実際の数値で計算する

具体的な例で計算してみます。

### タスク A：重要だが長い

```
roiScore = 5（とても価値が高い）
estimatedMinutes = 90（長い）
weights = { roi: 1.4, effortPenalty: 0.8 }

roi = 5 * 1.4 = 7.0
effortPenalty = max(1, 90/25) * 0.8
             = max(1, 3.6) * 0.8
             = 3.6 * 0.8 = 2.88

priorityScore = 7.0 - 2.88 = 4.12
expectedRoi = 7.0 / max(2.88, 0.5) = 7.0 / 2.88 = 2.43
```

### タスク B：中程度の価値で短い

```
roiScore = 3（普通の価値）
estimatedMinutes = 25（標準的な長さ）

roi = 3 * 1.4 = 4.2
effortPenalty = max(1, 25/25) * 0.8
             = max(1, 1) * 0.8
             = 1 * 0.8 = 0.8

priorityScore = 4.2 - 0.8 = 3.4
expectedRoi = 4.2 / max(0.8, 0.5) = 4.2 / 0.8 = 5.25
```

### 比較

| タスク | priorityScore | expectedRoi |
|---|---|---|
| A（roi=5, 90分） | **4.12** | 2.43 |
| B（roi=3, 25分） | 3.4 | **5.25** |

ランキング順位は A が上（priorityScore が高い）。
しかし効率（expectedRoi）は B の方が高い。

この結果は「重要で長いタスク」と「中程度で短いタスク」では
どちらを優先すべきかが文脈依存であることを示しています。

Jikko が `expectedRoi` を別で計算して表示する理由はここです：
「今一番やるべきもの（priorityScore）」と「効率が高いもの（expectedRoi）」が
必ずしも一致しないことを、ユーザに見せるためです。

---

## 4. `effortPenalty` の設計意図

`effortPenalty = max(1, estimatedMinutes / 25)` という式には意図があります。

- 25分以下のタスクは全て `effortPenalty = 1`（ペナルティ最小）
- 25分を超えると線形にペナルティが増える
- 25分が「基準単位」（ポモドーロに近い）

なぜ25分か。

これは「今の文脈で着手できる最小単位」に近い時間として選ばれています。
10分のタスクも25分のタスクも同じペナルティ（1）なのは、
どちらも「今すぐ始められる」という意味で同等だからです。

```
10分 → effortPenalty = max(1, 10/25) = max(1, 0.4) = 1
25分 → effortPenalty = max(1, 25/25) = max(1, 1.0) = 1
45分 → effortPenalty = max(1, 45/25) = max(1, 1.8) = 1.8
90分 → effortPenalty = max(1, 90/25) = max(1, 3.6) = 3.6
```

---

## 5. weights は何のためにあるか

```typescript
// src/domain/scoring/defaults.ts
export const defaultScoreWeights: ScoreWeights = {
  roi: 1.4,          // roi の重み（effortPenalty より大きい）
  effortPenalty: 0.8,
};
```

`roi: 1.4 > effortPenalty: 0.8` は意図的です。

Jikko は「価値を重視する」設計になっています。
もしこれを逆にすると（effortPenalty > roi）、常に短いタスクが上位になり、
重要な長期タスクが永遠に後回しになります。

この `weights` は将来、`analysis/suggestions.ts` が動的に調整する仕組みがあります：

```typescript
// src/domain/analysis/suggestions.ts
if (summary.timeoutRate >= 0.35) {
  suggestions.push({
    id: "raise-effort-penalty",
    recommendedWeights: {
      effortPenalty: roundToTenth(weights.effortPenalty + 0.2),  // 0.8 → 1.0
    },
    // ...
  });
}
```

タイムアウト率が 35% 以上なら「短いタスクをもっと優先しては？」と提案します。

---

## 6. `whyNowSummary` — 今は単純だが将来重要

```typescript
// engine.ts
function buildWhyNowSummary(breakdown: Recommendation["breakdown"]) {
  return `ROI ${breakdown.roi.toFixed(1)} / Cost ${breakdown.effortPenalty.toFixed(1)}`;
}
```

現在は数値の羅列です。これでも「何を見て判断したか」は分かります。

しかし本当に良い `whyNowSummary` は、3層の説明を持つべきです：

```
Layer 1（一言）: "短く終わるわりに見返りが大きい"
Layer 2（内訳）: "ROI 7.0 / Cost 0.8"
Layer 3（比較）: "他の候補より effortPenalty が最も低い"
```

改善するときは `buildWhyNowSummary` の中だけを変えればよく、
外からは `whyNowSummary: string` が変わらないので互換性は保たれます。

---

## 7. なぜ AI に委ねないか

`DESIGN.md` には「AI に中核判断を委ねない」とあります。
これは技術制約ではなく**プロダクト哲学**です。

AI に優先順位を委ねると何が起きるか：

1. **ユーザが学習できなくなる** — なぜこれが選ばれたか分からない
2. **信頼が崩れる** — 「なんか違う」と思っても直し方が分からない
3. **判断の感覚が育たない** — roiScore を何にすべきか自分で考えなくなる
4. **調整ができない** — ブラックボックスを修正するには再学習が必要

Jikko の目的は「ユーザが自分で判断できるよう支援する」ことです。
AI が全部判断してしまうと、この目的と矛盾します。

分析補助（Python helper）は使いますが、**最終判断はユーザとアルゴリズムの組み合わせ**です。

---

## 8. `analysis/metrics.ts` とスコアリングの関係

スコアリングは「今やるべき1件」を選ぶ。
分析は「スコアリングの精度を後から点検する」。

```typescript
// src/domain/analysis/metrics.ts
function estimateRealizedRoi(
  estimatedRoi: number,
  estimatedMinutes: number,
  actualMinutes: number,
  timeoutCount: number,
  reorientedCount: number,
) {
  const scheduleFactor = clamp(estimatedMinutes / Math.max(actualMinutes, 1), 0.55, 1.15);
  const interruptionPenalty = timeoutCount * 0.12 + reorientedCount * 0.08;
  return roundToTenth(clamp(
    estimatedRoi * scheduleFactor * (1 - interruptionPenalty),
    0.4,
    5
  ));
}
```

`realizedRoi`（実現ROI）は次のように計算されます：

- `scheduleFactor`: 見積もり時間 / 実際の時間。見積もりより短く終わったら > 1
- `interruptionPenalty`: タイムアウトで 12%、再評価で 8% 減
- 範囲は 0.4〜5.0 にクランプ

これが `estimatedRoi` と大きくズレていたら、「見積もりが甘かった」というシグナルです。

`suggestions.ts` はこの差分を使って `weights` の調整を提案します。

---

## 9. スコアリングを拡張するなら

将来的に追加するとしたら、この順番を推奨します：

```
1. タイムアウト履歴による軽微なペナルティ
   （同じタスクが3回タイムアウトしていたら少し下げる）

2. reorientation 率による不確実性補正
   （何度も再評価されたタスクはスコアを割り引く）

3. 連続重タスク回避
   （90分タスクが続かないよう、planningで選定）

4. 「今日の残り時間」との整合
   （残り2時間なら、45分以下のタスクを優先）
```

**最初から複雑にしてはいけません。**

理由：特徴量を増やすほど「なぜこのスコアか」が説明しにくくなります。
Jikko の価値は説明可能性にあるので、複雑さは直接 Jikko の価値を削ります。

---

## 章末の鍛錬課題

### 課題 1：手計算

以下の2タスクのスコアを手計算してください（weights はデフォルト）：

- タスク X：roiScore = 4、estimatedMinutes = 45
- タスク Y：roiScore = 2、estimatedMinutes = 10

どちらの `priorityScore` が高いですか。どちらの `expectedRoi` が高いですか。
この結果は直感と一致しますか。もし違和感があれば、どこが問題だと思いますか。

### 課題 2：weights の意味

`weights = { roi: 1.0, effortPenalty: 1.0 }` に変えると、
ランキングの傾向はどう変わりますか。
「どんなユーザに向いている weights か」を言語化してください。

### 課題 3：`whyNowSummary` の改善

現在の `whyNowSummary` を改善して、「一言の理由 / 内訳 / 比較理由」の3層版を
TypeScript 関数として書いてください。
ただし `buildWhyNowSummary` のシグネチャを変えずに済む方法で書いてください。
