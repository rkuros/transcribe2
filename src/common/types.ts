// Common types shared between main and renderer processes

export enum TranscriptionEngine {
  WHISPER = 'whisper',
  AWS_TRANSCRIBE = 'aws-transcribe'
}

export enum WhisperModel {
  FASTER_WHISPER_SMALL = 'faster-whisper-small',
  FASTER_WHISPER_MEDIUM = 'faster-whisper-medium',
  OPENAI_WHISPER_LARGE_V3_TURBO = 'openai-whisper-large-v3-turbo',
  AWS_TRANSCRIBE_AUTO = 'aws-transcribe-auto',
  AWS_TRANSCRIBE_MEDICAL = 'aws-transcribe-medical'
}

export enum ExportFormat {
  TXT = 'txt',
  DOCX = 'docx',
  SRT = 'srt'
}

export interface ProcessingOptions {
  model: WhisperModel;
  enableAudioSeparation: boolean;
  enableAutoFormatting?: boolean;
  enableGinzaFormatting?: boolean;
  outputFormat?: ExportFormat;
  language?: string;
  awsRegion?: string;
  awsVocabulary?: string;
  awsCustomVocabularyName?: string;
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  bitRate?: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  processingTime: number;
  modelUsed: WhisperModel;
  audioSeparationUsed: boolean;
  awsJobId?: string;
  awsTranscribeDetails?: any;
}

export interface DependencyStatus {
  python: boolean;
  demucs: boolean;
  fasterWhisper: boolean;
  openaiWhisper: boolean;
  awsTranscribe?: boolean;
  models: {
    [key: string]: boolean;
  };
  details?: {
    python?: any;
    demucs?: any;
    fasterWhisper?: any;
    openaiWhisper?: any;
    awsTranscribe?: any;
    models?: {
      [key: string]: any;
    };
    error?: string; // エラーメッセージ
  };
}

export interface ProgressStatus {
  stage: 'separation' | 'transcription' | 'formatting' | 'complete';
  percent: number;
  estimatedTimeRemaining?: number;
}

export interface FormattingOptions {
  autoFormat: boolean;
  language: string;
}