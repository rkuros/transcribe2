# Audio Transcription App

Macで動作するローカル音声文字起こしアプリケーション。Demucsによる音声分離とWhisperモデルによる文字起こしを組み合わせて高品質な文字起こしを実現します。

## 機能

- **音声分離**: Demucsを使用して音声ファイルからボーカルトラックを抽出
- **複数の文字起こしモデル**: faster-whisper small/medium、OpenAI Whisper large-v3-turboから選択可能
- **テキスト編集**: 文字起こし結果を編集・フォーマット可能
- **複数フォーマットでのエクスポート**: テキスト(.txt)、Word文書(.docx)、字幕(.srt)
- **オフライン処理**: すべての処理がローカルで実行され、プライバシーを確保

## 必要条件

- **macOS** 10.15以上
- **Node.js** 16以上
- **Python** 3.9以上
- **FFmpeg**

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/transcribe2.git
cd transcribe2
```

### 2. Node.jsの依存関係をインストール

```bash
npm install
```

### 3. Pythonの依存関係をインストール

```bash
pip install -r src/python/requirements.txt
```

### 4. FFmpegのインストール

Homebrewを使用してインストール:

```bash
brew install ffmpeg
```

### 5. Whisperモデルのダウンロード

faster-whisperのsmallモデルをダウンロード:

```bash
python -c "from faster_whisper import download_model; download_model('small')"
```

mediumモデルも使用する場合:

```bash
python -c "from faster_whisper import download_model; download_model('medium')"
```

OpenAI Whisper large-v3-turboを使用する場合:

```bash
python -c "import whisper; whisper.load_model('large-v3')"
```

## 開発

開発モードで実行:

```bash
# まず、TypeScriptをビルド
npm run build:dev

# 開発サーバーとElectronを起動
npm run dev
```

または、直接実行:

```bash
npm run build:dev && npm run start
```

## ビルド

アプリケーションをビルド:

```bash
npm run build
```

macOS用にパッケージ化:

```bash
npm run package
```

パッケージ化されたアプリは`release`ディレクトリに生成されます。

## ドキュメント

- [使い方ガイド](docs/getting-started.md) - アプリケーションの基本的な使い方
- [トラブルシューティング](docs/troubleshooting.md) - 問題解決のためのガイド
- [アーキテクチャ概要](docs/architecture.md) - アプリケーションの技術的構造（開発者向け）

## クイックスタート

### 依存関係の確認

アプリケーションを実行する前に、以下の依存関係を確認してください:

1. Pythonのバージョンを確認: `python --version` (3.9以上が必要)
2. FFmpegがインストールされていることを確認: `ffmpeg -version`
3. Python依存関係をインストール: `pip install -r src/python/requirements.txt`
4. Demucsをインストール: `pip install demucs`
5. Whisperをインストール: `pip install faster-whisper` または `pip install openai-whisper`

### 一般的な問題と解決方法

#### TorchおよびTorchaudioのバージョン不一致エラー

音声分離機能が「無効」と表示される場合、以下のコマンドで解決できます:

```bash
pip uninstall torch torchaudio
pip install torch==2.2.0 torchaudio==2.2.0
```

その他の問題については、[トラブルシューティングガイド](docs/troubleshooting.md)を参照してください。

## ライセンス

[MIT](LICENSE)

## 謝辞

- [Demucs](https://github.com/facebookresearch/demucs) - Facebook Researchによる音源分離システム
- [faster-whisper](https://github.com/guillaumekln/faster-whisper) - WhisperのCUDA実装
- [OpenAI Whisper](https://github.com/openai/whisper) - OpenAIによる音声認識システム
- [Electron](https://www.electronjs.org/) - デスクトップアプリケーションフレームワーク