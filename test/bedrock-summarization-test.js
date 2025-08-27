// Amazon Bedrock要約機能のテストスクリプト
const fs = require('fs');
const path = require('path');

// AWS SDKモジュール
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { fromIni } = require('@aws-sdk/credential-providers');

// テスト用の設定
const config = {
  region: 'us-east-1', // バージニアリージョン
  // 利用可能なモデルに変更
  modelId: 'anthropic.claude-instant-v1', 
  testTextFile: path.join(__dirname, '..', 'test_text.txt') // テスト用のテキストファイル
};

// AWSクライアント初期化
async function initializeClient() {
  try {
    console.log('認証情報を読み込み中...');
    const credentials = fromIni();
    
    console.log(`Bedrock Runtimeクライアントを初期化中 (リージョン: ${config.region})...`);
    const bedrockRuntimeClient = new BedrockRuntimeClient({
      region: config.region,
      credentials
    });
    
    return bedrockRuntimeClient;
  } catch (error) {
    console.error('クライアント初期化エラー:', error);
    throw error;
  }
}

// テキスト要約
async function summarizeText(client, text, length = 'medium') {
  try {
    const startTime = Date.now();
    
    // 長さに応じた指示
    const lengthInstructions = {
      'short': '100-200語の簡潔な要約を作成してください。',
      'medium': '300-500語の要約を作成してください。重要なポイントをすべて含めてください。',
      'long': '700-1000語の詳細な要約を作成してください。重要な詳細をすべて含めてください。'
    };
    
    const promptTemplate = `以下のテキストを要約してください。${lengthInstructions[length]}\n\n${text}`;
    
    console.log('要約リクエストを送信中...');
    
    // Claude Instant v1用のペイロード形式
    const payload = {
      prompt: `\n\nHuman: ${promptTemplate}\n\nAssistant: `,
      max_tokens_to_sample: 4096,
      temperature: 0,
      top_k: 250,
      top_p: 1,
      stop_sequences: ["\n\nHuman:"]
    };
    
    const command = new InvokeModelCommand({
      modelId: config.modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json'
    });
    
    const response = await client.send(command);
    
    // レスポンスをデコード
    const responseBody = new TextDecoder().decode(response.body);
    const parsedResponse = JSON.parse(responseBody);
    const summary = parsedResponse.completion || '要約の生成中にエラーが発生しました';
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      originalText: text,
      summary: summary,
      processingTime: processingTime,
      modelId: config.modelId
    };
  } catch (error) {
    console.error('要約処理エラー:', error);
    throw error;
  }
}

// 認証確認テスト
async function testAuthentication(client) {
  try {
    // 簡単なプロンプトでモデル呼び出しをテスト
    const command = new InvokeModelCommand({
      modelId: config.modelId,
      body: JSON.stringify({
        prompt: "\n\nHuman: Hello, world!\n\nAssistant: ",
        max_tokens_to_sample: 50,
        temperature: 0,
        top_p: 1,
        stop_sequences: ["\n\nHuman:"]
      }),
      contentType: 'application/json'
    });
    
    await client.send(command);
    console.log('認証が正常に機能しています');
    return true;
  } catch (error) {
    console.error('認証テストエラー:', error);
    return false;
  }
}

// メイン処理
async function main() {
  try {
    console.log('==== Amazon Bedrock要約テスト開始 ====');
    
    // クライアント初期化
    const bedrockClient = await initializeClient();
    
    // 認証テスト
    const authSuccess = await testAuthentication(bedrockClient);
    if (!authSuccess) {
      throw new Error('認証テストに失敗しました。AWS認証情報を確認してください。');
    }
    
    // テストテキストの読み込み
    let testText;
    try {
      testText = fs.readFileSync(config.testTextFile, 'utf8');
      console.log(`テキストファイル読み込み完了: ${testText.length}文字`);
    } catch (err) {
      console.log('テストファイルが存在しないため、サンプルテキストを使用します');
      testText = `
        機械学習は、コンピュータがデータから学習し、パターンを認識し、予測を行う能力を持つようにする人工知能の一分野です。
        教師あり学習、教師なし学習、強化学習など、さまざまなアプローチがあります。
        近年、深層学習の進歩により、画像認識、自然言語処理、自動運転車などの分野で大きな飛躍がありました。
        機械学習モデルは大量のデータで訓練され、新しいデータに対して予測を行います。
        しかし、バイアス、解釈可能性、プライバシーなどの課題もあります。
        今後も技術の進歩により、医療診断から気候変動予測まで、さまざまな分野で革命が起こると期待されています。
      `;
    }
    
    // 要約を実行（3種類の長さでテスト）
    console.log('\n==== 短い要約をテスト ====');
    const shortResult = await summarizeText(bedrockClient, testText, 'short');
    console.log(`処理時間: ${shortResult.processingTime.toFixed(2)}秒`);
    console.log('\n==== 短い要約結果 ====');
    console.log(shortResult.summary);
    
    console.log('\n==== 標準の要約をテスト ====');
    const mediumResult = await summarizeText(bedrockClient, testText, 'medium');
    console.log(`処理時間: ${mediumResult.processingTime.toFixed(2)}秒`);
    console.log('\n==== 標準の要約結果 ====');
    console.log(mediumResult.summary);
    
    console.log('\n==== 長い要約をテスト ====');
    const longResult = await summarizeText(bedrockClient, testText, 'long');
    console.log(`処理時間: ${longResult.processingTime.toFixed(2)}秒`);
    console.log('\n==== 長い要約結果 ====');
    console.log(longResult.summary);
    
    console.log('\n==== テスト成功 ====');
    return true;
  } catch (error) {
    console.error('\n==== テスト失敗 ====');
    console.error(error);
    return false;
  }
}

// テスト実行
main().catch(console.error);