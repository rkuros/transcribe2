import React, { useState } from 'react';
import { SummarizationLength, SummarizationOptions, SummarizationResult, WeeklyReportResult, WeeklyReportOptions } from '../../common/types';

interface SummaryDisplayProps {
  original: string;
  summary?: string | null;
  summarizationResult?: SummarizationResult | null;
  weeklyReportResult?: WeeklyReportResult | null;
  processingTime?: number;
  onRequestSummary: (options: SummarizationOptions) => void;
  onRequestWeeklyReport?: (options: WeeklyReportOptions) => void;
  isProcessing: boolean;
  customerName?: string;
  opportunityName?: string;
  opportunitySize?: string;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  original,
  summary,
  summarizationResult,
  weeklyReportResult,
  processingTime,
  onRequestSummary,
  onRequestWeeklyReport,
  isProcessing,
  customerName,
  opportunityName,
  opportunitySize
}) => {
  const [summaryLength, setSummaryLength] = useState<SummarizationLength>(SummarizationLength.MEDIUM);
  const [model, setModel] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [temperature, setTemperature] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'summary' | 'weekly'>('summary');
  
  return (
    <div className="summary-container">
      <div className="flex flex-col mb-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-600 mb-3">
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'summary' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setActiveTab('summary')}
            disabled={isProcessing}
          >
            要約
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'weekly' ? 'border-b-2 border-green-500 text-green-500' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setActiveTab('weekly')}
            disabled={isProcessing}
          >
            Weekly Report
          </button>
        </div>
        
        {activeTab === 'summary' && (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-sm">Strands Agentを使用して文字起こし結果の要約を生成</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <select 
                  value={summaryLength}
                  onChange={(e) => setSummaryLength(e.target.value as SummarizationLength)}
                  className="rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1 bg-gray-800 text-gray-100"
                  disabled={isProcessing}
                >
                  <option value={SummarizationLength.SHORT}>簡潔 (短)</option>
                  <option value={SummarizationLength.MEDIUM}>標準</option>
                  <option value={SummarizationLength.LONG}>詳細 (長)</option>
                </select>
              </div>
              
              <button
                className="btn-primary"
                onClick={() => onRequestSummary({
                  summarizationLength: summaryLength,
                  model: model || undefined,
                  maxTokens: maxTokens,
                  temperature: temperature
                })}
                disabled={isProcessing}
              >
                {isProcessing ? '処理中...' : '要約を生成'}
              </button>
              
              <button
                className="btn-link text-xs"
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={isProcessing}
              >
                {showAdvanced ? '詳細設定を隠す' : '詳細設定を表示'}
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'weekly' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-100">Weekly Report 設定</h4>
                <span className="text-sm text-gray-400">文字起こし結果からWeekly Reportを生成</span>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">顧客名 <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-2 bg-gray-800 text-gray-100"
                      placeholder="例: AWS Japan"
                      value={customerName || ''}
                      disabled={isProcessing}
                      // 親コンポーネントでのみ編集可能なため、read-onlyにしています
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">案件名</label>
                    <input
                      type="text"
                      className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-2 bg-gray-800 text-gray-100"
                      placeholder="例: Bedrock POC"
                      value={opportunityName || ''}
                      disabled={isProcessing}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">規模 (ARR/MRR)</label>
                    <input
                      type="text"
                      className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-2 bg-gray-800 text-gray-100"
                      placeholder="例: ARR $50k"
                      value={opportunitySize || ''}
                      disabled={isProcessing}
                      readOnly
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <button
                    className="btn-link text-xs"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    disabled={isProcessing}
                  >
                    {showAdvanced ? '詳細設定を隠す' : '詳細設定を表示'}
                  </button>
                  
                  <button
                    className="btn-primary text-base py-3 px-8 flex items-center gap-2 shadow-lg"
                    onClick={() => onRequestWeeklyReport && onRequestWeeklyReport({
                      customerName: customerName || 'Unknown Customer',
                      opportunityName,
                      opportunitySize,
                      model: model || undefined,
                      maxTokens: maxTokens,
                      temperature: temperature
                    })}
                    disabled={isProcessing || !onRequestWeeklyReport || !customerName}
                    style={{ backgroundColor: '#8B5CF6', borderColor: '#7C3AED' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isProcessing ? '処理中...' : 'Weekly Reportを生成'}
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        )}
      </div>
      
      {showAdvanced && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg">
          <h4 className="font-medium mb-2 text-gray-100">詳細設定</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="model-id" className="block text-sm font-medium text-gray-200 mb-1">モデルID</label>
              <input
                type="text"
                id="model-id"
                className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1 bg-gray-800 text-gray-100"
                placeholder="例: us.anthropic.claude-3-7-sonnet-20250219-v1:0"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-400 mt-1">空欄の場合はデフォルトモデルを使用</p>
            </div>
            <div>
              <label htmlFor="max-tokens" className="block text-sm font-medium text-gray-200 mb-1">最大トークン数</label>
              <input
                type="number"
                id="max-tokens"
                className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1 bg-gray-800 text-gray-100"
                placeholder="例: 1600"
                value={maxTokens === undefined ? '' : maxTokens}
                onChange={(e) => setMaxTokens(e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isProcessing}
                min="100"
                max="4000"
              />
              <p className="text-xs text-gray-400 mt-1">空欄の場合はデフォルト値を使用</p>
            </div>
            <div className="col-span-2">
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-200 mb-1">温度パラメーター: {temperature.toFixed(1)}</label>
              <input
                type="range"
                id="temperature"
                className="block w-full rounded-md border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1 bg-gray-800"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isProcessing}
                min="0"
                max="1"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">低い値 (0に近い) = より確実な回答、高い値 (1に近い) = より多様な回答</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Result */}
      {activeTab === 'summary' && summary && (
        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="mb-2 text-sm text-gray-300">
            {processingTime && <span>処理時間: {processingTime.toFixed(2)} 秒 | </span>}
            <span>要約率: {Math.round((summary.length / original.length) * 100)}%</span>
            {summarizationResult?.modelUsed && <span> | モデル: {summarizationResult.modelUsed}</span>}
          </div>
          <div className="whitespace-pre-wrap text-gray-100">
            {summary}
          </div>
        </div>
      )}
      
      {/* Weekly Report Result */}
      {activeTab === 'weekly' && weeklyReportResult?.report && (
        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="mb-2 text-sm text-gray-300">
            {weeklyReportResult.processingTime && <span>処理時間: {weeklyReportResult.processingTime.toFixed(2)} 秒</span>}
            {weeklyReportResult.modelUsed && <span> | モデル: {weeklyReportResult.modelUsed}</span>}
          </div>
          <div className="whitespace-pre-wrap text-gray-100">
            {weeklyReportResult.report}
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryDisplay;