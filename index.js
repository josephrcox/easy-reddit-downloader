const { version } = require('./package.json');

// NodeJS Dependencies
const fs = require('fs');
const fsp = fs.promises;
const prompts = require('prompts');
const chalk = require('chalk');
const axios = require('axios');

// Constants
const MAX_POSTS_PER_REQUEST = 100;
const MAX_FILENAME_LENGTH = 240;
const ALL_POSTS = Number.MAX_SAFE_INTEGER;
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

let config = require('./user_config_DEFAULT.json');

// Variables used for logging
let userLogs = '';
const logFormat = 'txt';
let date = new Date();
let date_string = `${date.getFullYear()} ${
	date.getMonth() + 1
} ${date.getDate()} at ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
let startTime = null;
let lastAPICallForSubreddit = false;
let currentAPICall = null;

let currentSubredditIndex = 0; // Used to track which subreddit the user is downloading from
let responseSize = -1; // Used to track the size of the response from the API call, aka how many posts are in the response

// User-defined variables, these can be preset with the help of testingMode
let timeBetweenRuns = 0; // in milliseconds, the time between runs. This is only used if repeatForever is true
let subredditList = []; // List of subreddits in this format: ['subreddit1', 'subreddit2', 'subreddit3']
let numberOfPosts = -1; // How many posts to go through, more posts = more downloads, but takes longer
let sorting = 'top'; // How to sort the posts (top, new, hot, rising, controversial)
let time = 'all'; // What time period to sort by (hour, day, week, month, year, all)
let repeatForever = false; // If true, the program will repeat every timeBetweenRuns milliseconds
let downloadDirectory = ''; // Where to download the files to, defined when
let downloadDirectoryBase = './downloads'; // Default download path, can be overridden
const postDelayMilliseconds = 250;

let currentUserAfter = ''; // Used to track the after value for the API call, this is used to get the next X posts

// Default object to track the downloaded posts by type,
// and the subreddit downloading from.
let downloadedPosts = {
	subreddit: '',
	self: 0,
	media: 0,
	link: 0,
	failed: 0,
	skipped_due_to_duplicate: 0,
	skipped_due_to_fileType: 0,
};

// Read the user_config.json file for user configuration options
if (fs.existsSync('./user_config.json')) {
	config = require('./user_config.json');
} else {
	// create ./user_config.json if it doesn't exist, by duplicating user_config_DEFAULT.json and renaming it
	fs.copyFileSync('./user_config_DEFAULT.json', './user_config.json');
	log('user_config.json was created. Edit it to manage user options.', true);
	config = require('./user_config.json');
}
checkConfig();

// check if download_post_list.txt exists, if it doesn't, create it
if (!fs.existsSync('./download_post_list.txt')) {
	const fileDefaultContent = `# Below, please list any posts that you wish to download. #
# They must follow this format below: #
# https://www.reddit.com/r/gadgets/comments/ptt967/eu_proposes_mandatory_usbc_on_all_devices/ #
# Lines with "#" at the start will be ignored (treated as comments). #`;
	fs.writeFileSync('./download_post_list.txt', fileDefaultContent);
	log('download_post_list.txt was created with default content.', true);
}

// Testing Mode for developer testing. This enables you to hardcode
// the variables above and skip the prompt.
// To edit, go into the user_config.json file.
const testingMode = config.testingMode;
if (testingMode) {
	subredditList = config.testingModeOptions.subredditList;
	numberOfPosts = config.testingModeOptions.numberOfPosts;
	sorting = config.testingModeOptions.sorting;
	time = config.testingModeOptions.time;
	repeatForever = config.testingModeOptions.repeatForever;
	timeBetweenRuns = config.testingModeOptions.timeBetweenRuns;
	if (config.testingModeOptions.downloadDirectory) {
		downloadDirectoryBase = config.testingModeOptions.downloadDirectory;
	}
}

// Start actions
console.clear(); // Clear the console
log(
	chalk.cyan(
		'👋 Welcome to the easiest & most customizable Reddit Post Downloader!',
	),
	false,
);
log(
	chalk.yellow(
		'😎 Contribute @ https://github.com/josephrcox/easy-reddit-downloader',
	),
	false,
);
log(
	chalk.blue(
		'🤔 Confused? Check out the README @ https://github.com/josephrcox/easy-reddit-downloader#readme\n',
	),
	false,
);
// For debugging logs
log('User config: ' + JSON.stringify(config), true);
if (config.testingMode) {
	log('Testing mode options: ' + JSON.stringify(config.testingMode), true);
}

