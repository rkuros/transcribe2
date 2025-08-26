#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import argparse
import signal
from pathlib import Path

# Handle SIGPIPE gracefully - important when parent process may close pipe
signal.signal(signal.SIGPIPE, signal.SIG_DFL)

def report_progress(progress, stage="formatting", estimated_time_remaining=None):
    """Report progress to the parent process"""
    try:
        data = {
            "stage": stage,
            "percent": progress,
        }
        
        if estimated_time_remaining is not None:
            data["estimatedTimeRemaining"] = estimated_time_remaining
        
        # Make sure to add a newline to separate JSON objects
        print(json.dumps({"progress": data}))
        sys.stdout.flush()  # More reliable cross-platform flush
    except BrokenPipeError:
        # Handle the broken pipe gracefully
        # This can happen if the parent process has already closed the pipe
        sys.stderr.write("BrokenPipeError: Parent process may have terminated the connection\n")
        sys.stderr.flush()
        # Don't re-raise the exception

def format_text_with_ginza(text):
    """
    Format Japanese text using GiNZA NLP library
    
    Args:
        text: The input text to format
        
    Returns:
        Formatted text with proper paragraphs and punctuation
    """
    # Save the original text for comparison
    original_text = text
    
    # 前処理として文字列に改行を挿入（すでに改行なしで連結されてしまっている文を分解するため）
    # 日本語の文末記号で分割
    text = text.replace('。', '。\n')
    text = text.replace('！', '！\n')
    text = text.replace('？', '？\n')
    text = text.replace('?', '?\n')
    
    # 疑問文と応答のパターンを検出して分割
    text = text.replace('ですか?', 'ですか?\n')
    text = text.replace('ですか？', 'ですか？\n')
    text = text.replace('のですか?', 'のですか?\n')
    text = text.replace('のですか？', 'のですか？\n')
    try:
        import spacy
        import ginza
        
        # Report progress
        report_progress(10)
        
        # Load the Japanese NLP model
        try:
            nlp = spacy.load("ja_ginza")
        except OSError:
            # If model not found, try loading with direct path
            print("Default model not found, trying alternative load method")
            import ja_ginza
            nlp = ja_ginza.load()
        
        report_progress(20)
        
        # Check if text is too large for spaCy's limits (approximately 1MB)
        max_bytes = 40000  # Safe limit for tokenization (under the 49149 bytes limit)
        text_bytes = text.encode('utf-8')
        if len(text_bytes) > max_bytes:
            print(f"Text is too large ({len(text_bytes)} bytes), processing in chunks")
            # Process text in chunks
            return process_text_in_chunks(text, nlp)
        
        # For smaller texts, process normally
        report_progress(30)
        
        # Process the text with GiNZA
        doc = nlp(text)
        
        report_progress(60)
        
        # Build formatted text
        sentences = []
        paragraphs = []
        current_paragraph = []
        
        # Process each sentence
        for sent in doc.sents:
            # Clean the sentence text
            clean_sent = sent.text.strip()
            
            # Skip empty sentences
            if not clean_sent:
                continue
            
            # Process sentence for formatting
            clean_sent = clean_up_sentence(clean_sent)
            
            # Add to current paragraph
            current_paragraph.append(clean_sent)
            
            # Check if this is a paragraph ending
            if is_paragraph_break(sent):
                # Join sentences in paragraph and add to paragraphs list
                if current_paragraph:
                    paragraphs.append(" ".join(current_paragraph))
                    current_paragraph = []
        
        # Add any remaining sentences as a paragraph
        if current_paragraph:
            paragraphs.append(" ".join(current_paragraph))
        
        report_progress(80)
        
        # Format paragraphs for Japanese text
        formatted_text = ""
        speaker_pattern = False
        
        # Check if text contains speaker indicators
        import re
        speaker_regex = re.compile(r'([A-Z\u4e00-\u9faf][A-Za-z\u4e00-\u9faf]*?[\uff1a:])')
        
        for i, para in enumerate(paragraphs):
            # If this looks like a speaker line, format accordingly
            if speaker_regex.search(para):
                speaker_pattern = True
                # Add proper spacing around speaker indicators
                para = speaker_regex.sub(r'\n\1 ', para).strip()
                formatted_text += para
                # Add double line break if not the last paragraph
                if i < len(paragraphs) - 1:
                    formatted_text += "\n\n"
            else:
                # Standard paragraph formatting
                if speaker_pattern:
                    # If previous text had speakers, maintain spacing pattern
                    if i > 0:
                        formatted_text += "\n" + para
                    else:
                        formatted_text += para
                else:
                    # Regular paragraphs with double line breaks
                    formatted_text += para
                    if i < len(paragraphs) - 1:
                        formatted_text += "\n\n"
        
        # Final cleanup
        formatted_text = post_process_text(formatted_text)
        
        report_progress(100)
        
        # Add debug information about the processing
        print(f"Debug - Original text (first 50 chars): {original_text[:50]}")
        print(f"Debug - Formatted text (first 50 chars): {formatted_text[:50]}")
        
        return formatted_text
        
    except ImportError:
        # Handle import errors more gracefully with proper JSON formatting
        error_msg = "GiNZA or spaCy not installed. Please install with 'pip install ginza spacy'"
        try:
            print(json.dumps({"success": False, "error": error_msg}))
            sys.stdout.flush()
        except BrokenPipeError:
            sys.stderr.write(f"BrokenPipeError: {error_msg}\n")
            sys.stderr.flush()
        return text

