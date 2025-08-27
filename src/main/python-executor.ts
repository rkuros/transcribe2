import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface PythonExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

class PythonExecutor {
  private pythonPath: string = process.platform === 'darwin' ? 'python3' : 'python';
  private scriptBasePath: string;

  constructor() {
    // スクリプトの基本パスを設定
    this.scriptBasePath = path.join(__dirname, '..', 'python');
    console.log('Python scripts path:', this.scriptBasePath);
  }

  /**
   * Python スクリプトを実行する
   * @param scriptPath スクリプトのパス
   * @param args コマンドライン引数
   * @param jsonParse 出力をJSONとしてパースするかどうか
   * @returns 実行結果
   */
  async executePythonScript(
    scriptPath: string,
    args: string[] = [],
    jsonParse: boolean = false
  ): Promise<PythonExecutionResult> {
    return new Promise<PythonExecutionResult>((resolve, reject) => {
      try {
        // スクリプトが存在するか確認
        if (!fs.existsSync(scriptPath)) {
          return reject(new Error(`Python script not found: ${scriptPath}`));
        }

        // Python プロセスを起動
        const process = spawn(this.pythonPath, [scriptPath, ...args]);
        
        let stdout = '';
        let stderr = '';

        // 標準出力を取得
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        // 標準エラー出力を取得
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // プロセス終了時のハンドラー
        process.on('close', (code) => {
          if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(`STDERR: ${stderr}`);
            return reject(new Error(`Python process failed with code ${code}: ${stderr}`));
          }

          // JSON パースが必要な場合
          if (jsonParse && stdout) {
            try {
              resolve({
                stdout: stdout,
                stderr: stderr,
                exitCode: code || 0
              });
            } catch (error) {
              reject(new Error(`Failed to parse Python script output as JSON: ${error}`));
            }
          } else {
            resolve({
              stdout: stdout,
              stderr: stderr,
              exitCode: code || 0
            });
          }
        });

        // エラーハンドラー
        process.on('error', (error) => {
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Python の依存関係をチェックする
   * @returns インストールされているパッケージの情報
   */
  async checkPythonDependencies(): Promise<any> {
    const depsScriptPath = path.join(this.scriptBasePath, 'check_deps.py');
    console.log('Check deps script exists:', fs.existsSync(depsScriptPath));

    if (!fs.existsSync(depsScriptPath)) {
      return {
        python: false,
        error: `Dependencies check script not found: ${depsScriptPath}`
      };
    }

    try {
      const result = await this.executePythonScript(depsScriptPath, [], true);
      return JSON.parse(result.stdout);
    } catch (error) {
      console.error('Failed to check Python dependencies:', error);
      return {
        python: false,
        error: `Failed to check dependencies: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const pythonExecutor = new PythonExecutor();