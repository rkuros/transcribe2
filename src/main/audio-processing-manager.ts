import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { AudioProcessingManager, ProgressReporter } from './interfaces';
import { 
  WhisperModel, 
  ProcessingOptions, 
  TranscriptionResult,
  DependencyStatus,
  ProgressStatus
} from '../common/types';

export class PythonAudioProcessingManager implements AudioProcessingManager, ProgressReporter {
  private callbacks: ((progress: any) => void)[] = [];
  private pythonPath: string = process.platform === 'darwin' ? 'python3' : 'python';
  private scriptBasePath: string;

  constructor(private mainWindow: BrowserWindow) {
    // Always use local scripts for development and testing
    this.scriptBasePath = path.join(__dirname, '..', '..', 'src', 'python');
    
    console.log('Python scripts path:', this.scriptBasePath);
    console.log('Check deps script exists:', fs.existsSync(path.join(this.scriptBasePath, 'check_deps.py')));
    console.log('Demucs script exists:', fs.existsSync(path.join(this.scriptBasePath, 'demucs', 'separate.py')));

    // Check if Python exists
    try {
      const pythonCheck = spawn(this.pythonPath, ['--version']);
      pythonCheck.on('error', (err) => {
        console.error('Python error:', err);
        // Send Python error to renderer
        if (this.mainWindow) {
          this.mainWindow.webContents.send('python-error', {
            message: `Pythonが見つかりませんでした。Python 3.9以上をインストールしてください。`,
            error: err.toString()
          });
        }
      });
    } catch (error) {
      console.error('Failed to check Python:', error);
    }
  }

  async processAudio(filePath: string, options: ProcessingOptions): Promise<TranscriptionResult> {
    // Store original file path for reference
    this.originalFilePath = filePath;
    let audioFilePath = filePath;

    // Step 1: Separate audio if enabled
    if (options.enableAudioSeparation) {
      try {
        audioFilePath = await this.separateAudio(filePath);
      } catch (error) {
        console.error('Error during audio separation:', error);
        // Continue with original file if separation fails
        audioFilePath = filePath;
      }
    }

    // Step 2: Transcribe audio
    try {
      return await this.transcribeAudio(audioFilePath, options.model);
    } catch (error) {
      console.error('Error during transcription:', error);
      // Return a default result if transcription fails
      return {
        text: "文字起こし処理中にエラーが発生しました: " + error,
        segments: [],
        processingTime: 0,
        modelUsed: options.model,
        audioSeparationUsed: audioFilePath !== filePath
      };
    }
  }

