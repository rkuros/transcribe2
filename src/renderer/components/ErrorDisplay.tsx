import React, { useState } from 'react';
import { AppError, ErrorCategory } from '../../common/error-utils';

interface ErrorDisplayProps {
  error: AppError | string;
  onDismiss?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Convert string error to AppError if needed
  const appError = typeof error === 'string' 
    ? new AppError(error, ErrorCategory.UNKNOWN) 
    : error;
  
  const errorMessage = appError.getUserFriendlyMessage();
  const suggestions = appError.getTroubleshootingSuggestions();
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              エラーが発生しました
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{errorMessage}</p>
            </div>
            
            <button
              type="button"
              className="mt-2 text-sm text-red-600 hover:text-red-800 flex items-center"
              onClick={() => setShowDetails(!showDetails)}
            >
              <span>{showDetails ? '▼' : '▶'}</span>
              <span className="ml-1">トラブルシューティング</span>
            </button>
            
            {showDetails && (
              <div className="mt-2">
                <h4 className="text-sm font-medium text-red-800">解決策の提案:</h4>
                <ul className="mt-1 text-sm text-red-700 list-disc pl-5 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
                
                {appError.originalError && (
                  <div className="mt-2 text-xs text-gray-500">
                    <details>
                      <summary>技術的なエラーの詳細</summary>
                      <pre className="mt-1 whitespace-pre-wrap">
                        {appError.originalError instanceof Error 
                          ? appError.originalError.stack || appError.originalError.message
                          : String(appError.originalError)
                        }
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {onDismiss && (
          <button
            type="button"
            className="ml-auto flex-shrink-0 bg-red-50 text-red-500 hover:text-red-700 focus:outline-none"
            onClick={onDismiss}
          >
            <span className="sr-only">閉じる</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;