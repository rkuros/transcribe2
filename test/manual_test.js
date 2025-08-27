const { StrandsAgentManager } = require('../dist/main/strands-agent-manager');
const fs = require('fs');
const path = require('path');

async function testWeeklyReport() {
  try {
    // テキストファイルを読み込む
    const textFilePath = path.join(__dirname, '../test data/real.txt');
    const text = fs.readFileSync(textFilePath, 'utf8');

    // StrandsAgentManagerを初期化
    const strandsAgentManager = new StrandsAgentManager(null);
    await strandsAgentManager.initialize();

    console.log('StrandsAgentManager initialized');
    
    // Weekly Reportを生成
    const options = {
      customerName: 'テストユーザー企業',
      opportunityName: 'STATIC CODE導入検討',
      opportunitySize: 'ARR $50k',
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' // Claude 3.7 Sonnetを指定
    };

    console.log('Generating Weekly Report...');
    const result = await strandsAgentManager.createWeeklyReport(text, options);
    
    console.log('Weekly Report generated successfully!');
    console.log('Processing time:', result.processingTime.toFixed(2), 'seconds');
    console.log('Model used:', result.modelUsed);
    console.log('\n=== Weekly Report ===\n');
    console.log(result.report);

    // 結果をファイルに保存
    fs.writeFileSync(path.join(__dirname, '../weekly_report_output.md'), result.report, 'utf8');
    console.log('\nWeekly Report saved to weekly_report_output.md');
  } catch (error) {
    console.error('Error testing Weekly Report:', error);
  }
}

testWeeklyReport();