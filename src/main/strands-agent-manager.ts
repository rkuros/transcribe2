import { BrowserWindow } from 'electron';
import { 
  BedrockAgentRuntimeClient, 
  InvokeAgentCommand
} from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { SummarizationLength, SummarizationResult, WeeklyReportOptions, WeeklyReportResult } from '../common/types';
import { v4 as uuidv4 } from 'uuid';

export class StrandsAgentManager {
  private mainWindow: BrowserWindow | null;
  private bedrockAgentClient: BedrockAgentRuntimeClient | null = null;
  private bedrockRuntimeClient: BedrockRuntimeClient | null = null;
  private region: string = 'us-east-1'; // デフォルトリージョン（バージニア）
  private agentId: string = ''; // Strands Agentのエージェント ID
  private agentAliasId: string = ''; // Strands Agentのエイリアス ID
  private modelId: string = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'; // Claude 3.7 Sonnetモデル
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

  // テキストを複数のチャンクに分割する補助メソッド
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      // チャンクサイズを超えない範囲で、文の終わりで区切る
      let endIndex = Math.min(startIndex + chunkSize, text.length);
      
      // 文の終わりを探す（。や！や？で区切る）
      if (endIndex < text.length) {
        // 次の文末まで探索
        const nextSentenceEnd = text.indexOf('。', endIndex);
        const nextExclamationEnd = text.indexOf('！', endIndex);
        const nextQuestionEnd = text.indexOf('？', endIndex);
        
        let sentenceEnd = -1;
        if (nextSentenceEnd !== -1) sentenceEnd = nextSentenceEnd + 1;
        if (nextExclamationEnd !== -1 && (sentenceEnd === -1 || nextExclamationEnd < sentenceEnd)) sentenceEnd = nextExclamationEnd + 1;
        if (nextQuestionEnd !== -1 && (sentenceEnd === -1 || nextQuestionEnd < sentenceEnd)) sentenceEnd = nextQuestionEnd + 1;
        
        // 文末が見つからない場合や、文末が遠すぎる場合は、最大でも追加のchunkSize/5まで探索
        if (sentenceEnd === -1 || sentenceEnd > endIndex + chunkSize / 5) {
          sentenceEnd = endIndex;
        }
        
        endIndex = sentenceEnd;
      }
      
      chunks.push(text.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
    
    return chunks;
  }

  // 大きなテキストを処理するメソッド
  private async processLargeText(text: string, length: SummarizationLength): Promise<SummarizationResult> {
    const startTime = Date.now();
    
    // テキストが小さい場合は直接要約
    if (text.length < 30000) {
      return await this.summarizeWithBedrockDirect(text, length);
    }
    
    console.log(`テキストが大きいため(${text.length}文字)、チャンク処理を適用します`);
    
    // テキストを複数のチャンクに分割
    const chunks = this.splitTextIntoChunks(text, 25000);
    const chunkSummaries: string[] = [];
    
    console.log(`テキストを${chunks.length}個のチャンクに分割しました`);
    
    // 各チャンクを要約
    for (let i = 0; i < chunks.length; i++) {
      console.log(`チャンク ${i+1}/${chunks.length} を処理中... (${chunks[i].length}文字)`);
      const result = await this.summarizeWithBedrockDirect(
        chunks[i], 
        SummarizationLength.SHORT
      );
      chunkSummaries.push(result.summary);
    }
    
    console.log('すべてのチャンクの要約が完了しました。最終要約を作成します');
    
    // すべてのチャンクの要約を結合して再要約
    const combinedText = `以下は長いテキストを分割して要約した結果です。これらの要約を元に、全体の要約を作成してください：\n\n${chunkSummaries.join("\n\n---\n\n")}`;
    
    const finalResult = await this.summarizeWithBedrockDirect(
      combinedText, 
      length
    );
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      originalText: text,
      summary: finalResult.summary,
      processingTime: processingTime,
      modelUsed: `${finalResult.modelUsed} (チャンク処理適用)`
    };
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
    
    try {
      // テキストサイズが大きい場合はチャンク処理
      if (text.length > 30000) {
        console.log(`大きなテキスト(${text.length}文字)のチャンク処理を開始します`);
        return await this.processLargeText(text, length);
      }
      
      const promptTemplate = this.getSummarizationPrompt(text, length);
      
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
      
      // Claude 3.7 Sonnetのペイロード形式
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: promptTemplate
          }
        ],
        top_k: 250,
        top_p: 1
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
      // Claude 3.7 Sonnet用のレスポンスフォーマット対応
      const summary = parsedResponse.content && parsedResponse.content[0] ? 
                     parsedResponse.content[0].text : 
                     (parsedResponse.completion || '要約の生成中にエラーが発生しました');
      
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
    const now = new Date();
    const formattedDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒`;
    
    const lengthInstructions = {
      [SummarizationLength.SHORT]: 'テキストの10-15%の長さで、主要ポイントのみを簡潔にまとめた要約を作成してください。トピックは2～3個に制限してください。',
      [SummarizationLength.MEDIUM]: 'テキストの20-30%の長さで、重要なトピックごとに整理した要約を作成してください。トピックは4～6個程度にしてください。',
      [SummarizationLength.LONG]: 'テキストの35-50%の長さで、トピックごとに詳細に整理した要約を作成してください。重要な詳細を含め、必要に応じトピックを複数に分けてください。'
    };
    
    return `このデータの要約を作成することがあなたの最優先タスクです。下記の構造を絶対に守らなければなりません。

