#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import time
import tempfile
import argparse
import importlib
from pathlib import Path

def report_progress(progress, stage="transcription", estimated_time_remaining=None):
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

class ProgressCallback:
    """Callback for reporting transcription progress"""
    def __init__(self, total_duration=None):
        self.start_time = time.time()
        self.total_duration = total_duration
        self.last_progress = 0
    
    def __call__(self, progress):
        # progress: dict with keys: "task", "completed_steps", "total_steps"
        if progress["task"] == "transcribe" and progress["total_steps"] > 0:
            percent = min(int((progress["completed_steps"] / progress["total_steps"]) * 100), 99)
            
            # Only report if progress has changed significantly
            if percent > self.last_progress + 4 or percent >= 99:
                self.last_progress = percent
                elapsed_time = time.time() - self.start_time
                
                # Estimate remaining time
                if percent > 0:
                    estimated_remaining = (elapsed_time / percent) * (100 - percent)
                else:
                    estimated_remaining = None
                
                report_progress(percent, estimated_time_remaining=estimated_remaining)

def post_process_japanese_text(text):
    """Apply Japanese-specific post-processing to improve text quality"""
    # Fix common Japanese transcription issues
    processed_text = text
    
    # Remove excessive whitespace while preserving paragraph structure
    processed_text = processed_text.strip()
    
    # Fix common Whisper transcription errors in Japanese
    processed_text = processed_text.replace("です。", "です。\n")
    processed_text = processed_text.replace("ました。", "ました。\n")
    
    # Fix Japanese punctuation spacing
    processed_text = processed_text.replace(" 。", "。")
    processed_text = processed_text.replace(" 、", "、")
    processed_text = processed_text.replace(" ！", "！")
    processed_text = processed_text.replace(" ？", "？")
    
    # Fix common period mistakes
    processed_text = processed_text.replace(".", "。")
    processed_text = processed_text.replace(",", "、")
    
    # Fix spacing between alphanumeric and Japanese
    import re
    processed_text = re.sub(r'([a-zA-Z0-9])([\u3040-\u30ff\u4e00-\u9fff])', r'\1 \2', processed_text)
    processed_text = re.sub(r'([\u3040-\u30ff\u4e00-\u9fff])([a-zA-Z0-9])', r'\1 \2', processed_text)
    
    return processed_text

def transcribe_with_faster_whisper(audio_path, model_size="small", language=None):
    """Transcribe audio with faster-whisper"""
    try:
        from faster_whisper import WhisperModel
        
        # Get audio duration for progress estimation
        # This could be done with librosa, pydub, or other libraries
        # For simplicity, we're skipping this for now
        
        # Initialize the model
        report_progress(5)  # Report initial progress
        model = WhisperModel(model_size, device="auto", compute_type="auto")
        report_progress(10)  # Model loaded
        
        # Create callback for progress reporting
        progress_callback = ProgressCallback()
        
        # Start transcription
        # Check if the model's transcribe method accepts callback parameter
        import inspect
        transcribe_params = inspect.signature(model.transcribe).parameters
        
        if 'callback' in transcribe_params:
            # Method supports callback
            segments, info = model.transcribe(
                audio_path,
                language=language or "ja",  # Default to Japanese if not specified
                task="transcribe",
                beam_size=5,
                vad_filter=True,
                callback=progress_callback
            )
        else:
            # Method doesn't support callback, use without it
            segments, info = model.transcribe(
                audio_path,
                language=language or "ja",  # Default to Japanese if not specified
                task="transcribe",
                beam_size=5,
                vad_filter=True
            )
            # Report some progress points manually
            report_progress(50)
        
        # Convert segments to list for JSON serialization
        result_segments = []
        text = ""
        
        for segment in segments:
            # Apply post-processing to segment text
            processed_segment_text = segment.text
            
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": processed_segment_text,
                "confidence": float(segment.avg_logprob)
            })
            text += processed_segment_text + " "
        
        # Apply post-processing to full text if Japanese
        if info.language == "ja" or language == "ja":
            text = post_process_japanese_text(text)
        
        # Report completion
        report_progress(100)
        
        return {
            "text": text.strip(),
            "segments": result_segments,
            "language": info.language,
            "language_probability": float(info.language_probability)
        }
        
    except ImportError:
        raise ImportError("faster-whisper not installed. Please install it with 'pip install faster-whisper'.")

