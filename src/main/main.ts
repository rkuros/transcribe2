import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { ElectronFileManager } from './file-manager';
import { SettingsManager } from './settings-manager';
import { PythonAudioProcessingManager } from './audio-processing-manager';
import { AWSAudioProcessingManager } from './aws-audio-processing-manager';
import { StrandsAgentManager } from './strands-agent-manager';
import { ExportService } from './export-service';
import { HistoryManager } from './history-manager';
import { Logger } from './logger';
import { ExportFormat, SummarizationLength, WeeklyReportOptions, WhisperModel } from '../common/types';
import { AppError, ErrorCategory, categorizeError } from '../common/error-utils';

// Keep a global reference of the window object to avoid it being garbage collected
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './preload.js'),
      sandbox: false
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"]
      }
    });
  });

  // Load the index.html of the app
  const startUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8080' 
    : url.format({
        pathname: path.join(__dirname, '../index.html'),
        protocol: 'file:',
        slashes: true
      });
  
  mainWindow.loadURL(startUrl);

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Set up IPC handlers
  setupIpcHandlers();

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
    // ウィンドウが閉じられたときにセットアップフラグをリセット
    isSetupComplete = false;
  });
}

// This method will be called when Electron has finished initialization
// and is ready to create browser windows
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed, except on macOS where it's common
// for applications to stay open until the user quits explicitly with Cmd + Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Initialize managers
let fileManager: ElectronFileManager;
let settingsManager: SettingsManager;
let pythonAudioProcessingManager: PythonAudioProcessingManager;
let awsAudioProcessingManager: AWSAudioProcessingManager | null = null;
let strandsAgentManager: StrandsAgentManager | null = null;
let exportService: ExportService;
let historyManager: HistoryManager;
let logger: Logger;
let isSetupComplete = false;

// Get the appropriate audio processing manager based on the selected model
function getAudioProcessingManager(model: string): PythonAudioProcessingManager | AWSAudioProcessingManager {
  // Check if this is an AWS model
  if (model.startsWith('aws-transcribe')) {
    if (!awsAudioProcessingManager && mainWindow) {
      console.log('Initializing AWS audio processing manager');
      awsAudioProcessingManager = new AWSAudioProcessingManager(mainWindow);
    }
    return awsAudioProcessingManager!;
  }
  
  // Default to Python manager
  return pythonAudioProcessingManager;
}

