import fs from 'fs';
import chalk from 'chalk';
import { RuntimeConfig } from '../types/runtime';

export class LogService {
    private userLogs: string = '';
    private logFormat: string = 'txt';
    private dateString: string;
    private config: RuntimeConfig;

    constructor(config: RuntimeConfig) {
        this.config = config;
        const date = new Date();
        this.dateString = `${date.getFullYear()} ${
            date.getMonth() + 1
        } ${date.getDate()} at ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
    }

    public log(message: any, detailed?: boolean): void {
        this.userLogs += message + '\r\n';
        let visibleToUser = true;
        
        if (detailed) {
            visibleToUser = this.config.detailed_logs;
        }

        if (visibleToUser) {
            console.log(message);
        }

        this.writeToLogFile();
    }

    private writeToLogFile(): void {
        if (!this.config.local_logs || !this.config.subredditList?.length) {
            return;
        }

        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs');
        }

        let logFileName = this.generateLogFileName();
        fs.writeFile(`./logs/${logFileName}.${this.logFormat}`, this.userLogs, (err) => {
            if (err) throw err;
        });
    }

    private generateLogFileName(): string {
        let logFileName = '';
        const { local_logs_naming_scheme: scheme } = this.config;

        if (scheme.showDateAndTime) {
            logFileName += `${this.dateString} - `;
        }

        if (scheme.showSubreddits) {
            let subredditListString = JSON.stringify(this.config.subredditList).replace(/[^a-zA-Z0-9,]/g, '');
            logFileName += `${subredditListString} - `;
        }

        if (scheme.showNumberOfPosts) {
            if (this.config.numberOfPosts < 999999999999999999) {
                logFileName += `ALL - `;
            } else {
                logFileName += `${this.config.numberOfPosts} - `;
            }
        }

        if (logFileName.endsWith(' - ')) {
            logFileName = logFileName.substring(0, logFileName.length - 3);
        }

        return logFileName;
    }

    public logError(message: string): void {
        this.log(chalk.red(message), false);
    }

    public logSuccess(message: string): void {
        this.log(chalk.green(message), false);
    }

    public logInfo(message: string): void {
        this.log(chalk.blue(message), false);
    }

    public logWarning(message: string): void {
        this.log(chalk.yellow(message), false);
    }
}
