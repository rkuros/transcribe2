D# 設計文書

## 概要

音声文字起こしElectronアプリケーションは、メインプロセスとレンダラープロセスの分離アーキテクチャを採用し、Pythonベースの音声処理ライブラリ（Demucs、faster-whisper、OpenAI Whisper）をNode.jsの子プロセスとして統合する。UIはReact + TypeScriptで構築し、音声処理の進捗をリアルタイムで表示する。

## アーキテクチャ

### 高レベルアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron メインプロセス                    │
├─────────────────────────────────────────────────────────────┤
│  • ファイルシステムアクセス                                    │
│  • Pythonプロセス管理                                       │
│  • IPC通信                                                │
│  • モデル管理                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Electron レンダラープロセス                  │
├─────────────────────────────────────────────────────────────┤
│  • React UIコンポーネント                                    │
│  • 進捗可視化                                              │
│  • テキストエディター                                        │
│  • エクスポート機能                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 子プロセス
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Python 音声処理                         │
├─────────────────────────────────────────────────────────────┤
│  • Demucs（音声分離）                                       │
│  • faster-whisper（Small/Medium）                         │
│  • OpenAI Whisper（Large-v3-turbo）                      │
│  • 音声フォーマット変換                                      │
└─────────────────────────────────────────────────────────────┘
```

### 技術スタック

- **フロントエンド**: React 18 + TypeScript + Tailwind CSS
- **デスクトップフレームワーク**: Electron 28+
- **音声処理**: Python 3.9+ with Demucs, faster-whisper, openai-whisper
- **プロセス通信**: Node.js child_process + Python subprocess
- **状態管理**: React Context + useReducer
- **ファイル処理**: Electron's dialog API + Node.js fs

## コンポーネントとインターフェース

### メインプロセスコンポーネント

#### AudioProcessingManager
```typescript
interface AudioProcessingManager {
  processAudio(filePath: string, options: ProcessingOptions): Promise<TranscriptionResult>
  separateAudio(filePath: string): Promise<string> // ボーカルトラックパスを返す
  transcribeAudio(filePath: string, model: WhisperModel): Promise<string>
  getAvailableModels(): Promise<WhisperModel[]>
  checkDependencies(): Promise<DependencyStatus>
}
```

#### FileManager
```typescript
interface FileManager {
  selectAudioFile(): Promise<string | null>
  exportTranscription(content: string, format: ExportFormat, filePath: string): Promise<void>
  validateAudioFile(filePath: string): Promise<boolean>
  getAudioMetadata(filePath: string): Promise<AudioMetadata>
}
```

### レンダラープロセスコンポーネント

#### MainWindowコンポーネント
- ファイル選択インターフェース
- モデル選択ドロップダウン
- 処理進捗表示
- 文字起こしテキストエディター
- エクスポートコントロール

#### ProgressIndicatorコンポーネント
- リアルタイム進捗バー
- 推定残り時間
- 現在の処理段階インジケーター
- 操作キャンセルボタン

#### TextEditorコンポーネント
- 編集可能な文字起こし結果
- 自動保存機能
- アンドゥ/リドゥ機能
- テキストフォーマットオプション

#### ModelSelectorコンポーネント
- Whisperモデルのラジオボタン選択
- モデル情報ツールチップ
- パフォーマンスインジケーター（速度 vs 精度）

### データモデル

#### ProcessingOptions
```typescript
interface ProcessingOptions {
  model: WhisperModel
  enableAudioSeparation: boolean
  outputFormat: ExportFormat
  language?: string
}
```

#### WhisperModel
```typescript
enum WhisperModel {
  FASTER_WHISPER_SMALL = 'faster-whisper-small',
  FASTER_WHISPER_MEDIUM = 'faster-whisper-medium',
  OPENAI_WHISPER_LARGE_V3_TURBO = 'openai-whisper-large-v3-turbo'
}
```

#### TranscriptionResult
```typescript
interface TranscriptionResult {
  text: string
  segments?: TranscriptionSegment[]
  processingTime: number
  modelUsed: WhisperModel
  audioSeparationUsed: boolean
}
```

#### TranscriptionSegment
```typescript
interface TranscriptionSegment {
  start: number
  end: number
  text: string
  confidence?: number
}
```

## エラーハンドリング

### Pythonプロセスエラーハンドリング
- 長時間実行プロセスのタイムアウト処理
- メモリ使用量監視と制限
- モデルが利用できない場合の優雅な劣化
- ユーザーフレンドリーなメッセージ付き詳細エラーログ

### ファイルシステムエラーハンドリング
- 無効なファイルフォーマット検出
- ディスク容量不足警告
- 権限エラー処理
- 破損ファイル検出

### モデル読み込みエラーハンドリング
- 不足モデル検出とダウンロード提案
- モデル互換性検証
- 利用可能モデルへのフォールバック
- 明確なインストール指示

## テスト戦略

### ユニットテスト
- Python音声処理関数
- Electron IPC通信
- Reactコンポーネントレンダリング
- ファイルシステム操作

### 統合テスト
- エンドツーエンド音声処理パイプライン
- モデル切り替え機能
- エクスポートフォーマット生成
- 進捗レポート精度

### パフォーマンステスト
- 大きなファイル処理能力
- メモリ使用量最適化
- 処理時間ベンチマーク
- 並行操作処理

### ユーザー受け入れテスト
- 音質評価
- 文字起こし精度検証
- UI/UXワークフローテスト
- クロスプラットフォーム互換性（macOS重視）

## セキュリティ考慮事項

### ローカル処理
- すべての音声処理がローカルで発生
- 外部サーバーへのデータ送信なし
- 処理後の一時ファイルクリーンアップ
- 安全なファイルパス処理

### Python環境分離
- サンドボックス化されたPython環境
- Pythonプロセスの限定的ファイルシステムアクセス
- プロセスリソース制限
- 安全なサブプロセス実行

## パフォーマンス最適化

### 音声処理
- 大きなファイルのチャンク処理
- 可能な場合の並列処理
- メモリ効率的な音声読み込み
- 一時ファイル管理

### UI応答性
- ノンブロッキング音声処理
- 段階的結果表示
- 効率的なReact再レンダリング
- バックグラウンドタスク管理

## デプロイメント戦略

### アプリケーションパッケージング
- macOSアプリパッケージング用Electron Builder
- Python環境バンドリング
- モデル事前インストールオプション
- 自動アップデーター統合

### モデル配布
- 初回実行時のオプションモデルダウンロード
- ローカルモデルキャッシュ
- モデルバージョン管理
- 帯域幅効率的ダウンロード