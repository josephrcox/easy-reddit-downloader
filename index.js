const request = require('request');
const { version } = require('./package.json');

// NodeJS Dependencies
const fs = require('fs');
const prompt = require('prompt');
var colors = require('@colors/colors/safe');
const chalk = require('chalk');
const axios = require('axios');

let config = require('./user_config_DEFAULT.json');

// Read the user_config.json file for user configuration options
if (fs.existsSync('./user_config.json')) {
	config = require('./user_config.json');
} else {
	// create ./user_config.json if it doesn't exist, by duplicating user_config_DEFAULT.json and renaming it
	fs.copyFile('./user_config_DEFAULT.json', './user_config.json', (err) => {
		if (err) throw err;
		log('user_config.json was created. Edit it to manage user options.', true);
		config = require('./user_config.json');
	});
}

// Variables used for logging
let userLogs = '';
const logFormat = 'txt';
let date = new Date();
let date_string = `${date.getFullYear()} ${date.getMonth()} ${date.getDate()} at ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
let startTime = null;

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

// Default object to track the downloaded posts by type,
// and the subreddit downloading from.
let downloadedPosts = {
	subreddit: '',
	self: 0,
	media: 0,
	link: 0,
	failed: 0,
};

// Repeat intervals in milliseconds if the user choses to repeat forever
const repeatIntervals = {
	1: 0,
	2: 1000 * 30, // 30 seconds
	3: 1000 * 60, // 1 minute
	4: 1000 * 60 * 5, // 5 minutes
	5: 1000 * 60 * 30, // 30 minutes
	6: 1000 * 60 * 60, // 1 hour
	7: 1000 * 60 * 60 * 3, // 3 hours
	8: 1000 * 60 * 60 * 24, // 24 hours
};

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
	downloadSubredditPosts(subredditList[0], ''); // skip the prompt and get right to the API calls
}

// Start actions
console.clear(); // Clear the console
log(chalk.cyan('Welcome to Reddit Post Downloader! '), true);
log(
	chalk.red(
		'Contribute @ https://github.com/josephrcox/easy-reddit-downloader'
	),
	true
);
// For debugging logs
log('User config: ' + JSON.stringify(config), false);
if (config.testingMode) {
	log('Testing mode options: ' + JSON.stringify(config.testingMode), false);
}

// Make a GET request to the GitHub API to get the latest release
request.get(
	'https://api.github.com/repos/josephrcox/easy-reddit-downloader/releases/latest',
	{ headers: { 'User-Agent': 'Downloader' } },
	(error, response, body) => {
		if (error) {
			console.error(error);
		} else {
			// Parse the response body to get the version number of the latest release
			const latestRelease = JSON.parse(body);
			const latestVersion = latestRelease.tag_name;

			// Compare the current version to the latest release version
			if (version !== latestVersion) {
				log(
					`ALERT: A new version (${latestVersion}) is available. \nPlease update to the latest version with 'git pull'.\n`,
					true
				);
			} else {
				log('You are on the latest stable version (' + version + ')\n', true);
			}
			// Only ask the prompt questions if testingMode is disabled.
			// If testingMode is enabled, the script will run with the preset values written at the top.
			if (!testingMode) {
				startPrompt();
			}
		}
	}
);

function startPrompt() {
	prompt.start();
	prompt.message = ''; // remove the default prompt message
	prompt.delimiter = ''; // removes the delimter between the prompt and the input ("prompt: ")

	// On first exec, this will always run.
	// But if repeatForever is set to true (by the user) then this will
	// run again after the timeBetweenRuns interval
	if (!repeatForever) {
		prompt.get(
			{
				properties: {
					subreddit: {
						description: colors.magenta(
							'What subreddit would you like to download?' +
								' You may submit multiple separated by commas (no spaces).\n\t'
						),
					},
					post_count: {
						description: colors.blue(
							'How many posts do you want to go through?' +
								'(more posts = more downloads, but takes longer)\n\t'
						),
					},
					sorting: {
						description: colors.yellow(
							'How would you like to sort? (top, new, hot, rising, controversial)\n\t'
						),
					},
					time: {
						description: colors.green(
							'What time period? (hour, day, week, month, year, all)\n\t'
						),
					},
					repeat: {
						description: colors.red(
							'How often should this be run? \nManually enter number other than the options below for manual entry, i.e. "500" for every 0.5 second \n' +
								'1.) one time\n' +
								'2.) every 0.5 minute\n' +
								'3.) every minute\n' +
								'4.) every 5 minutes\n' +
								'5.) every 30 minutes\n' +
								'6.) every hour\n' +
								'7.) every 3 hours\n' +
								'8.) every day\n\t'
						),
					},
				},
			},
			function (err, result) {
				if (err) {
					return onErr(err);
				}
				subredditList = result.subreddit.split(','); // the user enters subreddits separated by commas
				// clean up the subreddit list in case the user puts in invalid chars
				for (let i = 0; i < subredditList.length; i++) {
					subredditList[i] = subredditList[i].replace(/\s/g, '');
				}
				numberOfPosts = result.post_count;
				sorting = result.sorting.replace(/\s/g, '');
				time = result.time.replace(/\s/g, '');
				repeatForever = true;
				if (result.repeat == 1) {
					repeatForever = false;
				}
				if (result.repeat < 1 || result.repeat > 8) {
					if (result.repeat < 0) {
						result.repeat = 0;
					}
					timeBetweenRuns = result.repeat;
				} else {
					timeBetweenRuns = repeatIntervals[result.repeat] || 0;
				}

				// With the data gathered, call the APIs and download the posts
				downloadSubredditPosts(subredditList[0], '');
			}
		);
	}
}

function makeDirectories() {
	// Make needed directories for downloads,
	// clean and nsfw are made nomatter the subreddits downloaded
	if (!fs.existsSync('./downloads')) {
		fs.mkdirSync('./downloads');
	}
	if (config.separate_clean_nsfw) {
		if (!fs.existsSync('./downloads/clean')) {
			fs.mkdirSync('./downloads/clean');
		}
		if (!fs.existsSync('./downloads/nsfw')) {
			fs.mkdirSync('./downloads/nsfw');
		}
	}
}

async function downloadSubredditPosts(subreddit, lastPostId) {
	let postsRemaining = numberOfPostsRemaining()[0];
	if (postsRemaining <= 0) {
		// If we have downloaded enough posts, move on to the next subreddit
		if (subredditList.length > 1) {
			return downloadNextSubreddit();
		} else {
			// If we have downloaded all the subreddits, end the program
			return checkIfDone();
		}
		return;
	} else if (postsRemaining > 100) {
		// If we have more posts to download than the limit of 100, set it to 100
		postsRemaining = 100;
	}

	// if lastPostId is undefined, set it to an empty string. Common on first run.
	if (lastPostId == undefined) {
		lastPostId = '';
	}
	makeDirectories();

	try {
		if (subreddit == undefined) {
			if (subredditList.length > 1) {
				if (currentSubredditIndex > subredditList.length - 1) {
					currentSubredditIndex = -1;
				}
				return downloadNextSubreddit();
			} else {
				return checkIfDone();
			}
		}
		startTime = new Date();

		// Use log function to log a string
		// as well as a boolean if the log should be displayed to the user.
		log(
			`\n\nRequesting posts from
		https://www.reddit.com/r/${subreddit}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}\n\n`,
			true
		);
		// Get the top posts from the subreddit
		let response = null;
		let data = null;

		try {
			response = await axios.get(
				`https://www.reddit.com/r/${subreddit}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}`
			);
			data = await response.data;
			if (data.message == 'Not Found' || data.data.children.length == 0) {
				throw error;
			}
		} catch (err) {
			log(
				`\n\nERROR: There was a problem fetching posts for ${subreddit}. This is likely because the subreddit is private, banned, or doesn't exist.`
			);
			if (subredditList.length > 1) {
				if (currentSubredditIndex > subredditList.length - 1) {
					currentSubredditIndex = -1;
				}
				currentSubredditIndex += 1;
				return downloadSubredditPosts(subredditList[currentSubredditIndex], '');
			} else {
				return checkIfDone('', true);
			}
		}

		// if the first post on the subreddit is NSFW, then there is a fair chance
		// that the rest of the posts are NSFW.
		let isOver18 = data.data.children[0].data.over_18 ? 'nsfw' : 'clean';
		downloadedPosts.subreddit = data.data.children[0].data.subreddit;

		if (!config.separate_clean_nsfw) {
			downloadDirectory = `./downloads/${data.data.children[0].data.subreddit}`;
		} else {
			downloadDirectory = `./downloads/${isOver18}/${data.data.children[0].data.subreddit}`;
		}

		// Make sure the image directory exists
		// If no directory is found, create one
		if (!fs.existsSync(downloadDirectory)) {
			fs.mkdirSync(downloadDirectory);
		}

		responseSize = data.data.children.length;

		await data.data.children.forEach(async (child, i) => {
			try {
				const post = child.data;

				downloadPost(post);
			} catch (e) {
				log(e, true);
			}
		});
	} catch (error) {
		// throw the error
		throw error;
	}
}

