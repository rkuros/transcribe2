// テスト: モデル指定パラメータのテスト
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// サンプルテキスト
const sampleText = `
機械学習は、コンピュータがデータから学習し、パターンを認識し、予測を行う能力を持つようにする人工知能の一分野です。
教師あり学習、教師なし学習、強化学習など、さまざまなアプローチがあります。
近年、深層学習の進歩により、画像認識、自然言語処理、自動運転車などの分野で大きな飛躍がありました。
機械学習モデルは大量のデータで訓練され、新しいデータに対して予測を行います。
しかし、バイアス、解釈可能性、プライバシーなどの課題もあります。
今後も技術の進歩により、医療診断から気候変動予測まで、さまざまな分野で革命が起こると期待されています。
`;

// Python スクリプト実行関数
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

// テスト関数
async function testSummarization() {
  console.log('===== Strands Agent モデル指定テスト =====');
  
  try {
    // 一時テキストファイルを作成
    const tmpDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tmpFile = path.join(tmpDir, `test_text_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, sampleText, 'utf8');
    console.log(`一時テキストファイルを作成しました: ${tmpFile}`);
    
    // 要約スクリプトのパス
    const summaryScriptPath = path.join(__dirname, '..', 'src', 'python', 'summarizer', 'strands_summarize.py');
    console.log(`要約スクリプトを使用: ${summaryScriptPath}`);
    
    // テストケース
    const testCases = [
      {
        name: 'デフォルト設定',
        args: [
          '--file', tmpFile,
          '--length', 'medium'
        ]
      },
      {
        name: 'モデル指定あり',
        args: [
          '--file', tmpFile,
          '--length', 'short',
          '--model', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
        ]
      },
      {
        name: 'モデルとパラメータ指定あり',
        args: [
          '--file', tmpFile,
          '--length', 'short',
          '--model', 'us.amazon.nova-premier-v1:0',
          '--max-tokens', '1600',
          '--temperature', '0.7'
        ]
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n${testCase.name}のテスト中...`);
      
      try {
        const result = await executePythonScript(summaryScriptPath, testCase.args);
        
        // JSON解析
        const parsedResult = JSON.parse(result.stdout);
        
        console.log('=== 要約結果 ===');
        console.log(`処理時間: ${parsedResult.processingTime.toFixed(2)}秒`);
        console.log(`使用モデル: ${parsedResult.modelUsed}`);
        console.log('要約:');
        console.log(parsedResult.summary);
        console.log('================');
      } catch (error) {
        console.error(`${testCase.name}のテストでエラーが発生:`, error);
      }
    }
    
    // 一時ファイルを削除
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

// テスト実行
testSummarization().catch(console.error);