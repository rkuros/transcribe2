import React, { useState, useEffect } from 'react';
import { ProgressStatus } from '../../common/types';

interface ProgressIndicatorProps {
  status: ProgressStatus;
  isProcessing: boolean;
  onCancel?: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  isProcessing,
  onCancel
}) => {
  const [lastStatus, setLastStatus] = useState<ProgressStatus>(status);
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  // Keep track of the most recent valid status
  useEffect(() => {
    if (isProcessing && status.percent >= 0) {
      setLastStatus(status);
    }
  }, [status, isProcessing]);

  // Generate helpful progress messages based on the stage
  useEffect(() => {
    if (isProcessing) {
      switch (status.stage) {
        case 'separation':
          setProgressMessage('Demucsによる音声分離を実行中です...');
          break;
        case 'transcription':
          setProgressMessage(`Whisperモデルによる文字起こしを実行中です...`);
          break;
        case 'complete':
          setProgressMessage('処理が完了しました！');
          break;
        default:
          setProgressMessage('処理中です...');
      }
    }
  }, [status.stage, isProcessing]);

  if (!isProcessing) {
    return null;
  }
  
  const formatTime = (seconds?: number): string => {
    if (seconds === undefined) return 'calculating...';
    
    if (seconds < 60) {
      return `${Math.ceil(seconds)} 秒`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} 分`;
    }
  };
  
  const getStageText = (stage: string): string => {
    switch (stage) {
      case 'separation': return '音声分離';
      case 'transcription': return '文字起こし';
      case 'complete': return '完了';
      default: return '処理中';
    }
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between mb-1">
        <p className="font-medium">
          {getStageText(lastStatus.stage)} ({lastStatus.percent}%)
        </p>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            キャンセル
          </button>
        )}
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${lastStatus.percent}%` }} 
        />
      </div>

      {/* Progress message */}
      <div className="text-sm text-gray-600 mt-1">
        <p>{progressMessage}</p>
      </div>
      
      {lastStatus.estimatedTimeRemaining !== undefined && (
        <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
          <div className="progress-stage">
            <span className={`inline-block w-3 h-3 rounded-full mr-1 ${lastStatus.stage === 'separation' ? 'bg-blue-500' : lastStatus.stage === 'complete' && status.percent >= 100 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            <span className={lastStatus.stage === 'separation' ? 'font-medium' : ''}>音声分離</span>
            <span className="mx-2">→</span>
            <span className={`inline-block w-3 h-3 rounded-full mr-1 ${lastStatus.stage === 'transcription' ? 'bg-blue-500' : lastStatus.stage === 'complete' && status.percent >= 100 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            <span className={lastStatus.stage === 'transcription' ? 'font-medium' : ''}>文字起こし</span>
          </div>
          <p>
            残り約 {formatTime(lastStatus.estimatedTimeRemaining)}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgressIndicator;