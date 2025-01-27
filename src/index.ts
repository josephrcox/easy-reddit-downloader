import { version } from "../package.json";
import defaultConfigJson from "../user_config_DEFAULT.json";
import { UserConfig } from "./types/config";
import { RuntimeConfig } from "./types/runtime";

const defaultConfig = defaultConfigJson as UserConfig;
import { ConfigService } from "./services/ConfigService";
import { FileService } from "./services/FileService";
import { LogService } from "./services/LogService";
import { RedditService } from "./services/RedditService";
import { CommentService } from "./services/CommentService";
import { DownloadController } from "./controllers/DownloadController";
import { PromptController } from "./controllers/PromptController";

async function main() {
    try {
        // Initialize services
        const configService = new ConfigService(defaultConfig);
        await configService.loadUserConfig();
        
        const logger = configService.getLogger();
        const fileService = new FileService(configService.getRuntimeConfig(), logger);
        const redditService = new RedditService(configService.getRuntimeConfig(), logger);
        const commentService = new CommentService(configService.getRuntimeConfig(), logger);
        
        // Initialize controllers
        const promptController = new PromptController(configService);
        let downloadController = new DownloadController(
            configService.getRuntimeConfig(),
            logger,
            fileService,
            redditService,
            commentService
        );

        // Create necessary files
        await fileService.createDefaultFiles();

        // Display welcome message and check for updates
        promptController.displayWelcomeMessage();
        await promptController.checkForUpdates(version);

        const config = configService.getRuntimeConfig();
        if (!config.testingMode && !config.download_post_list_options.enabled) {
            // Start interactive prompt if not in testing mode
            await promptController.startPrompt();
            
            // Recreate download controller with updated config
            downloadController = new DownloadController(
                configService.getRuntimeConfig(),
                logger,
                fileService,
                redditService,
                commentService
            );
            // Get fresh config after prompt
            const updatedConfig = configService.getRuntimeConfig();
            await startDownloads(downloadController, updatedConfig.subredditList);
        } else if (config.download_post_list_options.enabled) {
            // Handle post list downloads
            await handlePostListDownloads(downloadController, config, logger);
        } else {
            // Handle testing mode downloads
            await startDownloads(downloadController, config.subredditList);
        }
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

async function startDownloads(downloadController: DownloadController, subreddits: string[]): Promise<void> {
    for (const subreddit of subreddits) {
        await downloadController.startDownload(subreddit);
        downloadController.resetStats();
    }
}

async function handlePostListDownloads(
    downloadController: DownloadController, 
    config: RuntimeConfig,
    logger: LogService
): Promise<void> {    
    if (config.download_post_list_options.repeatForever) {
        while (true) {
            await downloadController.startDownload('');
            downloadController.resetStats();
            logger.log(
                `⏲️ Waiting ${config.download_post_list_options.timeBetweenRuns / 1000} seconds before rerunning...`,
                false
            );
            await new Promise(resolve => 
                setTimeout(resolve, config.download_post_list_options.timeBetweenRuns)
            );
        }
    } else {
        await downloadController.startDownload('');
    }
}

// Start the application
main().catch(console.error);
