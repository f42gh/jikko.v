# Jikko 師匠マニュアル

このディレクトリは、`/Users/f42/dev/jikko.v` 全体を教材として読み解き、`本当に実現したかった Jikko` を未来の自分の手で育て直すための取扱説明書です。

これは単なるファイル一覧ではありません。

- Jikko が何を約束するプロダクトなのか
- どのコードがその約束を担っているのか
- どこが美しく、どこが過渡期なのか
- どう直すと芯を強くできるのか
- DDD やクリーンアーキテクチャを、この repo にどう翻訳すべきか

を、`少し先を歩く師匠` のつもりで、過度に美化せず具体的に書いています。

## 最初に読む順番

1. `../BRIDGE.md`
2. `../DESIGN.md`
3. `../TECH_STACK.md`
4. `./01-master-manual.md`
5. 必要に応じて個別テーマ

この順番には意味があります。

- `BRIDGE.md` は判断の優先順位を教える
- `DESIGN.md` は何を守るべき UX かを教える
- `TECH_STACK.md` は現実の構成を教える
- `01-master-manual.md` はそれらと実装を接続する

つまり、`思想 -> 体験 -> 構成 -> 実装` の順で読むのが基本です。

## 既存文書との関係

`manuals/` は、既存の `BRIDGE.md`、`DESIGN.md`、`TECH_STACK.md` を置き換えるものではありません。

位置づけは次の通りです。

- `BRIDGE.md`
  - 判断の憲法
- `DESIGN.md`
  - 体験の憲法
- `TECH_STACK.md`
  - 現実の構成図
- `manuals/`
  - それらを未来の自分が使える知恵へ翻訳する補助層

つまり `manuals/` は、解釈、育成、再理解のための層です。

## 個別テーマ

- [01-master-manual.md](./01-master-manual.md)
  - ディレクトリ全体の読解、全体地図、開発の基本姿勢
- [02-core-loop-and-domain.md](./02-core-loop-and-domain.md)
  - OODA、中核ループ、Task/Event、DDD 的な核の捉え方
- [03-state-ui-and-flow.md](./03-state-ui-and-flow.md)
  - `App.svelte` と `proto-state.ts` をどう読むか
- [04-scoring-and-explanation.md](./04-scoring-and-explanation.md)
  - 優先順位ロジック、説明可能性、透明な判断の作り方
- [05-persistence-runtime-and-migration.md](./05-persistence-runtime-and-migration.md)
  - SQLite / Drizzle / Tauri / localStorage と移行の考え方
- [06-architecture-philosophy-and-shuhari.md](./06-architecture-philosophy-and-shuhari.md)
  - DDD、クリーンアーキテクチャ、守破離、よりよいソフトウェアとは何か

## 各章の読み方

個別章は、できるだけ同じ型で書いています。

- その章の主題
- 現行 repo の具体参照
- 設計の気持ち
- ありがちな誤読 / 誤実装
- 今後の改善余地
- 章末の鍛錬課題

この順番には理由があります。

先に答えを読むのではなく、`何を守る構造か` を掴んでから、`どこを直すか` を考えるためです。

## このマニュアルの前提

この文書群は、今の Jikko を次のように見ています。

- かなり強いプロダクト思想を持っている
- ドメインの方向は良い
- 実装はまだ proto と移行途中の設計が混在している
- だからこそ、自分で理解して、自分で再建する価値が大きい

もし未来のあなたが全面リライトを選ぶとしても、このマニュアルは無駄になりません。

なぜなら、捨てるべきコードと、絶対に捨ててはいけない思想を分離して理解できるようになるからです。
