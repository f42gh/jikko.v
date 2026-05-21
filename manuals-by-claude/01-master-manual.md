# 01. 全体地図と現在地

## まず一言

この repo は**思想は強く、構造はまだ途中**です。

これは批判ではありません。事実の描写です。

この事実を正確に掴めれば、改修で失ってはいけないものと、
壊してよいものを見分けられるようになります。それがこの章の目的です。

---

## 1. Jikko が守ろうとしている唯一の約束

Jikko の核心は、次の一文に収まります。

> **今やるべきことを 1 件、迷わず始められる。**

タスク管理アプリではありません。
「着手」と「完了」を最大限に支援するアプリです。

この区別は決定的に重要です。なぜなら、設計のすべての判断はここから導かれるからです。

- なぜ `observe` はランキング対象外か → まだ着手できる状態じゃないから
- なぜ `act` は同時に 1 件か → 2 件は「着手」ではなく「迷い」だから
- なぜ `done` は `act` を経由しないといけないか → 実行なき完了は意味がないから
- なぜ AI に優先順位を委ねないか → 自分で選ぶ納得感が着手力を生むから

設計の迷いが生じたとき、常にこの一文に戻ってください。

---

## 2. ディレクトリ全体地図

```
jikko.v/
│
├── BRIDGE.md          判断の憲法。agent 向けと書いてあるが、
│                      実際にはあなた自身が読む最優先文書。
│
├── DESIGN.md          体験の憲法。UX ドグマが書いてある。
│
├── TECH_STACK.md      技術構成の現実。schema の旧列についての
│                      正直な告白も含む。
│
├── src/
│   ├── app/
│   │   ├── App.svelte        画面全体。現在は大きい単一ファイル。
│   │   └── proto-state.ts    状態の本体。ここが今の Jikko の心臓。
│   │
│   ├── domain/               ← ここが「意味の領域」
│   │   ├── tasks/
│   │   │   ├── types.ts      Task とは何か。最重要ファイルの一つ。
│   │   │   └── factory.ts    新規タスクの産声。哲学が1関数に凝縮。
│   │   │
│   │   ├── scoring/
│   │   │   ├── types.ts      Recommendation 型の定義。
│   │   │   ├── defaults.ts   重みのデフォルト値。
│   │   │   └── engine.ts     優先順位の算出。Jikko の判断の核。
│   │   │
│   │   ├── planning/
│   │   │   └── select-next.ts  最終1件を選ぶ関数。今は1行。
│   │   │
│   │   ├── history/
│   │   │   └── metrics.ts    完了履歴の集計。
│   │   │
│   │   └── analysis/
│   │       ├── types.ts      分析型定義。
│   │       ├── metrics.ts    詳細分析指標の計算。
│   │       └── suggestions.ts  補正提案の生成。
│   │
│   └── infra/                ← ここが「現実との折衝領域」
│       ├── db/
│       │   ├── schema.ts     Drizzle スキーマ。旧列が残る現実。
│       │   ├── client.ts     DB 接続。
│       │   ├── types.ts      TaskEvent 型。
│       │   ├── seed.ts       初期デモデータ。
│       │   └── repositories/
│       │       └── tasks-repository.ts  永続化の折衝役。最重要 infra ファイル。
│       │
│       └── system/
│           ├── tauri.ts      runtime 判定（1関数だが重要）。
│           └── analysis-helper.ts  Python プロセスとの橋渡し。
│
└── src-tauri/
    ├── src/main.rs           Rust 製ホスト。SQLite 初期化・Tauri commands。
    └── resources/
        └── analysis_helper.py  補助分析プロセス。
```

---

## 3. 実装を読む正しい順番

間違った順番：Tauri → DB → UI → domain
正しい順番：domain → 状態 → UI → infra

理由は単純です。「何を扱っているか」が分からないまま「どう保存するか」を読んでも意味がありません。

```
1. src/domain/tasks/types.ts        ← Jikkoが世界をどう切り取るか
2. src/domain/tasks/factory.ts      ← 新しいTaskがどう生まれるか
3. src/domain/scoring/types.ts      ← Recommendationとは何か
4. src/domain/scoring/engine.ts     ← 優先順位をどう計算するか
5. src/domain/planning/select-next.ts ← 最終的に誰が選ばれるか
6. src/app/proto-state.ts           ← 状態遷移の全容
7. src/app/App.svelte               ← UIが状態をどう表現するか
8. src/infra/db/repositories/tasks-repository.ts ← 現実との折衝
9. src/infra/db/schema.ts           ← 保存の都合（過去の痕跡込み）
10. src-tauri/src/main.rs           ← デスクトップアプリとしての殻
```

