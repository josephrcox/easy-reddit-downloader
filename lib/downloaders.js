/**
 * Post downloading logic by type
 */

const fs = require('fs');
const fsp = fs.promises;
const axios = require('axios');

const {
	DEFAULT_REQUEST_TIMEOUT,
	MEDIA_FORMATS,
	getFileName,
	getPostType,
	getPostTypeName,
	getMediaDownloadInfo,
} = require('./utils');

let ytdl, ffmpeg;
try {
	ytdl = require('ytdl-core');
	ffmpeg = require('fluent-ffmpeg');
} catch (e) {
	// YouTube download dependencies not available
}

const POST_DELAY_MS = 250;

/**
 * Create downloaders with config and state
 * @param {Object} config - User configuration
 * @param {Object} state - State manager
 * @param {Function} log - Logging function
 * @param {Function} onProgress - Callback called after each post completes (receives postName)
 * @returns {Object} - Downloader functions
 */
function createDownloaders(config, state, log, onProgress = () => {}) {
	function sleep() {
		return new Promise((resolve) => setTimeout(resolve, POST_DELAY_MS));
	}

	/**
	 * Check if a post should be downloaded (not a duplicate)
	 * @param {string} subreddit - Subreddit name
	 * @param {string} fileName - File name with extension
	 * @returns {boolean}
	 */
	function shouldWeDownload(subreddit, fileName) {
		if (config.redownload_posts === true || config.redownload_posts === undefined) {
			if (config.redownload_posts === undefined) {
				log(
					"ALERT: Please note that the 'redownload_posts' option is now available in user_config. See the default JSON for example usage.",
					true,
				);
			}
			return true;
		}

		const postExists = fs.existsSync(`${state.downloadDirectory}/${fileName}`);
		return !postExists;
	}

	/**
	 * Download a media file from URL
	 * @param {string} downloadURL - URL to download
	 * @param {string} filePath - Local file path
	 * @param {string} postName - Post identifier
	 */
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
					state.downloadedPosts.media += 1;
					resolve();
				});

				response.data.on('error', (error) => {
					reject(error);
				});
			});
		} catch (error) {
			state.downloadedPosts.failed += 1;
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

	/**
	 * Download a gallery post (multiple images)
	 */
	async function downloadGalleryPost(post, postTitleScrubbed) {
		if (!config.download_gallery_posts) {
			log(`Skipping gallery post with title: ${post.title}`, true);
			state.downloadedPosts.skipped_due_to_fileType += 1;
			onProgress(post.name);
			return;
		}

		let newDownloads = Object.keys(post.media_metadata).length;

		for (const { media_id, id } of post.gallery_data.items) {
			const media = post.media_metadata[media_id];
			const downloadUrl = media['s']['u'].replaceAll('&amp;', '&');
			const shortUrl = downloadUrl.split('?')[0];
			const fileType = shortUrl.split('.').pop();

			const postDirectory = `${state.downloadDirectory}/${postTitleScrubbed}`;
			if (!fs.existsSync(postDirectory)) {
				fs.mkdirSync(postDirectory);
			}

			const filePath = `${postTitleScrubbed}/${id}.${fileType}`;
			const toDownload = shouldWeDownload(post.subreddit, filePath);

			if (!toDownload) {
				if (--newDownloads === 0) {
					state.downloadedPosts.skipped_due_to_duplicate += 1;
					onProgress(post.name);
					return;
				}
			} else {
				await downloadMediaFile(
					downloadUrl,
					`${state.downloadDirectory}/${filePath}`,
					post.name,
				);
			}
		}
		onProgress(post.name);
	}

	/**
	 * Download a self/text post with optional comments
	 */
	async function downloadSelfPost(post, postTitleScrubbed) {
		const toDownload = shouldWeDownload(post.subreddit, `${postTitleScrubbed}.txt`);

		if (!toDownload) {
			state.downloadedPosts.skipped_due_to_duplicate += 1;
			onProgress(post.name);
			return;
		}

		if (!config.download_self_posts) {
			log(`Skipping self post with title: ${post.title}`, true);
			state.downloadedPosts.skipped_due_to_fileType += 1;
			onProgress(post.name);
			return;
		}

		let postData;
		try {
			const postResponse = await axios.get(`${post.url}.json`, {
				timeout: DEFAULT_REQUEST_TIMEOUT,
			});
			postData = postResponse.data;
		} catch (error) {
			log(`Failed to fetch post data: ${post.url}`, true);
			onProgress(post.name);
			return;
		}

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
			await fsp.writeFile(`${state.downloadDirectory}/${postTitleScrubbed}.txt`, content);
			state.downloadedPosts.self += 1;
		} catch (err) {
			log(err, true);
		}
		onProgress(post.name);
	}

	/**
	 * Download a media post (image/video)
	 */
	async function downloadMediaPost(post, postTitleScrubbed) {
		if (!config.download_media_posts) {
			log(`Skipping media post with title: ${post.title}`, true);
			state.downloadedPosts.skipped_due_to_fileType += 1;
			onProgress(post.name);
			return;
		}

		const { downloadURL, fileType } = getMediaDownloadInfo(post);
		const toDownload = shouldWeDownload(post.subreddit, `${postTitleScrubbed}.${fileType}`);

		if (!toDownload) {
			state.downloadedPosts.skipped_due_to_duplicate += 1;
			onProgress(post.name);
			return;
		}

		await downloadMediaFile(
			downloadURL,
			`${state.downloadDirectory}/${postTitleScrubbed}.${fileType}`,
			post.name,
		);
		onProgress(post.name);
	}

	/**
	 * Download a YouTube video with audio using ffmpeg
	 */
	async function downloadYouTubeVideo(post, postTitleScrubbed) {
		if (!ytdl || !ffmpeg) {
			log('YouTube download dependencies not available', true);
			return false;
		}

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
			const audioPath = `${state.downloadDirectory}/${fileName}.mp3`;
			const videoPath = `${state.downloadDirectory}/${fileName}.mp4`;

			// Download audio and video streams
			const audio = ytdl(post.url, { filter: 'audioonly' });
			audio.pipe(fs.createWriteStream(audioPath));

			const video = ytdl(post.url, { format });
			video.pipe(fs.createWriteStream(videoPath));

			await Promise.all([
				new Promise((resolve) => audio.on('end', resolve)),
				new Promise((resolve) => video.on('end', resolve)),
			]);

			await new Promise((resolve, reject) => {
				ffmpeg()
					.input(videoPath)
					.input(audioPath)
					.output(`${state.downloadDirectory}/${fileName}`)
					.on('end', () => {
						fs.unlinkSync(audioPath);
						fs.unlinkSync(videoPath);
						resolve();
					})
					.on('error', reject)
					.run();
			});

			state.downloadedPosts.link += 1;
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
	 * Download a link post (creates HTML redirect or downloads YouTube video)
	 */
	async function downloadLinkPost(post, postTitleScrubbed) {
		if (!config.download_link_posts) {
			log(`Skipping link post with title: ${post.title}`, true);
			state.downloadedPosts.skipped_due_to_fileType += 1;
			onProgress(post.name);
			return;
		}

		const toDownload = shouldWeDownload(post.subreddit, `${postTitleScrubbed}.html`);

		if (!toDownload) {
			state.downloadedPosts.skipped_due_to_duplicate += 1;
			onProgress(post.name);
			return;
		}

		if (post.domain.includes('youtu') && config.download_youtube_videos_experimental) {
			const success = await downloadYouTubeVideo(post, postTitleScrubbed);
			if (success) {
				onProgress(post.name);
				return;
			}
		}

		const htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;
		await fsp.writeFile(`${state.downloadDirectory}/${postTitleScrubbed}.html`, htmlFile);
		state.downloadedPosts.link += 1;
		onProgress(post.name);
	}

	/**
	 * Main function to download a post based on its type
	 * @param {Object} post - Reddit post data
	 */
	async function downloadPost(post) {
		const postType = getPostType(post);
		const postTitleScrubbed = getFileName(post, config);

		log(
			`Analyzing post with title: ${post.title}) and URL: ${post.url}`,
			true,
		);
		log(
			`Post has type: ${getPostTypeName(postType)} due to their post hint: ${post.post_hint} and domain: ${post.domain}`,
			true,
		);

		switch (postType) {
			case 4:
				return downloadGalleryPost(post, postTitleScrubbed);

			case 0:
				return downloadSelfPost(post, postTitleScrubbed);

			case 1:
				return downloadMediaPost(post, postTitleScrubbed);

			case 2:
				return downloadLinkPost(post, postTitleScrubbed);

			case 3:
				log(`Skipping poll post: ${post.title}`, true);
				state.downloadedPosts.skipped_due_to_fileType += 1;
				onProgress(post.name);
				return;

			default:
				if (post.url === undefined) {
					log(`Failed to download: ${post.title} - no URL`, true);
				} else {
					log(`Failed to download: ${post.title} with URL: ${post.url}`, true);
				}
				state.downloadedPosts.failed += 1;
				onProgress(post.name);
				return;
		}
	}

	return {
		sleep,
		shouldWeDownload,
		downloadMediaFile,
		downloadGalleryPost,
		downloadSelfPost,
		downloadMediaPost,
		downloadYouTubeVideo,
		downloadLinkPost,
		downloadPost,
	};
}

module.exports = {
	createDownloaders,
	POST_DELAY_MS,
};

