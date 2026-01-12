/**
 * Utility functions for Reddit Post Downloader
 * Extracted for testability
 */

const MAX_POSTS_PER_REQUEST = 100;
const MAX_FILENAME_LENGTH = 240;
const ALL_POSTS = Number.MAX_SAFE_INTEGER;
const DEFAULT_REQUEST_TIMEOUT = 30000;
const MEDIA_FORMATS = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];

/**
 * Sanitize a filename to work on Mac, Windows, and Linux
 * @param {string} fileName - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFileName(fileName) {
	return fileName
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/([^/])\/([^/])/g, '$1_$2');
}

/**
 * Generate a filename for a post based on config settings
 * @param {Object} post - Reddit post object
 * @param {Object} config - User config object
 * @returns {string} - Generated filename
 */
function getFileName(post, config) {
	let fileName = '';

	if (
		config.file_naming_scheme.showDate ||
		config.file_naming_scheme.showDate === undefined
	) {
		const timestamp = post.created;
		const date = new Date(timestamp * 1000);
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
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
		const title = sanitizeFileName(post.title);
		fileName += `_${title}`;
	}

	fileName = fileName.replace(/(?:\r\n|\r|\n|\t)/g, '');
	fileName = fileName.replace(/\ufe0e/g, '');
	fileName = fileName.replace(/\ufe0f/g, '');

	if (fileName.length > MAX_FILENAME_LENGTH) {
		fileName = fileName.substring(0, MAX_FILENAME_LENGTH);
	}

	return fileName;
}

/**
 * Determine the type of a Reddit post
 * @param {Object} post - Reddit post object
 * @returns {number} - Post type (0=self, 1=media, 2=link, 3=poll, 4=gallery)
 */
function getPostType(post) {
	if (post.post_hint === 'self' || post.is_self) {
		return 0;
	}

	if (
		post.post_hint === 'image' ||
		(post.post_hint === 'rich:video' && !post.domain.includes('youtu')) ||
		post.post_hint === 'hosted:video' ||
		(post.post_hint === 'link' &&
			post.domain.includes('imgur') &&
			!post.url_overridden_by_dest?.includes('gallery')) ||
		post.domain.includes('i.redd.it') ||
		post.domain.includes('i.reddituploads.com')
	) {
		return 1;
	}

	if (post.poll_data !== undefined) {
		return 3;
	}

	if (post.domain.includes('reddit.com') && post.is_gallery) {
		return 4;
	}

	return 2;
}

/**
 * Get the post type name from type number
 * @param {number} typeNum - Post type number
 * @returns {string} - Post type name
 */
function getPostTypeName(typeNum) {
	const types = ['self', 'media', 'link', 'poll', 'gallery'];
	return types[typeNum] || 'unknown';
}

/**
 * Determine download URL and file type for media posts
 * @param {Object} post - Reddit post object
 * @returns {Object} - { downloadURL, fileType }
 */
function getMediaDownloadInfo(post) {
	let downloadURL = post.url;
	let fileType = downloadURL.split('.').pop();

	if (post.preview !== undefined) {
		if (post.preview.reddit_video_preview !== undefined) {
			downloadURL = post.preview.reddit_video_preview.fallback_url;
			fileType = 'mp4';
		} else if (post.url_overridden_by_dest?.includes('.gifv')) {
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
 * Check if a target string represents a user profile
 * @param {string} target - Subreddit or user string
 * @returns {boolean}
 */
function isUserProfile(target) {
	return (
		target.includes('u/') || target.includes('user/') || target.includes('/u/')
	);
}

/**
 * Extract the clean name from a subreddit or user string
 * @param {string} target - Subreddit or user string
 * @returns {string} - Clean name
 */
function extractName(target) {
	if (isUserProfile(target)) {
		if (target.includes('user/')) {
			return target.split('user/').pop();
		}
		return target.split('u/').pop();
	}
	return target;
}

/**
 * Build Reddit API URL for fetching posts
 * @param {Object} options - { target, isUser, sorting, time, limit, after }
 * @returns {string} - API URL
 */
function buildRedditApiUrl({
	target,
	isUser,
	sorting,
	time,
	limit,
	after = '',
}) {
	if (isUser) {
		return `https://www.reddit.com/user/${target}/submitted/.json?limit=${limit}&after=${after}`;
	}
	return `https://www.reddit.com/r/${target}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${limit}&after=${after}`;
}

/**
 * Parse post list file content into valid Reddit URLs
 * @param {string} content - File content
 * @returns {string[]} - Array of valid Reddit post URLs
 */
function parsePostListFile(content) {
	return content
		.split('\n')
		.map((line) => line.trim())
		.filter(
			(line) =>
				line &&
				!line.startsWith('#') &&
				line.startsWith('https://www.reddit.com') &&
				line.includes('/comments/'),
		);
}

module.exports = {
	MAX_POSTS_PER_REQUEST,
	MAX_FILENAME_LENGTH,
	ALL_POSTS,
	DEFAULT_REQUEST_TIMEOUT,
	MEDIA_FORMATS,

	sanitizeFileName,
	getFileName,
	getPostType,
	getPostTypeName,
	getMediaDownloadInfo,
	isUserProfile,
	extractName,
	buildRedditApiUrl,
	parsePostListFile,
};