---

## 4. どこが「真実」か

この repo を読むとき、**どこを真実とみなすか**を間違えると急に苦しくなります。

| 領域 | 真実の所在 |
|---|---|
| プロダクトの意味 | `BRIDGE.md` + `DESIGN.md` |
| Task ドメインの定義 | `src/domain/tasks/types.ts` |
| 優先順位ロジック | `src/domain/scoring/engine.ts` |
| 状態遷移の全容 | `src/app/proto-state.ts` |
| 永続化の現実 | `src/infra/db/schema.ts`（旧列含む） |

**DB スキーマは現在、ドメインの真実ではありません。**

domain 型が意図した未来の姿で、DB は過去との互換を抱えた現実です。
だから `src/infra/db/schema.ts` の `urgency`・`impact`・`penaltyOfDelay` などの列は、
今の domain では使っておらず、それが正しい状態です。

---

## 5. 今の実装の強みと弱み

### 強み（壊してはいけない）

**1. OODA の状態設計が明確**

`observe → orient → act → done` というライフサイクルは、コード上でも一貫しています。
`types.ts` の型定義が Zod スキーマで守られており、不正な状態への移行はできません。

**2. スコアリングが決定論的**

同じ入力が与えられれば、必ず同じスコアが返ります。
これはランダム性や AI ブラックボックスに対する意識的な対抗です。

**3. ローカルファーストの前提がぶれない**

Tauri ランタイムと web ランタイムを `isTauriRuntime()` で切り替えていますが、
domain ロジックはどちらにも依存していません。

**4. domain と infra を分ける意志がある**

完全ではないが、`domain/` が `infra/` に依存していません。
依存方向が正しい方向を向いています。

### 弱み（過渡期ゆえの問題）

**1. `proto-state.ts` が責務過多**

このファイルは現在、以下を全部担っています：
- Svelte store の定義（状態管理）
- boot orchestration（起動シーケンス）
- application service（ユースケース）
- repository 呼び出し（永続化アクセス）

これは `proto` だから許容されていますが、将来は分離が必要です。

**2. DB schema に旧多因子列が残る**

`urgency`・`impact`・`penaltyOfDelay`・`momentumGain`・`emotionalResistance`・
`energyRequired`・`painScore`・`dueAt`・`deadlineAt` などは
現在の domain で使われていませんが、SQLite テーブルには残っています。

**3. `TaskEvent` に未使用の種別がある**

`decided`・`decomposed`・`archived` は型定義には存在しますが、
現行の UI で発行されていません。

---

## 6. 改修するときの判断軸

何かを変えるとき、必ず次を自問してください。

> **この変更は、ユーザが今の 1 件に着手しやすくなるか。**

答えが「分からない」なら、一旦手を止めてください。
答えが「Yes」なら、次を確認します。

- `observe` はランキング対象外のままか
- `act` は同時に 1 件のままか
- `done` は `act` を経由するままか
- 優先順位の根拠は説明できるか

これらが守られていれば、実装の手段は自由です。

---

## 7. この repo を参考に「自分の Jikko」を作るとは

コードの模写ではありません。

```
× コードをコピーして動かす
○ 判断基準を理解して、自分で書き直す
```

具体的には：

1. この repo が守ろうとしている約束を見抜く（本章）
2. その約束を実現する最小実装を自分の頭で設計する（08章）
3. よい部分だけを選んで持ち帰る
4. 過渡期の構造は持ち帰らない

---

## 章末の鍛錬課題

### 課題 1：プロダクト約束の言語化

Jikko の「唯一の約束」を、自分の言葉で 1 文に書いてください。
条件：「タスク管理」という言葉を使わないこと。

### 課題 2：設計判断の根拠

`act` を同時に複数許可する実装を想像してください。
何が崩れますか。3 つ、根拠と共に書いてください。

### 課題 3：現在地の評価

この repo の「強みと弱み」を、自分でもう一度書いてください。
私が書いたものと違ってもかまいません。自分の言葉で言えることが大事です。
