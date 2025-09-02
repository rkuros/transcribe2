import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TranscriptionResult } from '../common/types';
import { v4 as uuidv4 } from 'uuid';

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  result: TranscriptionResult;
}

export class HistoryManager {
  private historyFilePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.historyFilePath = path.join(userDataPath, 'transcription-history.json');
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
      
      await fs.writeFile(this.historyFilePath, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save transcription history:', error);
    }
  }

  async getHistory(): Promise<HistoryItem[]> {
    return await this.loadHistory();
  }

  private async loadHistory(): Promise<HistoryItem[]> {
    try {
      const data = await fs.readFile(this.historyFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, return empty array
      return [];
    }
  }
}
