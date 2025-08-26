import { WhisperModel, ProcessingOptions, ProgressStatus, DependencyStatus, TranscriptionResult } from '../../common/types';

export {};

declare global {
  interface Window {
    api: {
      // File operations
      selectAudioFile: () => Promise<string | null>;
      exportTranscription: (content: string, format: string, segments?: any[], filePath?: string) => Promise<string>;
      getAudioMetadata: (filePath: string) => Promise<any>;
      
      // Audio processing
      transcribeAudio: (filePath: string, options: ProcessingOptions) => Promise<TranscriptionResult>;
      separateAudio: (filePath: string) => Promise<string>;
      
      // Model and settings management
      getDefaultModel: () => Promise<WhisperModel>;
      setDefaultModel: (model: WhisperModel) => Promise<void>;
      getAudioSeparationEnabled: () => Promise<boolean>;
      setAudioSeparationEnabled: (enabled: boolean) => Promise<void>;
      getDefaultProcessingOptions: () => Promise<ProcessingOptions>;
      addRecentFile: (filePath: string) => Promise<void>;
      getRecentFiles: () => Promise<string[]>;
      getLastExportFormat: () => Promise<string | undefined>;
      setLastExportFormat: (format: string) => Promise<void>;
      resetSettings: () => Promise<void>;
      
      // Dependencies and models
      getAvailableModels: () => Promise<WhisperModel[]>;
      checkDependencies: () => Promise<DependencyStatus>;
      
      // Progress tracking
      onProgressUpdate: (callback: (progress: ProgressStatus) => void) => void;
      removeProgressListener: () => void;
      
      // Logger
      getLogPath: () => Promise<string>;
      
      // Error handling
      onPythonError: (callback: (error: any) => void) => void;
      removePythonErrorListener: () => void;
    };
  }
}