def clean_up_sentence(sentence):
    """Clean up a sentence with specific Japanese text rules"""
    # Fix common Japanese punctuation
    sentence = sentence.replace(".", "。").replace(",", "、")
    
    # Add period if the sentence doesn't end with any punctuation
    import re
    if not re.search(r'[、。！？\.!?]$', sentence.strip()):
        sentence = sentence.strip() + "。"
    
    # Fix spacing around Japanese characters
    sentence = re.sub(r'([、。！？])([^\s])', r'\1 \2', sentence)
    
    # Fix spacing between Japanese and alphanumeric text
    sentence = re.sub(r'([a-zA-Z0-9])([^\sa-zA-Z0-9])', r'\1 \2', sentence)
    sentence = re.sub(r'([^\sa-zA-Z0-9])([a-zA-Z0-9])', r'\1 \2', sentence)
    
    # Remove excessive spaces
    sentence = re.sub(r'\s+', ' ', sentence)
    
    return sentence.strip()

def is_paragraph_break(sentence):
    """Determine if a sentence should end a paragraph"""
    # Get the last token in the sentence
    last_token = sentence[-1] if len(sentence) > 0 else None
    
    # Check if the sentence ends with typical paragraph-ending punctuation
    if last_token and last_token.text in ["。", "！", "？", ".", "!", "?"]:
        # Check for paragraph-ending expressions
        text = sentence.text.strip()
        paragraph_endings = [
            "です。", "ました。", "でした。", "だった。", "である。", "だ。",
            "だ！", "ですね。", "だろう。", "だろうか。", "ではない。"
        ]
        
        for ending in paragraph_endings:
            if text.endswith(ending):
                return True
    
    return False

