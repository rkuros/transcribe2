# Audio Transcription App

Macで動作するローカル音声文字起こしアプリケーション。Demucsによる音声分離とWhisperモデルによる文字起こしを組み合わせて高品質な文字起こしを実現します。

## 機能

- **音声分離**: Demucsを使用して音声ファイルからボーカルトラックを抽出
- **複数の文字起こしモデル**: faster-whisper small/medium、OpenAI Whisper large-v3-turbo、AWS Transcribe から選択可能
- **テキスト編集**: 文字起こし結果を編集・フォーマット可能
- **複数フォーマットでのエクスポート**: テキスト(.txt)、Word文書(.docx)、字幕(.srt)
- **ハイブリッド処理**: ローカルまたはクラウド処理を選択可能（Whisper = ローカル、AWS Transcribe = クラウド）

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

### 6. AWS Transcribeの設定（オプション）

AWS Transcribeを使用する場合は、AWS CLIで認証情報を設定してください。

```bash
aws configure
```

AWSアカウントにS3とTranscribeへのアクセス権限が必要です。

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
- [開発ガイド](docs/development.md) - 開発環境とGitリポジトリの管理（開発者向け）
- [GiNZAフォーマット機能](docs/GINZA_FORMATTING.md) - テキスト整形の技術詳細
- [AWS Transcribeの利用](docs/AWS_TRANSCRIBE.md) - AWS Transcribeの設定と使用方法

## クイックスタート

### 依存関係の確認

アプリケーションを実行する前に、以下の依存関係を確認してください:

1. Pythonのバージョンを確認: `python --version` (3.9以上が必要)
2. FFmpegがインストールされていることを確認: `ffmpeg -version`
3. Python依存関係をインストール: `pip install -r src/python/requirements.txt`
4. Demucsをインストール: `pip install demucs`
5. Whisperをインストール: `pip install faster-whisper` または `pip install openai-whisper`
6. AWSモデルを使用する場合: `pip install boto3 awscli`

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
- [AWS Transcribe](https://aws.amazon.com/jp/transcribe/) - AWSによる高精度音声認識サービス
- [GiNZA](https://megagonlabs.github.io/ginza/) - 日本語NLPライブラリ
- [Electron](https://www.electronjs.org/) - デスクトップアプリケーションフレームワーク