function checkConfig() {
	let warnTheUser = false;
	let quitApplicaton = false;

	let count =
		(config.file_naming_scheme.showDate === true) +
		(config.file_naming_scheme.showAuthor === true) +
		(config.file_naming_scheme.showTitle === true);
	if (count === 0) {
		quitApplicaton = true;
	} else if (count < 2) {
		warnTheUser = true;
	}

	if (warnTheUser) {
		log(
			chalk.red(
				'WARNING: Your file naming scheme (user_config.json) is poorly set, we recommend changing it.',
			),
			false,
		);
	}

	if (quitApplicaton) {
		log(
			chalk.red(
				'ALERT: Your file naming scheme (user_config.json) does not have any options set. You can not download posts without filenames. Aborting. ',
			),
			false,
		);
		process.exit(1);
	}

	if (quitApplicaton || warnTheUser) {
		log(
			chalk.red(
				'Read about recommended naming schemes here - https://github.com/josephrcox/easy-reddit-downloader/blob/main/README.md#File-naming-scheme',
			),
			false,
		);
	}
}

// Make a GET request to the GitHub API to get the latest release
(async () => {
	try {
		const response = await axios.get(
			'https://api.github.com/repos/josephrcox/easy-reddit-downloader/releases/latest',
			{
				headers: { 'User-Agent': 'Downloader' },
				timeout: DEFAULT_REQUEST_TIMEOUT,
			},
		);
		const latestVersion = response.data.tag_name;

		// Compare the current version to the latest release version
		if (version !== latestVersion) {
			log(
				`Hey! A new version (${latestVersion}) is available. \nConsider updating to the latest version with 'git pull'.\n`,
				false,
			);
		} else {
			log('You are on the latest stable version (' + version + ')\n', true);
		}
	} catch (error) {
		log('Could not check for updates: ' + error.message, true);
	}
	startScript();
})();

function startScript() {
	if (!testingMode && !config.download_post_list_options.enabled) {
		startPrompt();
	} else {
		if (config.download_post_list_options.enabled) {
			downloadFromPostListFile();
		} else {
			downloadSubredditPosts(subredditList[0], ''); // skip the prompt and get right to the API calls
		}
	}
}

