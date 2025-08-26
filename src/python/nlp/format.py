#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import argparse
from pathlib import Path

def report_progress(progress, stage="formatting", estimated_time_remaining=None):
    """Report progress to the parent process"""
    data = {
        "stage": stage,
        "percent": progress,
    }
    
    if estimated_time_remaining is not None:
        data["estimatedTimeRemaining"] = estimated_time_remaining
    
    # Make sure to add a newline to separate JSON objects
    print(json.dumps({"progress": data}))
    print(flush=True)  # Ensure output is flushed with a newline

def format_text_with_ginza(text):
    """
    Format Japanese text using GiNZA NLP library
    
    Args:
        text: The input text to format
        
    Returns:
        Formatted text with proper paragraphs and punctuation
    """
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
        
        return formatted_text
        
    except ImportError:
        print(f"Error: GiNZA or spaCy not installed. Please install with 'pip install ginza spacy'")
        return text

def clean_up_sentence(sentence):
    """Clean up a sentence with specific Japanese text rules"""
    # Fix common Japanese punctuation
    sentence = sentence.replace(".", "。").replace(",", "、")
    
    # Fix spacing around Japanese characters
    import re
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

def post_process_text(text):
    """Final post-processing of formatted text"""
    import re
    
    # Normalize line breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Fix common transcription errors
    text = re.sub(r'([^\s])\s+([、。！？])', r'\1\2', text)  # No space before Japanese punctuation
    
    # Fix repeated punctuation
    text = re.sub(r'([、。！？])\1+', r'\1', text)
    
    # Ensure proper spacing for dates and numbers
    text = re.sub(r'(\d+)\s*([年月日時分秒])', r'\1\2', text)
    
    # Remove filler words often in transcriptions
    filler_words = [
        "あの", "えーと", "えっと", "まぁ", "あー", "えー", "んー", "そのー"
    ]
    for word in filler_words:
        text = re.sub(f'\\s*{word}\\s*', ' ', text)
    
    # Clean up excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'^ ', '', text, flags=re.MULTILINE)
    text = re.sub(r' $', '', text, flags=re.MULTILINE)
    
    return text.strip()

def main():
    parser = argparse.ArgumentParser(description="Format text using GiNZA NLP")
    parser.add_argument("input", help="Input text file or raw text")
    parser.add_argument("--is-file", action="store_true", help="Input is a file path")
    
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
        
        # Return the result
        print(json.dumps({"success": True, "result": formatted_text}), flush=True)
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), flush=True)

if __name__ == "__main__":
    main()