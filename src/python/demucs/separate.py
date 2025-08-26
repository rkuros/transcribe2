#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import argparse
import tempfile
import subprocess
import time
from pathlib import Path
import shutil

def report_progress(progress, stage="separation", estimated_time_remaining=None):
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

def separate_audio(input_file, output_dir=None):
    """
    Separate audio using Demucs to extract vocals from music tracks
    
    Uses the Demucs model to separate the audio into different stems,
    focusing on extracting the vocals track for better transcription.
    
    Args:
        input_file: Path to input audio file
        output_dir: Output directory for separated tracks. If None, a temporary directory will be created.
    
    Returns:
        Path to the separated vocals track
    """
    if not os.path.isfile(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")
    
    # Use a temporary directory if none provided
    temp_dir = None
    if output_dir is None:
        temp_dir = tempfile.mkdtemp(prefix="demucs_")
        output_dir = temp_dir
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Get filename without extension
    input_basename = Path(input_file).stem
    
    # Create subdirectory for output
    separated_dir = os.path.join(output_dir, "htdemucs", input_basename)
    os.makedirs(separated_dir, exist_ok=True)
    
    # Report initial progress
    report_progress(10, "separation")
    
    # Use the demucs command line tool directly with its absolute path
    # The demucs script is located at /Users/rkuros/Library/Python/3.9/bin/demucs
    DEMUCS_PATH = "/Users/rkuros/Library/Python/3.9/bin/demucs"
    
    if not os.path.isfile(DEMUCS_PATH):
        print(f"Demucs command not found at {DEMUCS_PATH}")
        print("Falling back to python module approach...")
        
        # Try to use demucs as a Python module
        try:
            import sys
            import importlib
            
            # Verify demucs is installed
            spec = importlib.util.find_spec("demucs")
            if spec is None:
                raise ImportError("demucs module is not installed")
                
            # Use Python directly to invoke the module
            python_path = sys.executable
            report_progress(20, "separation")
            
            print(f"Using Python at {python_path} to run demucs module")
            cmd = [
                python_path,
                "-m",
                "demucs.separate",
                "--two-stems=vocals",
                "-o", output_dir,
                "--mp3",
                input_file
            ]
            
            print(f"Running command: {' '.join(cmd)}")
        except ImportError as ie:
            print(f"Error importing demucs: {ie}")
            print("Falling back to basic Python subprocess with demucs...")
            
            # Last resort: try running the command directly
            cmd = [
                "python3",
                "-m",
                "demucs.separate",
                "--two-stems=vocals",
                "-o", output_dir,
                "--mp3",
                input_file
            ]
    else:
        # Use the absolute path to the demucs command
        print(f"Using demucs at {DEMUCS_PATH}")
        cmd = [
            DEMUCS_PATH,
            "--two-stems=vocals",
            "-o", output_dir,
            "--mp3",
            input_file
        ]
        
    report_progress(30, "separation")
    print(f"Running command: {' '.join(cmd)}")
    
    try:
        # Run the demucs command with progress monitoring
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={
                **os.environ,
                "PATH": f"{os.path.dirname(DEMUCS_PATH)}:{os.environ.get('PATH', '')}"
            }
        )
        
        # Monitor progress
        while True:
            line = process.stderr.readline()
            if not line:
                stdout_line = process.stdout.readline()
                if not stdout_line and process.poll() is not None:
                    break
                if stdout_line:
                    print(stdout_line, end='')
                continue
                
            print(line, end='')  # Print the line for debugging
            
            # Parse progress from output
            if "%" in line:
                try:
                    percent_part = line.split("%")[0].strip().split(" ")[-1]
                    current_progress = min(int(float(percent_part)), 80)
                    report_progress(current_progress, "separation")
                except (ValueError, IndexError):
                    pass
            elif "overlap-add" in line.lower():
                report_progress(85, "separation")
            elif "writing" in line.lower():
                report_progress(90, "separation")
        
        # Get return code and remaining output
        return_code = process.wait()
        stderr_remainder = process.stderr.read()
        stdout_remainder = process.stdout.read()
        
        print(f"Command stdout: {stdout_remainder}")
        print(f"Command stderr: {stderr_remainder}")
        print(f"Return code: {return_code}")
        
        if return_code != 0:
            raise RuntimeError(f"Demucs command failed with return code {return_code}")
        
        report_progress(95, "separation")
        
        # Find the vocals file
        vocals_file = os.path.join(separated_dir, "vocals.mp3")
        
        # If the file doesn't exist at the expected location, try to find it
        if not os.path.isfile(vocals_file):
            print(f"Vocals file not found at expected path: {vocals_file}")
            print("Searching for vocals file in output directory...")
            
            # Search for vocals file in the output directory
            for root, _, files in os.walk(output_dir):
                for file in files:
                    if "vocals" in file.lower() and file.endswith((".mp3", ".wav")):
                        vocals_file = os.path.join(root, file)
                        print(f"Found vocals file at: {vocals_file}")
                        break
                if os.path.isfile(vocals_file):
                    break
        
        if not os.path.isfile(vocals_file):
            raise FileNotFoundError(f"Could not locate separated vocals track in {output_dir}")
        
        report_progress(100, "separation")
        print(f"Successfully separated vocals: {vocals_file}")
        return vocals_file
        
    except Exception as e:
        print(f"Error during audio separation: {str(e)}")
        # If we encountered an error, return the original file
        return input_file

def main():
    parser = argparse.ArgumentParser(description="Separate audio using Demucs")
    parser.add_argument("input", help="Input audio file")
    parser.add_argument("--output-dir", help="Output directory for separated tracks", default=None)
    
    args = parser.parse_args()
    
    try:
        vocal_path = separate_audio(args.input, args.output_dir)
        print(json.dumps({"success": True, "vocal_path": vocal_path}), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), flush=True)

if __name__ == "__main__":
    main()