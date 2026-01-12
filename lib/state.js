/**
 * Application state management
 */

const { ALL_POSTS } = require('./utils');

/**
 * Create state manager
 * @param {Object} config - User configuration
 * @returns {Object} - State manager object
 */
function createState(config) {
	let subredditList = [];
	let numberOfPosts = -1;
	let sorting = 'top';
	let time = 'all';
	let repeatForever = false;
	let timeBetweenRuns = 0;
	let downloadDirectoryBase = './downloads';

	let currentSubredditIndex = 0;
	let responseSize = -1;
	let startTime = null;
	let lastAPICallForSubreddit = false;
	let currentAPICall = null;
	let downloadDirectory = '';

	let downloadedPosts = createEmptyDownloadStats();

	function createEmptyDownloadStats() {
		return {
			subreddit: '',
			self: 0,
			media: 0,
			link: 0,
			failed: 0,
			skipped_due_to_duplicate: 0,
			skipped_due_to_fileType: 0,
		};
	}

	/**
	 * Initialize state from testing mode options
	 */
	function initFromTestingMode() {
		const opts = config.testingModeOptions;
		subredditList = opts.subredditList || [];
		numberOfPosts = opts.numberOfPosts || -1;
		sorting = opts.sorting || 'top';
		time = opts.time || 'all';
		repeatForever = opts.repeatForever || false;
		timeBetweenRuns = opts.timeBetweenRuns || 0;
		if (opts.downloadDirectory) {
			downloadDirectoryBase = opts.downloadDirectory;
		}
	}

	/**
	 * Initialize state from post list options
	 */
	function initFromPostListOptions(postCount) {
		numberOfPosts = postCount;
		repeatForever = config.download_post_list_options.repeatForever;
		timeBetweenRuns = config.download_post_list_options.timeBetweenRuns;
	}

	/**
	 * Initialize state from user prompts
	 * @param {Object} result - Prompts result object
	 * @returns {boolean} - true if initialized successfully, false if cancelled
	 */
	function initFromPrompts(result) {
		if (!result || !result.subreddit) {
			return false;
		}

		subredditList = result.subreddit
			.split(',')
			.map((s) => s.replace(/\s/g, ''));
		repeatForever = result.repeatForever;
		numberOfPosts = result.numberOfPosts === 0 ? ALL_POSTS : result.numberOfPosts;
		sorting = result.sorting.replace(/\s/g, '');
		time = result.time.replace(/\s/g, '');

		if (result.downloadDirectory) {
			downloadDirectoryBase = result.downloadDirectory;
		}

		if (repeatForever && result.timeBetweenRuns >= 0) {
			timeBetweenRuns = result.timeBetweenRuns;
		}

		startTime = new Date();
		return true;
	}

	/**
	 * Calculate number of posts remaining to download
	 * @returns {[number, number]} - [remaining, downloaded]
	 */
	function getPostsRemaining() {
		const total =
			downloadedPosts.self +
			downloadedPosts.media +
			downloadedPosts.link +
			downloadedPosts.failed +
			downloadedPosts.skipped_due_to_duplicate +
			downloadedPosts.skipped_due_to_fileType;
		return [numberOfPosts - total, total];
	}

	/**
	 * Reset download stats for next subreddit/run
	 */
	function resetDownloadStats() {
		downloadedPosts = createEmptyDownloadStats();
		downloadDirectory = '';
	}

	/**
	 * Get current subreddit being downloaded
	 * @returns {string}
	 */
	function getCurrentSubreddit() {
		return subredditList[currentSubredditIndex];
	}

	/**
	 * Move to next subreddit
	 * @returns {boolean} - true if there's a next subreddit
	 */
	function nextSubreddit() {
		if (currentSubredditIndex < subredditList.length - 1) {
			currentSubredditIndex += 1;
			return true;
		}
		return false;
	}

	/**
	 * Reset to first subreddit (for repeat runs)
	 */
	function resetSubredditIndex() {
		currentSubredditIndex = 0;
	}

	return {
		get subredditList() {
			return subredditList;
		},
		get numberOfPosts() {
			return numberOfPosts;
		},
		get sorting() {
			return sorting;
		},
		get time() {
			return time;
		},
		get repeatForever() {
			return repeatForever;
		},
		get timeBetweenRuns() {
			return timeBetweenRuns;
		},
		get downloadDirectoryBase() {
			return downloadDirectoryBase;
		},
		get currentSubredditIndex() {
			return currentSubredditIndex;
		},
		get responseSize() {
			return responseSize;
		},
		get startTime() {
			return startTime;
		},
		get lastAPICallForSubreddit() {
			return lastAPICallForSubreddit;
		},
		get currentAPICall() {
			return currentAPICall;
		},
		get downloadDirectory() {
			return downloadDirectory;
		},
		get downloadedPosts() {
			return downloadedPosts;
		},

		set subredditList(value) {
			subredditList = value;
		},
		set numberOfPosts(value) {
			numberOfPosts = value;
		},
		set responseSize(value) {
			responseSize = value;
		},
		set startTime(value) {
			startTime = value;
		},
		set lastAPICallForSubreddit(value) {
			lastAPICallForSubreddit = value;
		},
		set currentAPICall(value) {
			currentAPICall = value;
		},
		set downloadDirectory(value) {
			downloadDirectory = value;
		},
		set currentSubredditIndex(value) {
			currentSubredditIndex = value;
		},

		initFromTestingMode,
		initFromPostListOptions,
		initFromPrompts,
		getPostsRemaining,
		resetDownloadStats,
		getCurrentSubreddit,
		nextSubreddit,
		resetSubredditIndex,
		createEmptyDownloadStats,
	};
}

module.exports = {
	createState,
};