async function startPrompt() {
	const questions = [
		{
			type: 'text',
			name: 'subreddit',
			message:
				'Which subreddits or users would you like to download? You may submit multiple separated by commas (no spaces).',
			validate: (value) =>
				value.length < 1 ? `Please enter at least one subreddit or user` : true,
		},
		{
			type: 'number',
			name: 'numberOfPosts',
			message:
				'How many posts would you like to attempt to download? If you would like to download all posts, enter 0.',
			initial: 0,
			validate: (value) =>
				// check if value is a number
				!isNaN(value) ? true : `Please enter a number`,
		},
		{
			type: 'text',
			name: 'sorting',
			message:
				'How would you like to sort? (top, new, hot, rising, controversial)',
			initial: 'top',
			validate: (value) =>
				value.toLowerCase() === 'top' ||
				value.toLowerCase() === 'new' ||
				value.toLowerCase() === 'hot' ||
				value.toLowerCase() === 'rising' ||
				value.toLowerCase() === 'controversial'
					? true
					: `Please enter a valid sorting method`,
		},
		{
			type: 'text',
			name: 'time',
			message: 'During what time period? (hour, day, week, month, year, all)',
			initial: 'month',
			validate: (value) =>
				value.toLowerCase() === 'hour' ||
				value.toLowerCase() === 'day' ||
				value.toLowerCase() === 'week' ||
				value.toLowerCase() === 'month' ||
				value.toLowerCase() === 'year' ||
				value.toLowerCase() === 'all'
					? true
					: `Please enter a valid time period`,
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
			type: (prev) => (prev === true ? 'number' : null),
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
	subredditList = result.subreddit.split(','); // the user enters subreddits separated by commas
	repeatForever = result.repeatForever;
	numberOfPosts = result.numberOfPosts;
	sorting = result.sorting.replace(/\s/g, '');
	time = result.time.replace(/\s/g, '');
	if (result.downloadDirectory) {
		downloadDirectoryBase = result.downloadDirectory;
	}

	// clean up the subreddit list in case the user puts in invalid chars
	for (let i = 0; i < subredditList.length; i++) {
		subredditList[i] = subredditList[i].replace(/\s/g, '');
	}

	if (numberOfPosts === 0) {
		numberOfPosts = ALL_POSTS;
	}

	if (repeatForever) {
		if (result.repeat < 0) {
			result.repeat = 0;
		}
		timeBetweenRuns = result.timeBetweenRuns; // the user enters the time between runs in ms
	}

	// With the data gathered, call the APIs and download the posts
	startTime = new Date();
	downloadSubredditPosts(subredditList[0], '');
}

function makeDirectories() {
	// Make needed directories for downloads,
	// clean and nsfw are made nomatter the subreddits downloaded
	if (!fs.existsSync(downloadDirectoryBase)) {
		fs.mkdirSync(downloadDirectoryBase);
	}
	if (config.separate_clean_nsfw) {
		if (!fs.existsSync(downloadDirectoryBase + '/clean')) {
			fs.mkdirSync(downloadDirectoryBase + '/clean');
		}
		if (!fs.existsSync(downloadDirectoryBase + '/nsfw')) {
			fs.mkdirSync(downloadDirectoryBase + '/nsfw');
		}
	}
}

/**
 * Downloads posts from a subreddit or user profile
 * @param {string} target - Subreddit name or username (with u/ prefix for users)
 * @param {string} lastPostId - ID of last post for pagination, empty string for first request
 */
async function downloadSubredditPosts(target, lastPostId = '') {
	// Check if target is a user profile
	const isUser =
		target.includes('u/') || target.includes('user/') || target.includes('/u/');

	// Extract clean name
	const name = isUser ? target.split('u/').pop() : target;

	// Check if we've downloaded enough posts
	let postsRemaining = numberOfPostsRemaining()[0];
	if (postsRemaining <= 0) {
		if (subredditList.length > 1) {
			return downloadNextSubreddit();
		}
		return checkIfDone('', true);
	}

	// Cap at API limit
	if (postsRemaining > MAX_POSTS_PER_REQUEST) {
		postsRemaining = MAX_POSTS_PER_REQUEST;
	}

	// Handle undefined target
	if (name === undefined) {
		if (subredditList.length > 1) {
			return downloadNextSubreddit();
		}
		return checkIfDone();
	}

	makeDirectories();

	// Build the appropriate URL
	const reqUrl = isUser
		? `https://www.reddit.com/user/${name}/submitted/.json?limit=${postsRemaining}&after=${lastPostId}`
		: `https://www.reddit.com/r/${name}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}`;

	log(`\n\n👀 Requesting posts from ${reqUrl}\n`, true);

	try {
		const response = await axios.get(reqUrl, {
			timeout: DEFAULT_REQUEST_TIMEOUT,
		});
		const data = response.data;

		currentAPICall = data;

		if (data.message === 'Not Found' || data.data.children.length === 0) {
			throw new Error(
				isUser
					? 'User not found or has no posts'
					: 'Subreddit not found or empty',
			);
		}

		// Check if this is the last batch of posts
		if (data.data.children.length < postsRemaining) {
			lastAPICallForSubreddit = true;
			postsRemaining = data.data.children.length;
		} else {
			lastAPICallForSubreddit = false;
		}

		// Set up download directory
		const firstPost = data.data.children[0].data;
		downloadedPosts.subreddit = firstPost.subreddit;

		if (isUser) {
			downloadDirectory = `${downloadDirectoryBase}/user_${name}`;
		} else {
			const isOver18 = firstPost.over_18 ? 'nsfw' : 'clean';
			downloadDirectory = config.separate_clean_nsfw
				? `${downloadDirectoryBase}/${isOver18}/${firstPost.subreddit}`
				: `${downloadDirectoryBase}/${firstPost.subreddit}`;
		}

		// Create directory if it doesn't exist
		if (!fs.existsSync(downloadDirectory)) {
			fs.mkdirSync(downloadDirectory);
		}

		responseSize = data.data.children.length;

		// Download each post
		for (const child of data.data.children) {
			await sleep();
			try {
				await downloadPost(child.data);
			} catch (e) {
				log(e, true);
			}
		}
	} catch (err) {
		const entityType = isUser ? 'user' : 'subreddit';
		log(
			`\n\nERROR: There was a problem fetching posts for ${name}. This is likely because the ${entityType} is private, banned, or doesn't exist.`,
			true,
		);

		// Try next subreddit/user or finish
		if (subredditList.length > 1) {
			if (currentSubredditIndex > subredditList.length - 1) {
				currentSubredditIndex = -1;
			}
			currentSubredditIndex += 1;
			return downloadSubredditPosts(subredditList[currentSubredditIndex], '');
		}
		return checkIfDone('', true);
	}
}

async function downloadFromPostListFile() {
	// This is called when config.download_post_list_options.enabled is true
	// Reads download_post_list.txt and downloads all valid posts
	// Lines starting with "#" are treated as comments and ignored

	const file = fs.readFileSync('./download_post_list.txt', 'utf8');
	const lines = file
		.split('\n')
		.map((line) => line.trim())
		.filter(
			(line) =>
				line &&
				!line.startsWith('#') &&
				line.startsWith('https://www.reddit.com') &&
				line.includes('/comments/'),
		);

	numberOfPosts = lines.length;
	repeatForever = config.download_post_list_options.repeatForever;
	timeBetweenRuns = config.download_post_list_options.timeBetweenRuns;

	if (numberOfPosts === 0) {
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
			`Starting download of ${numberOfPosts} posts from the download_post_list.txt file.\n`,
		),
		false,
	);

	// Download posts sequentially to avoid race conditions
	for (const line of lines) {
		try {
			const response = await axios.get(line + '.json', {
				timeout: DEFAULT_REQUEST_TIMEOUT,
			});
			const post = response.data[0].data.children[0].data;
			const isOver18 = post.over_18 ? 'nsfw' : 'clean';
			downloadedPosts.subreddit = post.subreddit;
			makeDirectories();

			if (!config.separate_clean_nsfw) {
				downloadDirectory = downloadDirectoryBase + `/${post.subreddit}`;
			} else {
				downloadDirectory =
					downloadDirectoryBase + `/${isOver18}/${post.subreddit}`;
			}

			// Make sure the image directory exists
			if (!fs.existsSync(downloadDirectory)) {
				fs.mkdirSync(downloadDirectory);
			}
			await downloadPost(post);
			await sleep();
		} catch (err) {
			log(`Failed to download post from ${line}: ${err.message}`, true);
			downloadedPosts.failed += 1;
		}
	}
	checkIfDone('', true);
}

function getPostType(post, postTypeOptions) {
	log(`Analyzing post with title: ${post.title}) and URL: ${post.url}`, true);
	let postType;
	if (post.post_hint === 'self' || post.is_self) {
		postType = 0;
	} else if (
		post.post_hint === 'image' ||
		(post.post_hint === 'rich:video' && !post.domain.includes('youtu')) ||
		post.post_hint === 'hosted:video' ||
		(post.post_hint === 'link' &&
			post.domain.includes('imgur') &&
			!post.url_overridden_by_dest.includes('gallery')) ||
		post.domain.includes('i.redd.it') ||
		post.domain.includes('i.reddituploads.com')
	) {
		postType = 1;
	} else if (post.poll_data !== undefined) {
		postType = 3; // UNSUPPORTED
	} else if (post.domain.includes('reddit.com') && post.is_gallery) {
		postType = 4;
	} else {
		postType = 2;
	}
	log(
		`Post has type: ${postTypeOptions[postType]} due to their post hint: ${post.post_hint} and domain: ${post.domain}`,
		true,
	);
	return postType;
}

async function downloadMediaFile(downloadURL, filePath, postName) {
	try {
		const response = await axios({
			method: 'GET',
			url: downloadURL,
			responseType: 'stream',
		});

		response.data.pipe(fs.createWriteStream(filePath));

		return new Promise((resolve, reject) => {
			response.data.on('end', () => {
				downloadedPosts.media += 1;
				checkIfDone(postName);
				resolve();
			});

			response.data.on('error', (error) => {
				reject(error);
			});
		});
	} catch (error) {
		downloadedPosts.failed += 1;
		checkIfDone(postName);
		if (error.code === 'ENOTFOUND') {
			log(
				'ERROR: Hostname not found for: ' + downloadURL + '\n... skipping post',
				true,
			);
		} else {
			log('ERROR: ' + error, true);
		}
	}
}

function sleep() {
	return new Promise((resolve) => setTimeout(resolve, postDelayMilliseconds));
}

// Supported image and video formats
const MEDIA_FORMATS = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];

