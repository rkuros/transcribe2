import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppError } from '../common/error-utils';

/**
 * Application logger that writes to file and console
 */
export class Logger {
  private logPath: string;
  
  constructor() {
    // Set log path in user data directory
    this.logPath = path.join(app.getPath('userData'), 'logs');
    this.ensureLogDirectory();
  }
  
  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logPath)) {
        fs.mkdirSync(this.logPath, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }
  
  /**
   * Log an info message
   */
  public info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }
  
  /**
   * Log a warning message
   */
  public warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }
  
  /**
   * Log an error message
   */
  public error(error: Error | AppError | string, data?: any): void {
    let errorMessage: string;
    let errorData: any = {};
    
    if (error instanceof AppError) {
      errorMessage = error.getUserFriendlyMessage();
      errorData = {
        category: error.category,
        originalError: error.originalError
      };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorData = {
        name: error.name,
        stack: error.stack
      };
    } else {
      errorMessage = error;
    }
    
    if (data) {
      errorData = { ...errorData, ...data };
    }
    
    this.log('ERROR', errorMessage, errorData);
  }
  
  /**
   * Log a message with level, timestamp, and optional data
   */
  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Log to console
    if (level === 'ERROR') {
      console.error(logMessage, data || '');
    } else if (level === 'WARN') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
    
    // Log to file
    try {
      const logFile = path.join(
        this.logPath,
        `app-${new Date().toISOString().split('T')[0]}.log`
      );
      
      let logEntry = logMessage;
      
      if (data) {
        try {
          logEntry += '\n' + JSON.stringify(data, null, 2);
        } catch (e) {
          logEntry += '\n[Non-serializable data]';
        }
      }
      
      logEntry += '\n';
      
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
  
  /**
   * Get path to log directory
   */
  public getLogPath(): string {
    return this.logPath;
  }
}