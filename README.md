# CPA Study Tracker

公認会計士試験の勉強時間を計測するアプリ。予定は Google スプレッドシートで立て、アプリのカレンダーに表示します。

## できること

- **タイマー**：科目ごとに勉強時間を計測（一時停止・休憩つき）、1日のタイムライン、記録の手動追加・編集
- **カレンダー**：スプレッドシートの予定と、日ごとの勉強時間を表示
- **記録**：連続日数、試験日までの日数、7 / 14 / 30日の勉強時間グラフ
- **スプレッドシート同期**：予定の読み込みと、勉強時間の書き込み（設定方法は [`apps-script/README.md`](./apps-script/README.md)）
- **バックアップ**：設定画面から記録を JSON ファイルに書き出し・読み込み

記録はブラウザの localStorage に保存されます。旧バージョンのタイマー記録・科目設定・試験日はそのまま引き継がれます。

## 開発

```sh
npm install
npm start      # 開発サーバー
npm run build  # 本番ビルド
```

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/tanaka11180526-hue/react-xzxr3bkk56)
