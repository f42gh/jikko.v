# 永続化、ランタイム、移行の現実

## 1. この文書が必要な理由

Jikko を読むとき、多くの人は domain までは気持ちよく理解できます。

しかし本当に詰まりやすいのは、そのあとです。

- なぜ localStorage と SQLite が両方あるのか
- なぜ schema に旧列が残っているのか
- なぜ Tauri 側でも schema を持っているのか
- どこまでが過去との互換で、どこからが現在の真実か

ここを曖昧にすると、改修のたびに `何を壊してよいか` が分からなくなります。

## 2. いまの保存戦略

Jikko は runtime によって保存先を切り替えています。

### web runtime

- `localStorage`
- `tasksRepository` が `loadFromLocalStorage` を使う

### tauri runtime

- `SQLite`
- `Drizzle ORM`
- 必要に応じて Tauri command 経由の SQL

`../src/infra/system/tauri.ts` と `../src/infra/db/repositories/tasks-repository.ts` が入口です。

## 3. repository の役割

`../src/infra/db/repositories/tasks-repository.ts` は、現実との折衝役です。

ここでは次を担っています。

- runtime 判定
- load / create / update / appendEvent
- DB row と domain Task の変換
- localStorage seed 管理

DDD や clean architecture でいうなら、かなり明確な `adapter` の役目です。

## 3.5 設計の気持ち

ここで守りたいのは、保存方式の美しさよりも `ドメインを汚さないこと` です。

ローカルアプリとして現実的に動かしつつ、

- web では素早く試せる
- tauri ではちゃんと保存できる
- 過去の痕跡は adapter で受け止める

という折衷が選ばれています。

## 4. なぜ schema に旧列が残っているのか

`../src/infra/db/schema.ts` と `../src-tauri/src/main.rs` を読むと分かる通り、tasks table には今の domain 型では使っていない列が残っています。

例:

- `urgency`
- `impact`
- `penalty_of_delay`
- `momentum_gain`
- `emotional_resistance`
- `energy_required`
- `pain_score`

これは失敗ではなく、設計の履歴です。

おそらく初期には、より多因子な評価モデルを見据えていた名残です。

いま大事なのは、この過去を責めることではありません。

大事なのは、

- いま本当に使っている列は何か
- 互換のためだけに残っている列は何か
- いつ消せるか

を見えるようにすることです。

## 5. domain が真実、schema は現実

この repo では、設計上の良い読み方があります。

`Task domain 型が意味の真実。DB schema は保存の都合を含んだ現実。`

これはとても重要です。

なぜなら、もし DB schema を唯一の真実としてしまうと、旧列まで含めて domain を汚染し始めるからです。

いまはむしろ逆です。

- domain を守る
- adapter で過去と折り合う
- 徐々に schema を追いつかせる

この順序でよいです。

## 6. parse / map の層が救っているもの

repository には次の関数があります。

- `mapTaskRecord`
- `parseTaskRow`
- `parseTaskEventRow`

これらは地味ですが、非常に大切です。

なぜなら、ここがあるおかげで `保存形式の歪み` を domain に漏らさずに済んでいるからです。

この種の関数を見て、

`面倒だから domain 型を DB に合わせよう`

と考えるのは危険です。

むしろ逆で、こういう面倒こそ adapter が引き受けるべきです。

## 7. Tauri 側に schema 初期化がある理由

`../src-tauri/src/main.rs` は、アプリ配布物として自立できるよう、SQLite schema を Rust 側でも初期化しています。

これはローカルデスクトップ app として自然な判断です。

ただし課題もあります。

- Drizzle schema と Rust の SQL が二重化する
- 列追加時の追随漏れリスクがある
- 移行の責務が散る

将来は、どこを source of truth にするかをもっと明確にしてもよいでしょう。

## 8. migration をどう考えるべきか

今後 schema を整理するとき、いきなり全部を消してはいけません。

順番があります。

1. 現行 code path で使っている列を特定する
2. 互換列を一覧化する
3. 読み取りフォールバックを残したまま、書き込みを新列中心にする
4. seed / tests / tauri init を追随させる
5. 最後に不要列を削る

移行は `正しさ` だけでなく、`恐怖を減らすこと` でもあります。

## 9. localStorage は恥ではない

proto 段階の localStorage を見て、すぐに軽視してはいけません。

これは web runtime の素早い反復には非常に有効です。

Jikko のように、

- まず中核ループを試したい
- デスクトップ配布も視野にある
- でも最初から重くしたくない

という状況では、localStorage fallback は合理的です。

問題は fallback の存在ではなく、意味が不明なまま肥大化することです。

## 10. Python helper の位置づけ

`../src/infra/system/analysis-helper.ts` と `../src-tauri/resources/analysis_helper.py` は、補助分析のための経路です。

ここで大切なのは、

- recommendation の本体は TypeScript に残す
- Python は分析補助に限定する
- 失敗しても UI を止めない

という設計態度です。

これは非常に健全です。

AI や数値分析を導入するときの良い原則は、`中核判断から距離を置いた位置で働かせる` ことです。

## 11. きれいにするとしたら次に何をするか

私なら次の順で整理します。

1. schema の現役列 / 互換列一覧を文書化する
2. repository mapper にコメントで変換意図を残す
3. Rust 側 schema 初期化との重複を整理する
4. 旧多因子列を段階的に廃止する
5. task event の利用実態を棚卸しする

## 11.5 ありがちな誤読 / 誤実装

- schema にある列をすべて現役ドメインだと思ってしまう
  - 過渡期の互換列まで domain に逆流します。
- 面倒だから domain を DB へ寄せたくなる
  - 未来の整理余地が消えます。
- Rust 側 schema と Drizzle schema の二重化を、即悪と決めつける
  - ローカル配布アプリとしての事情もあるので、まず役割を理解する必要があります。

## 11.6 改善余地

- 現役列と互換列の表を別文書として持てる
- mapper 関数の意図をより明示できる
- schema の source of truth をどこへ寄せるか、将来の方針を決められる

## 12. 師匠としての一言

良い保存設計とは、`美しいテーブル定義` のことではありません。

本当に良いのは、

- domain を汚さず
- 過去との互換を引き受け
- 未来の整理に向けた逃げ道を残す

設計です。

泥臭い adapter は、しばしば良いソフトウェアの良心です。

## 13. 鍛錬課題

### 課題 1

`../src/infra/db/repositories/tasks-repository.ts` を読み、`mapTaskRecord` と `parseTaskRow` が何を守っているかを 150 文字以内で説明してください。

### 課題 2

`../src/infra/db/schema.ts` にある列のうち、現行 domain が直接使っていないものを 5 つ抜き出してください。

### 課題 3

旧列を整理する migration を考えるときの手順を、Jikko 向けに 4 ステップで書いてください。