/**
 * Downloads a gallery post (multiple images in one post)
 */
async function downloadGalleryPost(post, postTitleScrubbed) {
	if (!config.download_gallery_posts) {
		log(`Skipping gallery post with title: ${post.title}`, true);
		downloadedPosts.skipped_due_to_fileType += 1;
		return checkIfDone(post.name);
	}

	let newDownloads = Object.keys(post.media_metadata).length;

	for (const { media_id, id } of post.gallery_data.items) {
		const media = post.media_metadata[media_id];
		const downloadUrl = media['s']['u'].replaceAll('&amp;', '&');
		const shortUrl = downloadUrl.split('?')[0];
		const fileType = shortUrl.split('.').pop();

		// Create directory for gallery
		const postDirectory = `${downloadDirectory}/${postTitleScrubbed}`;
		if (!fs.existsSync(postDirectory)) {
			fs.mkdirSync(postDirectory);
		}

		const filePath = `${postTitleScrubbed}/${id}.${fileType}`;
		const toDownload = await shouldWeDownload(post.subreddit, filePath);

		if (!toDownload) {
			if (--newDownloads === 0) {
				downloadedPosts.skipped_due_to_duplicate += 1;
				return checkIfDone(post.name);
			}
		} else {
			await downloadMediaFile(
				downloadUrl,
				`${downloadDirectory}/${filePath}`,
				post.name,
			);
		}
	}
}

