const assert = require('assert');
const { StrandsAgentManager } = require('../dist/main/strands-agent-manager');

// Weekly Report テスト
describe('StrandsAgentManager Weekly Report', function() {
  this.timeout(60000); // テストタイムアウトを60秒に設定
  
  let strandsAgentManager;
  
  before(async function() {
    // StrandsAgentManagerのインスタンスを作成
    strandsAgentManager = new StrandsAgentManager(null);
    try {
      await strandsAgentManager.initialize();
    } catch (error) {
      console.error('StrandsAgentManager初期化エラー:', error);
      this.skip(); // AWSクレデンシャルがない場合はスキップ
    }
  });
  
  it('should generate a Weekly Report from text', async function() {
    // AWS認証情報がない場合はスキップ
    if (!strandsAgentManager.bedrockRuntimeClient) {
      this.skip();
    }
    
    const sampleText = `
田中: 皆さん、おはようございます。今日はAWS Bedrockの活用についてのミーティングを始めます。
山田: おはようございます。お客様のGame8社様との進捗状況について共有させてください。
田中: はい、ぜひお願いします。
山田: 先週、Game8のCTOと技術チームと打ち合わせを行い、掲示板監視機能の実装について詳細を詰めました。彼らはゲームタイトルごとに掲示板を運営していて、不適切な投稿の自動検出が課題となっています。現在は人手で約1,000件/日の削除対応をしているようです。
佐藤: その規模だと相当な工数がかかりますね。
山田: そうなんです。そこでBedrockを使って自動で不適切な投稿を検出するソリューションを提案しました。具体的には、投稿に対してタグ付けをするプロンプトのサンプルを作成し提供しました。
田中: 反応はどうでしたか？
山田: 非常に前向きでした。掲示板の責任者、エンジニア、CTOを集めてプロンプトチューニングのワークショップも実施しました。面白かったのは、ゲームタイトルごとに検知すべき単語や表現が大きく異なることがわかったことです。
佐藤: なるほど、ドメイン知識が重要ということですね。
山田: はい。そのため、ゲームタイトルごとにプロンプトをカスタマイズするアプローチに決まりました。最初は特に荒れていた「鳴潮」という1タイトルでテスト導入する予定でしたが、他のタイトルのディレクターからも要望があり、現在7タイトルで本番導入が始まっています。
田中: それは素晴らしいですね。ARRはいくら見込めそうですか？
山田: 現在の見積もりでは年間約12,000ドルです。11月中旬まで効果測定を行い、その結果次第ではさらに拡大する可能性があります。
佐藤: 他に課題などはありますか？
山田: 現状ではありませんが、効果測定後に事例化も合意済みなので、それに向けた準備を進めています。
田中: 素晴らしい進捗ですね。他に何か質問はありますか？
佐藤: 私からは以上です。引き続きサポートよろしくお願いします。
田中: ありがとうございました。では次の議題に移りましょう。
    `;
    
    const options = {
      customerName: 'Game8（Gunosy）',
      opportunityName: 'Bedrockを用いた掲示板監視機能',
      opportunitySize: 'ARR $12k',
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' // Claude 3.7 Sonnetを指定
    };
    
    const result = await strandsAgentManager.createWeeklyReport(sampleText, options);
    
    // 結果の検証
    assert.ok(result, 'Weekly Reportの結果がnullまたはundefinedです');
    assert.ok(result.report, 'Weekly Reportのreportプロパティが存在しません');
    assert.ok(result.processingTime > 0, '処理時間が不正です');
    assert.ok(result.modelUsed.includes('Claude'), 'モデル名が不正です');
    
    // レポート内容の検証
    const report = result.report;
    
    // 顧客名が含まれていることを確認
    assert.ok(report.includes('Game8'), 'レポートに顧客名が含まれていません');
    
    // 主要なセクションが含まれていることを確認
    assert.ok(
      report.includes('Action') || report.includes('実施事項'),
      'Action Takenセクションがありません'
    );
    assert.ok(
      report.includes('Observation') || report.includes('気づき'),
      'Observationセクションがありません'
    );
    assert.ok(
      report.includes('Next') || report.includes('次のステップ'),
      'Next Stepセクションがありません'
    );
    
    console.log('生成されたWeekly Report:');
    console.log(report);
  });
  
  it('should handle large text with chunking', async function() {
    // AWS認証情報がない場合はスキップ
    if (!strandsAgentManager.bedrockRuntimeClient) {
      this.skip();
    }
    
    // 大きなテキストを生成（35000文字以上）
    let largeText = '';
    const sampleParagraph = `これは会議の文字起こしのサンプルです。AWS Bedrockの活用について議論しています。
      Game8社は日本最大級のゲーム総合情報Webサービスを運営しており、ゲームタイトル毎に掲示板を運営しています。
      掲示板監視の自動化のためにBedrockの活用を検討しています。不適切な投稿の自動検出が課題となっており、
      プロンプトエンジニアリングによる解決策を提案しています。現在は7タイトルで本番導入が始まっています。
      効果測定は11月中旬までに行う予定です。ARR $12kを見込んでいます。`;
    
    // 約35,000文字のテキストを生成
    while (largeText.length < 35000) {
      largeText += sampleParagraph;
    }
    
    const options = {
      customerName: 'Game8（大規模テキストテスト）',
      opportunityName: 'Bedrock大規模テキスト処理',
      opportunitySize: 'ARR $12k',
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' // Claude 3.7 Sonnetを指定
    };
    
    const result = await strandsAgentManager.createWeeklyReport(largeText, options);
    
    // 結果の検証
    assert.ok(result, 'Weekly Reportの結果がnullまたはundefinedです');
    assert.ok(result.report, 'Weekly Reportのreportプロパティが存在しません');
    assert.ok(result.processingTime > 0, '処理時間が不正です');
    assert.ok(result.modelUsed.includes('チャンク処理適用'), 'チャンク処理が適用されていません');
    
    console.log(`大規模テキスト(${largeText.length}文字)のWeekly Report処理時間: ${result.processingTime.toFixed(2)}秒`);
  });
});