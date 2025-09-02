import React, { useState, useEffect } from 'react';
import { TranscriptionResult } from '../../common/types';

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  result: TranscriptionResult;
}

interface TranscriptionHistoryProps {
  onLoadHistory: (result: TranscriptionResult) => void;
}

const TranscriptionHistory: React.FC<TranscriptionHistoryProps> = ({ onLoadHistory }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const historyData = await window.api.getTranscriptionHistory();
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ja-JP');
  };

  const handleLoadHistory = (item: HistoryItem) => {
    onLoadHistory(item.result);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        履歴を表示
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white border rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
          <div className="p-4 border-b">
            <h3 className="font-semibold">文字起こし履歴</h3>
          </div>
          
          {history.length === 0 ? (
            <div className="p-4 text-gray-500">履歴がありません</div>
          ) : (
            <div className="divide-y">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleLoadHistory(item)}
                >
                  <div className="font-medium text-sm">{item.fileName}</div>
                  <div className="text-xs text-gray-500">{formatDate(item.timestamp)}</div>
                  <div className="text-xs text-gray-600 mt-1 truncate">
                    {item.result.text.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionHistory;