/**
 * Downloads a self/text post with optional comments
 */
async function downloadSelfPost(post, postTitleScrubbed) {
	const toDownload = await shouldWeDownload(
		post.subreddit,
		`${postTitleScrubbed}.txt`,
	);

	if (!toDownload) {
		downloadedPosts.skipped_due_to_duplicate += 1;
		return checkIfDone(post.name);
	}

	if (!config.download_self_posts) {
		log(`Skipping self post with title: ${post.title}`, true);
		downloadedPosts.skipped_due_to_fileType += 1;
		return checkIfDone(post.name);
	}

	let postData;
	try {
		const postResponse = await axios.get(`${post.url}.json`, {
			timeout: DEFAULT_REQUEST_TIMEOUT,
		});
		postData = postResponse.data;
	} catch (error) {
		log(`Failed to fetch post data: ${post.url}`, true);
		return checkIfDone(post.name);
	}

	// Build post content with title, body, and optionally comments
	let content = `${post.title} by ${post.author}\n\n`;
	content += `${post.selftext}\n`;
	content += '------------------------------------------------\n\n';

	if (config.download_comments) {
		content += '--COMMENTS--\n\n';
		for (const child of postData[1].data.children) {
			const comment = child.data;
			content += `${comment.author}:\n${comment.body}\n`;
			if (comment.replies?.data?.children?.[0]?.data) {
				const topReply = comment.replies.data.children[0].data;
				content += `\t>\t${topReply.author}:\n\t>\t${topReply.body}\n`;
			}
			content += '\n\n\n';
		}
	}

	try {
		await fsp.writeFile(
			`${downloadDirectory}/${postTitleScrubbed}.txt`,
			content,
		);
		downloadedPosts.self += 1;
	} catch (err) {
		log(err, true);
	}
	checkIfDone(post.name);
}

/**
 * Determines the download URL and file type for a media post
 */
function getMediaDownloadInfo(post) {
	let downloadURL = post.url;
	let fileType = downloadURL.split('.').pop();

	if (post.preview !== undefined) {
		if (post.preview.reddit_video_preview !== undefined) {
			log("Using fallback URL for Reddit's GIF preview.", true);
			downloadURL = post.preview.reddit_video_preview.fallback_url;
			fileType = 'mp4';
		} else if (post.url_overridden_by_dest?.includes('.gifv')) {
			log('Replacing gifv with mp4', true);
			downloadURL = post.url_overridden_by_dest.replace('.gifv', '.mp4');
			fileType = 'mp4';
		} else if (post.preview.images?.[0]?.source?.url) {
			const sourceURL = post.preview.images[0].source.url;
			for (const format of MEDIA_FORMATS) {
				if (sourceURL.toLowerCase().includes(format.toLowerCase())) {
					fileType = format;
					break;
				}
			}
		}
	}

	if (post.media !== undefined && post.post_hint === 'hosted:video') {
		downloadURL = post.media.reddit_video.fallback_url;
		fileType = 'mp4';
	} else if (
		post.media !== undefined &&
		post.post_hint === 'rich:video' &&
		post.media.oembed?.thumbnail_url !== undefined
	) {
		downloadURL = post.media.oembed.thumbnail_url;
		fileType = 'gif';
	}

	return { downloadURL, fileType };
}

/**
 * Downloads a media post (image/video)
 */
