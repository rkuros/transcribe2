import React, { useState, useEffect } from 'react';
import { WhisperModel, TranscriptionEngine, ProcessingOptions, TranscriptionResult, ProgressStatus, DependencyStatus, TranscriptionSegment, ExportFormat } from '../common/types';
import RecentFiles from './components/RecentFiles';
import ProgressIndicator from './components/ProgressIndicator';
import TranscriptionEditor from './components/TranscriptionEditor';
import ExportOptions from './components/ExportOptions';
import ErrorDisplay from './components/ErrorDisplay';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { AppError, categorizeError } from '../common/error-utils';

// Types
interface AudioFile {
  path: string;
  name: string;
  size: number;
  duration?: number;
}

// Wrapped app component with notification context
const AppContent: React.FC = () => {
  const { showNotification } = useNotification();
  // State variables
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [selectedModel, setSelectedModel] = useState<WhisperModel>(WhisperModel.FASTER_WHISPER_SMALL);
  const [enableSeparation, setEnableSeparation] = useState(true);
  const [enableGinza, setEnableGinza] = useState(true);
  const [awsRegion, setAwsRegion] = useState<string>('ap-northeast-1'); // デフォルトは東京リージョン
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [editedTranscription, setEditedTranscription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressStatus>({ stage: 'separation', percent: 0 });
  const [dependencies, setDependencies] = useState<DependencyStatus | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [error, setError] = useState<AppError | null>(null);

  // Initialize settings and check dependencies on startup
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load settings
        const defaultModel = await window.api.getDefaultModel();
        setSelectedModel(defaultModel);
        
        const separationEnabled = await window.api.getAudioSeparationEnabled();
        setEnableSeparation(separationEnabled);
        
        const recentFilesList = await window.api.getRecentFiles();
        setRecentFiles(recentFilesList);
        
        // Check dependencies
        const deps = await window.api.checkDependencies();
        setDependencies(deps);
      } catch (err) {
        const appError = categorizeError(err);
        setError(appError);
        showNotification('error', '初期化中にエラーが発生しました。');
      }
    };
    
    initApp();
    
    // Set up Python error listener
    const handlePythonError = (pythonError: any) => {
      console.error('Python error:', pythonError);
      const appError = new AppError(
        pythonError.message || 'Pythonエラーが発生しました',
        'Python環境の問題',
        ErrorCategory.PYTHON_ERROR
      );
      setError(appError);
      showNotification('error', 'Pythonエラーが発生しました: ' + (pythonError.message || ''));
    };
    
    window.api.onPythonError(handlePythonError);
    
    // Cleanup
    return () => {
      window.api.removePythonErrorListener();
    };
  }, []);

  // Set up progress listener
  useEffect(() => {
    const handleProgress = (progressData: ProgressStatus) => {
      setProgress(progressData);
    };

    window.api.onProgressUpdate(handleProgress);

    return () => {
      window.api.removeProgressListener();
    };
  }, []);

  // Handle file selection
  const handleSelectFile = async (existingFilePath?: string) => {
    try {
      // Use provided path or open file dialog
      const filePath = existingFilePath || await window.api.selectAudioFile();
      
      if (filePath) {
        try {
          // Get file metadata
          const metadata = await window.api.getAudioMetadata(filePath);
          
          // Extract filename safely - handle both slash types
          let fileName = filePath.split(/[\/\\]/).pop() || '';
          
          // Remove any GiNZA formatting markers from the displayed filename if present
          fileName = fileName.replace(/【GiNZA.*】|◆◆◆/g, '');
          
          const audioFileData: AudioFile = {
            path: filePath,
            name: fileName,
            size: metadata.size || 0,
            duration: metadata.duration
          };
          
          setAudioFile(audioFileData);
          
          // Add to recent files
          await window.api.addRecentFile(filePath);
          const updatedRecentFiles = await window.api.getRecentFiles();
          setRecentFiles(updatedRecentFiles);
          
          setError(null);
        } catch (metadataErr) {
          // Fallback if metadata extraction fails
          // Extract filename safely - handle both slash types
          let fileName = filePath.split(/[\/\\]/).pop() || '';
          
          // Remove any GiNZA formatting markers from the displayed filename if present
          fileName = fileName.replace(/【GiNZA.*】|◆◆◆/g, '');
          
          setAudioFile({
            path: filePath,
            name: fileName,
            size: 0
          });
          
          // Still add to recent files
          await window.api.addRecentFile(filePath);
        }
      }
    } catch (err) {
      const appError = categorizeError(err);
      setError(appError);
      showNotification('error', 'ファイルの選択中にエラーが発生しました。');
    }
  };

  // Handle transcription
  const handleTranscribe = async () => {
    if (!audioFile) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      let filePath = audioFile.path;
      
      // If audio separation is enabled, process with Demucs first
      if (enableSeparation) {
        setProgress({ stage: 'separation', percent: 0 });
        filePath = await window.api.separateAudio(filePath);
      }
      
      // Transcribe the audio
      setProgress({ stage: 'transcription', percent: 0 });
      // AWS Transcribe用のオプションを追加
      const isAwsModel = selectedModel.startsWith('aws-transcribe');
      
      const result = await window.api.transcribeAudio(filePath, {
        model: selectedModel,
        enableAudioSeparation: enableSeparation,
        enableAutoFormatting: true, // 自動テキスト整形を有効化
        enableGinzaFormatting: enableGinza, // GiNZA日本語整形の有効/無効
        // AWS特有のオプション
        awsRegion: isAwsModel ? awsRegion : undefined,
      });
      
      setTranscriptionResult(result);
      setEditedTranscription(result.text);
      setProgress({ stage: 'complete', percent: 100 });
      showNotification('success', '文字起こしが完了しました。テキストを編集できます。');
    } catch (err) {
      const appError = categorizeError(err);
      setError(appError);
      showNotification('error', '文字起こし処理中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle exporting transcription
  const handleExport = async (format: ExportFormat) => {
    if (!editedTranscription) return;
    
    try {
      // Pass segments if available for SRT export
      const filePath = await window.api.exportTranscription(
        editedTranscription, 
        format, 
        transcriptionResult?.segments
      );
      
      showNotification('success', `ファイルが ${format} 形式でエクスポートされました。`);
      
      // Save last used format in settings
      if (format) {
        window.api.setLastExportFormat(format);
      }
    } catch (err: any) {
      // If it's a user cancellation, don't show error
      if (err.message && err.message.includes('canceled by user')) {
        return;
      }
      
      const appError = categorizeError(err);
      setError(appError);
      showNotification('error', 'エクスポート中にエラーが発生しました。');
    }
  };

  // Render application UI
  return (
    <div className="app-container">
      <h1 className="text-3xl font-bold mb-6">音声文字起こしアプリ</h1>
      
      {/* Dependency status */}
      {dependencies && (
        <>
          {/* Python version check */}
          {!dependencies.python && (
            <div className="card bg-red-100">
              <h2 className="text-xl font-semibold mb-2">要件を満たしていません</h2>
              <p>このアプリケーションを実行するには、Python 3.9以上が必要です。</p>
              <a 
                href="https://www.python.org/downloads/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline mt-2 inline-block"
              >
                Python をダウンロード
              </a>
            </div>
          )}
          
          {/* Demucs check */}
          {dependencies.python && !dependencies.demucs && (
            <div className="card bg-yellow-100">
              <h2 className="text-xl font-semibold mb-2">Demucs が見つかりません</h2>
              <p>音声分離機能を使用するには、Demucs をインストールする必要があります。</p>
              <p className="mt-2">ターミナルで以下のコマンドを実行してください：</p>
              <div className="bg-gray-800 text-white p-2 rounded mt-1 overflow-x-auto">
                <code>pip install demucs</code>
              </div>
            </div>
          )}
          
          {/* Whisper models check */}
          {dependencies.python && !dependencies.fasterWhisper && !dependencies.openaiWhisper && (
            <div className="card bg-yellow-100">
              <h2 className="text-xl font-semibold mb-2">Whisper モデルが見つかりません</h2>
              <p>文字起こし機能を使用するには、faster-whisper または OpenAI Whisper をインストールする必要があります。</p>
              <p className="mt-2">ターミナルで以下のコマンドを実行してください：</p>
              <div className="bg-gray-800 text-white p-2 rounded mt-1 overflow-x-auto">
                <code>pip install faster-whisper</code>
              </div>
              <p className="mt-2">または：</p>
              <div className="bg-gray-800 text-white p-2 rounded mt-1 overflow-x-auto">
                <code>pip install openai-whisper</code>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* File selection */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">1. 音声ファイルを選択</h2>
        
        {audioFile ? (
          <div className="mb-4">
            <div>
          <p><strong>ファイル名:</strong> {audioFile.name}</p>
          <p><strong>パス:</strong> {audioFile.path}</p>
        </div>
          </div>
        ) : (
          <div>
            <div 
              className="audio-selector" 
              onClick={() => handleSelectFile()}
            >
              <p>クリックして音声ファイルを選択</p>
              <p className="text-sm text-gray-500">対応フォーマット: MP3, WAV, M4A, FLAC, AAC</p>
            </div>
            
            <RecentFiles 
              files={recentFiles}
              onSelectFile={handleSelectFile}
            />
          </div>
        )}
        
        {audioFile && (
          <button 
            className="btn-secondary" 
            onClick={() => handleSelectFile()}
          >
            ファイルを変更
          </button>
        )}
      </div>
      
      {/* Model selection */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">2. モデルと処理オプションを選択</h2>
        
        <div className="model-selector">
          <h3 className="text-lg font-medium mb-3">Whisper モデル</h3>
          <div className="model-option">
            <input 
              type="radio"
              id="model-small"
              name="model"
              checked={selectedModel === WhisperModel.FASTER_WHISPER_SMALL}
              onChange={() => {
                setSelectedModel(WhisperModel.FASTER_WHISPER_SMALL);
                window.api.setDefaultModel(WhisperModel.FASTER_WHISPER_SMALL);
              }}
            />
            <label htmlFor="model-small" className="ml-2">
              <span className="font-medium">faster-whisper small</span>
              <p className="text-sm text-gray-600">高速処理、適度な精度</p>
            </label>
          </div>
          
          <div className="model-option">
            <input 
              type="radio"
              id="model-medium"
              name="model"
              checked={selectedModel === WhisperModel.FASTER_WHISPER_MEDIUM}
              onChange={() => {
                setSelectedModel(WhisperModel.FASTER_WHISPER_MEDIUM);
                window.api.setDefaultModel(WhisperModel.FASTER_WHISPER_MEDIUM);
              }}
            />
            <label htmlFor="model-medium" className="ml-2">
              <span className="font-medium">faster-whisper medium</span>
              <p className="text-sm text-gray-600">より高い精度、適度な処理速度</p>
            </label>
          </div>
          
          <div className="model-option">
            <input 
              type="radio"
              id="model-large"
              name="model"
              checked={selectedModel === WhisperModel.OPENAI_WHISPER_LARGE_V3_TURBO}
              onChange={() => {
                setSelectedModel(WhisperModel.OPENAI_WHISPER_LARGE_V3_TURBO);
                window.api.setDefaultModel(WhisperModel.OPENAI_WHISPER_LARGE_V3_TURBO);
              }}
            />
            <label htmlFor="model-large" className="ml-2">
              <span className="font-medium">OpenAI Whisper large-v3-turbo</span>
              <p className="text-sm text-gray-600">最高精度、より遅い処理速度</p>
            </label>
          </div>
          
          <h3 className="text-lg font-medium my-4">AWS Transcribe モデル</h3>
          <div className="model-option">
            <input 
              type="radio"
              id="model-aws-auto"
              name="model"
              checked={selectedModel === WhisperModel.AWS_TRANSCRIBE_AUTO}
              onChange={() => {
                setSelectedModel(WhisperModel.AWS_TRANSCRIBE_AUTO);
                window.api.setDefaultModel(WhisperModel.AWS_TRANSCRIBE_AUTO);
              }}
            />
            <label htmlFor="model-aws-auto" className="ml-2">
              <span className="font-medium">AWS Transcribe 一般</span>
              <p className="text-sm text-gray-600">クラウド処理、高精度、自動言語検出</p>
            </label>
          </div>
          
          <div className="model-option">
            <input 
              type="radio"
              id="model-aws-medical"
              name="model"
              checked={selectedModel === WhisperModel.AWS_TRANSCRIBE_MEDICAL}
              onChange={() => {
                setSelectedModel(WhisperModel.AWS_TRANSCRIBE_MEDICAL);
                window.api.setDefaultModel(WhisperModel.AWS_TRANSCRIBE_MEDICAL);
              }}
            />
            <label htmlFor="model-aws-medical" className="ml-2">
              <span className="font-medium">AWS Transcribe Medical</span>
              <p className="text-sm text-gray-600">医療用語に特化、高精度</p>
            </label>
          </div>
          
          {/* AWS特有の設定 - モデルがAWS関連の場合のみ表示 */}
          {selectedModel.startsWith('aws-transcribe') && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <h4 className="font-medium mb-2">AWS設定</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="aws-region" className="block text-sm font-medium text-gray-700 mb-1">AWS リージョン</label>
                  <select
                    id="aws-region"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                  >
                    <option value="ap-northeast-1">東京 (ap-northeast-1)</option>
                    <option value="ap-northeast-3">大阪 (ap-northeast-3)</option>
                    <option value="us-east-1">バージニア (us-east-1)</option>
                    <option value="us-west-2">オレゴン (us-west-2)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 space-y-3">
          <div className="flex items-center">
            <input 
              type="checkbox"
              id="enable-separation"
              checked={enableSeparation}
              onChange={(e) => {
                setEnableSeparation(e.target.checked);
                window.api.setAudioSeparationEnabled(e.target.checked);
              }}
            />
            <label htmlFor="enable-separation" className="ml-2">
              <span className="font-medium">Demucsで音声分離を有効化</span>
              <p className="text-sm text-gray-600">ボーカルを分離してより高品質な文字起こしを実現</p>
            </label>
          </div>
          
          <div className="flex items-center">
            <input 
              type="checkbox"
              id="enable-ginza"
              checked={enableGinza}
              onChange={(e) => {
                setEnableGinza(e.target.checked);
              }}
            />
            <label htmlFor="enable-ginza" className="ml-2">
              <span className="font-medium">GiNZAで日本語テキスト整形を有効化</span>
              <p className="text-sm text-gray-600">自然な段落分けと読みやすさを向上（日本語のみ）</p>
            </label>
          </div>
        </div>
      </div>
      
      {/* Processing button */}
      <div className="card">
        <button 
          className="btn-primary"
          disabled={!audioFile || isProcessing}
          onClick={handleTranscribe}
        >
          {isProcessing ? '処理中...' : '文字起こしを開始'}
        </button>
        
        {/* Progress indicator */}
        <ProgressIndicator 
          status={progress}
          isProcessing={isProcessing}
          onCancel={() => {
            // Cancel functionality would be implemented here
            showNotification('info', '処理をキャンセルしました。');
            setIsProcessing(false);
          }}
        />
        
        {/* Error message */}
        {error && (
          <ErrorDisplay 
            error={error} 
            onDismiss={() => setError(null)}
          />
        )}
      </div>
      
      {/* Transcription result */}
      {transcriptionResult && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">3. 文字起こし結果</h2>
          
          <div className="mb-4">
            <p><strong>使用モデル:</strong> {transcriptionResult.modelUsed}</p>
            <p><strong>処理時間:</strong> {transcriptionResult.processingTime.toFixed(2)} 秒</p>
            <p><strong>音声分離:</strong> {transcriptionResult.audioSeparationUsed ? '有効' : '無効'}</p>
            {transcriptionResult.awsJobId && (
              <p><strong>AWS Job ID:</strong> {transcriptionResult.awsJobId}</p>
            )}
          </div>
          
          <TranscriptionEditor 
            text={transcriptionResult.text}
            segments={transcriptionResult.segments}
            onChange={(text) => setEditedTranscription(text)}
            onReset={() => setEditedTranscription(transcriptionResult.text)}
          />
          
          <ExportOptions 
            onExport={handleExport}
            segments={transcriptionResult.segments}
          />
        </div>
      )}
    </div>
  );
};

// Main App Component with context providers
const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

export default App;