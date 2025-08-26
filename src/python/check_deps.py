#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import importlib
import subprocess
import os

def check_python_version():
    """Check if Python version meets the minimum requirements"""
    major = sys.version_info.major
    minor = sys.version_info.minor
    meets_requirement = major >= 3 and minor >= 9
    return {
        "installed": True,  # Python is running, so it's installed
        "meets_requirements": meets_requirement,
        "version": f"{major}.{minor}",
        "required_version": "3.9+"
    }

def check_module_installed(module_name):
    """Check if a Python module is installed and get its version if possible"""
    try:
        module = importlib.import_module(module_name)
        version = getattr(module, "__version__", "unknown")
        return {
            "installed": True,
            "version": version
        }
    except ImportError:
        return {
            "installed": False,
            "version": None
        }

def check_whisper_model(model_path):
    if os.path.isdir(model_path):
        # Check for expected files in model directory
        expected_files = ["model.bin", "config.json"]
        for file in expected_files:
            if not os.path.isfile(os.path.join(model_path, file)):
                return False
        return True
    return False

def check_demucs():
    """Check if demucs is installed and available as a command"""
    module_status = check_module_installed("demucs")
    
    if not module_status["installed"]:
        return {
            "installed": False,
            "command_available": False,
            "version": None,
            "error": "Demucs Python module not installed"
        }
    
    # Additional check to see if demucs command is available
    try:
        result = subprocess.run(
            ["demucs", "--version"], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            check=True,
            text=True
        )
        version = result.stdout.strip() or "unknown"
        return {
            "installed": True,
            "command_available": True,
            "version": version,
            "error": None
        }
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return {
            "installed": True,
            "command_available": False,
            "version": module_status["version"],
            "error": str(e)
        }

def check_faster_whisper():
    """Check if faster-whisper is installed"""
    status = check_module_installed("faster_whisper")
    if not status["installed"]:
        return {
            "installed": False,
            "version": None,
            "error": "faster-whisper not installed"
        }
    return {
        "installed": True,
        "version": status["version"],
        "error": None
    }

def check_openai_whisper():
    """Check if OpenAI Whisper is installed"""
    status = check_module_installed("whisper")
    if not status["installed"]:
        return {
            "installed": False,
            "version": None,
            "error": "OpenAI Whisper not installed"
        }
    return {
        "installed": True,
        "version": status["version"],
        "error": None
    }

def check_model_availability(model_name):
    """Check if a specific model is downloaded and available"""
    # This would check for specific model availability
    # For faster-whisper, check in ~/.cache/huggingface/hub
    # For OpenAI Whisper, check in ~/.cache/whisper
    
    home_dir = os.path.expanduser("~")
    
    if model_name.startswith("faster-whisper"):
        model_size = model_name.split("-")[-1]
        model_path = os.path.join(home_dir, ".cache", "huggingface", "hub", f"models--guillaumekln--faster-whisper-{model_size}")
        
        is_available = check_whisper_model(model_path)
        
        return {
            "available": is_available,
            "model_name": model_name,
            "path": model_path,
            "auto_download": True,  # faster-whisper can auto-download models
            "error": None if is_available else "Model not found at expected location"
        }
    elif model_name.startswith("openai-whisper"):
        model_size = "-".join(model_name.split("-")[2:])  # Get model size (large-v3-turbo)
        model_path = os.path.join(home_dir, ".cache", "whisper", model_size)
        
        is_available = os.path.isfile(model_path)
        
        return {
            "available": is_available,
            "model_name": model_name,
            "path": model_path,
            "auto_download": True,  # OpenAI Whisper can auto-download models
            "error": None if is_available else "Model not found at expected location"
        }
    else:
        return {
            "available": False,
            "model_name": model_name,
            "path": None,
            "auto_download": False,
            "error": f"Unknown model type: {model_name}"
        }

def main():
    """Check the system for all required dependencies and report results"""
    python_status = check_python_version()
    demucs_status = check_demucs()
    faster_whisper_status = check_faster_whisper()
    openai_whisper_status = check_openai_whisper()
    
    # Check models only if the corresponding package is installed
    models = {}
    
    if faster_whisper_status["installed"]:
        models["faster-whisper-small"] = check_model_availability("faster-whisper-small")
        models["faster-whisper-medium"] = check_model_availability("faster-whisper-medium")
    
    if openai_whisper_status["installed"]:
        models["openai-whisper-large-v3-turbo"] = check_model_availability("openai-whisper-large-v3-turbo")
    
    # Create summary status fields
    result = {
        "python": python_status["meets_requirements"] if isinstance(python_status, dict) else python_status,
        "demucs": demucs_status["installed"] if isinstance(demucs_status, dict) else demucs_status,
        "fasterWhisper": faster_whisper_status["installed"] if isinstance(faster_whisper_status, dict) else faster_whisper_status,
        "openaiWhisper": openai_whisper_status["installed"] if isinstance(openai_whisper_status, dict) else openai_whisper_status,
        "models": {
            "faster-whisper-small": models.get("faster-whisper-small", {}).get("available", False) if "faster-whisper-small" in models else False,
            "faster-whisper-medium": models.get("faster-whisper-medium", {}).get("available", False) if "faster-whisper-medium" in models else False,
            "openai-whisper-large-v3-turbo": models.get("openai-whisper-large-v3-turbo", {}).get("available", False) if "openai-whisper-large-v3-turbo" in models else False
        },
        # Detailed status for more information
        "details": {
            "python": python_status,
            "demucs": demucs_status,
            "fasterWhisper": faster_whisper_status,
            "openaiWhisper": openai_whisper_status,
            "models": models
        }
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()