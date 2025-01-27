import { UserConfig } from './config';
import { SortTime, SortType } from './types';

export interface RuntimeConfig extends UserConfig {
    subredditList: string[];
    numberOfPosts: number;
    sorting: SortType;
    time: SortTime;
    repeatForever: boolean;
    timeBetweenRuns: number;
    downloadDirectory?: string;
}
