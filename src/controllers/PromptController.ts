import prompts, { PromptObject } from 'prompts';
import { ConfigService } from '../services/ConfigService';
import { cleanSubreddits } from '../utils/utils';
import { SortTime, SortType } from '../types/types';

export class PromptController {
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
    }

    public async startPrompt(): Promise<void> {
        const questions: PromptObject[] = [
            {
                type: 'text',
                name: 'subreddit',
                message: 'Which subreddits or users would you like to download? You may submit multiple separated by commas (no spaces).',
                validate: (value: string) => (value.length < 1 ? `Please enter at least one subreddit or user` : true),
            },
            {
                type: 'number',
                name: 'numberOfPosts',
                message: 'How many posts would you like to attempt to download? If you would like to download all posts, enter 0.',
                initial: 0,
                validate: (value: number) => !isNaN(value) ? true : `Please enter a number`,
            },
            {
                type: 'text',
                name: 'sorting',
                message: 'How would you like to sort? (top, new, hot, rising, controversial)',
                initial: 'top',
                validate: (value: string) => this.validateSorting(value.toLowerCase()),
            },
            {
                type: 'text',
                name: 'time',
                message: 'During what time period? (hour, day, week, month, year, all)',
                initial: 'month',
                validate: (value: string) => this.validateTime(value.toLowerCase()),
            },
            {
                type: 'toggle',
                name: 'repeatForever',
                message: 'Would you like to run this on repeat?',
                initial: false,
                active: 'yes',
                inactive: 'no',
            },
            {
                type: (prev: boolean) => (prev ? 'number' : null),
                name: 'timeBetweenRuns',
                message: 'How often would you like to run this? (in ms)',
            },
            {
                type: 'text',
                name: 'downloadDirectory',
                message: 'Change the download path, defaults to ./downloads',
                initial: '',
            },
        ];

        const result = await prompts(questions);
        await this.processPromptResult(result);
    }

    private async processPromptResult(result: any): Promise<void> {
        if (!result.subreddit) {
            throw new Error('Prompt was cancelled');
        }

        const subredditList = cleanSubreddits(result.subreddit.split(','));
        this.configService.setSubredditList(subredditList);
        
        const numberOfPosts = result.numberOfPosts;
        this.configService.setNumberOfPosts(numberOfPosts);
        
        const sorting = result.sorting.replace(/\s/g, '') as SortType;
        this.configService.setSorting(sorting);
        
        const time = result.time.replace(/\s/g, '') as SortTime;
        this.configService.setTime(time);
        
        const repeatForever = result.repeatForever;
        this.configService.setRepeatForever(repeatForever);
        
        if (repeatForever && result.timeBetweenRuns !== undefined) {
            const timeBetweenRuns = Math.max(0, result.timeBetweenRuns);
            this.configService.setTimeBetweenRuns(timeBetweenRuns);
        }
        
        if (result.downloadDirectory) {
            this.configService.setDownloadDirectory(result.downloadDirectory);
        }

        // Update the runtime configuration
        const updatedConfig = {
            ...this.configService.getRuntimeConfig(),
            subredditList,
            numberOfPosts,
            sorting,
            time,
            repeatForever,
            timeBetweenRuns: repeatForever ? result.timeBetweenRuns : 0,
            downloadDirectory: result.downloadDirectory || './downloads'
        };
        this.configService.updateRuntimeConfig(updatedConfig);
    }

    private validateSorting(value: string): boolean | string {
        const validSortings = ['top', 'new', 'hot', 'rising', 'controversial'];
        return validSortings.includes(value) ? true : `Please enter a valid sorting method`;
    }

    private validateTime(value: string): boolean | string {
        const validTimes = ['hour', 'day', 'week', 'month', 'year', 'all'];
        return validTimes.includes(value) ? true : `Please enter a valid time period`;
    }

    public async checkForUpdates(version: string): Promise<void> {
        const logger = this.configService.getLogger();
        try {
            const response = await fetch(
                'https://api.github.com/repos/josephrcox/easy-reddit-downloader/releases/latest',
                { headers: { 'User-Agent': 'Downloader' } }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json() as { tag_name: string };
            const latestVersion = data.tag_name;

            if (version !== latestVersion) {
                logger.log(
                    `Hey! A new version (${latestVersion}) is available. \nConsider updating to the latest version with 'git pull'.\n`,
                    false
                );
            } else {
                logger.log(`You are on the latest stable version (${version})\n`, true);
            }
        } catch (error) {
            logger.logError(`Failed to check for updates: ${error}`);
        }
    }

    public displayWelcomeMessage(): void {
        const logger = this.configService.getLogger();
        console.clear();
        logger.log('👋 Welcome to the easiest & most customizable Reddit Post Downloader!', false);
        logger.log('😎 Contribute @ https://github.com/josephrcox/easy-reddit-downloader', false);
        logger.log('🤔 Confused? Check out the README @ https://github.com/josephrcox/easy-reddit-downloader#readme\n', false);
    }
}
