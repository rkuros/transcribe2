import { S3Client, GetObjectCommand, ListObjectsV2Command, NoSuchKey } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { TranscriptionResult } from '../common/types';

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  result: TranscriptionResult;
}

export class HistoryManager {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(region: string = 'ap-northeast-1', bucketName: string = 'transcribe-history-bucket') {
    this.s3Client = new S3Client({
      region,
      credentials: fromNodeProviderChain()
    });
    this.bucketName = bucketName;
  }

  async saveTranscription(fileName: string, result: TranscriptionResult): Promise<void> {
    // AWS Transcribeの場合は自動的にS3に保存されるため、この関数は何もしない
    console.log(`Transcription result for ${fileName} is already saved in S3`);
  }

  async getHistory(): Promise<HistoryItem[]> {
    try {
      // S3からTranscribeの結果ファイル一覧を取得
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 50
      }));

      if (!response.Contents) {
        return [];
      }

      const historyItems: HistoryItem[] = [];

      // .jsonファイルのみを処理
      const jsonFiles = response.Contents.filter(obj => 
        obj.Key && obj.Key.endsWith('.json') && !obj.Key.includes('uploads/')
      );

      for (const file of jsonFiles) {
        if (!file.Key || !file.LastModified) continue;

        try {
          // S3からTranscribe結果を取得
          const transcriptResponse = await this.s3Client.send(new GetObjectCommand({
            Bucket: this.bucketName,
            Key: file.Key
          }));

          const transcriptData = await transcriptResponse.Body?.transformToString();
          if (!transcriptData) continue;

          const transcriptResult = JSON.parse(transcriptData);
          
          // AWS Transcribeの結果を標準形式に変換
          const result = this.convertAwsTranscriptToResult(transcriptResult, file.Key);

          historyItems.push({
            id: file.Key,
            fileName: file.Key.replace('.json', ''),
            timestamp: file.LastModified,
            result
          });
        } catch (error) {
          console.error(`Failed to process transcript file ${file.Key}:`, error);
        }
      }

      // 日付順でソート（新しい順）
      return historyItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to load history from S3:', error);
      return [];
    }
  }

  private convertAwsTranscriptToResult(transcriptResult: any, jobName: string): TranscriptionResult {
    try {
      const transcript = transcriptResult.results?.transcripts?.[0]?.transcript || '';
      const items = transcriptResult.results?.items || [];
      
      const segments = items
        .filter((item: any) => item.type === 'pronunciation')
        .map((item: any, index: number) => ({
          id: index,
          start: parseFloat(item.start_time || '0'),
          end: parseFloat(item.end_time || '0'),
          text: item.alternatives?.[0]?.content || ''
        }));

      return {
        text: transcript,
        segments,
        modelUsed: 'AWS Transcribe',
        processingTime: 0,
        language: transcriptResult.results?.language_code || 'ja-JP'
      };
    } catch (error) {
      console.error('Error converting AWS transcript:', error);
      return {
        text: `Error processing transcript for ${jobName}`,
        segments: [],
        modelUsed: 'AWS Transcribe',
        processingTime: 0,
        language: 'ja-JP'
      };
    }
  }
}
