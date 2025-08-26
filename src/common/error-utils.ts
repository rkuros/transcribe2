/**
 * Error utilities for handling and categorizing errors
 */

// Define application error categories
export enum ErrorCategory {
  FILE_SYSTEM = 'file_system',
  PYTHON_PROCESS = 'python_process',
  PYTHON_ERROR = 'python_error',
  DEPENDENCY = 'dependency',
  MODEL = 'model',
  TRANSCRIPTION = 'transcription',
  EXPORT = 'export',
  USER_INPUT = 'user_input',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

// Application error class with categorization
export class AppError extends Error {
  category: ErrorCategory;
  originalError?: Error | unknown;
  
  constructor(
    message: string, 
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    originalError?: Error | unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.originalError = originalError;
    
    // Maintains proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
  
  // Get a user-friendly message
  getUserFriendlyMessage(): string {
    switch (this.category) {
      case ErrorCategory.FILE_SYSTEM:
        return `ファイルシステムエラー: ${this.message}`;
      case ErrorCategory.PYTHON_PROCESS:
        return `Pythonプロセスエラー: ${this.message}`;
      case ErrorCategory.DEPENDENCY:
        return `依存関係エラー: ${this.message}`;
      case ErrorCategory.MODEL:
        return `モデルエラー: ${this.message}`;
      case ErrorCategory.TRANSCRIPTION:
        return `文字起こしエラー: ${this.message}`;
      case ErrorCategory.EXPORT:
        return `エクスポートエラー: ${this.message}`;
      case ErrorCategory.USER_INPUT:
        return `入力エラー: ${this.message}`;
      case ErrorCategory.NETWORK:
        return `ネットワークエラー: ${this.message}`;
      case ErrorCategory.UNKNOWN:
      default:
        return `エラー: ${this.message}`;
    }
  }
  
  // Get suggested troubleshooting steps
  getTroubleshootingSuggestions(): string[] {
    switch (this.category) {
      case ErrorCategory.FILE_SYSTEM:
        return [
          'ファイルへのアクセス権限があるか確認してください',
          'ディスクの空き容量を確認してください',
          '別のフォルダやドライブを試してください'
        ];
      case ErrorCategory.PYTHON_PROCESS:
        return [
          'Pythonが正しくインストールされているか確認してください',
          'アプリケーションを再起動してください',
          '必要なPythonパッケージがインストールされているか確認してください'
        ];
      case ErrorCategory.DEPENDENCY:
        return [
          'README.mdの指示に従って必要な依存関係をインストールしてください',
          'FFmpegがインストールされているか確認してください',
          'ファイヤウォールがアプリケーションをブロックしていないか確認してください'
        ];
      case ErrorCategory.MODEL:
        return [
          '別のWhisperモデルを選択してみてください',
          'モデルが正しくダウンロードされているか確認してください',
          'インターネット接続を確認してモデルを再ダウンロードしてください'
        ];
      case ErrorCategory.TRANSCRIPTION:
        return [
          '音声ファイルが破損していないか確認してください',
          '別の音声ファイルを試してください',
          'Demucsによる音声分離を無効にしてみてください'
        ];
      case ErrorCategory.EXPORT:
        return [
          'エクスポート先のフォルダにアクセス権限があるか確認してください',
          '別のファイル形式を試してください',
          '別のエクスポート先フォルダを選択してください'
        ];
      case ErrorCategory.USER_INPUT:
        return [
          '有効な入力値を提供してください',
          'サポートされているファイル形式であることを確認してください'
        ];
      case ErrorCategory.NETWORK:
        return [
          'インターネット接続を確認してください',
          'ファイヤウォール設定を確認してください',
          '後でもう一度試してください'
        ];
      case ErrorCategory.UNKNOWN:
      default:
        return [
          'アプリケーションを再起動してください',
          'システムの再起動を試してください',
          'ログファイルを確認して問題を特定してください'
        ];
    }
  }
}

// Helper function to categorize errors
export function categorizeError(error: Error | unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Categorize based on message content
  if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
    return new AppError('ファイルが見つかりません', ErrorCategory.FILE_SYSTEM, error);
  }
  
  if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
    return new AppError('ファイルアクセス権限がありません', ErrorCategory.FILE_SYSTEM, error);
  }
  
  if (errorMessage.includes('Python') || errorMessage.includes('process')) {
    return new AppError('Pythonプロセスの実行中にエラーが発生しました', ErrorCategory.PYTHON_PROCESS, error);
  }
  
  if (errorMessage.includes('model') || errorMessage.includes('whisper')) {
    return new AppError('モデルのロード中にエラーが発生しました', ErrorCategory.MODEL, error);
  }
  
  if (errorMessage.includes('transcribe') || errorMessage.includes('audio')) {
    return new AppError('文字起こし中にエラーが発生しました', ErrorCategory.TRANSCRIPTION, error);
  }
  
  if (errorMessage.includes('export') || errorMessage.includes('save')) {
    return new AppError('ファイルのエクスポート中にエラーが発生しました', ErrorCategory.EXPORT, error);
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return new AppError('ネットワークエラーが発生しました', ErrorCategory.NETWORK, error);
  }
  
  // Default to unknown category
  return new AppError(errorMessage, ErrorCategory.UNKNOWN, error);
}

// Helper function to handle errors in async functions
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: AppError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const appError = categorizeError(error);
    
    if (errorHandler) {
      errorHandler(appError);
    }
    
    console.error(`Error (${appError.category}):`, appError.message, appError);
    return null;
  }
}