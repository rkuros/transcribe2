import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow, dialog } from 'electron';
import { ExportFormat, TranscriptionSegment } from '../common/types';

export class ExportService {
  constructor(private mainWindow: BrowserWindow) {}

  /**
   * Export transcription content to a file
   * 
   * @param content The text content to export
   * @param format The export format (txt, docx, srt)
   * @param segments Optional segments for SRT format
   * @param suggestedFilePath Optional suggested file path, if empty a dialog will be shown
   */
  async exportTranscription(
    content: string,
    format: ExportFormat,
    segments?: TranscriptionSegment[],
    suggestedFilePath?: string
  ): Promise<string> {
    // Get file path from user if not provided
    const filePath = suggestedFilePath || await this.showSaveDialog(format);
    
    if (!filePath) {
      throw new Error('Export canceled by user');
    }
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    await fs.promises.mkdir(dirPath, { recursive: true });
    
    // Format content based on export format
    const formattedContent = this.formatContent(content, format, segments);
    
    // Write to file
    await fs.promises.writeFile(filePath, formattedContent, 'utf-8');
    
    return filePath;
  }

  /**
   * Show save dialog to get export file path
   */
  private async showSaveDialog(format: ExportFormat): Promise<string | undefined> {
    const result = await dialog.showSaveDialog(this.mainWindow, {
      title: 'エクスポート',
      defaultPath: `transcription.${format}`,
      filters: [
        { name: this.getFormatName(format), extensions: [format] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    
    return result.canceled ? undefined : result.filePath;
  }

  /**
   * Format content based on export format
   */
  private formatContent(
    content: string, 
    format: ExportFormat,
    segments?: TranscriptionSegment[]
  ): string {
    switch (format) {
      case ExportFormat.TXT:
        return content;
        
      case ExportFormat.DOCX:
        // In a real implementation, we'd use a library to create docx
        // For now, we'll just use text content
        return content;
        
      case ExportFormat.SRT:
        return this.formatAsSRT(content, segments);
        
      default:
        return content;
    }
  }

  /**
   * Format content as SRT subtitles
   */
  private formatAsSRT(content: string, segments?: TranscriptionSegment[]): string {
    // If we have segments with timestamps, use them
    if (segments && segments.length > 0) {
      return segments
        .map((segment, index) => {
          const startTime = this.formatSRTTime(segment.start);
          const endTime = this.formatSRTTime(segment.end);
          return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n`;
        })
        .join('\n');
    }
    
    // Otherwise, split content into reasonable segments
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

  /**
   * Format seconds as SRT timestamp (HH:MM:SS,mmm)
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Get readable name for export format
   */
  private getFormatName(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.TXT:
        return 'Text Document';
      case ExportFormat.DOCX:
        return 'Word Document';
      case ExportFormat.SRT:
        return 'SubRip Subtitle';
      default:
        return 'Document';
    }
  }
}