重要指示: 以下の厳密なフォーマットで要約を作成してください。このフォーマットから外れることは絶対に許されません:

1. 必ず"# 重要な内容"という見出しで開始すること
2. 最初のセクションでは、最も重要なポイントを箇条書き形式で列挙すること。各項目は必ず「- 」で始めること
3. 次に、主要なトピックごとに"# [トピック名]"という見出しを使い、複数のセクションに分けること
4. 各トピックセクション内では、箇条書き「- 」を使用して情報を整理すること
5. 最後に必ず作成日時を表示すること

他のどんなフォーマットも受け入れられません。この構造に厳密に従い、読み手に明確で構造化された要約を提供してください。${lengthInstructions[length]}

要約するテキストは以下の通りです：

${text}

（作成日時：${formattedDate}）`;
  }

  // 利用可能なエージェント情報を取得
  async getAvailableAgents() {
    await this.fetchAvailableAgents();
    
    return {
      currentAgentId: this.agentId,
      currentAgentAliasId: this.agentAliasId
    };
  }
  
  // Weekly Reportプロンプトの生成
  private getWeeklyReportPrompt(text: string, options: WeeklyReportOptions): string {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒`;
    
    // 顧客名とOpportunity情報を抽出
    const customerName = options.customerName || '不明';
    const opportunityName = options.opportunityName || '';
    const opportunitySize = options.opportunitySize || '';
    
    // Opportunity情報があれば表示用に整形
    let opportunityText = '';
    if (opportunityName || opportunitySize) {
      opportunityText = ' / ';
      if (opportunityName) opportunityText += opportunityName;
      if (opportunitySize) {
        if (opportunityName) opportunityText += ' - ';
        opportunityText += opportunitySize;
      }
    }
    
    return `あなたはプロフェッショナルなセールス・エンジニア（SE）です。文字起こしされた会話から、プロジェクトの週次報告書を作成してください。

重要指示: 以下の厳密なフォーマットで週次報告書を作成してください。このフォーマットから外れることは絶対に許されません:

# [顧客名${opportunityText}]
${customerName}${opportunityText}

# Action Taken（実施事項）
- [ここにSEが実施した技術的なアクティビティを記載。どのような技術的支援、デモ、プレゼン、アーキテクチャ設計などを行ったかを具体的に]
- [具体的な技術要素、製品名、バージョンなどを含める]
- [可能であれば数値情報を含める（例：〇〇時間のワークショップ実施、✕✕のコンポーネント設計など）]

# Observation（気づき）
- [顧客の技術的な課題、ニーズ、反応について観察したこと]
- [顧客の現状の技術スタックや課題に関する具体的な洞察]
- [競合情報や技術的な懸念点があれば言及]

# Next Step（次のステップ）
- [次回までに実施すべき技術的なフォローアップ項目]
- [必要な技術情報の提供や追加の検証など、具体的なアクション]
- [デモや提案資料の準備など、具体的なタスク]

# Ask（依頼・要望）
- [営業担当へのサポート依頼や情報共有の要望]
- [他部署との連携や追加リソースの要請などがあれば記載]

他のどんなフォーマットも受け入れられません。この構造に厳密に従い、SEの視点から見た技術的な週次報告書を作成してください。以下のガイドラインに従ってください：

1. ビジネスインパクトを明確に示す
2. 個人名ではなく役職名を使用する
3. 客観的で簡潔な文体を維持する
4. 技術的な正確さを保つ
5. 必要に応じて箇条書きを使用する

対象となる文字起こしテキストは以下の通りです：

${text}

（作成日時：${formattedDate}）`;
  }
  
  // 大きなテキストをWeekly Report用に処理するメソッド
  private async processLargeTextForWeeklyReport(text: string, options: WeeklyReportOptions): Promise<WeeklyReportResult> {
    const startTime = Date.now();
    
    // テキストが小さい場合は直接処理
    if (text.length < 30000) {
      return await this.createWeeklyReportWithBedrockDirect(text, options);
    }
    
    console.log(`テキストが大きいため(${text.length}文字)、チャンク処理を適用します`);
    
    // テキストを複数のチャンクに分割
    const chunks = this.splitTextIntoChunks(text, 25000);
    const chunkSummaries: string[] = [];
    
    console.log(`テキストを${chunks.length}個のチャンクに分割しました`);
    
    // 各チャンクを処理
    for (let i = 0; i < chunks.length; i++) {
      console.log(`チャンク ${i+1}/${chunks.length} を処理中... (${chunks[i].length}文字)`);
      
      // 各チャンクは短めの要約として処理
      const tmpOptions = { ...options };
      const result = await this.createWeeklyReportWithBedrockDirect(
        chunks[i], 
        tmpOptions
      );
      chunkSummaries.push(result.report);
    }
    
    console.log('すべてのチャンクの処理が完了しました。最終Weekly Reportを作成します');
    
    // すべてのチャンクの要約を結合して再処理
    const combinedText = `以下は長い会話テキストを分割して処理した結果です。これらを統合して、一貫性のあるWeekly Reportを作成してください：\n\n${chunkSummaries.join("\n\n---\n\n")}`;
    
    const finalResult = await this.createWeeklyReportWithBedrockDirect(
      combinedText, 
      options
    );
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      originalText: text,
      report: finalResult.report,
      processingTime: processingTime,
      modelUsed: `${finalResult.modelUsed} (チャンク処理適用)`
    };
  }
  
  // Weekly Reportを直接Bedrockで生成
  private async createWeeklyReportWithBedrockDirect(text: string, options: WeeklyReportOptions): Promise<WeeklyReportResult> {
    if (!this.bedrockRuntimeClient) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    const promptTemplate = this.getWeeklyReportPrompt(text, options);
    const modelId = options.model || this.modelId;
    
    try {
      console.log(`Bedrockを直接呼び出してWeekly Reportを生成: モデルID=${modelId}`);
      
      // Claude 3.7 Sonnetのペイロード形式
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0,
        messages: [
          {
            role: "user",
            content: promptTemplate
          }
        ],
        top_k: 250,
        top_p: 1
      };
      
      const command = new InvokeModelCommand({
        modelId: modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json'
      });
      
      const response = await this.bedrockRuntimeClient!.send(command);
      
      // レスポンスをデコードして結果を抽出
      const responseBody = new TextDecoder().decode(response.body);
      const parsedResponse = JSON.parse(responseBody);
      // Claude 3.7 Sonnet用のレスポンスフォーマット対応
      const report = parsedResponse.content && parsedResponse.content[0] ? 
                    parsedResponse.content[0].text : 
                    (parsedResponse.completion || 'Weekly Reportの生成中にエラーが発生しました');
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        originalText: text,
        report: report,
        processingTime: processingTime,
        modelUsed: `Amazon Bedrock (${modelId})`
      };
    } catch (error) {
      console.error('Bedrock直接呼び出しエラー:', error);
      throw error;
    }
  }
  
  // 文字起こしテキストからWeekly Reportを生成する
  async createWeeklyReport(text: string, options: WeeklyReportOptions = {}): Promise<WeeklyReportResult> {
    if (!this.bedrockAgentClient || !this.bedrockRuntimeClient) {
      await this.initialize();
    }

    const startTime = Date.now();
    const agentId = options.model ? '' : this.agentId; // モデルが指定されている場合はエージェント使用しない
    const agentAliasId = options.model ? '' : this.agentAliasId;
    
    try {
      // テキストサイズが大きい場合はチャンク処理
      if (text.length > 30000) {
        console.log(`大きなテキスト(${text.length}文字)のチャンク処理を開始します`);
        return await this.processLargeTextForWeeklyReport(text, options);
      }
      
      const promptTemplate = this.getWeeklyReportPrompt(text, options);
      
      // StrandsAgentが設定されており、モデルが明示的に指定されていない場合はStrandsAgentを使用
      if (agentId && agentAliasId && !options.model) {
        console.log('Strands Agentを使用してWeekly Reportを開始します');
        try {
          // Strands Agent を呼び出す
          const response = await this.invokeStrandsAgent(agentId, agentAliasId, promptTemplate);
          
          const processingTime = (Date.now() - startTime) / 1000;
          
          return {
            originalText: text,
            report: response,
            processingTime: processingTime,
            modelUsed: `Amazon Bedrock Strands Agent (${agentId})`
          };
        } catch (agentError) {
          console.error('Strands Agent呼び出しエラー:', agentError);
          console.log('Bedrockの直接呼び出しにフォールバックします');
          // エラーの場合はBedrockの直接呼び出しにフォールバック
        }
      }
      
      // Bedrock Runtimeを使って直接生成（フォールバックまたはデフォルト）
      return await this.createWeeklyReportWithBedrockDirect(text, options);
      
    } catch (error) {
      console.error('Weekly Report生成エラー:', error);
      throw new Error(`Weekly Reportの生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
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