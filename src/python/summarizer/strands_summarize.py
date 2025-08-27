#!/usr/bin/env python3
"""
Strands Agent-based Text Summarization Module

このスクリプトはStrands Agentsを使用して文章を要約します。
Strands Agentsがインストールされていない場合はエラーを返します。
"""

import os
import sys
import json
import time
import argparse
import importlib.util
from typing import Dict, Any, Optional

# Strands AgentのインポートとAWS認証情報をチェック
def check_strands_availability():
    """Strands Agent利用可能か確認する"""
    # Strandsパッケージのチェック
    if importlib.util.find_spec("strands") is None:
        raise ImportError(
            "Strands Agents がインストールされていません。\n"
            "インストールするには: pip install strands-agents\n"
            "注意: Python 3.10以上が必要です。"
        )
    
    # AWS認証情報のチェック
    aws_cred_path = os.path.expanduser("~/.aws/credentials")
    if not os.path.exists(aws_cred_path):
        print(f"\n\u8b66告: AWS認証情報ファイルが見つかりません: {aws_cred_path}\n" + 
              "認証情報ファイルを作成するか、環境変数でAWS認証情報を設定してください。\n" +
              "AWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEYを環境変数で設定することもできます。\n", file=sys.stderr)
    
    return True

# 要約の長さに応じたプロンプト設定
SUMMARY_LENGTHS = {
    "short": "100-200語の簡潔な要約を作成してください。",
    "medium": "300-500語の要約を作成してください。重要なポイントをすべて含めてください。",
    "long": "700-1000語の詳細な要約を作成してください。重要な詳細をすべて含めてください。"
}

def summarize_text(text: str, length: str = "medium", model: str = "us.anthropic.claude-3-7-sonnet-20250219-v1:0", max_tokens: int = None, temperature: float = 0.7, timeout: int = 120) -> Dict[str, Any]:
    """AI Agentを使ってテキストを要約"""
    start_time = time.time()
    
    try:
        # Strands Agentの利用可能性をチェック
        check_strands_availability()
        
        # 利用可能な場合、Strands Agentをインポート
        from strands import Agent
        
        # Agentの初期化
        agent = Agent() if model is None else Agent(model_name=model)
        
        # プロンプトの準備
        length_instruction = SUMMARY_LENGTHS.get(length, SUMMARY_LENGTHS["medium"])
        prompt = f"あなたは日本語テキストの要約を専門とするアシスタントです。以下のテキストを要約してください。{length_instruction}\n\n{text}"
        
        # 温度と最大トークン数とタイムアウトの設定
        kwargs = {}
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        if temperature is not None:
            kwargs["temperature"] = temperature
        
        # タイムアウトの設定
        kwargs["timeout"] = timeout
        
        # 長文の場合は分割要約を検討
        if len(text) > 30000:
            print(f"テキストが長いため、タイムアウト設定を{timeout}秒に設定しています", file=sys.stderr)
        
        # Strands Agent API呼び出し
        response = agent(prompt, **kwargs)
        
        # Agentの戻り値がオブジェクトの場合はテキストに変換
        if hasattr(response, 'content'):
            summary = response.content
        elif hasattr(response, 'text'):
            summary = response.text
        else:
            summary = str(response)
        
        processing_time = time.time() - start_time
        
        return {
            "summary": summary,
            "processingTime": processing_time,
            "modelUsed": f"Strands Agent ({agent.model_name if hasattr(agent, 'model_name') else 'default'})",
            "success": True
        }
        
    except ImportError as e:
        # Strandsがインストールされていない場合のエラー
        return {
            "summary": "",
            "processingTime": time.time() - start_time,
            "modelUsed": "Error",
            "success": False,
            "error": f"Strands Agentsがインストールされていません: {str(e)}"
        }
        
    except Exception as e:
        # その他のエラー
        return {
            "summary": "",
            "processingTime": time.time() - start_time,
            "modelUsed": "Error",
            "success": False,
            "error": f"要約中にエラーが発生しました: {str(e)}"
        }

def main():
    parser = argparse.ArgumentParser(description='Strands Agent Text Summarization')
    text_group = parser.add_mutually_exclusive_group(required=True)
    text_group.add_argument('--file', help='要約するテキストファイル')
    text_group.add_argument('--text', help='要約するテキスト')
    parser.add_argument('--length', default='medium', choices=['short', 'medium', 'long'],
                        help='要約の長さ (short, medium, long)')
    parser.add_argument('--model', help='使用するモデルID (例: "us.anthropic.claude-3-sonnet-20240229")')
    parser.add_argument('--max-tokens', type=int, help='生成する最大トークン数')
    parser.add_argument('--temperature', type=float, default=0.7, help='生成温度 (0.0-1.0)')
    parser.add_argument('--timeout', type=int, default=120, help='Strands APIリクエストのタイムアウト時間（秒）')
    
    args = parser.parse_args()
    
    try:
        # まず Strandsがインストールされているか確認
        check_strands_availability()
        
        # テキストの読み込み
        if args.file:
            try:
                with open(args.file, 'r', encoding='utf-8') as f:
                    text = f.read()
            except Exception as e:
                sys.stderr.write(f"ファイルの読み込み中にエラーが発生しました: {str(e)}\n")
                result = {
                    "error": True,
                    "message": f"ファイル読み込みエラー: {str(e)}"
                }
                print(json.dumps(result, ensure_ascii=False))
                sys.exit(1)
        else:
            text = args.text
        
        # 要約を実行
        result = summarize_text(
            text,
            length=args.length,
            model=args.model,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            timeout=args.timeout
        )
        
        print(json.dumps(result, ensure_ascii=False))
        
    except ImportError as e:
        # Strandsがインストールされていない場合のエラーを表示
        error_result = {
            "summary": "",
            "processingTime": 0,
            "modelUsed": "Error",
            "success": False,
            "error": f"Strands Agentsがインストールされていません: {str(e)}"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stderr.write(f"\n{str(e)}\n\nインストールするには: pip install strands-agents\n注意: Python 3.10以上が必要です\n")
        sys.exit(1)
        
    except Exception as e:
        # その他のエラー
        error_result = {
            "summary": "",
            "processingTime": 0,
            "modelUsed": "Error",
            "success": False,
            "error": f"エラーが発生しました: {str(e)}"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