  async separateAudio(filePath: string): Promise<string> {
    console.log('Separating audio:', filePath);
    
    const scriptPath = path.join(this.scriptBasePath, 'demucs', 'separate.py');
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`Audio separation script not found: ${scriptPath}`);
      // Instead of throwing error, show error message to user
      if (this.mainWindow) {
        this.mainWindow.webContents.send('python-error', {
          message: `音声分離スクリプトが見つかりません。`,
          error: `スクリプトパス: ${scriptPath}`
        });
      }
      // Return original file path to continue with transcription without separation
      return filePath;
    }
    
    return new Promise<string>((resolve, reject) => {
      try {
        // Set a timeout for the separation process (3 minutes)
        const timeoutMs = 3 * 60 * 1000;
        let timeoutId: NodeJS.Timeout | null = null;
        
        // Spawn python process with fast mode enabled
        const process = spawn(this.pythonPath, [scriptPath, filePath, "--fast"]);
        
        let stdout = '';
        let stderr = '';
        
        // Set timeout handler
        timeoutId = setTimeout(() => {
          console.log('Audio separation process timed out');
          if (process.pid) {
            try {
              // Try to kill the process
              process.kill();
            } catch (e) {
              console.error('Failed to kill timed out process:', e);
            }
          }
          
          if (this.mainWindow) {
            this.mainWindow.webContents.send('python-error', {
              message: `音声分離処理がタイムアウトしました。元の音声ファイルを使用します。`,
              error: 'タイムアウト: 180秒'
            });
          }
          
          resolve(filePath);
        }, timeoutMs);
        
        process.stdout.on('data', (data) => {
          const dataStr = data.toString();
          stdout += dataStr;
          this.handlePythonOutput(dataStr);
          
          // If we got any response that seems to contain progress information,
          // reset the timeout timer
          if (dataStr.includes('"progress"')) {
            if (timeoutId !== null) {
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                console.log('Audio separation process timed out after progress update');
                process.kill();
                resolve(filePath);
              }, timeoutMs);
            }
          }
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          // Clear timeout if process completes
          if (timeoutId) clearTimeout(timeoutId);
          
          // Log the output for debugging
          console.log('Audio separation process output:', stdout);
          console.log('Audio separation errors/warnings:', stderr);
          
          if (code !== 0) {
            console.error('Audio separation process exited with code:', code);
            console.error('Audio separation failed:', stderr);
            
            // Show error but continue with original file
            if (this.mainWindow) {
              this.mainWindow.webContents.send('python-error', {
                message: `音声処理に失敗しました。元の音声ファイルを使用します。`,
                error: stderr
              });
            }
            return resolve(filePath);
          }
          
          try {
            // Split the stdout by lines and find the last complete JSON object
            const lines = stdout.split('\n');
            let lastValidJson = null;
            
            // First, log all found JSON objects for debugging
            console.log('Found JSON objects:');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              try {
                const parsedJson = JSON.parse(line);
                console.log(`Line ${i}: ${JSON.stringify(parsedJson)}`);
              } catch (e) {
                // Not valid JSON
              }
            }
            
            // Iterate through lines from the end to find the last valid JSON
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (!line) continue;
              
              try {
                // Try to parse the line as JSON
                const parsedJson = JSON.parse(line);
                // Check if it has the success property (final result)
                if ('success' in parsedJson) {
                  lastValidJson = parsedJson;
                  console.log('Found valid result JSON:', lastValidJson);
                  break;
                }
              } catch (e) {
                // Not valid JSON, continue searching
                continue;
              }
            }
            
            // Check if we found JSON data
            if (!lastValidJson) {
              console.error('No valid JSON found in output');
              return resolve(filePath);
            }
            
            const result = lastValidJson;
            
            if (result.success && result.vocal_path) {
              // Check if the file actually exists
              if (fs.existsSync(result.vocal_path)) {
                console.log('Audio processing completed:', result.vocal_path);
                resolve(result.vocal_path);
              } else {
                console.error('Audio processing completed but file does not exist:', result.vocal_path);
                if (this.mainWindow) {
                  this.mainWindow.webContents.send('python-error', {
                    message: `音声処理が完了しましたが、ファイルが見つかりません。元の音声ファイルを使用します。`,
                    error: `ファイルが存在しません: ${result.vocal_path}`
                  });
                }
                resolve(filePath);
              }
            } else {
              console.error('Audio processing result missing vocal_path:', result);
              // Show error but continue with original file
              if (this.mainWindow) {
                this.mainWindow.webContents.send('python-error', {
                  message: `音声処理結果が不完全です。元の音声ファイルを使用します。`,
                  error: result.error || 'ボーカルトラックのパスが見つかりません'
                });
              }
              resolve(filePath);
            }
          } catch (error) {
            console.error('Failed to parse audio processing result:', error);
            // Show error but continue with original file
            if (this.mainWindow) {
              this.mainWindow.webContents.send('python-error', {
                message: `音声処理結果の解析に失敗しました。元の音声ファイルを使用します。`,
                error: String(error)
              });
            }
            resolve(filePath);
          }
        });
        
        process.on('error', (error) => {
          // Clear timeout if process errors
          if (timeoutId) clearTimeout(timeoutId);
          
          console.error('Failed to start audio processing process:', error);
          // Show error but continue with original file
          if (this.mainWindow) {
            this.mainWindow.webContents.send('python-error', {
              message: `音声処理プロセスの起動に失敗しました。元の音声ファイルを使用します。`,
              error: String(error)
            });
          }
          resolve(filePath);
        });
      } catch (error) {
        console.error('Unexpected error during audio processing:', error);
        // Continue with original file
        resolve(filePath);
      }
    });
  }

  async transcribeAudio(filePath: string, model: WhisperModel): Promise<TranscriptionResult> {
    console.log('Transcribing audio:', filePath, 'with model:', model);
    
    const scriptPath = path.join(this.scriptBasePath, 'whisper', 'transcribe.py');
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`Transcription script not found: ${scriptPath}`);
      
      // Show error to user
      if (this.mainWindow) {
        this.mainWindow.webContents.send('python-error', {
          message: `文字起こしスクリプトが見つかりません。`,
          error: `スクリプトパス: ${scriptPath}`
        });
      }
      
      // Return empty result
      return {
        text: "文字起こしスクリプトが見つかりません。Python環境のセットアップを確認してください。",
        segments: [],
        processingTime: 0,
        modelUsed: model,
        audioSeparationUsed: false
      };
    }
    
    return new Promise<TranscriptionResult>((resolve, reject) => {
      try {
        // Spawn python process
        const process = spawn(
          this.pythonPath, 
          [scriptPath, filePath, '--model', model]
        );
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
          this.handlePythonOutput(data.toString());
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code !== 0) {
            console.error('Transcription failed:', stderr);
            
            // Show error to user but return empty result
            if (this.mainWindow) {
              this.mainWindow.webContents.send('python-error', {
                message: `文字起こし処理が失敗しました。`,
                error: stderr
              });
            }
            
            return resolve({
              text: "文字起こしに失敗しました。エラー: " + stderr,
              segments: [],
              processingTime: 0,
              modelUsed: model,
              audioSeparationUsed: false
            });
          }
          
          try {
            // Find the last valid JSON in stdout
            // Split the stdout by lines and find the last complete JSON object
            const lines = stdout.split('\n');
            let lastValidJson = null;
            
            // Iterate through lines from the end to find the last valid JSON
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (!line) continue;
              
              try {
                // Try to parse the line as JSON
                const parsedJson = JSON.parse(line);
                // Check if it has the success property (final result)
                if ('success' in parsedJson) {
                  lastValidJson = parsedJson;
                  break;
                }
              } catch (e) {
                // Not valid JSON, continue searching
                continue;
              }
            }
            
            // If no valid JSON found
            if (!lastValidJson) {
              console.error('No valid JSON found in output');
              
              if (this.mainWindow) {
                this.mainWindow.webContents.send('python-error', {
                  message: `文字起こし結果の形式が不正です。`,
                  error: 'JSONデータが見つかりません'
                });
              }
              
              return resolve({
                text: "文字起こし結果の形式が不正です。出力データ: " + stdout,
                segments: [],
                processingTime: 0,
                modelUsed: model,
                audioSeparationUsed: false
              });
            }
            
            const result = lastValidJson;
            
            if (result.success && result.result) {
              const transcriptionResult: TranscriptionResult = {
                text: result.result.text || "",
                segments: result.result.segments || [],
                processingTime: result.result.processingTime || 0,
                modelUsed: result.result.modelUsed || model,
                audioSeparationUsed: filePath !== this.originalFilePath // Check if we used separated audio
              };
              
              console.log('Transcription completed');
              resolve(transcriptionResult);
            } else {
              console.error('Invalid transcription result:', result);
              
              if (this.mainWindow) {
                this.mainWindow.webContents.send('python-error', {
                  message: `文字起こし結果が不完全です。`,
                  error: result.error || '不明なエラー'
                });
              }
              
              resolve({
                text: result.error || "文字起こし中に不明なエラーが発生しました。",
                segments: [],
                processingTime: 0,
                modelUsed: model,
                audioSeparationUsed: false
              });
            }
          } catch (error) {
            console.error('Failed to parse transcription result:', error);
            
            if (this.mainWindow) {
              this.mainWindow.webContents.send('python-error', {
                message: `文字起こし結果の解析に失敗しました。`,
                error: String(error)
              });
            }
            
            resolve({
              text: "文字起こし結果の解析に失敗しました: " + error,
              segments: [],
              processingTime: 0,
              modelUsed: model,
              audioSeparationUsed: false
            });
          }
        });
        
        process.on('error', (error) => {
          console.error('Failed to start transcription process:', error);
          
          if (this.mainWindow) {
            this.mainWindow.webContents.send('python-error', {
              message: `文字起こしプロセスの起動に失敗しました。`,
              error: String(error)
            });
          }
          
          resolve({
            text: "文字起こしプロセスの起動に失敗しました: " + error,
            segments: [],
            processingTime: 0,
            modelUsed: model,
            audioSeparationUsed: false
          });
        });
      } catch (error) {
        console.error('Unexpected error during transcription:', error);
        resolve({
          text: "文字起こし中に予期せぬエラーが発生しました: " + error,
          segments: [],
          processingTime: 0,
          modelUsed: model,
          audioSeparationUsed: false
        });
      }
    });
  }
  
  // Keep track of original file path
  private originalFilePath: string = '';

  async getAvailableModels(): Promise<WhisperModel[]> {
    const deps = await this.checkDependencies();
    const availableModels: WhisperModel[] = [];
    
    if (deps.models['faster-whisper-small']) {
      availableModels.push(WhisperModel.FASTER_WHISPER_SMALL);
    }
    
    if (deps.models['faster-whisper-medium']) {
      availableModels.push(WhisperModel.FASTER_WHISPER_MEDIUM);
    }
    
    if (deps.models['openai-whisper-large-v3-turbo']) {
      availableModels.push(WhisperModel.OPENAI_WHISPER_LARGE_V3_TURBO);
    }
    
    return availableModels;
  }

  async checkDependencies(): Promise<DependencyStatus> {
    console.log('Checking dependencies');
    
    const scriptPath = path.join(this.scriptBasePath, 'check_deps.py');
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`Dependency check script not found: ${scriptPath}`);
      // Return default values instead of throwing error
      return {
        python: true,  // Assume Python exists since we're running
        demucs: false, // Assume deps are not available since we can't check
        fasterWhisper: false,
        openaiWhisper: false,
        models: {
          'faster-whisper-small': false,
          'faster-whisper-medium': false,
          'openai-whisper-large-v3-turbo': false
        },
        details: {
          error: `依存関係チェックスクリプトが見つかりません: ${scriptPath}`
        }
      };
    }
    
    return new Promise<DependencyStatus>((resolve, reject) => {
      try {
        // Spawn python process
        const process = spawn(this.pythonPath, [scriptPath]);
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code !== 0) {
            console.error('Dependency check failed:', stderr);
            // Return default values instead of rejecting
            return resolve({
              python: true,
              demucs: false,
              fasterWhisper: false,
              openaiWhisper: false,
              models: {
                'faster-whisper-small': false,
                'faster-whisper-medium': false,
                'openai-whisper-large-v3-turbo': false
              },
              details: {
                error: `依存関係チェックが失敗しました: ${stderr}`
              }
            });
          }
          
          try {
            const result = JSON.parse(stdout);
            
            const depStatus: DependencyStatus = {
              python: result.python,
              demucs: result.demucs,
              fasterWhisper: result.fasterWhisper,
              openaiWhisper: result.openaiWhisper,
              models: result.models,
              details: result.details
            };
            
            console.log('Dependency check completed:', depStatus);
            resolve(depStatus);
          } catch (error) {
            console.error('Failed to parse dependency check result:', error);
            // Return default values instead of rejecting
            resolve({
              python: true,
              demucs: false,
              fasterWhisper: false,
              openaiWhisper: false,
              models: {
                'faster-whisper-small': false,
                'faster-whisper-medium': false,
                'openai-whisper-large-v3-turbo': false
              },
              details: {
                error: `依存関係チェック結果の解析に失敗しました: ${error}`
              }
            });
          }
        });
        
        process.on('error', (error) => {
          console.error('Failed to start dependency check process:', error);
          // Return default values instead of rejecting
          resolve({
            python: true,
            demucs: false,
            fasterWhisper: false,
            openaiWhisper: false,
            models: {
              'faster-whisper-small': false,
              'faster-whisper-medium': false,
              'openai-whisper-large-v3-turbo': false
            },
            details: {
              error: `依存関係チェックプロセスの起動に失敗しました: ${error}`
            }
          });
        });
      } catch (error) {
        console.error('Failed to run dependency check:', error);
        // Return default values instead of rejecting
        resolve({
          python: true,
          demucs: false,
          fasterWhisper: false,
          openaiWhisper: false,
          models: {
            'faster-whisper-small': false,
            'faster-whisper-medium': false,
            'openai-whisper-large-v3-turbo': false
          },
          details: {
            error: `依存関係チェックの実行に失敗しました: ${error}`
          }
        });
      }
    });
  }

  // Progress reporter implementation
  onProgress(callback: (progress: any) => void): void {
    this.callbacks.push(callback);
  }

  reportProgress(data: any): void {
    this.callbacks.forEach(callback => callback(data));
  }

  private handlePythonOutput(output: string): void {
    // Look for progress updates in the output
    try {
      if (output.includes('"progress"')) {
        // Find JSON objects in the output
        const jsonMatches = output.match(/\{(?:[^{}]|(\{(?:[^{}]|())*\}))*\}/g);
        
        if (jsonMatches && jsonMatches.length > 0) {
          // Process each JSON object found
          for (const jsonStr of jsonMatches) {
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.progress) {
                // Forward progress to renderer
                this.mainWindow.webContents.send('progress-update', data.progress);
                
                // Also report through the callbacks
                this.reportProgress(data.progress);
              }
            } catch (innerError) {
              // Skip invalid JSON
              console.debug('Skipping invalid JSON in output chunk');
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse progress data:', error);
    }
  }
}