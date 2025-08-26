import { contextBridge, ipcRenderer } from 'electron';
import { WhisperModel } from '../common/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  transcribeAudio: (filePath: string, options: any) => ipcRenderer.invoke('transcribe-audio', filePath, options),
  separateAudio: (filePath: string) => ipcRenderer.invoke('separate-audio', filePath),
  exportTranscription: (content: string, format: string, segments?: any[], filePath?: string) => ipcRenderer.invoke('export-transcription', content, format, segments, filePath),
  getAudioMetadata: (filePath: string) => ipcRenderer.invoke('get-audio-metadata', filePath),
  
  // Settings-related methods
  getDefaultModel: () => ipcRenderer.invoke('get-default-model'),
  setDefaultModel: (model: WhisperModel) => ipcRenderer.invoke('set-default-model', model),
  getAudioSeparationEnabled: () => ipcRenderer.invoke('get-audio-separation-enabled'),
  setAudioSeparationEnabled: (enabled: boolean) => ipcRenderer.invoke('set-audio-separation-enabled', enabled),
  getDefaultProcessingOptions: () => ipcRenderer.invoke('get-default-processing-options'),
  addRecentFile: (filePath: string) => ipcRenderer.invoke('add-recent-file', filePath),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  getLastExportFormat: () => ipcRenderer.invoke('get-last-export-format'),
  setLastExportFormat: (format: string) => ipcRenderer.invoke('set-last-export-format', format),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  
  // Python process-related methods
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  onProgressUpdate: (callback: (progress: any) => void) => ipcRenderer.on('progress-update', (_event, progress) => callback(progress)),
  removeProgressListener: () => ipcRenderer.removeAllListeners('progress-update'),
  
  // Logger-related methods
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  
  // Error handling
  onPythonError: (callback: (error: any) => void) => ipcRenderer.on('python-error', (_event, error) => callback(error)),
  removePythonErrorListener: () => ipcRenderer.removeAllListeners('python-error'),
});