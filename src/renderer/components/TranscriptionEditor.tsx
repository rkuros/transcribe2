import React, { useState, useEffect, useRef } from 'react';
import { TranscriptionSegment } from '../../common/types';

interface TranscriptionEditorProps {
  text: string;
  segments?: TranscriptionSegment[];
  onChange: (text: string) => void;
  onReset: () => void;
}

const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  text,
  segments,
  onChange,
  onReset
}) => {
  const [editedText, setEditedText] = useState<string>(text);
  const [history, setHistory] = useState<string[]>([text]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update editor when text prop changes
  useEffect(() => {
    setEditedText(text);
    setHistory([text]);
    setHistoryIndex(0);
  }, [text]);

  // Auto-save changes when user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editedText !== text) {
        onChange(editedText);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [editedText, onChange, text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedText(newText);
    
    // Add to history after delay to avoid too many history entries
    clearTimeout((window as any).historyTimeout);
    (window as any).historyTimeout = setTimeout(() => {
      // Only add to history if text has changed significantly
      if (newText !== history[historyIndex] && 
          Math.abs(newText.length - history[historyIndex].length) > 5) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newText);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 2000);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditedText(history[newIndex]);
      onChange(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditedText(history[newIndex]);
      onChange(history[newIndex]);
    }
  };

  const handleReset = () => {
    setEditedText(text);
    onChange(text);
    onReset();
  };

  // Format text with paragraph breaks
  const handleFormatParagraphs = () => {
    // Split by multiple line breaks and join with proper paragraph spacing
    const paragraphs = editedText
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .join('\n\n');
    
    setEditedText(paragraphs);
    onChange(paragraphs);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(paragraphs);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Remove excess spaces
  const handleCleanupText = () => {
    const cleanText = editedText
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .replace(/\s+\./g, '.') // Remove spaces before periods
      .replace(/\s+,/g, ',') // Remove spaces before commas
      .split(/\n/)
      .map(line => line.trim())
      .join('\n');
    
    setEditedText(cleanText);
    onChange(cleanText);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleanText);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  return (
    <div className="transcription-editor">
      <div className="mb-2 flex justify-between">
        <div className="flex space-x-2">
          <button
            className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            元に戻す
          </button>
          <button
            className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            やり直し
          </button>
          <button
            className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={handleFormatParagraphs}
          >
            段落を整形
          </button>
          <button
            className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={handleCleanupText}
          >
            文字を整形
          </button>
        </div>
        <button
          className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={handleReset}
        >
          元の文字起こしに戻す
        </button>
      </div>
      
      <textarea
        ref={textareaRef}
        className="w-full min-h-[300px] p-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={editedText}
        onChange={handleTextChange}
        placeholder="文字起こし結果がここに表示されます"
      />
      
      {segments && segments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">タイムスタンプ付きセグメント</h3>
          <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
            {segments.map((segment, index) => (
              <div key={index} className="text-sm mb-2 p-2 hover:bg-gray-100">
                <div className="text-xs text-gray-500 mb-1">
                  {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                </div>
                <div>{segment.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format time in HH:MM:SS format
const formatTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return [
    h > 0 ? h.toString().padStart(2, '0') + ':' : '',
    m.toString().padStart(2, '0'),
    ':',
    s.toString().padStart(2, '0')
  ].join('');
};

export default TranscriptionEditor;