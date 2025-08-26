import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { ElectronFileManager } from './file-manager';
import { SettingsManager } from './settings-manager';
import { PythonAudioProcessingManager } from './audio-processing-manager';
import { AWSAudioProcessingManager } from './aws-audio-processing-manager';
import { ExportService } from './export-service';
import { Logger } from './logger';
import { ExportFormat, WhisperModel } from '../common/types';
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
let exportService: ExportService;
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
      
      // Try to check AWS dependencies, but don't fail if AWS checking fails
      try {
        if (!awsAudioProcessingManager && mainWindow) {
          awsAudioProcessingManager = new AWSAudioProcessingManager(mainWindow);
        }
        if (awsAudioProcessingManager) {
          const awsDeps = await awsAudioProcessingManager.checkDependencies();
          
          // Merge the dependency information
          const combinedDeps = {
            ...pythonDeps,
            awsTranscribe: awsDeps.awsTranscribe,
            models: {
              ...pythonDeps.models,
              ...awsDeps.models
            },
            details: {
              ...pythonDeps.details,
              awsTranscribe: awsDeps.details?.awsTranscribe,
              models: {
                ...pythonDeps.details?.models,
                ...awsDeps.details?.models
              }
            }
          };
          logger.info('Dependency check completed', combinedDeps);
          return combinedDeps;
        }
      } catch (e) {
        console.warn('Failed to check AWS dependencies:', e);
      }
      
      logger.info('Dependency check completed', pythonDeps);
      return pythonDeps;
    } catch (error) {
      const appError = categorizeError(error);
      logger.error(appError);
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