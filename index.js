/**
 * Reddit Post Downloader - Main Entry Point
 *
 * A tool to download posts from Reddit subreddits or user profiles.
 * https://github.com/josephrcox/easy-reddit-downloader
 */

const { version } = require('./package.json');
const chalk = require('chalk');

// Load modules
const {
	loadConfig,
	validateConfig,
	ensurePostListFile,
	readPostListFile,
} = require('./lib/config');
const { createLogger } = require('./lib/logger');
const { createState } = require('./lib/state');
const { promptForSettings } = require('./lib/prompts');
const { createDownloaders } = require('./lib/downloaders');
const { createApi } = require('./lib/api');
const { MAX_POSTS_PER_REQUEST, ALL_POSTS } = require('./lib/utils');

const config = loadConfig();
ensurePostListFile();

const validation = validateConfig(config);

const logger = createLogger(config);

const state = createState(config);

function log(message, detailed) {
	logger.log(message, detailed, state.subredditList, state.numberOfPosts);
}

let isDownloading = false;
let isCompletingDownload = false;

function onProgress(postName) {
	if (isDownloading) {
		checkIfDone(postName);
	}
}

const downloaders = createDownloaders(config, state, log, onProgress);
const api = createApi(config, state, log, downloaders);

logger.logWelcome();
logger.logValidation(validation);

if (!validation.valid) {
	process.exit(1);
}

log('User config: ' + JSON.stringify(config), true);
if (config.testingMode) {
	log(
		'Testing mode options: ' + JSON.stringify(config.testingModeOptions),
		true,
	);
}

if (config.testingMode) {
	state.initFromTestingMode();
}

/**
 * Check if we're done downloading and handle next steps
 */
function checkIfDone(lastPostId, override = false) {
	const [remaining, downloaded] = state.getPostsRemaining();
	const total = state.numberOfPosts >= ALL_POSTS ? 'all' : state.numberOfPosts;

	if (config.download_post_list_options.enabled) {
		if (remaining > 0) {
			log(
				`Still downloading posts from ${chalk.cyan(
					'post list',
				)}... (${downloaded}/${total})`,
				false,
			);
		} else {
			log(`Finished downloading posts from download_post_list.txt`, false);
			state.resetDownloadStats();

			if (config.download_post_list_options.repeatForever) {
				log(
					`⏲️ Waiting ${
						state.timeBetweenRuns / 1000
					} seconds before rerunning...`,
					false,
				);
				setTimeout(() => {
					state.startTime = new Date();
					isCompletingDownload = false;
					downloadFromPostListFile();
				}, state.timeBetweenRuns);
			}
		}
		return;
	}

	const currentAPICall = state.currentAPICall;
	const responseSize = state.responseSize;
	const lastAPICallForSubreddit = state.lastAPICallForSubreddit;

	const batchComplete =
		(lastAPICallForSubreddit &&
			currentAPICall &&
			lastPostId ===
				currentAPICall.data.children[responseSize - 1].data.name) ||
		remaining === 0 ||
		override ||
		(downloaded === responseSize && responseSize < MAX_POSTS_PER_REQUEST);

	if (batchComplete && remaining === 0) {
		handleDownloadComplete();
	} else if (batchComplete) {
		log(
			`Still downloading posts from ${chalk.cyan(
				state.getCurrentSubreddit(),
			)}... (${downloaded}/${total})`,
			false,
		);
	} else {
		log(
			`Still downloading posts from ${chalk.cyan(
				state.getCurrentSubreddit(),
			)}... (${downloaded}/${total})`,
			false,
		);

		const posts = state.downloadedPosts;
		Object.keys(posts).forEach((key) => {
			log(`\t- ${key}: ${posts[key]}`, true);
		});
		log('\n', true);

		if (downloaded % MAX_POSTS_PER_REQUEST === 0) {
			api.downloadSubredditPosts(
				state.getCurrentSubreddit(),
				lastPostId,
				handleBatchComplete,
			);
		}
	}
}

