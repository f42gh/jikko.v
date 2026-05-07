# Tauri とはなにか

## ひとことで言うと

Tauri は、Web 技術で作った画面を、デスクトップアプリとして動かすための仕組みです。

jikko では、画面は React と TypeScript で作り、アプリとしての起動、ウィンドウ表示、ローカル SQLite への接続などを Tauri が担当しています。

## 何を解決してくれるのか

普通の React アプリは、基本的にはブラウザ上で動きます。

しかし jikko は、次のような性質を持ちたいアプリです。

- 認証なしで、個人用アプリとして使える
- データを自分の PC の中に保存する
- SQLite のようなローカル DB を使う
- 将来的に通知、バックアップ、ファイル出力などを扱いたい

こういう場合、普通の Web アプリとして作るより、デスクトップアプリとして作る方が自然です。

Tauri はそのために、Web の UI と OS 側の機能をつなぐ橋になります。

## Tauri の中身

Tauri アプリは、大きく分けると 2 つの部分でできています。

### フロントエンド

jikko ではここです。

- `src/`
- React
- TypeScript
- Vite
- Tailwind CSS

ユーザが見る画面、ボタン、フォーム、スコア表示などを担当します。

### バックエンド

jikko ではここです。

- `src-tauri/`
- Rust
- Tauri
- rusqlite

デスクトップアプリとしての起動、ローカルファイル、SQLite、OS との接続を担当します。

## このリポジトリではどこにあるか

Tauri の中心は次のファイルです。

- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

`src-tauri/src/main.rs` では、主に次のことをしています。

- アプリ用のデータ保存場所を決める
- `jikko.sqlite` という SQLite ファイルの場所を作る
- 必要なテーブルを作る
- フロントエンドから SQL を実行できる command を公開する

フロントエンド側では、`src/infra/db/client.ts` が Tauri の command を呼び出します。

つまり、ざっくり言うとこうです。

```text
React の画面
  ↓
src/infra/db/client.ts
  ↓
Tauri command
  ↓
src-tauri/src/main.rs
  ↓
SQLite
```

## なぜ Electron ではなく Tauri なのか

似た選択肢に Electron があります。

Electron も、Web 技術でデスクトップアプリを作るための仕組みです。VS Code や Slack などでも使われています。

Tauri は Electron と比べると、一般的に次のような特徴があります。

- アプリサイズを小さくしやすい
- メモリ使用量を抑えやすい
- OS に入っている WebView を使う
- OS 側の処理は Rust で書く

jikko は個人用の軽いローカルアプリを目指しているので、Tauri の軽さとローカル志向が合っています。

## なぜ jikko に合っているのか

jikko の前提は、一般的な SaaS とは少し違います。

- 当面は 1 人で使う
- ログインはいらない
- クラウド同期は v1 の中心ではない
- タスク、スコア、履歴をローカルに保存したい
- 認知負荷を下げる中核体験に集中したい

Tauri を使うと、サーバ、認証、クラウド DB などを最初から大きく用意しなくても、ローカルで完結するアプリを作れます。

そのぶん、jikko の本質である「今やるべきことを決める」「なぜ今なのかを説明する」「完了履歴を返す」に集中できます。

## 開発中によく使うコマンド

Web UI だけを確認するときは、次を使います。

```bash
npm run dev
```

Tauri のデスクトップアプリとして確認するときは、次を使います。

```bash
npm run tauri dev
```

フロントエンドをビルドするときは、次を使います。

```bash
npm run build
```

Rust 側が壊れていないか見るときは、次を使います。

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 注意点

Tauri は便利ですが、React だけで完結するアプリよりは考えることが増えます。

特に次の境界を意識する必要があります。

- 画面側のコードは `src/`
- OS や SQLite に近いコードは `src-tauri/`
- 両者の橋渡しは Tauri command

この境界をきれいに保つと、jikko は育てやすくなります。

逆に、画面側から直接なんでも SQLite に触ろうとしたり、Rust 側に UI 判断を入れすぎたりすると、あとで見通しが悪くなります。

## jikko での現在地

今の jikko では、Tauri の土台はすでにあります。

ただし、画面上のタスク操作はまだ完全には SQLite に保存されていません。

現在は、`src/infra/db/seed.ts` のデモデータを読み込み、`src/state/task-store.ts` のメモリ上でタスク追加、開始、完了、ランキング再計算をしています。

次の大きな実装は、ここを Tauri 経由の SQLite 永続化につなぐことです。

## 覚え方

Tauri は、jikko にとって「React で作った考える画面」を「ローカルに保存できる本物のデスクトップアプリ」にするための外骨格です。

React がユーザとの会話部分なら、Tauri は PC の中でアプリとして生きるための身体です。
