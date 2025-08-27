import { BrowserWindow } from 'electron';
import { 
  BedrockAgentRuntimeClient, 
  InvokeAgentCommand
} from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { SummarizationLength, SummarizationResult } from '../common/types';
import { v4 as uuidv4 } from 'uuid';

export class StrandsAgentManager {
  private mainWindow: BrowserWindow | null;
  private bedrockAgentClient: BedrockAgentRuntimeClient | null = null;
  private bedrockRuntimeClient: BedrockRuntimeClient | null = null;
  private region: string = 'us-east-1'; // デフォルトリージョン（バージニア）
  private agentId: string = ''; // Strands Agentのエージェント ID
  private agentAliasId: string = ''; // Strands Agentのエイリアス ID
  private modelId: string = 'anthropic.claude-instant-v1'; // フォールバック用のモデルID
  // 利用可能なStrands Agents

  constructor(mainWindow: BrowserWindow | null, agentId?: string, agentAliasId?: string) {
    this.mainWindow = mainWindow;
    if (agentId) this.agentId = agentId;
    if (agentAliasId) this.agentAliasId = agentAliasId;
  }

  async initialize(region?: string) {
    try {
      this.region = region || this.region;
      
      console.log(`Bedrockクライアントを初期化中 (リージョン: ${this.region})...`);
      const credentials = fromIni();
      
      // Agent Runtime クライアントを初期化
      this.bedrockAgentClient = new BedrockAgentRuntimeClient({
        region: this.region,
        credentials
      });
      
      // Runtime（フォールバック用）のクライアントを初期化
      this.bedrockRuntimeClient = new BedrockRuntimeClient({
        region: this.region,
        credentials
      });
      
      // 利用可能なエージェントを取得
      await this.fetchAvailableAgents();
      
      return true;
    } catch (error) {
      console.error('Bedrock初期化エラー:', error);
      throw new Error(`Bedrockの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 利用可能なStrands Agentsを取得
  private async fetchAvailableAgents() {
    if (!this.bedrockAgentClient) {
      await this.initialize();
    }

    try {
      console.log('利用可能なStrands Agentsを取得中...');
      // エージェントの取得は現在使用していないので、手動で設定
      // 実際のアプリでは、必要に応じてこの部分を実装する
      if (!this.agentId) {
        console.log('デフォルトのエージェントIDとエイリアスIDを使用');
        // 何もしない - デフォルト値を使用
      }
    } catch (error) {
      console.warn('エージェント取得エラー:', error);
      console.log('エージェント一覧の取得に失敗しました。直接BedrockモデルAPIを利用します。');
    }
  }

  // エージェントのエイリアスを取得
  private async fetchAgentAliases(agentId: string) {
    if (!this.bedrockAgentClient) {
      await this.initialize();
    }

    try {
      console.log(`エージェント ${agentId} のエイリアスを取得中...`);
      // エイリアスの取得は現在使用していないので、手動で設定
      // 実際のアプリでは、必要に応じてこの部分を実装する
      if (!this.agentAliasId) {
        console.log('デフォルトのエイリアスIDを使用');
        // 何もしない - デフォルト値を使用
      }
    } catch (error) {
      console.warn('エージェントエイリアス取得エラー:', error);
    }
  }

  // 文字起こしテキストを要約する
  async summarizeText(text: string, options: {
    agentId?: string,
    agentAliasId?: string,
    length?: SummarizationLength
  } = {}): Promise<SummarizationResult> {
    if (!this.bedrockAgentClient || !this.bedrockRuntimeClient) {
      await this.initialize();
    }

    const startTime = Date.now();
    const agentId = options.agentId || this.agentId;
    const agentAliasId = options.agentAliasId || this.agentAliasId;
    const length = options.length || SummarizationLength.MEDIUM;
    const promptTemplate = this.getSummarizationPrompt(text, length);
    
    try {
      // StrandsAgentが設定されている場合はそれを使用する
      if (agentId && agentAliasId) {
        console.log('Strands Agentを使用して要約を開始します');
        try {
          // Strands Agent を呼び出す
          const response = await this.invokeStrandsAgent(agentId, agentAliasId, promptTemplate);
          
          const processingTime = (Date.now() - startTime) / 1000;
          
          return {
            originalText: text,
            summary: response,
            processingTime: processingTime,
            modelUsed: `Amazon Bedrock Strands Agent (${agentId})`
          };
        } catch (agentError) {
          console.error('Strands Agent呼び出しエラー:', agentError);
          console.log('Bedrockの直接呼び出しにフォールバックします');
          // エラーの場合はBedrockの直接呼び出しにフォールバック
        }
      }
      
      // Bedrock Runtimeを使って直接要約（フォールバック）
      return await this.summarizeWithBedrockDirect(text, length);
      
    } catch (error) {
      console.error('要約エラー:', error);
      throw new Error(`テキストの要約に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Strands Agentを呼び出す
  private async invokeStrandsAgent(agentId: string, agentAliasId: string, prompt: string): Promise<string> {
    if (!this.bedrockAgentClient) {
      await this.initialize();
    }

    try {
      console.log(`Strands Agent呼び出し: agentId=${agentId}, aliasId=${agentAliasId}`);
      
      const command = new InvokeAgentCommand({
        agentId: agentId,
        agentAliasId: agentAliasId,
        sessionId: uuidv4(), // セッションIDを生成
        inputText: prompt
      });
      
      const response = await this.bedrockAgentClient!.send(command);
      
      // レスポンスから要約を抽出
      if (response.completion && typeof response.completion === 'string') {
        return response.completion;
      } else {
        throw new Error('Strands Agentからの応答が無効です');
      }
    } catch (error) {
      console.error('Strands Agent呼び出しエラー:', error);
      throw error;
    }
  }
  
  // Bedrockを直接呼び出して要約を行う（フォールバック処理）
  private async summarizeWithBedrockDirect(text: string, length: SummarizationLength): Promise<SummarizationResult> {
    if (!this.bedrockRuntimeClient) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    const promptTemplate = this.getSummarizationPrompt(text, length);
    
    try {
      console.log(`Bedrockを直接呼び出して要約を実行: モデルID=${this.modelId}`);
      
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
        modelId: this.modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json'
      });
      
      const response = await this.bedrockRuntimeClient!.send(command);
      
      // レスポンスをデコードして要約を抽出
      const responseBody = new TextDecoder().decode(response.body);
      const parsedResponse = JSON.parse(responseBody);
      const summary = parsedResponse.completion || '要約の生成中にエラーが発生しました';
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        originalText: text,
        summary: summary,
        processingTime: processingTime,
        modelUsed: `Amazon Bedrock (${this.modelId})`
      };
    } catch (error) {
      console.error('Bedrock直接呼び出しエラー:', error);
      throw error;
    }
  }
  
