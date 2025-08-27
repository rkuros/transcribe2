// Test script for the summarization feature
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Sample text for testing
const sampleText = `
機械学習は、コンピュータがデータから学習し、パターンを認識し、予測を行う能力を持つようにする人工知能の一分野です。
教師あり学習、教師なし学習、強化学習など、さまざまなアプローチがあります。
近年、深層学習の進歩により、画像認識、自然言語処理、自動運転車などの分野で大きな飛躍がありました。
機械学習モデルは大量のデータで訓練され、新しいデータに対して予測を行います。
しかし、バイアス、解釈可能性、プライバシーなどの課題もあります。
今後も技術の進歩により、医療診断から気候変動予測まで、さまざまな分野で革命が起こると期待されています。
`;

// Execute Python script and return promise
function executePythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [scriptPath, ...args]);
    
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout: stdoutData,
          stderr: stderrData
        });
      } else {
        reject(new Error(`Python script exited with code ${code}. Error: ${stderrData}`));
      }
    });
    
    pythonProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Test function
async function testSummarization() {
  console.log('===== Strands Agentによるテキスト要約テスト =====');
  
  try {
    // Create a temporary file with sample text
    const tmpDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tmpFile = path.join(tmpDir, `test_text_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, sampleText, 'utf8');
    console.log(`一時テキストファイルを作成しました: ${tmpFile}`);
    
    // Path to the summarization script
    const summaryScriptPath = path.join(__dirname, '..', 'src', 'python', 'summarizer', 'strands_summarize.py');
    console.log(`要約スクリプトを使用: ${summaryScriptPath}`);
    
    // Test different summary lengths
    const lengths = ['short', 'medium', 'long'];
    
    for (const length of lengths) {
      console.log(`\n${length}の長さでテキストを要約中...`);
      
      try {
        const startTime = Date.now();
        
        // Execute Python script directly
        const args = [
          '--file', tmpFile,
          '--length', length
        ];
        
        const result = await executePythonScript(summaryScriptPath, args);
        
        // Parse the JSON output
        const parsedResult = JSON.parse(result.stdout);
        
        console.log('=== 要約結果 ===');
        console.log(`処理時間: ${parsedResult.processingTime.toFixed(2)}秒`);
        console.log(`使用モデル: ${parsedResult.modelUsed}`);
        console.log('要約:');
        console.log(parsedResult.summary);
        console.log('================');
      } catch (error) {
        console.error(`${length}の長さの要約でエラーが発生:`, error);
      }
    }
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(tmpFile);
      console.log(`一時ファイルを削除しました: ${tmpFile}`);
    } catch (e) {
      console.warn('一時ファイルの削除に失敗:', e);
    }
    
    console.log('\nテストが完了しました！');
    
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// Run the test
testSummarization().catch(console.error);