async function downloadMediaPost(post, postTitleScrubbed) {
	if (!config.download_media_posts) {
		log(`Skipping media post with title: ${post.title}`, true);
		downloadedPosts.skipped_due_to_fileType += 1;
		return checkIfDone(post.name);
	}

	const { downloadURL, fileType } = getMediaDownloadInfo(post);

	const toDownload = await shouldWeDownload(
		post.subreddit,
		`${postTitleScrubbed}.${fileType}`,
	);

	if (!toDownload) {
		downloadedPosts.skipped_due_to_duplicate += 1;
		return checkIfDone(post.name);
	}

	await downloadMediaFile(
		downloadURL,
		`${downloadDirectory}/${postTitleScrubbed}.${fileType}`,
		post.name,
	);
}

/**
 * Downloads a YouTube video with audio using ffmpeg
 */
async function downloadYouTubeVideo(post, postTitleScrubbed) {
	log(
		`Downloading ${postTitleScrubbed} from YouTube... This may take a while...`,
		false,
	);

	try {
		if (!ytdl.validateURL(post.url)) {
			throw new Error('Invalid YouTube URL');
		}

		const info = await ytdl.getInfo(post.url);
		const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
		const fileName = `${postTitleScrubbed}.mp4`;
		const audioPath = `${downloadDirectory}/${fileName}.mp3`;
		const videoPath = `${downloadDirectory}/${fileName}.mp4`;

		// Download audio and video streams
		const audio = ytdl(post.url, { filter: 'audioonly' });
		audio.pipe(fs.createWriteStream(audioPath));

		const video = ytdl(post.url, { format });
		video.pipe(fs.createWriteStream(videoPath));

		await Promise.all([
			new Promise((resolve) => audio.on('end', resolve)),
			new Promise((resolve) => video.on('end', resolve)),
		]);

		// Merge with ffmpeg
		await new Promise((resolve, reject) => {
			ffmpeg()
				.input(videoPath)
				.input(audioPath)
				.output(`${downloadDirectory}/${fileName}`)
				.on('end', () => {
					fs.unlinkSync(audioPath);
					fs.unlinkSync(videoPath);
					resolve();
				})
				.on('error', reject)
				.run();
		});

		downloadedPosts.link += 1;
		checkIfDone(post.name);
		return true;
	} catch (error) {
		log(
			`Failed to download ${postTitleScrubbed} from YouTube. Do you have FFMPEG installed? https://ffmpeg.org/`,
			false,
		);
		return false;
	}
}

/**
 * Downloads a link post (creates HTML redirect or downloads YouTube video)
 */
async function downloadLinkPost(post, postTitleScrubbed) {
	if (!config.download_link_posts) {
		log(`Skipping link post with title: ${post.title}`, true);
		downloadedPosts.skipped_due_to_fileType += 1;
		return checkIfDone(post.name);
	}

	const toDownload = await shouldWeDownload(
		post.subreddit,
		`${postTitleScrubbed}.html`,
	);

	if (!toDownload) {
		downloadedPosts.skipped_due_to_duplicate += 1;
		return checkIfDone(post.name);
	}

	// Try YouTube download if enabled and applicable
	if (
		post.domain.includes('youtu') &&
		config.download_youtube_videos_experimental
	) {
		const success = await downloadYouTubeVideo(post, postTitleScrubbed);
		if (success) return;
	}

	// Create HTML redirect file
	const htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;
	await fsp.writeFile(
		`${downloadDirectory}/${postTitleScrubbed}.html`,
		htmlFile,
	);
	downloadedPosts.link += 1;
	checkIfDone(post.name);
}

/**
 * Main function to download a post based on its type
 */
async function downloadPost(post) {
	const postTypeOptions = ['self', 'media', 'link', 'poll', 'gallery'];
	const postType = getPostType(post, postTypeOptions);
	const postTitleScrubbed = getFileName(post);

	switch (postType) {
		case 4: // Gallery
			return downloadGalleryPost(post, postTitleScrubbed);

		case 0: // Self/text post
			return downloadSelfPost(post, postTitleScrubbed);

		case 1: // Media (image/video)
			return downloadMediaPost(post, postTitleScrubbed);

		case 2: // Link
			return downloadLinkPost(post, postTitleScrubbed);

		case 3: // Poll (unsupported)
			log(`Skipping poll post: ${post.title}`, true);
			downloadedPosts.skipped_due_to_fileType += 1;
			return checkIfDone(post.name);

		default:
			if (post.url === undefined) {
				log(`Failed to download: ${post.title} - no URL`, true);
			} else {
				log(`Failed to download: ${post.title} with URL: ${post.url}`, true);
			}
			downloadedPosts.failed += 1;
			return checkIfDone(post.name);
	}
}

