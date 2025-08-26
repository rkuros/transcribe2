# 開発ガイド

このドキュメントは、音声文字起こしアプリケーションの開発者向けのガイドです。

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [ビルドと実行](#ビルドと実行)
3. [Gitリポジトリの管理](#gitリポジトリの管理)
4. [依存関係の管理](#依存関係の管理)
5. [トラブルシューティング](#トラブルシューティング)

## 開発環境のセットアップ

### 必要条件

- **Node.js** 16以上
- **npm** 7以上
- **Python** 3.9以上
- **FFmpeg**

### セットアップ手順

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/rkuros/transcribe2.git
   cd transcribe2
   ```

2. Node.js依存関係をインストール:
   ```bash
   npm install
   ```

3. Python依存関係をインストール:
   ```bash
   pip install -r src/python/requirements.txt
   ```

## ビルドと実行

### 開発モードで実行

```bash
# 開発用ビルド
npm run build:dev

# 開発サーバーとElectronを起動
npm run dev
```

または、一度にビルドして実行:

```bash
npm run build:dev && npm run start
```

### 本番モードでビルド

```bash
# 本番用ビルド
npm run build

# アプリケーションを実行
npm run start
```

### パッケージングとリリース

```bash
# macOS用にパッケージ化
npm run package
```

パッケージ化されたアプリは`release`ディレクトリに生成されます。

## Gitリポジトリの管理

### リポジトリ情報

- リポジトリURL: [https://github.com/rkuros/transcribe2.git](https://github.com/rkuros/transcribe2.git)
- メインブランチ: `main`

### Git操作

#### 変更をプッシュ

コードの変更をGitHubリポジトリにプッシュする際、企業のファイアウォールや制限がある場合は`--no-verify`オプションが必要な場合があります:

```bash
git add .
git commit -m "コミットメッセージ"
git push --no-verify
```

#### リポジトリのセットアップ (新しい環境の場合)

新しい環境でリポジトリをセットアップする手順:

```bash
# 新しいリポジトリの初期化
git init

# ファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit"

# リモートリポジトリを追加
git remote add origin https://github.com/rkuros/transcribe2.git

# ブランチ名を設定
git branch -M main

# GitHubにプッシュ (必要に応じて--no-verifyオプションを使用)
git push -u origin main --no-verify
```

## 依存関係の管理

### TorchとTorchaudioのバージョン互換性

音声分離機能を正常に動作させるには、TorchとTorchaudioの互換性のあるバージョンを使用する必要があります:

```bash
pip uninstall torch torchaudio
pip install torch==2.2.0 torchaudio==2.2.0
```

この組み合わせは、Demucsを使用した音声分離機能の動作確認済みです。

### Whisperモデルのインストール

初回実行時にWhisperモデルがダウンロードされますが、手動でダウンロードすることもできます:

```bash
# faster-whisperのsmallモデル
python -c "from faster_whisper import download_model; download_model('small')"

# faster-whisperのmediumモデル
python -c "from faster_whisper import download_model; download_model('medium')"

# OpenAI Whisper large-v3モデル
python -c "import whisper; whisper.load_model('large-v3')"
```

## トラブルシューティング

### GitHubプッシュの問題

企業環境などで`git push`が失敗する場合:

- `--no-verify`オプションを使用してプッシュ
- SSH接続を試す: `git remote set-url origin git@github.com:rkuros/transcribe2.git`
- 代替として、GitHub CLIを使用: `gh repo create`

### 音声分離の問題

Demucs関連のエラーが発生する場合:

- TorchとTorchaudioのバージョンを確認し、必要に応じて上記のコマンドで互換性のあるバージョンをインストール
- Python環境のパスが正しく設定されていることを確認