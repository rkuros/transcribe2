import { 
  WhisperModel, 
  ProcessingOptions, 
  TranscriptionResult,
  DependencyStatus,
  AudioMetadata,
  ExportFormat
} from '../common/types';

// Interface for audio processing
export interface AudioProcessingManager {
  processAudio(filePath: string, options: ProcessingOptions): Promise<TranscriptionResult>;
  separateAudio(filePath: string): Promise<string>; // Returns vocal track path
  transcribeAudio(filePath: string, model: WhisperModel): Promise<TranscriptionResult>;
  getAvailableModels(): Promise<WhisperModel[]>;
  checkDependencies(): Promise<DependencyStatus>;
}

// Interface for file operations
export interface FileManager {
  selectAudioFile(): Promise<string | null>;
  exportTranscription(content: string, format: ExportFormat, filePath: string): Promise<void>;
  validateAudioFile(filePath: string): Promise<boolean>;
  getAudioMetadata(filePath: string): Promise<AudioMetadata>;
}

// Interface for progress reporting
export interface ProgressReporter {
  onProgress(callback: (progress: any) => void): void;
  reportProgress(data: any): void;
}