function downloadNextSubreddit() {
	if (currentSubredditIndex > subredditList.length) {
		checkIfDone('', true);
	} else {
		currentSubredditIndex += 1;
		downloadSubredditPosts(subredditList[currentSubredditIndex]);
	}
}

function shouldWeDownload(subreddit, postTitleWithPrefixAndExtension) {
	if (
		config.redownload_posts === true ||
		config.redownload_posts === undefined
	) {
		if (config.redownload_posts === undefined) {
			log(
				chalk.red(
					"ALERT: Please note that the 'redownload_posts' option is now available in user_config. See the default JSON for example usage.",
				),
				true,
			);
		}
		return true;
	} else {
		// Check if the post in the subreddit folder already exists.
		// If it does, we don't need to download it again.
		let postExists = fs.existsSync(
			`${downloadDirectory}/${postTitleWithPrefixAndExtension}`,
		);
		return !postExists;
	}
}

// checkIfDone is called frequently to see if we have downloaded the number of posts
// that the user requested to download.
// We could check this inline but it's easier to read if it's a separate function,
// and this ensures that we only check after the files are done being downloaded to the PC, not
// just when the request is sent.
function checkIfDone(lastPostId, override) {
	// If we are downloading from a post list, simply ignore this function.
	if (config.download_post_list_options.enabled) {
		if (numberOfPostsRemaining()[0] > 0) {
			// Still downloading from post list
			log(
				`Still downloading posts from ${chalk.cyan(
					subredditList[currentSubredditIndex],
				)}... (${numberOfPostsRemaining()[1]}/all)`,
				false,
			);
		} else {
			// Done downloading from post list
			log(`Finished downloading posts from download_post_list.txt`, false);
			downloadedPosts = {
				subreddit: '',
				self: 0,
				media: 0,
				link: 0,
				failed: 0,
				skipped_due_to_duplicate: 0,
				skipped_due_to_fileType: 0,
			};
			if (config.download_post_list_options.repeatForever) {
				log(
					`⏲️ Waiting ${
						config.download_post_list_options.timeBetweenRuns / 1000
					} seconds before rerunning...`,
					false,
				);
				setTimeout(function () {
					startTime = new Date();
					downloadFromPostListFile();
				}, timeBetweenRuns);
			}
		}
	} else if (
		(lastAPICallForSubreddit &&
			lastPostId ===
				currentAPICall.data.children[responseSize - 1].data.name) ||
		numberOfPostsRemaining()[0] === 0 ||
		override ||
		(numberOfPostsRemaining()[1] === responseSize &&
			responseSize < MAX_POSTS_PER_REQUEST)
	) {
		let endTime = new Date();
		let timeDiff = endTime - startTime;
		timeDiff /= 1000;
		let msPerPost = (timeDiff / numberOfPostsRemaining()[1])
			.toString()
			.substring(0, 5);
		const [remaining, downloaded] = numberOfPostsRemaining();
		const total = numberOfPosts >= ALL_POSTS ? 'all' : numberOfPosts;
		log(
			`Still downloading posts from ${chalk.cyan(
				subredditList[currentSubredditIndex],
			)}... (${downloaded}/${total})`,
			false,
		);
		if (numberOfPostsRemaining()[0] === 0) {
			log('Validating that all posts were downloaded...', false);
			setTimeout(() => {
				log(
					'🎉 All done downloading posts from ' +
						subredditList[currentSubredditIndex] +
						'!',
					false,
				);

				log(JSON.stringify(downloadedPosts), true);
				if (currentSubredditIndex === subredditList.length - 1) {
					log(
						`\n📈 Downloading took ${timeDiff} seconds, at about ${msPerPost} seconds/post`,
						false,
					);
				}

				// default values for next run (important if being run multiple times)
				downloadedPosts = {
					subreddit: '',
					self: 0,
					media: 0,
					link: 0,
					failed: 0,
					skipped_due_to_duplicate: 0,
					skipped_due_to_fileType: 0,
				};

				if (currentSubredditIndex < subredditList.length - 1) {
					downloadNextSubreddit();
				} else if (repeatForever) {
					currentSubredditIndex = 0;
					log(
						`⏲️ Waiting ${timeBetweenRuns / 1000} seconds before rerunning...`,
						false,
					);
					setTimeout(function () {
						downloadSubredditPosts(subredditList[0], '');
						startTime = new Date();
					}, timeBetweenRuns);
				} else {
					startPrompt();
				}
				return true;
			}, 1000);
		}
	} else {
		const [remaining, downloaded] = numberOfPostsRemaining();
		const total = numberOfPosts >= ALL_POSTS ? 'all' : numberOfPosts;
		log(
			`Still downloading posts from ${chalk.cyan(
				subredditList[currentSubredditIndex],
			)}... (${downloaded}/${total})`,
			false,
		);

		for (let i = 0; i < Object.keys(downloadedPosts).length; i++) {
			log(
				`\t- ${Object.keys(downloadedPosts)[i]}: ${
					Object.values(downloadedPosts)[i]
				}`,
				true,
			);
		}
		log('\n', true);

		if (numberOfPostsRemaining()[1] % MAX_POSTS_PER_REQUEST === 0) {
			return downloadSubredditPosts(
				subredditList[currentSubredditIndex],
				lastPostId,
			);
		}
		return false;
	}
}