function getPostType(post, postTypeOptions) {
	log(`Analyzing post with title: ${post.title}) and URL: ${post.url}`, false);
	if (post.post_hint === 'self' || post.is_self) {
		postType = 0;
	} else if (
		post.post_hint === 'image' ||
		((post.post_hint === 'rich:video') && !post.domain.includes("youtu")) ||
		post.post_hint === 'hosted:video' ||
		(post.post_hint === 'link' && post.domain.includes('imgur') && !post.domain.includes("gallery")) ||
		post.domain.includes('i.redd.it')
	) {
		postType = 1;
	} else {
		postType = 2;
	}
	log(
		`Post has type: ${postTypeOptions[postType]} due to their post hint: ${post.post_hint} and domain: ${post.domain}`,
		false
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
				false
			);
		} else {
			log('ERROR: ' + error, false);
		}
	}
}

async function downloadPost(post) {
	let postTypeOptions = ['self', 'media', 'link']; // 0 = self, 1 = media, 2 = link
	let postType = -1; // default to no postType until one is found

	// Determine the type of post. If no type is found, default to link as a last resort.
	// If it accidentally downloads a self or media post as a link, it will still
	// save properly.
	postType = getPostType(post, postTypeOptions);

	// All posts should have URLs, so just make sure that it does.
	// If the post doesn't have a URL, then it should be skipped.
	if (post.url) {
		// Array of possible (supported) image and video formats
		const imageFormats = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];

		let downloadURL = post.url;
		// Get the file type of the post via the URL. If it ends in .jpg, then it's a jpg.
		let fileType = downloadURL.split('.').pop();
		// Post titles can be really long and have invalid characters, so we need to clean them up.
		let postTitleScrubbed = sanitizeFileName(post.title);

		if (postType === 0) {
			if (!config.download_self_posts) {
				log(`Skipping self post with title: ${post.title}`, false);
			} else {
				// DOWNLOAD A SELF POST
				let comments_string = '';
				let postResponse = null;
				let data = null;
				try {
					postResponse = await axios.get(`${post.url}.json`);
					data = postResponse.data;
				} catch (error) {
					log(`Axios failure with ${post.url}`, true);
					return checkIfDone(post.name);
				}

				// With text/self posts, we want to download the top comments as well.
				// This is done by requesting the post's JSON data, and then iterating through each comment.
				// We also iterate through the top nested comments (only one level deep).
				// So we have a file output with the post title, the post text, the author, and the top comments.

				comments_string += post.title + ' by ' + post.author + '\n\n';
				comments_string += post.selftext + '\n';
				comments_string +=
					'------------------------------------------------\n\n';
				if (config.download_comments) {
					// If the user wants to download comments
					comments_string += '--COMMENTS--\n\n';
					data[1].data.children.forEach((child) => {
						const comment = child.data;
						comments_string += comment.author + ':\n';
						comments_string += comment.body + '\n';
						if (comment.replies) {
							const top_reply = comment.replies.data.children[0].data;
							comments_string += '\t>\t' + top_reply.author + ':\n';
							comments_string += '\t>\t' + top_reply.body + '\n';
						}
						comments_string += '\n\n\n';
					});
				}

				fs.writeFile(
					`${downloadDirectory}/SELF -${postTitleScrubbed}.txt`,
					comments_string,
					function (err) {
						if (err) {
							log(err);
						}
						downloadedPosts.self += 1;
						if (checkIfDone(post.name)) {
							return;
						}
					}
				);
			}
		} else if (postType === 1) {
			// DOWNLOAD A MEDIA POST
			if (post.preview != undefined) {
				// Reddit stores fallback URL previews for some GIFs.
				// Changing the URL to download to the fallback URL will download the GIF, in MP4 format.
				if (post.preview.reddit_video_preview != undefined) {
					log("Using fallback URL for Reddit's GIF preview." + post.preview.reddit_video_preview)
					downloadURL = post.preview.reddit_video_preview.fallback_url;
					fileType = 'mp4';
				} else if (post.url_overridden_by_dest.includes('.gifv')) {
					// Luckily, you can just swap URLs on imgur with .gifv
					// with ".mp4" to get the MP4 version. Amazing!
					log("Replacing gifv with mp4")
					downloadURL = post.url_overridden_by_dest.replace('.gifv', '.mp4');
					fileType = 'mp4';
				}
			} 
			if (post.media != undefined && post.post_hint == "hosted:video") { 
				// If the post has a media object, then it's a video.
				// We need to get the URL from the media object.
				// This is because the URL in the post object is a fallback URL.
				// The media object has the actual URL.
				downloadURL = post.media.reddit_video.fallback_url;
				fileType = 'mp4';
			} else if (post.media != undefined && post.post_hint == "rich:video" && post.media.oembed.thumbnail_url != undefined) {
				// Common for gfycat links
				downloadURL = post.media.oembed.thumbnail_url;
				fileType = 'gif';
			}
			if (!config.download_media_posts) {
				log(`Skipping media post with title: ${post.title}`, false);
			} else {
				downloadMediaFile(
					downloadURL,
					`${downloadDirectory}/MEDIA - ${postTitleScrubbed}.${fileType}`,
					post.name
				);
			}
		} else if (postType === 2) {
			if (!config.download_link_posts) {
				log(`Skipping link post with title: ${post.title}`, false);
			} else {
				// DOWNLOAD A LINK POST
				// With link posts, we create a simple HTML file that redirects to the post's URL.
				// This enables the user to still "open" the link file, and it will redirect to the post.
				// No comments or other data is stored.
				let htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;

				fs.writeFile(
					`${downloadDirectory}/LINK - ${postTitleScrubbed}.html`,
					htmlFile,
					function (err) {
						if (err) throw err;
						downloadedPosts.link += 1;
						if (checkIfDone(post.name)) {
							return;
						}
					}
				);
			}
		} else {
			log('Failed to download: ' + post.title + 'with URL: ' + post.url);
			downloadedPosts.failed += 1;
			if (checkIfDone(post.name)) {
				return;
			}
		}
	} else {
		log(
			`FAILURE: No URL found for post with title: ${post.title} from subreddit ${post.subreddit}`,
			false
		);
	}
}

