import { BrowserWindow } from 'electron';
import { WhisperModel } from '../common/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { 
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  ListTranscriptionJobsCommand,
  LanguageCode,
  MediaFormat
} from '@aws-sdk/client-transcribe';
import { S3Client, BucketLocationConstraint, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fromIni } from '@aws-sdk/credential-providers';
import * as https from 'https';

// AWS音声処理マネージャークラス
export class AWSAudioProcessingManager {
  private mainWindow: BrowserWindow | null;
  private callbacks: ((data: any) => void)[] = [];
  private s3Client: S3Client | null = null;
  private transcribeClient: TranscribeClient | null = null;
  private region: string = 'ap-northeast-1'; // デフォルトリージョン（東京）
  private bucketName: string;

  // バケット名を生成
  private static readonly DEFAULT_BUCKET_PREFIX = 'transcribe-audio-temp-rkuros';
  private static createdBuckets: Set<string> = new Set<string>();
  
  // 一意なバケット名を取得
  private getBucketName(): string {
    // ユーザー固有のバケット名を生成
    const defaultBucket = `${AWSAudioProcessingManager.DEFAULT_BUCKET_PREFIX}-${this.region}`;
    
    // 既に作成済みのバケットがあればそれを返す
    if (AWSAudioProcessingManager.createdBuckets.has(this.region)) {
      return defaultBucket;
    }
    
    // 初回はバケットを新規作成、作成済みバケットリストに追加
    AWSAudioProcessingManager.createdBuckets.add(this.region);
    return defaultBucket;
  }

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
    