// Set up IPC handlers after window creation
function setupIpcHandlers() {
  if (!mainWindow) return;
  if (isSetupComplete) return; // 既にセットアップ済みの場合は何もしない
  
  // Initialize managers
  fileManager = new ElectronFileManager(mainWindow);
  settingsManager = new SettingsManager();
  pythonAudioProcessingManager = new PythonAudioProcessingManager(mainWindow);
  exportService = new ExportService(mainWindow);
  historyManager = new HistoryManager();
  logger = new Logger();
  
  // セットアップが完了したことをマーク
  isSetupComplete = true;
  
  // Set up global error handlers
  process.on('uncaughtException', (error) => {
    const appError = categorizeError(error);
    logger.error(appError);
    
    dialog.showErrorBox(
      'アプリケーションエラー',
      `予期せぬエラーが発生しました: ${appError.getUserFriendlyMessage()}`
    );
  });
  
  process.on('unhandledRejection', (reason) => {
    const appError = categorizeError(reason instanceof Error ? reason : new Error(String(reason)));
    logger.error(appError);
    
    // Unhandled rejections don't always need to show a dialog
    console.error('Unhandled rejection:', appError);
  });

  // File handling IPC endpoints
  ipcMain.handle('select-audio-file', async () => {
    try {
      return await fileManager.selectAudioFile();
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError);
      throw appError;
    }
  });

  ipcMain.handle('export-transcription', async (_event, content: string, format: string, segments?: any[], filePath?: string) => {
    try {
      const result = await exportService.exportTranscription(
        content,
        format as ExportFormat,
        segments,
        filePath
      );
      
      logger.info(`Successfully exported file in ${format} format`, { filePath: result });
      return result;
    } catch (error) {
      const appError = categorizeError(error);
      
      // Don't log user cancellation as an error
      if (error instanceof Error && error.message.includes('canceled by user')) {
        logger.info('Export canceled by user');
      } else {
        logger.error(appError, { format, contentLength: content?.length });
      }
      
      throw appError;
    }
  });

  ipcMain.handle('get-audio-metadata', async (_event, filePath: string) => {
    return fileManager.getAudioMetadata(filePath);
  });
  
  // Settings handling IPC endpoints
  ipcMain.handle('get-default-model', () => {
    return settingsManager.getDefaultModel();
  });
  
  ipcMain.handle('set-default-model', (_event, model: WhisperModel) => {
    settingsManager.setDefaultModel(model);
  });
  
  ipcMain.handle('get-audio-separation-enabled', () => {
    return settingsManager.getEnableAudioSeparation();
  });
  
  ipcMain.handle('set-audio-separation-enabled', (_event, enabled: boolean) => {
    settingsManager.setEnableAudioSeparation(enabled);
  });
  
  ipcMain.handle('get-default-processing-options', () => {
    return settingsManager.getDefaultProcessingOptions();
  });
  
  ipcMain.handle('add-recent-file', (_event, filePath: string) => {
    settingsManager.addRecentFile(filePath);
  });
  
  ipcMain.handle('get-recent-files', () => {
    return settingsManager.getRecentFiles();
  });

  ipcMain.handle('get-last-export-format', () => {
    return settingsManager.getLastExportFormat();
  });
  
  ipcMain.handle('set-last-export-format', (_event, format: ExportFormat) => {
    settingsManager.setLastExportFormat(format);
  });
  
  ipcMain.handle('reset-settings', () => {
    settingsManager.resetToDefaults();
  });
  
  // Audio processing IPC endpoints
  ipcMain.handle('transcribe-audio', async (_event, filePath: string, options: any) => {
    try {
      logger.info(`Starting transcription for ${filePath}`, { options });
      // Get the appropriate manager based on the selected model
      const manager = getAudioProcessingManager(options.model);
      const result = await manager.processAudio(filePath, options);
      logger.info(`Successfully transcribed audio file`, { 
        filePath, 
        model: result.modelUsed, 
        processingTime: result.processingTime 
      });
      return result;
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError, { filePath, options });
      throw appError;
    }
  });
  
  // 要約処理エンドポイント
  ipcMain.handle('summarize-transcription', async (_event, text: string, options: any) => {
    try {
      logger.info(`Starting summarization`, { textLength: text.length });
      
      // StrandsAgentManagerを使用して要約
      if (!strandsAgentManager && mainWindow) {
        logger.info('Initializing StrandsAgentManager');
        strandsAgentManager = new StrandsAgentManager(mainWindow);
      }

      if (strandsAgentManager) {
        try {
          // StrandsAgentManagerを使用して要約
          logger.info('Using StrandsAgentManager for summarization');
          const result = await strandsAgentManager.summarizeText(text, {
            length: options.summarizationLength || SummarizationLength.MEDIUM
          });

          logger.info(`Successfully summarized text with StrandsAgentManager`, { 
            textLength: text.length,
            summaryLength: result.summary?.length || 0,
            processingTime: result.processingTime,
            modelUsed: result.modelUsed
          });

          return result;
        } catch (agentError) {
          logger.error('StrandsAgentManager summarization failed', agentError);
          logger.info('Falling back to wrapper script method');
          // StrandsAgentManagerが失敗した場合はラッパースクリプト方式にフォールバック
        }
      }

      // フォールバック: 従来のラッパースクリプト方式
      logger.info('Using wrapper script for summarization');
      // 要約スクリプトのパスを確認
      const wrapperScriptPath = '/Users/rkuros/bin/strands-summarize.sh';
      const fs = require('fs');
      if (!fs.existsSync(wrapperScriptPath)) {
        throw new Error(`要約ラッパースクリプトが見つかりません: ${wrapperScriptPath}`);
      }
      
      // 一時ファイルに書き出す
      const tmpDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tmpFile = path.join(tmpDir, `text_to_summarize_${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, text, 'utf8');
      
      // シェルスクリプトを直接実行
      const { spawn } = require('child_process');
      
      // コマンドライン引数を準備
      let args = [
        '--file', tmpFile,
        '--length', options.summarizationLength || SummarizationLength.MEDIUM,
        '--timeout', '600'
      ];
      
      // モデルが指定されている場合は追加
      if (options.model) {
        args.push('--model', options.model);
      }
      
      // モデルパラメーターが指定されている場合は追加
      if (options.maxTokens) {
        args.push('--max-tokens', options.maxTokens.toString());
      }
      
      if (options.temperature !== undefined) {
        args.push('--temperature', options.temperature.toString());
      }
      
      // シェルスクリプトを実行（コマンドとして実行）
      const result = await new Promise<{stdout: string, stderr: string, exitCode: number}>((resolve, reject) => {
        try {
          const cmdArgs = ['-c', `${wrapperScriptPath} ${args.join(' ')}`];
          console.log('Executing wrapper script as command:', '/bin/bash', cmdArgs);
          
          const process = spawn('/bin/bash', cmdArgs);
          
          let stdout = '';
          let stderr = '';

          process.stdout.on('data', (data: Buffer) => {
            const str = data.toString();
            stdout += str;
            console.log('STDOUT:', str);
          });

          process.stderr.on('data', (data: Buffer) => {
            const str = data.toString();
            stderr += str;
            console.error('STDERR from wrapper:', str);
          });

          process.on('close', (code: number) => {
            console.log('Process completed with code:', code);
            
            // 一時ファイルを削除
            try {
              fs.unlinkSync(tmpFile);
              console.log('Temporary file deleted:', tmpFile);
            } catch (e) {
              console.warn('一時ファイルの削除に失敗:', e);
            }
            
            if (code !== 0) {
              console.error(`Process exited with code ${code}`);
              console.error(`STDERR: ${stderr}`);
              reject(new Error(`Process failed with code ${code}: ${stderr}`));
            } else {
              resolve({
                stdout: stdout,
                stderr: stderr,
                exitCode: code || 0
              });
            }
          });

          process.on('error', (error: Error) => {
            console.error('Process error:', error);
            
            // エラー時も一時ファイルを削除
            try {
              fs.unlinkSync(tmpFile);
              console.log('Temporary file deleted after error:', tmpFile);
            } catch (e) {
              console.warn('一時ファイルの削除に失敗:', e);
            }
            
            reject(new Error(`Failed to start process: ${error.message}`));
          });
        } catch (error) {
          console.error('Exception during spawn:', error);
          
          // 例外時も一時ファイルを削除
          try {
            fs.unlinkSync(tmpFile);
            console.log('Temporary file deleted after exception:', tmpFile);
          } catch (e) {
            console.warn('一時ファイルの削除に失敗:', e);
          }
          
          reject(error);
        }
      });
      
      // JSON解析
      let jsonResult;
      try {
        jsonResult = JSON.parse(result.stdout);
      } catch (e) {
        console.error('要約結果のJSON解析エラー:', e);
        throw new Error(`要約結果の解析に失敗しました: ${result.stdout}`);
      }
      
      logger.info(`Successfully summarized text with wrapper script`, { 
        textLength: text.length,
        summaryLength: jsonResult.summary?.length || 0,
        processingTime: jsonResult.processingTime 
      });
      
      return jsonResult;
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError, { textLength: text?.length });
      throw appError;
    }
  });

  // Weekly Report生成エンドポイント
  ipcMain.handle('create-weekly-report', async (_event, text: string, options: WeeklyReportOptions) => {
    try {
      logger.info(`Starting Weekly Report generation`, { textLength: text.length, customerName: options.customerName });
      
      // StrandsAgentManagerを使用してWeekly Report生成
      if (!strandsAgentManager && mainWindow) {
        logger.info('Initializing StrandsAgentManager for Weekly Report');
        strandsAgentManager = new StrandsAgentManager(mainWindow);
      }

      if (strandsAgentManager) {
        try {
          // StrandsAgentManagerを使用してWeekly Report生成
          logger.info('Using StrandsAgentManager for Weekly Report generation');
          const result = await strandsAgentManager.createWeeklyReport(text, options);

          logger.info(`Successfully generated Weekly Report with StrandsAgentManager`, { 
            textLength: text.length,
            reportLength: result.report?.length || 0,
            processingTime: result.processingTime,
            modelUsed: result.modelUsed
          });

          return result;
        } catch (agentError) {
          logger.error('StrandsAgentManager Weekly Report generation failed', agentError);
          throw agentError; // Weekly Reportはフォールバック機能がないのでエラーをスロー
        }
      } else {
        throw new Error('StrandsAgentManagerが初期化されていません。Weekly Reportを生成できません。');
      }
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError, { textLength: text?.length, customerName: options.customerName });
      throw appError;
    }
  });
  
  ipcMain.handle('separate-audio', async (_event, filePath: string) => {
    // Always use Python manager for audio separation
    return pythonAudioProcessingManager.separateAudio(filePath);
  });
  
  ipcMain.handle('get-available-models', async () => {
    // Get models from both managers
    const pythonModels = await pythonAudioProcessingManager.getAvailableModels();
    
    // Try to get AWS models if possible, but don't fail if AWS is not available
    let awsModels: WhisperModel[] = [];
    try {
      if (!awsAudioProcessingManager && mainWindow) {
        awsAudioProcessingManager = new AWSAudioProcessingManager(mainWindow);
      }
      if (awsAudioProcessingManager) {
        awsModels = await awsAudioProcessingManager.getAvailableModels();
      }
    } catch (e) {
      console.warn('Failed to get AWS models:', e);
    }
    
    return [...pythonModels, ...awsModels];
  });
  
  ipcMain.handle('check-dependencies', async () => {
    try {
      logger.info('Checking dependencies');
      // Start with Python dependencies
      const pythonDeps = await pythonAudioProcessingManager.checkDependencies();
      
      let combinedDeps = {...pythonDeps};
      
      // Try to check AWS dependencies, but don't fail if AWS checking fails
      try {
        if (!awsAudioProcessingManager && mainWindow) {
          awsAudioProcessingManager = new AWSAudioProcessingManager(mainWindow);
        }
        if (awsAudioProcessingManager) {
          const awsDeps = await awsAudioProcessingManager.checkDependencies();
          
          // Merge the dependency information
          combinedDeps = {
            ...combinedDeps,
            awsTranscribe: awsDeps.awsTranscribe,
            models: {
              ...combinedDeps.models,
              ...awsDeps.models
            },
            details: {
              ...combinedDeps.details,
              awsTranscribe: awsDeps.details?.awsTranscribe,
              models: {
                ...combinedDeps.details?.models,
                ...awsDeps.details?.models
              }
            }
          };
        }
      } catch (e) {
        console.warn('Failed to check AWS dependencies:', e);
      }
      
      // Try to check Strands Agent dependencies, but don't fail if checking fails
      try {
        if (!strandsAgentManager && mainWindow) {
          strandsAgentManager = new StrandsAgentManager(mainWindow);
        }
        
        if (strandsAgentManager) {
          const strandsDeps = await strandsAgentManager.checkDependencies();
          
          // Merge the dependency information
          if (strandsDeps.bedrockAgent) {
            combinedDeps.bedrockAgent = strandsDeps.bedrockAgent;
          }
          if (strandsDeps.strandsAgent) {
            combinedDeps.strandsAgent = strandsDeps.strandsAgent;
          }
          if (strandsDeps.details) {
            if (!combinedDeps.details) {
              combinedDeps.details = {};
            }
            combinedDeps.details.bedrockAgent = strandsDeps.details;
            combinedDeps.details.strandsAgent = strandsDeps.details;
          }
        }
      } catch (e) {
        console.warn('Failed to check Strands Agent dependencies:', e);
      }
      
      logger.info('Dependency check completed', combinedDeps);
      return combinedDeps;
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError);
      throw appError;
    }
  });
  
  // History management IPC endpoints
  ipcMain.handle('get-transcription-history', async () => {
    try {
      return await historyManager.getHistory();
    } catch (error) {
      const appError = categorizeError(error);
      logger.error('Failed to get transcription history', { error: appError });
      throw appError;
    }
  });

  ipcMain.handle('save-transcription-to-history', async (_event, fileName: string, result: any) => {
    try {
      await historyManager.saveTranscription(fileName, result);
    } catch (error) {
      const appError = categorizeError(error);
      logger.error('Failed to save transcription to history', { error: appError });
      throw appError;
    }
  });
  
  // Logger access
  ipcMain.handle('get-log-path', () => {
    return logger.getLogPath();
  });
}

// More IPC handlers will be added here for:
// - Audio processing
// - Audio separation with Demucs
// - Transcription with Whisper models
// - Export functionality