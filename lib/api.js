/**
 * Reddit API calls and directory management
 */

const fs = require('fs');
const axios = require('axios');

const {
	MAX_POSTS_PER_REQUEST,
	DEFAULT_REQUEST_TIMEOUT,
	isUserProfile,
	isSearchQuery,
	extractName,
	buildRedditApiUrl,
} = require('./utils');

/**
 * Create API handler with config and state
 * @param {Object} config - User configuration
 * @param {Object} state - State manager
 * @param {Function} log - Logging function
 * @param {Object} downloaders - Downloader functions
 * @returns {Object} - API functions
 */
function createApi(config, state, log, downloaders) {
	/**
	 * Create needed directories for downloads
	 */
	function makeDirectories() {
		if (!fs.existsSync(state.downloadDirectoryBase)) {
			fs.mkdirSync(state.downloadDirectoryBase);
		}

		if (config.separate_clean_nsfw) {
			if (!fs.existsSync(`${state.downloadDirectoryBase}/clean`)) {
				fs.mkdirSync(`${state.downloadDirectoryBase}/clean`);
			}
			if (!fs.existsSync(`${state.downloadDirectoryBase}/nsfw`)) {
				fs.mkdirSync(`${state.downloadDirectoryBase}/nsfw`);
			}
		}
	}

	/**
	 * Check latest version from GitHub
	 * @param {string} currentVersion - Current app version
	 * @returns {Promise<string|null>} - Latest version or null
	 */
	async function checkForUpdates(currentVersion) {
		try {
			const response = await axios.get(
				'https://api.github.com/repos/josephrcox/easy-reddit-downloader/releases/latest',
				{
					headers: { 'User-Agent': 'Downloader' },
					timeout: DEFAULT_REQUEST_TIMEOUT,
				},
			);
			return response.data.tag_name;
		} catch (error) {
			log('Could not check for updates: ' + error.message, true);
			return null;
		}
	}

	/**
	 * Downloads posts from a subreddit or user profile
	 * @param {string} target - Subreddit name or username (with u/ prefix for users)
	 * @param {string} lastPostId - ID of last post for pagination
	 * @param {Function} onComplete - Callback when batch is done
	 */
	async function downloadSubredditPosts(target, lastPostId = '', onComplete) {
		const isUser = isUserProfile(target);
		const isSearch = isSearchQuery(target);
		const name = extractName(target);

		// Check if we've downloaded enough posts
		let postsRemaining = state.getPostsRemaining()[0];
		if (postsRemaining <= 0) {
			return onComplete(null, true);
		}

		if (postsRemaining > MAX_POSTS_PER_REQUEST) {
			postsRemaining = MAX_POSTS_PER_REQUEST;
		}

		if (name === undefined) {
			return onComplete(null, true);
		}

		makeDirectories();

		const reqUrl = buildRedditApiUrl({
			target: name,
			isUser,
			isSearch,
			sorting: state.sorting,
			time: state.time,
			limit: postsRemaining,
			after: lastPostId,
		});

		log(`\n\n👀 Requesting posts from ${reqUrl}\n`, true);

		try {
			const response = await axios.get(reqUrl, {
				timeout: DEFAULT_REQUEST_TIMEOUT,
			});
			const data = response.data;

			state.currentAPICall = data;

			if (data.message === 'Not Found' || data.data.children.length === 0) {
				throw new Error(
					isUser
						? 'User not found or has no posts'
						: (isSearch
						? 'Search query found no results'
						: 'Subreddit not found or empty'),
				);
			}

			if (data.data.children.length < postsRemaining) {
				state.lastAPICallForSubreddit = true;
				postsRemaining = data.data.children.length;
			} else {
				state.lastAPICallForSubreddit = false;
			}

			const firstPost = data.data.children[0].data;
			state.downloadedPosts.subreddit = firstPost.subreddit;

			if (isUser) {
				state.downloadDirectory = `${state.downloadDirectoryBase}/user_${name}`;
			}
			else if (isSearch) {
				state.downloadDirectory = `${state.downloadDirectoryBase}/search_${name}`;
			}
			else {
				const isOver18 = firstPost.over_18 ? 'nsfw' : 'clean';
				state.downloadDirectory = config.separate_clean_nsfw
					? `${state.downloadDirectoryBase}/${isOver18}/${firstPost.subreddit}`
					: `${state.downloadDirectoryBase}/${firstPost.subreddit}`;
			}

			if (!fs.existsSync(state.downloadDirectory)) {
				fs.mkdirSync(state.downloadDirectory);
			}

			state.responseSize = data.data.children.length;

			for (const child of data.data.children) {
				await downloaders.sleep();
				try {
					await downloaders.downloadPost(child.data);
				} catch (e) {
					log(e, true);
				}
			}

			const lastChild = data.data.children[data.data.children.length - 1];
			onComplete(lastChild.data.name, false);
		} catch (err) {
			const entityType = isUser ? 'user' : 'subreddit';
			log(
				`\n\nERROR: There was a problem fetching posts for ${name}. This is likely because the ${entityType} is private, banned, or doesn't exist.`,
				true,
			);
			onComplete(null, true);
		}
	}

	/**
	 * Download posts from a single URL
	 * @param {string} url - Reddit post URL
	 */
	async function downloadFromPostUrl(url) {
		try {
			const response = await axios.get(url + '.json', {
				timeout: DEFAULT_REQUEST_TIMEOUT,
			});
			const post = response.data[0].data.children[0].data;
			const isOver18 = post.over_18 ? 'nsfw' : 'clean';
			state.downloadedPosts.subreddit = post.subreddit;

			makeDirectories();

			if (!config.separate_clean_nsfw) {
				state.downloadDirectory = `${state.downloadDirectoryBase}/${post.subreddit}`;
			} else {
				state.downloadDirectory = `${state.downloadDirectoryBase}/${isOver18}/${post.subreddit}`;
			}

			if (!fs.existsSync(state.downloadDirectory)) {
				fs.mkdirSync(state.downloadDirectory);
			}

			await downloaders.downloadPost(post);
			await downloaders.sleep();
		} catch (err) {
			log(`Failed to download post from ${url}: ${err.message}`, true);
			state.downloadedPosts.failed += 1;
		}
	}

	return {
		makeDirectories,
		checkForUpdates,
		downloadSubredditPosts,
		downloadFromPostUrl,
	};
}

module.exports = {
	createApi,
};