function downloadNextSubreddit() {
	currentSubredditIndex += 1;
	downloadSubredditPosts(subredditList[currentSubredditIndex]);
}

function onErr(err) {
	log(err, false);
	return 1;
}

// checkIfDone is called frequently to see if we have downloaded the number of posts
// that the user requested to download.
// We could check this inline but it's easier to read if it's a separate function,
// and this ensures that we only check after the files are done being downloaded to the PC, not
// just when the request is sent.
function checkIfDone(lastPostId, override) {
	// Add up all downloaded/failed posts that have been downloaded so far, and check if it matches the
	// number requested.

	if (
		numberOfPostsRemaining()[0] === 0 ||
		override ||
		(numberOfPostsRemaining()[1] === responseSize && responseSize < 100)
	) {
		// All done downloading posts from this subreddit
		let endTime = new Date();
		let timeDiff = endTime - startTime;
		timeDiff /= 1000;
		// simplify to first 5 digits for msPerPost
		let msPerPost = (timeDiff / numberOfPostsRemaining()[1])
			.toString()
			.substring(0, 5);

		log(
			'🎉 All done downloading posts from ' + downloadedPosts.subreddit + '!',
			true
		);
		log(JSON.stringify(downloadedPosts), true);
		log(
			`\n📈 Downloading took ${timeDiff} seconds, at about ${msPerPost} seconds/post`,
			true
		);

		// default values for next run (important if being run multiple times)
		downloadedPosts = {
			subreddit: '',
			self: 0,
			media: 0,
			link: 0,
			failed: 0,
		};
		if (currentSubredditIndex < subredditList.length - 1) {
			downloadNextSubreddit();
		} else if (repeatForever) {
			currentSubredditIndex = 0;
			log(
				`⏲️ Waiting ${timeBetweenRuns / 1000} seconds before rerunning...`,
				true
			);
			log('\n------------------------------------------------', true);
			setTimeout(function () {
				downloadSubredditPosts(subredditList[0], '');
			}, timeBetweenRuns);
		} else {
			startPrompt();
		}
		return true;
	} else {
		log(
			`Still downloading posts... (${
				numberOfPostsRemaining()[1]
			}/${numberOfPosts})`,
			true
		);
		log(JSON.stringify(downloadedPosts), true);
		log('\n------------------------------------------------', true);

		// check if total is divisible by 100
		if (numberOfPostsRemaining()[1] % 100 == 0) {
			return downloadSubredditPosts(
				subredditList[currentSubredditIndex],
				lastPostId
			);
		}
		return false;
	}
}

function numberOfPostsRemaining() {
	let total =
		downloadedPosts.self +
		downloadedPosts.media +
		downloadedPosts.link +
		downloadedPosts.failed;
	return [numberOfPosts - total, total];
}

function log(message, visibleToUser) {
	// This function takes a message string and a boolean.
	// If the boolean is true, the message will be logged to the console, otherwise it
	// will only be logged to the log file.
	userLogs += message + '\r\n\n';
	if (visibleToUser || visibleToUser == undefined) {
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
				''
			);
			logFileName += `${subredditListString} - `;
		}
		if (config.local_logs_naming_scheme.showNumberOfPosts) {
			logFileName += `${numberOfPosts} - `;
		}

		if (logFileName.endsWith(' - ')) {
			logFileName = logFileName.substring(0, logFileName.length - 3);
		}

		fs.writeFile(
			`./logs/${logFileName}.${logFormat}`,
			userLogs,
			function (err) {
				if (err) throw err;
			}
		);
	}
}

// sanitize function for file names so that they work on Mac, Windows, and Linux
function sanitizeFileName(fileName) {
	return fileName.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200);
}
