import React from 'react';

interface RecentFilesProps {
  files: string[];
  onSelectFile: (filePath: string) => void;
}

const RecentFiles: React.FC<RecentFilesProps> = ({ files, onSelectFile }) => {
  if (!files.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium mb-2">最近使用したファイル</h3>
      <div className="max-h-40 overflow-y-auto">
        <ul className="divide-y divide-gray-200">
          {files.map((filePath, index) => {
            // Get just the file name for display
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            
            return (
              <li 
                key={index} 
                className="py-2 hover:bg-gray-100 cursor-pointer rounded px-2"
                onClick={() => onSelectFile(filePath)}
              >
                <div className="flex items-center">
                  <span className="flex-1 truncate">{fileName}</span>
                  <span className="text-xs text-gray-500 truncate max-w-xs">{filePath}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default RecentFiles;