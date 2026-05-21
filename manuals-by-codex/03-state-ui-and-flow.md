# 状態管理と UI フロー

## 1. ここは Jikko の鼓動

`../src/app/proto-state.ts` と `../src/app/App.svelte` は、今の Jikko の鼓動です。

ここでは、

- domain がどう画面に現れるか
- ユーザ操作がどう状態遷移に変わるか
- 推奨タスクがどう選ばれ、どう着手へつながるか

がほぼすべて見えます。

## 2. proto-state.ts の役割

このファイルは現在、複数の責務を兼ねています。

- セッション状態の store
- derived state の組み立て
- boot orchestration
- application service 的なユースケース
- repository 呼び出し

設計的にはやや重いですが、proto としては自然です。

大事なのは、責務が混ざっていることを自覚しつつ、意味の境界は見失わないことです。

## 2.5 設計の気持ち

ここで守ろうとしているのは、厳密な層分離そのものではありません。

先に守っているのは、

- 画面から中核ループが読めること
- 状態遷移が追えること
- 推奨と着手が離れすぎないこと

です。

その結果として、いまは `proto-state.ts` に責務が寄っています。

これは永遠の形ではありませんが、proto としては筋が通っています。

## 3. 状態の層

`TECH_STACK.md` にある通り、状態は次の 3 層で見ると理解しやすいです。

1. 永続状態
2. セッション状態
3. 導出状態

### 永続状態

- SQLite または localStorage
- `tasksRepository` が窓口

### セッション状態

- `state` writable store
- tasks, events, weights, boot を保持

### 導出状態

- `observeTasks`
- `orientTasks`
- `activeTask`
- `recommendation`

良い点は、derived を使って `画面に出す意味` をその場で再計算していることです。

これにより、元データと表示用データのズレが減ります。

## 4. recommendation は何を意味するか

`recommendation` は、今の Jikko における `意思決定の顔` です。

実装上は次のルールです。

- activeTask があれば、それが最優先
- そうでなければ orient 済みタスクから selectNextTask

この設計は重要です。

なぜなら、いったん act に入ったものを、別の推薦で簡単に押し流さないからです。

つまり、Jikko は `決めること` だけでなく、`決めたあとにやり切ること` も守ろうとしています。

## 5. initializeApp をどう読むか

起動処理は次の流れです。

1. boot 状態を loading にする
2. 保存データを読む
3. 期限切れ act を reconcile する
4. state を ready にする

ここで見逃してはいけないのは、`期限切れ act の整合` を起動時に行っていることです。

つまり Jikko は、単に保存データを復元するだけでなく、`現時点の意味に照らして状態を再解釈` しています。

これは、アプリとしてかなり良い態度です。

## 6. add / orient / start / timeout / complete

この 5 操作が、Jikko の主要ユースケースです。

### addTask

- observe タスクを作る
- `created` event を残す

### saveOrientation

- observe または orient の task を orient にする
- `oriented` または `reoriented` event

### startTask

- orient 済み task を act へ
- 他の act を `ensureNotAct` で外す

ここには `act は同時に 1 件だけ` という不変条件が埋め込まれています。

### timeoutTask

- act を orient に戻す
- progressNote を残す
- `act_timed_out` event

### completeTask

- act を done にする
- actualMinutes を計算して `completed` event

## 7. UI の読み方

`../src/app/App.svelte` は、今のところ巨大コンポーネントですが、構造は読みやすいです。

画面は大きく次の 3 領域です。

- hero
- observe dock
- rank dock

### hero

いまの主役です。

- activeTask があれば act 用の顔
- focusTask があれば orient/observe 用の顔
- 何もなければ空状態

ここで重要なのは、hero が単なる詳細表示ではなく `判断と着手の場` であることです。

### observe dock

まだ意味づけされていないタスクの置き場です。

Observe を横の strip にしているのは、`主役ではないが、いつでも取り出せる待機列` という意味に合っています。

### rank dock

orient 済み候補のランキングです。

ここも重要なのは、`すべてを読む一覧` ではなく、`hero を支える比較材料` に留めていることです。

## 8. focusTask の戦略

この UI は、次の優先順で焦点を決めています。

1. selectedTaskId
2. activeTask
3. recommendation
4. observeTasks の先頭

細部はコードの導出式を見れば分かりますが、本質は次です。

`ユーザの明示選択があれば尊重し、なければ中核ループが自然に前へ進む対象を見せる`

これは良い UX 上の判断です。

## 9. まだ大きいが、悪い肥大化ではない

`App.svelte` が大きいこと自体は、ただちに悪ではありません。

proto 段階では、

- 状態遷移の意味が画面から見える
- 条件分岐が近い
- 改修のたびにファイルを飛び回らない

という利点があります。

問題になるのは、`意味のかたまり` ではなく `見た目の部品都合` で分割し始めたときです。

## 10. 分割するなら何を先に分けるか

もし今後分割するなら、順番はこうです。

1. boot panel
2. hero の act / orient 表示差分
3. recommendation 表示専用部
4. capture form

逆に、いきなり store を大量の service 群に分けるのは危険です。

まだその前に、`どの責務が安定しているか` を見極める必要があります。

## 10.5 ありがちな誤読 / 誤実装

- `App.svelte` が大きいので、とにかく分割したくなる
  - 見た目の分割だけ先に進むと、状態遷移の読みやすさを失います。
- `proto-state.ts` を即座に service 群へ分解したくなる
  - まだ安定していない責務まで固定化し、逆に読みづらくなる危険があります。
- recommendation を UI 都合で複雑にしすぎる
  - `今の 1 件` に集中する体験が薄れます。

## 10.6 改善余地

- boot orchestration は将来的に切り出し候補
- hero の表示差分は意味の塊ごとに分けられる余地がある
- application layer を明示したくなったら、まず `start / timeout / complete` のユースケース境界から切ると安全

## 11. クリーンアーキテクチャ的に見るなら

いまの UI は完全な clean architecture ではありません。

でも、重要な種はあります。

- domain は比較的独立している
- infra は adapter として分離されている
- UI は外側にいる

足りないのは、application layer の明示だけです。

`proto-state.ts` がいまその役を兼務しているので、将来ここを `use cases` と `state adapter` に分ける余地があります。

## 12. 師匠としての一言

UI を読むときにやってはいけないのは、`見た目の部品` だけを見ることです。

本当に見るべきなのは、

- どの状態が、どの操作で
- どの順序で
- どんな約束を保ったまま変わるか

です。

良い UI は、綺麗な見た目ではなく、正しい状態遷移の表情です。

## 13. 鍛錬課題

### 課題 1

`../src/app/proto-state.ts` の exported 関数を一覧にし、それぞれがどのドメイン状態をどう変えるかを 1 行ずつで説明してください。

### 課題 2

`../src/app/App.svelte` の `hero` が、単なる詳細欄ではなく `判断と着手の場` だと言える理由を 3 つ挙げてください。

### 課題 3

UI を分割するとしたら、`今すぐ分けるべきもの` と `まだ分けない方がよいもの` を 2 つずつ書いてください。
