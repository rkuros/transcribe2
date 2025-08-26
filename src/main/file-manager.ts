import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { FileManager } from './interfaces';
import { AudioMetadata, ExportFormat } from '../common/types';

const exec = promisify(childProcess.exec);

export class ElectronFileManager implements FileManager {
  constructor(private mainWindow: BrowserWindow) {}

  async selectAudioFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'flac', 'aac'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    const filePath = result.filePaths[0];
    const isValid = await this.validateAudioFile(filePath);
    
    if (!isValid) {
      throw new Error('Invalid or unsupported audio file format');
    }
    
    return filePath;
  }

  async exportTranscription(content: string, format: ExportFormat, filePath: string): Promise<void> {
    // If filePath is empty, prompt the user to select a destination
    if (!filePath) {
      const defaultName = `transcription.${format}`;
      
      const result = await dialog.showSaveDialog(this.mainWindow, {
        title: 'Export Transcription',
        defaultPath: defaultName,
        filters: [
          { name: format.toUpperCase(), extensions: [format] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return;
      }
      
      filePath = result.filePath;
    }
    
    // Handle different export formats
    switch (format) {
      case ExportFormat.TXT:
        await fs.promises.writeFile(filePath, content, 'utf8');
        break;
        
      case ExportFormat.DOCX:
        // In a real implementation, we'd use a library like docx-templates
        // For now, just write a plain text file with a .docx extension
        await fs.promises.writeFile(filePath, content, 'utf8');
        break;
        
      case ExportFormat.SRT:
        // In a real implementation, we'd format the content as proper SRT
        // This is just a placeholder implementation
        await fs.promises.writeFile(filePath, this.formatAsSRT(content), 'utf8');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async validateAudioFile(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      await fs.promises.access(filePath, fs.constants.F_OK);
      
      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac'];
      
      if (!validExtensions.includes(ext)) {
        return false;
      }
      
      // Try to get audio metadata to verify it's a valid audio file
      await this.getAudioMetadata(filePath);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAudioMetadata(filePath: string): Promise<AudioMetadata> {
    try {
      // In a real implementation, we'd use a library like music-metadata
      // For now, let's use ffprobe if available
      const { stdout } = await exec(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      
      const data = JSON.parse(stdout);
      const audioStream = data.streams.find((stream: any) => stream.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('No audio stream found');
      }
      
      return {
        duration: parseFloat(data.format.duration || '0'),
        sampleRate: parseInt(audioStream.sample_rate || '0', 10),
        channels: parseInt(audioStream.channels || '0', 10),
        format: data.format.format_name,
        bitRate: data.format.bit_rate ? parseInt(data.format.bit_rate, 10) : undefined
      };
    } catch (error) {
      // Fallback: return minimal metadata based on file size
      const stats = await fs.promises.stat(filePath);
      
      // Rough approximation (assuming ~128kbps MP3)
      const estimatedDuration = stats.size / (128 * 1024 / 8);
      
      return {
        duration: estimatedDuration,
        sampleRate: 44100, // Assume CD quality
        channels: 2, // Assume stereo
        format: path.extname(filePath).substring(1),
      };
    }
  }

  private formatAsSRT(content: string): string {
    // Simple placeholder implementation that splits text into lines
    // and creates very basic SRT format
    const lines = content.split(/[.!?]+/).filter(line => line.trim().length > 0);
    let srtContent = '';
    let counter = 1;
    let currentTime = 0;
    
    // Assume each line takes about 5 seconds to speak
    const timePerLine = 5;
    
    for (const line of lines) {
      const startTime = this.formatSRTTime(currentTime);
      currentTime += timePerLine;
      const endTime = this.formatSRTTime(currentTime);
      
      srtContent += `${counter}\n${startTime} --> ${endTime}\n${line.trim()}\n\n`;
      counter++;
    }
    
    return srtContent;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}