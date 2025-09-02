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
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, limit]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const historyData = await window.api.getTranscriptionHistory();
      // Limit the number of items displayed
      setHistory(historyData.slice(0, limit));
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
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-4/5 max-w-4xl h-4/5 max-h-screen flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold">文字起こし履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <label className="text-sm">表示件数:</label>
            <input 
              type="number" 
              value={limit} 
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
              min="1"
              max="100"
              className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 w-20"
            />
            <span className="text-sm text-gray-400">件</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg">履歴を読み込み中...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">履歴がありません</div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <div className="grid gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-600 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleLoadHistory(item)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg truncate text-white">{item.fileName}</h3>
                      <span className="text-sm text-gray-400 ml-4 whitespace-nowrap">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 mb-2">
                      モデル: {item.result.modelUsed}
                    </div>
                    <div className="text-gray-300" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 10,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.result.text.substring(0, 1000)}
                      {item.result.text.length > 1000 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-900">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              {history.length > 0 && `${history.length}件の履歴を表示中`}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
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