def process_text_in_chunks(text, nlp):
    """Process long text by breaking it into smaller chunks"""
    import re
    
    # Define a reasonable chunk size that won't exceed spaCy's limit
    chunk_size = 10000  # characters, not bytes
    
    # Split text into sentences first to avoid breaking in the middle of a sentence
    # Simple regex for Japanese sentence boundaries
    sentence_boundaries = re.compile(r'([。！？]\s*)')
    sentences = sentence_boundaries.split(text)
    
    # Recombine into sentences with their punctuation
    proper_sentences = []
    for i in range(0, len(sentences)-1, 2):
        if i+1 < len(sentences):
            proper_sentences.append(sentences[i] + sentences[i+1])
        else:  # Handle odd number of items
            proper_sentences.append(sentences[i])
    
    # If we couldn't split into sentences properly, fall back to character chunks
    if not proper_sentences:
        proper_sentences = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    
    # Process each chunk
    processed_chunks = []
    total_chunks = len(proper_sentences)
    
    # Group sentences into chunks that don't exceed the limit
    chunks = []
    current_chunk = ""
    
    for sentence in proper_sentences:
        # If adding this sentence would exceed the limit, start a new chunk
        if len((current_chunk + sentence).encode('utf-8')) > 35000:  # Safe margin
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence
        else:
            current_chunk += sentence
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append(current_chunk)
    
    # Process each chunk
    total_chunks = len(chunks)
    for i, chunk in enumerate(chunks):
        # Update progress
        progress = 30 + (i / total_chunks) * 30
        report_progress(int(progress))
        
        # Process this chunk
        try:
            doc = nlp(chunk)
            # Extract sentences and format them
            chunk_sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
            processed_text = " ".join(chunk_sentences)
            processed_chunks.append(processed_text)
        except Exception as e:
            try:
                print(json.dumps({"progress": {"stage": "formatting", "percent": progress, "error": f"Error processing chunk {i+1}/{total_chunks}: {e}"}})) 
                sys.stdout.flush()
            except BrokenPipeError:
                # Silent catch - we've already configured global signal handler
                pass
            # If processing fails, include the raw chunk to avoid data loss
            processed_chunks.append(chunk)
    
    # Combine the processed chunks
    combined_text = " ".join(processed_chunks)
    
    # Apply standard formatting to the combined text
    # Build formatted text with paragraphs
    sentences = []
    paragraphs = []
    current_paragraph = []
    
    # Re-split into sentences for paragraph formatting
    # We're simulating doc.sents here since we've already processed in chunks
    for sent in sentence_boundaries.split(combined_text):
        if not sent.strip():
            continue
            
        # Clean the sentence text
        clean_sent = sent.strip()
        
        # Process sentence for formatting
        clean_sent = clean_up_sentence(clean_sent)
        
        # Add to current paragraph
        current_paragraph.append(clean_sent)
        
        # Check if this is a paragraph ending
        if clean_sent.endswith(("。", "！", "？", ".", "!", "?")) and any(clean_sent.endswith(ending) for ending in [
            "です。", "ました。", "でした。", "だった。", "である。", "だ。",
            "だ！", "ですね。", "だろう。", "だろうか。", "ではない。"
        ]):
            # Join sentences in paragraph and add to paragraphs list
            if current_paragraph:
                paragraphs.append(" ".join(current_paragraph))
                current_paragraph = []
    
    # Add any remaining sentences as a paragraph
    if current_paragraph:
        paragraphs.append(" ".join(current_paragraph))
    
    # Format paragraphs for Japanese text following the same logic as before
    formatted_text = ""
    speaker_pattern = False
    
    # Check if text contains speaker indicators
    import re
    speaker_regex = re.compile(r'([A-Z\u4e00-\u9faf][A-Za-z\u4e00-\u9faf]*?[\uff1a:])')
    
    for i, para in enumerate(paragraphs):
        # If this looks like a speaker line, format accordingly
        if speaker_regex.search(para):
            speaker_pattern = True
            # Add proper spacing around speaker indicators
            para = speaker_regex.sub(r'\n\1 ', para).strip()
            formatted_text += para
            # Add double line break if not the last paragraph
            if i < len(paragraphs) - 1:
                formatted_text += "\n\n"
        else:
            # Standard paragraph formatting
            if speaker_pattern:
                # If previous text had speakers, maintain spacing pattern
                if i > 0:
                    formatted_text += "\n" + para
                else:
                    formatted_text += para
            else:
                # Regular paragraphs with double line breaks
                formatted_text += para
                if i < len(paragraphs) - 1:
                    formatted_text += "\n\n"
    
    report_progress(80)
    
    # Final cleanup
    return post_process_text(formatted_text)

