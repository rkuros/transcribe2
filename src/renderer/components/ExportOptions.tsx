import React, { useState } from 'react';
import { ExportFormat, TranscriptionSegment } from '../../common/types';

interface ExportOptionsProps {
  onExport: (format: ExportFormat) => void;
  segments?: TranscriptionSegment[];
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ onExport, segments }) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleExport = (format: ExportFormat) => {
    onExport(format);
  };

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium mb-2">エクスポート</h3>
      
      <div className="flex flex-wrap gap-2">
        <button 
          className="btn-secondary"
          onClick={() => handleExport(ExportFormat.TXT)}
        >
          テキストとしてエクスポート (.txt)
        </button>
        
        <button 
          className="btn-secondary"
          onClick={() => handleExport(ExportFormat.DOCX)}
        >
          Word文書としてエクスポート (.docx)
        </button>
        
        <button 
          className="btn-secondary"
          onClick={() => handleExport(ExportFormat.SRT)}
        >
          字幕としてエクスポート (.srt)
        </button>
      </div>
      
      <button 
        className="text-sm text-blue-600 hover:text-blue-800 mt-2 flex items-center"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span>{showDetails ? '▼' : '▶'}</span>
        <span className="ml-1">エクスポート形式の詳細</span>
      </button>
      
      {showDetails && (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          <div className="mb-2">
            <h4 className="font-medium">テキスト (.txt)</h4>
            <p>シンプルなテキストファイル。すべてのテキストエディタで開くことができます。</p>
          </div>
          
          <div className="mb-2">
            <h4 className="font-medium">Word文書 (.docx)</h4>
            <p>Microsoft Word文書。テキスト編集とフォーマットに適しています。</p>
          </div>
          
          <div>
            <h4 className="font-medium">字幕 (.srt)</h4>
            <p>SubRip字幕形式。ビデオプレーヤーや字幕編集ソフトウェアと互換性があります。
              {segments && segments.length > 0 ? 
                ' 元のオーディオからのタイムコードが含まれます。' :
                ' タイムコードは自動生成されます。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportOptions;