// AWS Transcribeのテストスクリプト
const { S3Client, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { 
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  ListTranscriptionJobsCommand
} = require('@aws-sdk/client-transcribe');
const { fromIni } = require('@aws-sdk/credential-providers');
const fs = require('fs');
const path = require('path');
const https = require('https');

// テスト用の設定
const config = {
  region: 'ap-northeast-1', // 東京リージョン
  testAudioFile: path.join(__dirname, '..', 'test data', 'test.mp3'), // テスト用の音声ファイル
  bucketName: 'transcribe-audio-temp-rkuros-test' // テスト用のバケット名
};

// クライアント初期化
async function initializeClients() {
  try {
    console.log('認証情報を読み込み中...');
    const credentials = fromIni();
    
    console.log('S3クライアントを初期化中...');
    const s3Client = new S3Client({
      region: config.region,
      credentials
    });
    
    console.log('Transcribeクライアントを初期化中...');
    const transcribeClient = new TranscribeClient({
      region: config.region,
      credentials
    });
    
    // S3バケットが存在するか確認し、なければ作成
    await ensureBucketExists(s3Client);
    
    return { s3Client, transcribeClient };
  } catch (error) {
    console.error('クライアント初期化エラー:', error);
    throw error;
  }
}

// S3バケットが存在することを確認し、存在しなければ作成
async function ensureBucketExists(s3Client) {
  try {
    console.log(`S3バケット ${config.bucketName} の存在を確認中...`);
    
    try {
      // バケットが存在するか確認
      await s3Client.send(new HeadBucketCommand({
        Bucket: config.bucketName
      }));
      console.log(`S3バケット ${config.bucketName} は既に存在します`);
    } catch (error) {
      // バケットが存在しない場合は作成
      if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
        console.log(`S3バケット ${config.bucketName} は存在しません。作成します...`);
        await s3Client.send(new CreateBucketCommand({
          Bucket: config.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: config.region !== 'us-east-1' ? config.region : undefined
          }
        }));
        console.log(`S3バケット ${config.bucketName} を作成しました`);
        
        // バケットポリシーを設定して、Transcribeが結果を書き込めるようにする
        console.log('バケットポリシーを設定中...');
        await setBucketPolicy(s3Client);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('バケット確認/作成エラー:', error);
    throw new Error(`S3バケットの確認または作成に失敗しました: ${error.message}`);
  }
}

// S3バケットポリシーを設定
async function setBucketPolicy(s3Client) {
  try {
    // バケットポリシーの設定はパブリックポリシーをブロックする設定があるため、スキップ
    console.log('バケットポリシーの設定をスキップします。S3バケットに対する権限はユーザーのIAMポリシーから得る必要があります');
    // 特にアクションは必要ない
  } catch (error) {
    console.error('バケットポリシー設定エラー:', error);
    throw error;
  }
}

// S3にファイルをアップロード
async function uploadToS3(s3Client, filePath) {
  try {
    console.log(`ファイルを確認中: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`ファイルが存在しません: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const timestamp = Date.now();
    const objectKey = `test_uploads/${timestamp}/${fileName}`;
    
    console.log(`S3にアップロード中: s3://${config.bucketName}/${objectKey}`);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: config.bucketName,
        Key: objectKey,
        Body: fileContent
      }
    });
    
    upload.on('httpUploadProgress', (progress) => {
      const loaded = progress.loaded || 0;
      const total = progress.total || 1;
      const percent = Math.round((loaded / total) * 100);
      console.log(`アップロード進捗: ${percent}%`);
    });
    
    await upload.done();
    console.log('アップロード完了');
    
    return { objectKey, bucketUrl: `s3://${config.bucketName}/${objectKey}` };
  } catch (error) {
    console.error('S3アップロードエラー:', error);
    throw error;
  }
}

// トランスクリプションジョブを開始
async function startTranscriptionJob(transcribeClient, mediaUri) {
  try {
    const jobName = `test_job_${Date.now()}`;
    console.log(`トランスクリプションジョブ開始: ${jobName}`);
    
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: {
        MediaFileUri: mediaUri
      },
      MediaFormat: 'mp3',
      LanguageCode: 'ja-JP',
      OutputBucketName: config.bucketName
    });
    
    const response = await transcribeClient.send(command);
    console.log('ジョブ開始レスポンス:', JSON.stringify(response, null, 2));
    
    return jobName;
  } catch (error) {
    console.error('ジョブ開始エラー:', error);
    throw error;
  }
}

