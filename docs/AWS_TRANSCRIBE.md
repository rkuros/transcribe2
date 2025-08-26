# AWS Transcribeの統合について

本アプリケーションはAWS Transcribeサービスを使用した文字起こし機能をサポートしています。この文書では、AWS Transcribeの設定方法と使用方法について説明します。

## 設定方法

### 1. AWS CLIの設定

AWS Transcribeを使用するには、まずAWS CLIを設定する必要があります。ターミナルで以下のコマンドを実行してください。

```bash
aws configure
```

プロンプトに従って、以下の情報を入力してください。
- AWS Access Key ID
- AWS Secret Access Key
- Default region name（例：ap-northeast-1）
- Default output format（例：json）

### 2. 必要なIAM権限

AWS Transcribeを使用するアカウントには、以下の権限が必要です：

- `transcribe:StartTranscriptionJob`
- `transcribe:GetTranscriptionJob`
- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`

### 3. S3バケットについて

アプリケーションは自動的に必要なS3バケットを作成します。バケット名は以下の形式で作成されます：
```
transcribe-audio-temp-rkuros-{リージョン名}
```

同じリージョンで再度使用する場合は、既存のバケットを再利用します。

## 使用方法

### 1. モデルの選択

アプリケーションの「モデルとオプション選択」セクションから、以下のAWS Transcribeモデルを選択できます。

- **AWS Transcribe 一般**：一般的な音声向けのモデル
- **AWS Transcribe Medical**：医療関連の専門用語に最適化されたモデル

### 2. リージョンの選択

AWS Transcribeを使用する際は、以下のリージョンから選択できます。

- 東京 (ap-northeast-1)
- 大阪 (ap-northeast-3)
- バージニア (us-east-1)
- オレゴン (us-west-2)

### 3. 処理の流れ

AWS Transcribeを使用した文字起こし処理の流れは以下の通りです：

1. 音声ファイルがS3バケットにアップロードされる
2. AWS Transcribeジョブが開始される
3. ジョブの完了を待機する
4. S3から結果ファイルを取得する
5. 結果を解析して表示する

## トラブルシューティング

### 認証エラー

AWS認証情報が正しく設定されていない場合、以下のエラーが表示されることがあります。
```
AWS認証情報またはクライアントの初期化に失敗しました
```

対処法：`aws configure`コマンドで認証情報を再設定してください。

### S3バケットエラー

既存のバケットにアクセスできない場合は以下のエラーが発生することがあります。
```
S3バケットの確認または作成に失敗しました
```

対処法：AWS管理コンソールで該当のS3バケットの権限設定を確認するか、バケットを手動で削除して再作成してください。

### リージョンの選択

AWS Transcribeの精度は選択するリージョンによって変わる場合があります。日本語の文字起こしには「東京 (ap-northeast-1)」または「大阪 (ap-northeast-3)」リージョンを推奨します。

## 注意事項

- AWS Transcribeは従量課金制サービスです。使用量に応じて料金が発生します。
- 大きな音声ファイルの場合、処理に時間がかかることがあります。
- AWS Transcribe使用時は音声データがAWSのサーバーに送信されます。機密情報を含む音声を処理する際はご注意ください。

## GiNZAフォーマット

AWS Transcribeで文字起こしした後も、GiNZAフォーマットオプションを有効にすることで、テキストを自然な段落に分けることができます。