# Python Dependencies for Audio Transcription App

This directory contains Python scripts for audio processing, including audio separation with Demucs and transcription with Whisper models.

## Installation

### Prerequisites

- Python 3.9 or higher
- FFmpeg (for audio processing)

### Installing Python Dependencies

To install all required Python packages, run:

```bash
pip install -r requirements.txt
```

### Model Downloads

When the application runs for the first time, it will attempt to download the required models automatically. 

If you want to pre-download the models:

#### Faster Whisper Models

```bash
# Small model (recommended default)
python -c "from faster_whisper import download_model; download_model('small')"

# Medium model
python -c "from faster_whisper import download_model; download_model('medium')"
```

#### OpenAI Whisper Large Model

```bash
# This will download the model to ~/.cache/whisper/
python -c "import whisper; whisper.load_model('large-v3')"
```

## Scripts

- `check_deps.py`: Checks if all required dependencies and models are installed
- `demucs/separate.py`: Audio separation using Demucs
- `whisper/transcribe.py`: Audio transcription using Whisper models

## Troubleshooting

If you encounter issues with the Python dependencies:

1. Make sure FFmpeg is installed and available in your PATH
2. For CUDA-enabled GPU acceleration, ensure you have compatible CUDA libraries installed
3. If using Apple Silicon (M1/M2), make sure you have the correct PyTorch version for your hardware