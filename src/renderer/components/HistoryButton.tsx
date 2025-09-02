import React from 'react';

interface HistoryButtonProps {
  onClick: () => void;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="btn-primary bg-cyan-500 hover:bg-cyan-600 flex items-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      履歴を表示
    </button>
  );
};

export default HistoryButton;