    // バケット名は初期化では設定せず、実際の処理時にリージョン情報を含めて取得する
    this.bucketName = '';
  }

  // 音声処理メソッド - ファイルパスとオプションを受け取り、処理結果を返す
  async processAudio(filePath: string, options: any) {
    try {
      const startTime = Date.now();
      console.log('AWS Transcribeでの処理を開始:', filePath);
      console.log('処理オプション:', JSON.stringify(options));

      // 指定されたリージョンがあれば更新
      if (options.awsRegion) {
        this.region = options.awsRegion;
      }
      
      // リージョンに応じてバケット名を生成
      this.bucketName = this.getBucketName();
      console.log(`使用するS3バケット名: ${this.bucketName} (リージョン: ${this.region})`);

      // クライアントを初期化
      await this.initializeClients();

      // ファイルをS3にアップロード
      const uploadResult = await this.uploadFileToS3(filePath);
      
      // 文字起こしを実行
      const transcriptionResult = await this.transcribeAudio(
        uploadResult.s3Uri,
        options
      );

      // 処理時間を計算
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        ...transcriptionResult,
        processingTime,
        modelUsed: options.model,
        audioSeparationUsed: false // AWS Transcribeは音声分離を行わない
      };
    } catch (error) {
      console.error('AWS処理エラー:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('python-error', {
          message: `AWS Transcribeでの処理中にエラーが発生しました`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }

  // AWSクライアントの初期化
  private async initializeClients() {
    try {
      console.log('AWS認証情報を読み込み中...');
      const credentials = fromIni();
      
      console.log(`S3クライアントを初期化中 (リージョン: ${this.region})...`);
      this.s3Client = new S3Client({
        region: this.region,
        credentials
      });
      
      console.log(`Transcribeクライアントを初期化中 (リージョン: ${this.region})...`);
      this.transcribeClient = new TranscribeClient({
        region: this.region,
        credentials
      });
      
      // S3バケットが存在するか確認し、なければ作成
      await this.ensureBucketExists();
      
      return { s3Client: this.s3Client, transcribeClient: this.transcribeClient };
    } catch (error) {
      console.error('AWS クライアント初期化エラー:', error);
      throw new Error(`AWS認証情報またはクライアントの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // S3バケットが存在することを確認し、存在しなければ作成
  private async ensureBucketExists() {
    if (!this.s3Client) {
      throw new Error('S3クライアントが初期化されていません');
    }

    try {
      console.log(`S3バケット ${this.bucketName} の存在を確認中...`);
      
      try {
        // バケットが存在するか確認
        await this.s3Client.send(new HeadBucketCommand({
          Bucket: this.bucketName
        }));
        console.log(`S3バケット ${this.bucketName} は既に存在します`);
      } catch (error) {
        // バケットが存在しない場合は作成
        if ((error as any).name === 'NotFound' || (error as any).name === 'NoSuchBucket') {
          try {
            console.log(`S3バケット ${this.bucketName} は存在しません。作成します...`);
            await this.s3Client.send(new CreateBucketCommand({
              Bucket: this.bucketName,
              CreateBucketConfiguration: {
                LocationConstraint: this.region !== 'us-east-1' ? 
                  this.region as BucketLocationConstraint : 
                  undefined
              }
            }));
            console.log(`S3バケット ${this.bucketName} を作成しました`);
            
            // バケットポリシーを設定して、Transcribeが結果を書き込めるようにする
            console.log('バケットポリシーを設定中...');
            await this.setBucketPolicy();
          } catch (bucketCreateError) {
            // バケット作成中に別エラーが発生した場合
            // BucketAlreadyExistsエラーは無視（他の誰かが先に作成した場合）
            if ((bucketCreateError as any).name === 'BucketAlreadyExists') {
              console.log(`バケット名 ${this.bucketName} は既に別のユーザーによって使用されています。バケットポリシーの設定を試みます`);
              try {
                await this.setBucketPolicy();
              } catch (policyError) {
                console.error('既存バケットのポリシー設定エラー:', policyError);
                // ポリシー設定ができなくても続行する
              }
            } else {
              throw bucketCreateError;
            }
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('バケット確認/作成エラー:', error);
      throw new Error(`S3バケットの確認または作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // S3バケットポリシーを設定
  private async setBucketPolicy() {
    if (!this.s3Client) {
      throw new Error('S3クライアントが初期化されていません');
    }
    
    try {
      // バケットポリシーの設定はパブリックポリシーをブロックする設定があるため、スキップ
      console.log('バケットポリシーの設定をスキップします。S3バケットに対する権限はユーザーのIAMポリシーから得る必要があります');
      // 特にアクションは必要ない
    } catch (error) {
      console.error('バケットポリシー設定エラー:', error);
      throw error;
    }
  }

  // ファイルをS3にアップロード
  private async uploadFileToS3(filePath: string) {
    if (!this.s3Client) {
      throw new Error('S3クライアントが初期化されていません');
    }

    try {
      console.log(`ファイルを確認中: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが存在しません: ${filePath}`);
      }
      
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const timestamp = Date.now();
      const objectKey = `uploads/${timestamp}/${fileName}`;
      
      console.log(`S3にアップロード中: s3://${this.bucketName}/${objectKey}`);
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: objectKey,
          Body: fileContent
        }
      });
      
      upload.on('httpUploadProgress', (progress) => {
        const loaded = progress.loaded || 0;
        const total = progress.total || 1;
        const percent = Math.round((loaded / total) * 100);
        console.log(`アップロード進捗: ${percent}%`);
        
        // 進捗状況をレンダラーに送信
        this.reportProgress({
          stage: 'uploading',
          percent: percent,
          message: `ファイルをAWSにアップロード中: ${percent}%`
        });
      });
      
      await upload.done();
      console.log('アップロード完了');
      
      const s3Uri = `s3://${this.bucketName}/${objectKey}`;
      return { objectKey, s3Uri };
    } catch (error) {
      console.error('S3アップロードエラー:', error);
      throw new Error(`S3へのファイルアップロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 音声文字起こしを実行
  private async transcribeAudio(mediaUri: string, options: any) {
    if (!this.transcribeClient) {
      throw new Error('Transcribeクライアントが初期化されていません');
    }

    try {
      const jobName = `transcription_job_${Date.now()}`;
      console.log(`文字起こしジョブを開始: ${jobName}`);
      
      // ファイルの拡張子から適切なメディアフォーマットを判断
      const fileExtension = path.extname(mediaUri).toLowerCase().slice(1);
      let mediaFormat: MediaFormat;
      
      switch (fileExtension) {
        case 'mp3':
          mediaFormat = MediaFormat.MP3;
          break;
        case 'mp4':
          mediaFormat = MediaFormat.MP4;
          break;
        case 'wav':
          mediaFormat = MediaFormat.WAV;
          break;
        case 'flac':
          mediaFormat = MediaFormat.FLAC;
          break;
        default:
          mediaFormat = MediaFormat.MP3; // デフォルト
      }
      
      // 言語設定
      let languageCode: LanguageCode = LanguageCode.JA_JP; // デフォルトは日本語
      if (options.language) {
        switch (options.language.toLowerCase()) {
          case 'en':
          case 'english':
            languageCode = LanguageCode.EN_US;
            break;
          case 'ja':
          case 'japanese':
          default:
            languageCode = LanguageCode.JA_JP;
        }
      }
      
      // ジョブ開始コマンド作成
      const command = new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        Media: {
          MediaFileUri: mediaUri
        },
        MediaFormat: mediaFormat,
        LanguageCode: languageCode,
        OutputBucketName: this.bucketName,
        Settings: options.awsCustomVocabularyName ? {
          VocabularyName: options.awsCustomVocabularyName
        } : undefined
      });
      
      // 医療特化モデルの場合の設定
      if (options.model === WhisperModel.AWS_TRANSCRIBE_MEDICAL) {
        // 医療特化モデルの設定は必要に応じて追加
        // AWS SDKのバージョンによっては以下のプロパティが存在しない場合があります
        // command.input.SpecialtyName = 'PRIMARYCARE';
        // command.input.Type = 'DICTATION';
      }
      
      // ジョブ開始
      const response = await this.transcribeClient.send(command);
      console.log('ジョブ開始レスポンス:', response);
      
      // ジョブ完了を待機
      this.reportProgress({
        stage: 'processing',
        percent: 0,
        message: '文字起こし処理を開始しました'
      });
      
      // ジョブの完了をポーリングで確認
      const jobResult = await this.pollJobCompletion(jobName);
      
      // 完了したジョブのIDを保存
      console.log('完了したジョブID:', jobName);
      
      this.reportProgress({
        stage: 'processing',
        percent: 90,
        message: '文字起こし結果を取得中'
      });
      
      // S3から直接結果を取得
      try {
        // S3から結果を取得
        const transcriptFileName = `${jobName}.json`;
        console.log(`S3から文字起こし結果を取得中: ${transcriptFileName}`);
        
        if (!this.s3Client) {
          throw new Error('S3クライアントが初期化されていません');
        }
        
        // GetObjectを使用してS3からファイルを取得
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: transcriptFileName
        }));
        
        // レスポンスボディを読み込む
        let responseBody = '';
        if (response.Body) {
          // @ts-ignore - TypeScriptが非同期イテレータを認識しない場合の対策
          for await (const chunk of response.Body as any) {
            responseBody += chunk.toString();
          }
        }
        
        // JSONをパース
        const transcriptResult = JSON.parse(responseBody);
        console.log('文字起こし結果の取得に成功しました');
        
        this.reportProgress({
          stage: 'complete',
          percent: 100,
          message: '文字起こし完了'
        });
        
        // 結果を適切な形式に変換
        return this.convertAwsTranscriptToResult(transcriptResult, jobName);
      } catch (error) {
        console.error('S3からの結果取得エラー:', error);
        
        // エラー発生時はデフォルトのデモ結果を返す
        const demoResult = {
          text: `AWS Transcribeによる文字起こし結果（ジョブID: ${jobName}）\n\n` +
                `文字起こしジョブは完了しましたが、S3からの結果取得中にエラーが発生しました。\n` +
                `エラー: ${error instanceof Error ? error.message : String(error)}`,
          segments: [],
          processingTime: 0,
          modelUsed: options.model,
          audioSeparationUsed: false,
          awsJobId: jobName
        };
        
        this.reportProgress({
          stage: 'complete',
          percent: 100,
          message: '文字起こし完了'
        });
        
        return demoResult;
      }
    } catch (error) {
      console.error('文字起こしジョブエラー:', error);
      throw new Error(`AWS Transcribeジョブの実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ジョブの完了を待機
  private async pollJobCompletion(jobName: string, maxAttempts: number = 60, intervalSeconds: number = 5) {
    if (!this.transcribeClient) {
      throw new Error('Transcribeクライアントが初期化されていません');
    }

    console.log(`ジョブ完了を待機中: ${jobName}`);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const command = new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName
        });
        
        const response = await this.transcribeClient.send(command);
        const status = response.TranscriptionJob?.TranscriptionJobStatus;
        console.log(`ジョブステータス (${attempt + 1}/${maxAttempts}): ${status}`);
        
        // 進捗状況をレンダラーに送信
        const progressPercent = Math.min(10 + Math.round((attempt / maxAttempts) * 80), 90);
        this.reportProgress({
          stage: 'processing',
          percent: progressPercent,
          message: `文字起こし処理中: ${progressPercent}%`
        });
        
        if (status === 'COMPLETED') {
          console.log('ジョブが完了しました');
          return response.TranscriptionJob!;
        }
        
        if (status === 'FAILED') {
          const reason = response.TranscriptionJob?.FailureReason || '不明';
          throw new Error(`文字起こしジョブが失敗しました: ${reason}`);
        }
        
        // 指定された間隔で待機
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      } catch (error) {
        console.error('ジョブ状態確認エラー:', error);
        throw error;
      }
    }
    
    throw new Error(`タイムアウト: ${maxAttempts}回試行後も文字起こしジョブが完了しませんでした`);
  }

  // 注意: fetchTranscriptResult関数は直接S3から取得する実装に置き換わったため削除されました

  // AWS Transcribeの結果を標準形式に変換
  private convertAwsTranscriptToResult(awsResult: any, jobId: string) {
    try {
      // AWSのフォーマットから必要な情報を抽出
      const transcript = awsResult.results.transcripts[0].transcript || '';
      
      // セグメント情報がある場合は変換
      const segments = awsResult.results.items ? this.convertAwsItemsToSegments(awsResult.results.items) : [];
      
      return {
        text: transcript,
        segments,
        awsJobId: jobId,
        awsTranscribeDetails: awsResult
      };
    } catch (error) {
      console.error('結果変換エラー:', error);
      return {
        text: '文字起こし結果の変換中にエラーが発生しました',
        segments: [],
        awsJobId: jobId
      };
    }
  }

  // AWSの項目をセグメントに変換
  private convertAwsItemsToSegments(items: any[]) {
    const segments: any[] = [];
    let currentSegment: any = null;
    
    items.forEach((item, index) => {
      // プンクチュエーション（句読点）は含めない
      if (item.type === 'punctuation') {
        if (currentSegment) {
          currentSegment.text += item.alternatives[0].content;
        }
        return;
      }
      
      // 新しい単語が始まる場合
      if (!currentSegment || (index > 0 && items[index - 1].end_time && item.start_time - items[index - 1].end_time > 1.0)) {
        // 前のセグメントがあれば保存
        if (currentSegment) {
          segments.push(currentSegment);
        }
        
        // 新しいセグメントを開始
        currentSegment = {
          id: segments.length,
          start: parseFloat(item.start_time) || 0,
          end: parseFloat(item.end_time) || 0,
          text: item.alternatives[0].content,
          words: [{
            word: item.alternatives[0].content,
            start: parseFloat(item.start_time) || 0,
            end: parseFloat(item.end_time) || 0,
            confidence: parseFloat(item.alternatives[0].confidence) || 0
          }]
        };
      } else {
        // 既存のセグメントに単語を追加
        if (currentSegment) {
          currentSegment.text += ' ' + item.alternatives[0].content;
          currentSegment.end = parseFloat(item.end_time) || currentSegment.end;
          currentSegment.words.push({
            word: item.alternatives[0].content,
            start: parseFloat(item.start_time) || 0,
            end: parseFloat(item.end_time) || 0,
            confidence: parseFloat(item.alternatives[0].confidence) || 0
          });
        }
      }
    });
    
    // 最後のセグメントを追加
    if (currentSegment) {
      segments.push(currentSegment);
    }
    
    return segments;
  }

  // 依存関係チェック（AWS SDKの存在確認）
  async checkDependencies() {
    try {
      console.log('AWS依存関係チェック中...');
      
      // AWS SDKをロード試行
      const hasAwsSdk = !!(
        typeof TranscribeClient !== 'undefined' &&
        typeof S3Client !== 'undefined'
      );
      
      // AWSの認証情報を確認
      let hasAwsCredentials = false;
      try {
        const credentials = fromIni();
        const credValue = await credentials();
        hasAwsCredentials = !!(credValue.accessKeyId && credValue.secretAccessKey);
      } catch (error) {
        console.error('AWS認証情報の確認に失敗:', error);
      }
      
      console.log('AWS SDK検出:', hasAwsSdk);
      console.log('AWS認証情報検出:', hasAwsCredentials);
      
      return {
        awsTranscribe: hasAwsSdk && hasAwsCredentials,
        models: {
          'aws-transcribe-auto': hasAwsSdk && hasAwsCredentials,
          'aws-transcribe-medical': hasAwsSdk && hasAwsCredentials
        },
        details: {
          awsTranscribe: hasAwsSdk ? 'インストール済み' : 'インストールされていません',
          awsCredentials: hasAwsCredentials ? '設定済み' : '設定されていません',
          models: {
            'aws-transcribe-auto': hasAwsSdk && hasAwsCredentials ? '利用可能' : '利用不可',
            'aws-transcribe-medical': hasAwsSdk && hasAwsCredentials ? '利用可能' : '利用不可'
          }
        }
      };
    } catch (error) {
      console.error('依存関係チェックエラー:', error);
      return {
        awsTranscribe: false,
        models: {
          'aws-transcribe-auto': false,
          'aws-transcribe-medical': false
        },
        details: {
          error: `AWS依存関係チェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }

  // 利用可能なモデルのリストを取得
  async getAvailableModels() {
    try {
      const deps = await this.checkDependencies();
      const availableModels: WhisperModel[] = [];
      
      if (deps.models['aws-transcribe-auto']) {
        availableModels.push(WhisperModel.AWS_TRANSCRIBE_AUTO);
      }
      
      if (deps.models['aws-transcribe-medical']) {
        availableModels.push(WhisperModel.AWS_TRANSCRIBE_MEDICAL);
      }
      
      return availableModels;
    } catch (error) {
      console.error('利用可能なモデルの取得エラー:', error);
      return [];
    }
  }

  // 進捗レポーター
  onProgress(callback: (data: any) => void) {
    this.callbacks.push(callback);
  }

  reportProgress(data: any) {
    this.callbacks.forEach(callback => callback(data));
    
    // メインウィンドウにも進捗を送信
    if (this.mainWindow) {
      this.mainWindow.webContents.send('progress-update', data);
    }
  }
}