function getFileName(post) {
	let fileName = '';
	if (
		config.file_naming_scheme.showDate ||
		config.file_naming_scheme.showDate === undefined
	) {
		let timestamp = post.created;
		const date = new Date(timestamp * 1000);
		var year = date.getFullYear();
		var month = (date.getMonth() + 1).toString().padStart(2, '0');
		var day = date.getDate().toString().padStart(2, '0');
		fileName += `${year}-${month}-${day}`;
	}
	if (
		config.file_naming_scheme.showScore ||
		config.file_naming_scheme.showScore === undefined
	) {
		fileName += `_score=${post.score}`;
	}
	if (
		config.file_naming_scheme.showSubreddit ||
		config.file_naming_scheme.showSubreddit === undefined
	) {
		fileName += `_${post.subreddit}`;
	}
	if (
		config.file_naming_scheme.showAuthor ||
		config.file_naming_scheme.showAuthor === undefined
	) {
		fileName += `_${post.author}`;
	}
	if (
		config.file_naming_scheme.showTitle ||
		config.file_naming_scheme.showTitle === undefined
	) {
		let title = sanitizeFileName(post.title);
		fileName += `_${title}`;
	}

	// remove special chars from name
	fileName = fileName.replace(/(?:\r\n|\r|\n|\t)/g, '');

	fileName = fileName.replace(/\ufe0e/g, '');
	fileName = fileName.replace(/\ufe0f/g, '');

	// The max length for most systems is about 255. To give some wiggle room, we use 240
	if (fileName.length > MAX_FILENAME_LENGTH) {
		fileName = fileName.substring(0, MAX_FILENAME_LENGTH);
	}

	return fileName;
}

function numberOfPostsRemaining() {
	let total =
		downloadedPosts.self +
		downloadedPosts.media +
		downloadedPosts.link +
		downloadedPosts.failed +
		downloadedPosts.skipped_due_to_duplicate +
		downloadedPosts.skipped_due_to_fileType;
	return [numberOfPosts - total, total];
}

function log(message, detailed) {
	// This function takes a message string and a boolean.
	// If the boolean is true, the message will be logged to the console, otherwise it
	// will only be logged to the log file.
	userLogs += message + '\r\n';
	let visibleToUser = true;
	if (detailed) {
		visibleToUser = config.detailed_logs;
	}

	if (visibleToUser) {
		console.log(message);
	}
	if (config.local_logs && subredditList.length > 0) {
		if (!fs.existsSync('./logs')) {
			fs.mkdirSync('./logs');
		}

		let logFileName = '';
		if (config.local_logs_naming_scheme.showDateAndTime) {
			logFileName += `${date_string} - `;
		}
		if (config.local_logs_naming_scheme.showSubreddits) {
			let subredditListString = JSON.stringify(subredditList).replace(
				/[^a-zA-Z0-9,]/g,
				'',
			);
			logFileName += `${subredditListString} - `;
		}
		if (config.local_logs_naming_scheme.showNumberOfPosts) {
			if (numberOfPosts >= ALL_POSTS) {
				logFileName += `ALL - `;
			} else {
				logFileName += `${numberOfPosts} - `;
			}
		}

		if (logFileName.endsWith(' - ')) {
			logFileName = logFileName.substring(0, logFileName.length - 3);
		}

		fsp
			.writeFile(`./logs/${logFileName}.${logFormat}`, userLogs)
			.catch((err) => {
				console.error('Failed to write log file:', err);
			});
	}
}

// sanitize function for file names so that they work on Mac, Windows, and Linux
function sanitizeFileName(fileName) {
	return fileName
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/([^/])\/([^/])/g, '$1_$2');
}
