import React, { useState, useEffect } from 'react';
import { TranscriptionResult } from '../../common/types';

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  result: TranscriptionResult;
}

interface TranscriptionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadHistory: (result: TranscriptionResult) => void;
}

const TranscriptionHistoryModal: React.FC<TranscriptionHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  onLoadHistory 
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const historyData = await window.api.getTranscriptionHistory();
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ja-JP');
  };

  const handleLoadHistory = (item: HistoryItem) => {
    onLoadHistory(item.result);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-4/5 max-w-4xl h-4/5 max-h-screen flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">文字起こし履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg">履歴を読み込み中...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">履歴がありません</div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <div className="grid gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleLoadHistory(item)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg truncate">{item.fileName}</h3>
                      <span className="text-sm text-gray-500 ml-4 whitespace-nowrap">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      モデル: {item.result.modelUsed}
                    </div>
                    <div className="text-gray-700 line-clamp-3">
                      {item.result.text.substring(0, 200)}
                      {item.result.text.length > 200 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {history.length > 0 && `${history.length}件の履歴`}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionHistoryModal;