def post_process_text(text):
    """Final post-processing of formatted text"""
    import re
    
    # Track formatting with metadata instead of adding marker to text
    formatted_with_ginza = True  # Tracking via metadata
    
    # Apply enhanced paragraph breaks using our improved algorithm
    text = apply_enhanced_paragraphs(text)
    
    # 句読点の前のスペースを削除
    text = re.sub(r'\s+([、。！？])', r'\1', text)  # 日本語の句読点前のスペースを削除
    
    # 数字と単位の間のスペースを削除
    text = re.sub(r'(\d+)\s*([年月日時分秒円万%％])', r'\1\2', text)
    
    # 日本語と英数字の間にスペースを入れる
    text = re.sub(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])([a-zA-Z0-9])', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z0-9])([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])', r'\1 \2', text)
    
    # フィラー語を削除
    filler_words = [
        "あの", "えーと", "えっと", "まぁ", "あー", "えー", "んー", "そのー"
    ]
    for word in filler_words:
        text = re.sub(f'\\s*{word}\\s*', ' ', text)
    
    # 過剰なスペースを整理
    text = re.sub(r' {2,}', ' ', text)  # 連続スペースを1つに
    text = re.sub(r'^\s+|\s+$', '', text, flags=re.MULTILINE)  # 行頭・行末のスペース削除
    
    # 読点の後にスペースを挿入
    text = re.sub(r'([、,])([^\s\n])', r'\1 \2', text)
    
    # 各行が句点で終わるように調整する（最終処理）
    lines = []
    for paragraph in text.split('\n\n'):
            
        # Add period to paragraph if it doesn't end with punctuation
        if paragraph and not re.search(r'[。！？.!?]$', paragraph.strip()):
            paragraph = paragraph.strip() + '。'
        
        lines.append(paragraph)
    
    text = '\n\n'.join(lines)
    
    # Debug paragraph preservation
    newline_count = text.count("\n\n")
    sys.stderr.write(f"Debug - Final output has {newline_count} paragraph breaks\n")
    sys.stderr.flush()
    
    return text.strip()