/**
 * Handle batch completion
 */
function handleBatchComplete(lastPostId, isError) {
	if (isError) {
		if (state.subredditList.length > 1 && state.nextSubreddit()) {
			api.downloadSubredditPosts(
				state.getCurrentSubreddit(),
				'',
				handleBatchComplete,
			);
		} else {
			checkIfDone('', true);
		}
	} else {
		checkIfDone(lastPostId);
	}
}

/**
 * Handle download completion for a subreddit
 */
function handleDownloadComplete() {
	if (isCompletingDownload) {
		return;
	}
	isCompletingDownload = true;

	const endTime = new Date();
	let timeDiff = (endTime - state.startTime) / 1000;
	const [, downloaded] = state.getPostsRemaining();
	const msPerPost = (timeDiff / downloaded).toString().substring(0, 5);

	log('Validating that all posts were downloaded...', false);

	setTimeout(() => {
		log(
			'🎉 All done downloading posts from ' + state.getCurrentSubreddit() + '!',
			false,
		);
		log(JSON.stringify(state.downloadedPosts), true);

		if (state.currentSubredditIndex === state.subredditList.length - 1) {
			log(
				`\n📈 Downloading took ${timeDiff} seconds, at about ${msPerPost} seconds/post`,
				false,
			);
		}

		state.resetDownloadStats();

		if (state.nextSubreddit()) {
			isCompletingDownload = false;
			api.downloadSubredditPosts(
				state.getCurrentSubreddit(),
				'',
				handleBatchComplete,
			);
		} else if (state.repeatForever) {
			state.resetSubredditIndex();
			state.resetDownloadStats();
			log(
				`⏲️ Waiting ${
					state.timeBetweenRuns / 1000
				} seconds before rerunning...`,
				false,
			);
			setTimeout(() => {
				state.startTime = new Date();
				isCompletingDownload = false;
				api.downloadSubredditPosts(
					state.getCurrentSubreddit(),
					'',
					handleBatchComplete,
				);
			}, state.timeBetweenRuns);
		} else {
			isDownloading = false;
			isCompletingDownload = false;
			startPrompt();
		}
	}, 1000);
}

/**
 * Download from post list file
 */
async function downloadFromPostListFile() {
	const lines = readPostListFile();
	state.initFromPostListOptions(lines.length);

	if (lines.length === 0) {
		log(
			chalk.red(
				'ERROR: There are no posts in the download_post_list.txt file. Please add some posts to the file and try again.\n',
			),
			false,
		);
		log(
			chalk.yellow(
				'If you are trying to download posts from a subreddit, please set "download_post_list_options.enabled" to false in the user_config.json file.\n',
			),
			false,
		);
		process.exit(1);
	}

	log(
		chalk.green(
			`Starting download of ${lines.length} posts from the download_post_list.txt file.\n`,
		),
		false,
	);

	isDownloading = true;
	for (const url of lines) {
		await api.downloadFromPostUrl(url);
	}

	checkIfDone('', true);
}

/**
 * Start the user prompt
 */
async function startPrompt() {
	const result = await promptForSettings();

	if (!state.initFromPrompts(result)) {
		log('\nDownload cancelled. Goodbye!', false);
		process.exit(0);
	}

	isDownloading = true;
	api.downloadSubredditPosts(
		state.getCurrentSubreddit(),
		'',
		handleBatchComplete,
	);
}

/**
 * Main entry point
 */
async function main() {
	const latestVersion = await api.checkForUpdates(version);
	if (latestVersion) {
		logger.logVersionInfo(version, latestVersion);
	}

	if (config.download_post_list_options.enabled) {
		downloadFromPostListFile();
	} else if (config.testingMode) {
		state.startTime = new Date();
		isDownloading = true;
		api.downloadSubredditPosts(
			state.getCurrentSubreddit(),
			'',
			handleBatchComplete,
		);
	} else {
		startPrompt();
	}
}

main();