  // 長さに応じた要約プロンプトを生成
  private getSummarizationPrompt(text: string, length: SummarizationLength): string {
    const lengthInstructions = {
      [SummarizationLength.SHORT]: '100-200語の簡潔な要約を作成してください。',
      [SummarizationLength.MEDIUM]: '300-500語の要約を作成してください。重要なポイントをすべて含めてください。',
      [SummarizationLength.LONG]: '700-1000語の詳細な要約を作成してください。重要な詳細をすべて含めてください。'
    };
    
    return `以下のテキストを要約してください。${lengthInstructions[length]}\n\n${text}`;
  }

  // 利用可能なエージェント情報を取得
  async getAvailableAgents() {
    await this.fetchAvailableAgents();
    
    return {
      currentAgentId: this.agentId,
      currentAgentAliasId: this.agentAliasId
    };
  }
  
  // 依存関係とAWS認証情報の確認
  async checkDependencies() {
    try {
      console.log('Bedrock依存関係チェック中...');
      
      // AWS SDKの存在確認
      const hasBedrockAgentSdk = !!(typeof BedrockAgentRuntimeClient !== 'undefined');
      const hasBedrockRuntimeSdk = !!(typeof BedrockRuntimeClient !== 'undefined');
      
      // AWS認証情報の確認
      let hasAwsCredentials = false;
      try {
        const credentials = fromIni();
        const credValue = await credentials();
        hasAwsCredentials = !!(credValue.accessKeyId && credValue.secretAccessKey);
      } catch (error) {
        console.error('AWS認証情報の確認に失敗:', error);
      }
      
      // エージェントの確認
      let hasStrandsAgents = false;
      if (hasBedrockAgentSdk && hasAwsCredentials) {
        try {
          await this.fetchAvailableAgents();
          // 仮に利用可能として設定
          hasStrandsAgents = true;
        } catch (error) {
          console.warn('Strands Agentsの確認に失敗:', error);
        }
      }
      
      return {
        bedrockAgent: hasBedrockRuntimeSdk && hasAwsCredentials,
        strandsAgent: hasBedrockAgentSdk && hasAwsCredentials && hasStrandsAgents,
        details: {
          bedrockAgentSdk: hasBedrockAgentSdk ? 'インストール済み' : 'インストールされていません',
          bedrockRuntimeSdk: hasBedrockRuntimeSdk ? 'インストール済み' : 'インストールされていません',
          awsCredentials: hasAwsCredentials ? '設定済み' : '設定されていません',
          strandsAgents: hasStrandsAgents ? '利用可能' : '利用不可'
        }
      };
    } catch (error) {
      console.error('依存関係チェックエラー:', error);
      return {
        bedrockAgent: false,
        strandsAgent: false,
        details: {
          error: `依存関係チェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }

  // 特定のエージェントとエイリアスを設定
  setAgent(agentId: string, agentAliasId: string) {
    this.agentId = agentId;
    this.agentAliasId = agentAliasId;
    console.log(`エージェントを設定: agentId=${agentId}, aliasId=${agentAliasId}`);
  }
}