def apply_enhanced_paragraphs(text):
    """Apply enhanced paragraph breaks to the formatted text"""
    import re
    import sys
    
    sys.stderr.write(f"Debug - Applying enhanced paragraph breaks to text ({len(text)} chars)\n")
    sys.stderr.flush()
    
    # No need to preserve GiNZA formatting marker as we don't add it anymore
    ginza_marker = ""
    
    # Split text by sentences first
    sentences = []
    pattern = r'([^。！？!?]+[。！？!?])'
    matches = re.finditer(pattern, text)
    
    last_end = 0
    for match in matches:
        sentences.append(match.group(0).strip())
        last_end = match.end()
    
    # Add any remaining text that doesn't end with a sentence marker
    if last_end < len(text):
        sentences.append(text[last_end:].strip())
    
    sys.stderr.write(f"Debug - Split text into {len(sentences)} sentences\n")
    sys.stderr.flush()
    
    # Group sentences into paragraphs
    paragraphs = []
    current_paragraph = []
    dialogue_markers = ['ですか', 'でしょうか', 'わかりました', 'はい', 'いいえ', 'そうですね', 'なるほど',
                      'ありがとう', 'えー', 'ええ', 'さようなら', '確かに', '失礼', 'そうなんですか']
    topic_shift_markers = ['でも', 'しかし', 'ところで', 'また', 'そして', 'そういえば', '次に', 'ただ', 'まずは']
    
    for i, sentence in enumerate(sentences):
        current_paragraph.append(sentence)
        
        # Check if this sentence should end a paragraph
        end_paragraph = False
        
        # End paragraph on dialogue markers or topic shifts
        if i < len(sentences) - 1:  # If not the last sentence
            next_sentence = sentences[i+1]
            break_reason = ""
            
            # Check if next sentence starts with dialogue/topic marker
            for marker in dialogue_markers + topic_shift_markers:
                if next_sentence.startswith(marker):
                    end_paragraph = True
                    break_reason = f"Dialogue marker: {marker}"
                    break
                    
            # Check if this sentence is a question
            if not end_paragraph and (sentence.endswith('?') or sentence.endswith('？')):
                end_paragraph = True
                break_reason = "Question ending"
            
            # Check if sentences have very different lengths (indicating topic change)
            if not end_paragraph:
                current_length = len(sentence)
                next_length = len(next_sentence)
                if abs(current_length - next_length) > 20 and current_length > 15:
                    end_paragraph = True
                    break_reason = f"Length difference: {current_length} vs {next_length}"
            
            # Speaker change detection
            if not end_paragraph:
                speaker_pattern = r'([A-Z\u4e00-\u9faf][A-Za-z\u4e00-\u9faf]*?[：:]\s)'
                if re.search(speaker_pattern, next_sentence):
                    end_paragraph = True
                    break_reason = "Speaker change detected"
                    
            if end_paragraph:
                sys.stderr.write(f"Debug - Paragraph break after: '{sentence[:20]}...' - Reason: {break_reason}\n")
                sys.stderr.flush()
        
        # If we should end the paragraph or this is the last sentence
        if end_paragraph or i == len(sentences) - 1:
            if current_paragraph:
                paragraph_text = " ".join(current_paragraph)
                paragraphs.append(paragraph_text)
                current_paragraph = []
    
    # Log paragraph info
    paragraph_count = len(paragraphs)
    sys.stderr.write(f"Debug - Created {paragraph_count} paragraphs\n")
    sys.stderr.flush()
    
    # Build the final formatted text with explicit paragraph marks
    formatted_text = "\n\n◆◆◆\n\n".join(paragraphs)
    
    # Log the formatted text with paragraph markers
    sys.stderr.write(f"Debug - Added visible paragraph markers '◆◆◆'\n")
    sys.stderr.flush()
    
    # Final formatting cleanup
    formatted_text = re.sub(r'\n{3,}', '\n\n', formatted_text)  # Normalize newlines
    
    # Debug the output
    newlines_count = formatted_text.count("\n\n")
    sys.stderr.write(f"Debug - Final text has {newlines_count} paragraph breaks\n")
    sys.stderr.flush()
    
    return formatted_text

def main():
    parser = argparse.ArgumentParser(description="Format text using GiNZA NLP")
    parser.add_argument("input", help="Input text file or raw text")
    parser.add_argument("--is-file", action="store_true", help="Input is a file path")
    parser.add_argument("--debug", action="store_true", help="Print debug information")
    
    args = parser.parse_args()
    
    try:
        # Get the text content
        if args.is_file:
            if not os.path.isfile(args.input):
                print(json.dumps({"success": False, "error": f"Input file not found: {args.input}"}))
                return
                
            with open(args.input, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            text = args.input
            
        # Format the text
        formatted_text = format_text_with_ginza(text)
        
        if args.debug:
            # Debug view with visible newlines
            debug_text = formatted_text.replace('\n', '↵\n')
            print(f"Debug formatted text with visible newlines:\n{debug_text}")
        
        try:
            # Debug print to see raw formatted text with escape sequences
            raw_text = repr(formatted_text)
            sys.stderr.write(f"Debug - Raw formatted text: {raw_text[:100]}...\n")
            sys.stderr.flush()
            
            # Return the result preserving line breaks and add metadata
            result = json.dumps({
                "success": True, 
                "result": formatted_text,
                "metadata": {
                    "formatted_with_ginza": True
                }
            })
            print(result)
            sys.stdout.flush()
        except BrokenPipeError:
            # Handle broken pipe when parent process has closed the connection
            sys.stderr.write("BrokenPipeError: Unable to write result to parent process\n")
            sys.stderr.flush()
            # Exit with an error code that can be checked by the parent
            sys.exit(1)
        
    except Exception as e:
        try:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.stdout.flush()
        except BrokenPipeError:
            sys.stderr.write(f"BrokenPipeError while reporting error: {str(e)}\n")
            sys.stderr.flush()
            sys.exit(1)

if __name__ == "__main__":
    main()