// ジョブ状態を確認
async function checkJobStatus(transcribeClient, jobName) {
  try {
    console.log(`ジョブ状態を確認中: ${jobName}`);
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    });
    
    const response = await transcribeClient.send(command);
    const status = response.TranscriptionJob?.TranscriptionJobStatus;
    console.log(`ジョブ状態: ${status}`);
    
    return {
      status,
      job: response.TranscriptionJob
    };
  } catch (error) {
    console.error('ジョブ状態確認エラー:', error);
    throw error;
  }
}

// 完了待ち
async function waitForCompletion(transcribeClient, jobName, maxAttempts = 30) {
  console.log(`ジョブ完了を待機中: ${jobName}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    const { status, job } = await checkJobStatus(transcribeClient, jobName);
    
    if (status === 'COMPLETED') {
      console.log('ジョブが完了しました');
      return job;
    }
    
    if (status === 'FAILED') {
      const reason = job?.FailureReason || '不明';
      throw new Error(`ジョブが失敗しました: ${reason}`);
    }
    
    console.log('処理中... 5秒後に再確認');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error(`タイムアウト: ${maxAttempts}回試行後も完了しませんでした`);
}

// 結果の取得
async function fetchTranscriptResult(transcriptUri) {
  return new Promise((resolve, reject) => {
    console.log(`結果を取得中: ${transcriptUri}`);
    
    // S3から直接取得
    const jobName = transcriptUri.split('/').pop().split('.')[0];
    console.log(`ジョブ名から取得: ${jobName}`);
    
    // S3のオブジェクトを直接取得する
    async function getJobResult(jobName) {
      try {
        const { GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
        
        // transcribeクライアントが必要
        const { fromIni } = require('@aws-sdk/credential-providers');
        const { TranscribeClient } = require('@aws-sdk/client-transcribe');
        
        const transcribeClient = new TranscribeClient({
          region: config.region,
          credentials: fromIni()
        });
        
        const command = new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName
        });
        
        const response = await transcribeClient.send(command);
        
        // 標準的な形式に変換
        const result = {
          results: {
            transcripts: [{
              transcript: response.TranscriptionJob.Transcript.TranscriptionText || ''
            }],
            items: [] // 詳細な項目は必要に応じて追加
          }
        };
        
        return result;
      } catch (error) {
        console.error('Transcribeジョブ取得エラー:', error);
        throw error;
      }
    }
    
    // ジョブ名から結果を取得
    getJobResult(jobName)
      .then(result => {
        console.log('結果の取得に成功しました');
        resolve(result);
      })
      .catch(err => {
        reject(new Error(`ジョブ結果の取得エラー: ${err.message}`));
      });
  });
}

// リストジョブのテスト（認証確認用）
async function testListJobs(transcribeClient) {
  try {
    console.log('ジョブリストをテスト中...');
    const command = new ListTranscriptionJobsCommand({
      MaxResults: 5
    });
    
    const response = await transcribeClient.send(command);
    console.log(`${response.TranscriptionJobSummaries?.length || 0}件のジョブが見つかりました`);
    console.log('認証が正常に機能しています');
    return true;
  } catch (error) {
    console.error('認証テストエラー:', error);
    return false;
  }
}

// メイン処理
async function main() {
  try {
    console.log('==== AWS Transcribe テスト開始 ====');
    
    // クライアント初期化
    const { s3Client, transcribeClient } = await initializeClients();
    
    // 認証テスト
    const authSuccess = await testListJobs(transcribeClient);
    if (!authSuccess) {
      throw new Error('認証テストに失敗しました。AWS認証情報を確認してください。');
    }
    
    // ファイルアップロード
    const { bucketUrl } = await uploadToS3(s3Client, config.testAudioFile);
    
    // ジョブ開始
    const jobName = await startTranscriptionJob(transcribeClient, bucketUrl);
    
    // 完了待ち
    const completedJob = await waitForCompletion(transcribeClient, jobName);
    
    // 結果取得
    if (completedJob.Transcript?.TranscriptFileUri) {
      const transcript = await fetchTranscriptResult(completedJob.Transcript.TranscriptFileUri);
      
      // 結果を表示
      console.log('\n==== 文字起こし結果 ====');
      console.log(transcript.results.transcripts[0].transcript);
      
      console.log('\n==== テスト成功 ====');
      return true;
    } else {
      throw new Error('トランスクリプトURIが見つかりません');
    }
  } catch (error) {
    console.error('\n==== テスト失敗 ====');
    console.error(error);
    return false;
  }
}

// テスト実行
main().catch(console.error);