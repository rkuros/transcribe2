import { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { TranscriptionResult } from '../common/types';
import { v4 as uuidv4 } from 'uuid';

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  result: TranscriptionResult;
}

export class HistoryManager {
  private s3Client: S3Client;
  private bucketName: string;
  private historyKey: string;

  constructor(region: string = 'ap-northeast-1', bucketName: string = 'transcribe-history-bucket') {
    this.s3Client = new S3Client({
      region,
      credentials: fromNodeProviderChain()
    });
    this.bucketName = bucketName;
    this.historyKey = 'transcription-history.json';
  }

  async saveTranscription(fileName: string, result: TranscriptionResult): Promise<void> {
    try {
      const history = await this.loadHistory();
      const newItem: HistoryItem = {
        id: uuidv4(),
        fileName,
        timestamp: new Date(),
        result
      };
      
      history.unshift(newItem);
      
      // Keep only the last 50 items
      if (history.length > 50) {
        history.splice(50);
      }
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.historyKey,
        Body: JSON.stringify(history, null, 2),
        ContentType: 'application/json'
      }));
    } catch (error) {
      console.error('Failed to save transcription history to S3:', error);
      throw error;
    }
  }

  async getHistory(): Promise<HistoryItem[]> {
    return await this.loadHistory();
  }

  private async loadHistory(): Promise<HistoryItem[]> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.historyKey
      }));
      
      const data = await response.Body?.transformToString();
      return data ? JSON.parse(data) : [];
    } catch (error) {
      if (error instanceof NoSuchKey) {
        // File doesn't exist, return empty array
        return [];
      }
      console.error('Failed to load history from S3:', error);
      throw error;
    }
  }
}