def transcribe_with_openai_whisper(audio_path, model_name="large-v3-turbo", language=None):
    """Transcribe audio with OpenAI Whisper"""
    try:
        import whisper
        
        # Initialize the model
        report_progress(5)  # Report initial progress
        model = whisper.load_model(model_name)
        report_progress(15)  # Model loaded
        
        # Start transcription
        options = {
            # Set higher values for better sentence punctuation
            "best_of": 5,
            # Set temperature for more predictable output
            "temperature": 0,
        }
        
        # Note: vad_filter is not supported in OpenAI Whisper, only in faster-whisper
        
        # Set language if provided, default to Japanese if not specified
        if language is not None:
            options["language"] = language
        else:
            options["language"] = "ja"
        
        # Set up a progress tracker by overriding decode_with_fallback
        original_decode = model.decode
        
        def decode_with_progress(*args, **kwargs):
            """Wrap the decoder to track progress"""
            # Report progress at fixed intervals
            for progress in range(20, 90, 10):
                report_progress(progress)
                result = original_decode(*args, **kwargs)
                time.sleep(0.1)  # To ensure progress updates are visible
                return result
        
        # Temporarily replace the decode function
        model.decode = decode_with_progress
        
        # Perform transcription
        result = model.transcribe(audio_path, **options)
        
        # Restore original function
        model.decode = original_decode
        
        # Convert segments to the common format
        segments = []
        for segment in result["segments"]:
            # Apply post-processing to segment text
            processed_segment_text = segment["text"]
            
            segments.append({
                "start": segment["start"],
                "end": segment["end"],
                "text": processed_segment_text,
                "confidence": segment.get("confidence", 0.0)
            })
        
        # Apply post-processing to full text if Japanese
        text = result["text"]
        if result.get("language") == "ja" or language == "ja":
            text = post_process_japanese_text(text)
        
        # Report completion
        report_progress(100)
        
        return {
            "text": text,
            "segments": segments,
            "language": result.get("language", language)
        }
        
    except ImportError:
        raise ImportError("OpenAI Whisper not installed. Please install it with 'pip install openai-whisper'.")
        
    except ImportError:
        raise ImportError("OpenAI Whisper not installed. Please install it with 'pip install openai-whisper'.")

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using Whisper")
    parser.add_argument("input", help="Input audio file")
    parser.add_argument("--model", help="Model to use", 
                       choices=["faster-whisper-small", "faster-whisper-medium", "openai-whisper-large-v3-turbo"],
                       default="faster-whisper-small")
    parser.add_argument("--language", help="Language code (optional)", default=None)
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.isfile(args.input):
        print(json.dumps({"success": False, "error": f"Input file not found: {args.input}"}))
        return
    
    try:
        start_time = time.time()
        result = None
        
        if args.model.startswith("faster-whisper"):
            model_size = args.model.split("-")[-1]
            result = transcribe_with_faster_whisper(args.input, model_size, args.language)
        elif args.model.startswith("openai-whisper"):
            model_name = "-".join(args.model.split("-")[2:])
            result = transcribe_with_openai_whisper(args.input, model_name, args.language)
        
        processing_time = time.time() - start_time
        
        if result:
            result["processingTime"] = processing_time
            result["modelUsed"] = args.model
            print(json.dumps({"success": True, "result": result}), flush=True)
        else:
            print(json.dumps({"success": False, "error": "Transcription failed"}), flush=True)
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), flush=True)

if __name__ == "__main__":
    main()