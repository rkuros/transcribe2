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

  // Format text with paragraph breaks (Japanese optimized)
  const handleFormatParagraphs = () => {
    console.log('段落整形ボタンがクリックされました');
    
    // Japanese-optimized paragraph formatting with improved logic
    let paragraphs = editedText;
    
    // First, normalize line breaks and whitespace
    paragraphs = paragraphs
      .replace(/\r\n/g, '\n')                   // Normalize line breaks
      .replace(/\s+/g, ' ')                    // Normalize whitespace to single spaces
      .trim();
      
    // Detect paragraph patterns
    // 1. Look for repetitive patterns (speaker indicators)
    const speakerPattern = /([A-Z一-龯][A-Za-z一-龯]*?[：:])\s*/g;
    const hasSpeakerIndicators = speakerPattern.test(paragraphs);
    
    if (hasSpeakerIndicators) {
      // Format as dialogue with speakers
      paragraphs = paragraphs
        .replace(/([A-Z一-龯][A-Za-z一-龯]*?[：:])/g, '\n$1')  // Line break before speaker
        .replace(/\n+([A-Z一-龯][A-Za-z一-龯]*?[：:])/g, '\n\n$1') // Double line break between speakers
        .replace(/^\s+|\s+$/gm, '')             // Trim each line
        .trim();
    } else {
      // Standard Japanese paragraph formatting
      paragraphs = paragraphs
        .replace(/([。！？]\s*)/g, '$1\n\n')    // Add paragraph break after sentence endings
        .replace(/([、])([^\n])/g, '$1 $2')    // Add space after commas for readability
        .replace(/^\s+|\s+$/gm, '')             // Trim each line
        .replace(/\n{3,}/g, '\n\n')             // Limit to max double newlines
        .trim();
    }
    
    // Handle special cases for Japanese language
    paragraphs = paragraphs
      // Ensure proper spacing around parentheses
      .replace(/([(（])\s*/g, '$1')           // No space after opening parenthesis
      .replace(/\s*([)）])/g, '$1')           // No space before closing parenthesis
      
      // Preserve proper spacing around numbers and dates
      .replace(/([0-9]+)\s*([年月日時分秒])/g, '$1$2') // No space between numbers and time/date units
      
      // Ensure proper sentence flow
      .replace(/([^。！？\n])\n\n([ぁ-んァ-ン])/g, '$1。\n\n$2') // Add missing period before paragraph break if needed
      .trim();
    
    setEditedText(paragraphs);
    onChange(paragraphs);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(paragraphs);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Clean up Japanese text formatting
  const handleCleanupText = () => {
    console.log('文字整形ボタンがクリックされました');
    
    // Enhanced text cleanup with better language handling
    let cleanText = editedText;
    
    // Normalize whitespace and line breaks first
    cleanText = cleanText
      .replace(/\r\n/g, '\n')                   // Normalize line breaks
      .replace(/\s+/g, ' ')                    // Normalize whitespace to single spaces
      .trim();
    
    // Fix common transcription errors
    cleanText = cleanText
      // Fix Japanese punctuation
      .replace(/\.\s*/g, '。')               // Replace western periods with Japanese periods
      .replace(/,\s*/g, '、')               // Replace western commas with Japanese commas
      .replace(/!\s*/g, '！')               // Replace western exclamation with Japanese
      .replace(/\?\s*/g, '？')              // Replace western question mark with Japanese
      
      // Fix spacing around Japanese characters
      .replace(/([\u3041-\u3093\u30a1-\u30f3\u30fc\u4e00-\u9faf])\s+([\u3041-\u3093\u30a1-\u30f3\u30fc\u4e00-\u9faf])/g, '$1$2') // No spaces between Japanese characters
      
      // Proper spacing between Japanese and other languages/numbers
      .replace(/([\u3041-\u3093\u30a1-\u30f3\u30fc\u4e00-\u9faf])([a-zA-Z0-9])/g, '$1 $2')  // Space between Japanese and alphanumeric
      .replace(/([a-zA-Z0-9])([\u3041-\u3093\u30a1-\u30f3\u30fc\u4e00-\u9faf])/g, '$1 $2')  // Space between alphanumeric and Japanese
      
      // Fix repeated punctuation
      .replace(/[。！？]+/g, (match) => match.charAt(0)) // Replace multiple Japanese punctuation with single
      
      // Fix spacing around Japanese punctuation
      .replace(/\s*([。！？、])\s*/g, '$1')      // No space around Japanese punctuation
      
      // Fix numbers and units
      .replace(/(\d+)\s*([\u5186\u500b\u6b73\u5e74\u6708\u65e5\u6642\u5206\u79d2])/g, '$1$2') // No space between number and unit
      
      // Fix quotation marks
      .replace(/"([^"]*)"/g, '「$1」')  // Replace western quotes with Japanese brackets
      
      // Fix repetitions common in transcriptions
      .replace(/([\u3041-\u3093\u30a1-\u30f3\u30fc\u4e00-\u9faf])\1{3,}/g, '$1$1') // Reduce character repetitions to maximum of 2
      
      // Remove filler words common in Japanese transcriptions
      .replace(/\s*(\u3042\u306e|\u3048\u30fc\u3068|\u3093\u30fc|\u307e\u3042)\s*/g, '') // Remove fillers like あの, えーと, んー, まあ
      
      // Preserve paragraph structure
      .replace(/\n+/g, '\n')                    // Normalize to single newlines
      .replace(/^\s+|\s+$/gm, '')               // Trim each line
      .trim();
    
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
            className="text-sm px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            元に戻す
          </button>
          <button
            className="text-sm px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            やり直し
          </button>
          {/* GiNZA自動整形に置き換えたため手動整形ボタンは削除 */}
        </div>
        <button
          className="text-sm px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
          onClick={handleReset}
        >
          元の文字起こしに戻す
        </button>
      </div>
      
      <textarea
        ref={textareaRef}
        className="w-full min-h-[300px] p-4 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800 text-gray-100"
        value={editedText}
        onChange={handleTextChange}
        placeholder="文字起こし結果がここに表示されます"
      />
      
      {segments && segments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">タイムスタンプ付きセグメント</h3>
          <div className="max-h-[200px] overflow-y-auto border border-gray-600 rounded-md p-2 bg-gray-800">
            {segments.map((segment, index) => (
              <div key={index} className="text-sm mb-2 p-2 hover:bg-gray-700 text-gray-200">
                <div className="text-xs text-gray-400 mb-1">
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