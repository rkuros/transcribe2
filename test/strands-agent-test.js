// Strands Agentテストスクリプト
const fs = require('fs');
const path = require('path');

// AWS SDKモジュール
const { 
  BedrockAgentRuntimeClient, 
  InvokeAgentCommand,
  ListAgentsCommand,
  ListAgentAliasesCommand
} = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { fromIni } = require('@aws-sdk/credential-providers');
const { v4: uuidv4 } = require('uuid');

// テスト用の設定
const config = {
  region: 'us-east-1', // バージニアリージョン
  modelId: 'anthropic.claude-instant-v1', // フォールバック用モデル
  testTextFile: path.join(__dirname, '..', 'test_text.txt') // テスト用のテキストファイル
};

// AWSクライアント初期化
async function initializeClient() {
  try {
    console.log('認証情報を読み込み中...');
    const credentials = fromIni();
    
    console.log(`BedrockAgentRuntimeクライアントを初期化中 (リージョン: ${config.region})...`);
    const bedrockAgentClient = new BedrockAgentRuntimeClient({
      region: config.region,
      credentials
    });
    
    console.log(`BedrockRuntimeクライアントを初期化中 (リージョン: ${config.region})...`);
    const bedrockRuntimeClient = new BedrockRuntimeClient({
      region: config.region,
      credentials
    });
    
    return { bedrockAgentClient, bedrockRuntimeClient };
  } catch (error) {
    console.error('クライアント初期化エラー:', error);
    throw error;
  }
}

// 利用可能なStrands Agentの一覧を取得
async function listAgents(client) {
  try {
    console.log('利用可能なStrands Agentsを取得中...');
    
    const command = new ListAgentsCommand({
      maxResults: 10
    });
    
    const response = await client.send(command);
    const agents = response.agentSummaries || [];
    
    console.log(`${agents.length}個のエージェントが見つかりました`);
    return agents;
  } catch (error) {
    console.error('Strands Agents取得エラー:', error);
    return [];
  }
}

// エージェントのエイリアス一覧を取得
async function listAgentAliases(client, agentId) {
  try {
    console.log(`エージェント ${agentId} のエイリアスを取得中...`);
    
    const command = new ListAgentAliasesCommand({
      agentId: agentId,
      maxResults: 5
    });
    
    const response = await client.send(command);
    const aliases = response.agentAliasSummaries || [];
    
    console.log(`${aliases.length}個のエイリアスが見つかりました`);
    return aliases;
  } catch (error) {
    console.error('エージェントエイリアス取得エラー:', error);
    return [];
  }
}

// Strands Agentを使って要約
async function summarizeWithAgent(client, text, agentId, agentAliasId) {
  try {
    console.log(`Strands Agentを使って要約: agentId=${agentId}, aliasId=${agentAliasId}`);
    const startTime = Date.now();
    
    const promptTemplate = `以下のテキストを300-500語程度で要約してください。重要なポイントはすべて含めてください。\n\n${text}`;
    
    const command = new InvokeAgentCommand({
      agentId: agentId,
      agentAliasId: agentAliasId,
      sessionId: uuidv4(), // セッションIDを生成
      inputText: promptTemplate
    });
    
    const response = await client.send(command);
    
    // レスポンスから要約を抽出
    const summary = response.completion || '要約の生成中にエラーが発生しました';
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      summary,
      processingTime
    };
  } catch (error) {
    console.error('Strands Agent要約エラー:', error);
    throw error;
  }
}

// Bedrock直接呼び出しで要約（フォールバック）
async function summarizeWithBedrock(client, text) {
  try {
    console.log(`Bedrockを直接使って要約: modelId=${config.modelId}`);
    const startTime = Date.now();
    
    const promptTemplate = `以下のテキストを300-500語程度で要約してください。重要なポイントはすべて含めてください。\n\n${text}`;
    
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
      summary,
      processingTime
    };
  } catch (error) {
    console.error('Bedrock直接要約エラー:', error);
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
    console.log('==== Strands Agent / Bedrock テスト開始 ====');
    
    // クライアント初期化
    const { bedrockAgentClient, bedrockRuntimeClient } = await initializeClient();
    
    // 認証テスト
    const authSuccess = await testAuthentication(bedrockRuntimeClient);
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
    
    // 利用可能なエージェントを取得
    const agents = await listAgents(bedrockAgentClient);
    
    // Strands Agent を使って要約を試みる
    let usedStrandsAgent = false;
    if (agents.length > 0) {
      try {
        const agent = agents[0]; // 最初のエージェントを使用
        console.log(`エージェント情報: ${agent.agentName} (${agent.agentId})`);
        
        // エージェントのエイリアスを取得
        const aliases = await listAgentAliases(bedrockAgentClient, agent.agentId);
        
        if (aliases.length > 0) {
          const alias = aliases[0]; // 最初のエイリアスを使用
          console.log(`エイリアス情報: ${alias.agentAliasName} (${alias.agentAliasId})`);
          
          // Strands Agentで要約
          console.log('\n==== Strands Agentで要約をテスト ====');
          const agentResult = await summarizeWithAgent(bedrockAgentClient, testText, agent.agentId, alias.agentAliasId);
          
          console.log(`処理時間: ${agentResult.processingTime.toFixed(2)}秒`);
          console.log('\n==== Strands Agent要約結果 ====');
          console.log(agentResult.summary);
          
          usedStrandsAgent = true;
        }
      } catch (agentError) {
        console.error('Strands Agent要約テストエラー:', agentError);
        console.log('Bedrockの直接呼び出しにフォールバックします');
      }
    }
    
    // フォールバック: Bedrockを直接呼び出して要約
    if (!usedStrandsAgent) {
      console.log('\n==== Bedrock直接呼び出しで要約をテスト（フォールバック） ====');
      const bedrockResult = await summarizeWithBedrock(bedrockRuntimeClient, testText);
      
      console.log(`処理時間: ${bedrockResult.processingTime.toFixed(2)}秒`);
      console.log('\n==== Bedrock直接要約結果 ====');
      console.log(bedrockResult.summary);
    }
    
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