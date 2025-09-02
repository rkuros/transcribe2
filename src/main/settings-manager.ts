import ElectronStore from 'electron-store';
import type { Options } from 'electron-store';

// Extend ElectronStore with the right typings
interface TypedElectronStore<T> extends ElectronStore {
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  // Include other necessary methods
  has<K extends keyof T>(key: K): boolean;
  reset<K extends keyof T>(...keys: K[]): void;
  delete<K extends keyof T>(key: K): void;
  clear(): void;
  store: T;
}
import { WhisperModel, ProcessingOptions, ExportFormat } from '../common/types';

interface Settings {
  defaultModel: WhisperModel;
  enableAudioSeparation: boolean;
  language?: string;
  lastExportFormat?: string;
  recentFiles?: string[];
  historyBucketName?: string;
}

const DEFAULT_SETTINGS: Settings = {
  defaultModel: WhisperModel.FASTER_WHISPER_SMALL,
  enableAudioSeparation: true,
  recentFiles: [],
  historyBucketName: 'transcribe-history-bucket'
};

export class SettingsManager {
  private store: TypedElectronStore<Settings>;

  constructor() {
    this.store = new ElectronStore<Settings>({
      defaults: DEFAULT_SETTINGS
    }) as TypedElectronStore<Settings>;
  }

  public getDefaultProcessingOptions(): ProcessingOptions {
    return {
      model: this.getDefaultModel(),
      enableAudioSeparation: this.getEnableAudioSeparation(),
      language: this.getLanguage()
    };
  }

  public getDefaultModel(): WhisperModel {
    return this.store.get('defaultModel', WhisperModel.FASTER_WHISPER_SMALL);
  }

  public setDefaultModel(model: WhisperModel): void {
    this.store.set('defaultModel', model);
  }

  public getEnableAudioSeparation(): boolean {
    return this.store.get('enableAudioSeparation', true);
  }

  public setEnableAudioSeparation(enable: boolean): void {
    this.store.set('enableAudioSeparation', enable);
  }

  public getLanguage(): string | undefined {
    return this.store.get('language');
  }

  public setLanguage(language: string): void {
    this.store.set('language', language);
  }

  public getRecentFiles(): string[] {
    return this.store.get('recentFiles', []) || [];
  }

  public addRecentFile(filePath: string): void {
    const recentFiles = this.getRecentFiles();
    
    // Remove if already exists
    const filteredFiles = recentFiles.filter(file => file !== filePath);
    
    // Add to the beginning
    filteredFiles.unshift(filePath);
    
    // Keep only last 10 files
    const newRecentFiles = filteredFiles.slice(0, 10);
    
    this.store.set('recentFiles', newRecentFiles);
  }

  public getLastExportFormat(): ExportFormat | undefined {
    const format = this.store.get('lastExportFormat');
    return format as ExportFormat | undefined;
  }

  public setLastExportFormat(format: ExportFormat): void {
    this.store.set('lastExportFormat', format);
  }

  public getHistoryBucketName(): string {
    return this.store.get('historyBucketName', DEFAULT_SETTINGS.historyBucketName!);
  }

  public setHistoryBucketName(bucketName: string): void {
    this.store.set('historyBucketName', bucketName);
  }

  public getAllSettings(): Settings {
    return this.store.store;
  }

  public resetToDefaults(): void {
    this.store.clear();
    
    // Set each default setting individually
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      this.store.set(key as keyof Settings, value as any);
    });
  }
}