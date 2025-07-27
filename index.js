const request = require('request');
const { version } = require('./package.json');

// NodeJS Dependencies
const fs = require('fs');
const prompts = require('prompts');
const chalk = require('chalk');
const axios = require('axios');

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

// --- RedGIFs support (new) ---
const REDGIFS_API_BASE = 'https://api.redgifs.com/v2';
let redgifsToken = null;
let redgifsTokenFetchedAt = 0;
const REDGIFS_TOKEN_TTL_MS = 25 * 60 * 1000; // refresh every ~25 minutes to be safe

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
    checkConfig();
} else {
    // create ./user_config.json if it doesn't exist, by duplicating user_config_DEFAULT.json and renaming it
    fs.copyFile('./user_config_DEFAULT.json', './user_config.json', (err) => {
        if (err) throw err;
        log('user_config.json was created. Edit it to manage user options.', true);
        config = require('./user_config.json');
    });
    checkConfig();
}

// check if download_post_list.txt exists, if it doesn't, create it
if (!fs.existsSync('./download_post_list.txt')) {
    fs.writeFile('./download_post_list.txt', '', (err) => {
        if (err) throw err;

        let fileDefaultContent = `# Below, please list any posts that you wish to download. # \n# They must follow this format below: # \n# https://www.reddit.com/r/gadgets/comments/ptt967/eu_proposes_mandatory_usbc_on_all_devices/ # \n# Lines with "#" at the start will be ignored (treated as comments). #`;

        // write a few lines to the file
        fs.appendFile('./download_post_list.txt', fileDefaultContent, (err) => {
            if (err) throw err;
            log('download_post_list.txt was created with default content.', true);
        });
    });
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
request.get(
    'https://api.github.com/repos/josephrcox/easy-reddit-downloader/releases/latest',
    { headers: { 'User-Agent': 'Downloader' } },
    (error, response, body) => {
        if (error) {
            log(error, true);
        } else {
            // Parse the re∏sponse body to get the version number of the latest release
            const latestRelease = JSON.parse(body);
            const latestVersion = latestRelease.tag_name;

            // Compare the current version to the latest release version
            if (version !== latestVersion) {
                log(
                    `Hey! A new version (${latestVersion}) is available. \nConsider updating to the latest version with 'git pull'.\n`,
                    false,
                );
                startScript();
            } else {
                log('You are on the latest stable version (' + version + ')\n', true);
                startScript();
            }
        }
    },
);

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
            type: (prev) => (prev == true ? 'number' : null),
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
        numberOfPosts = 9999999999999999999999;
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

async function downloadSubredditPosts(subreddit, lastPostId) {
    let isUser = false;
    if (
        subreddit.includes('u/') ||
        subreddit.includes('user/') ||
        subreddit.includes('/u/')
    ) {
        isUser = true;
        subreddit = subreddit.split('u/').pop();
        return downloadUser(subreddit, lastPostId);
    }
    let postsRemaining = numberOfPostsRemaining()[0];
    if (postsRemaining <= 0) {
        // If we have downloaded enough posts, move on to the next subreddit
        if (subredditList.length > 1) {
            return downloadNextSubreddit();
        } else {
            // If we have downloaded all the subreddits, end the program
            return checkIfDone('', true);
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
                return downloadNextSubreddit();
            } else {
                return checkIfDone();
            }
        }

        // Use log function to log a string
        // as well as a boolean if the log should be displayed to the user.
        if (isUser) {
            log(
                `\n\n👀 Requesting posts from
				https://www.reddit.com/user/${subreddit.replace(
                    'u/',
                    '',
                )}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}\n`,
                true,
            );
        } else {
            log(
                `\n\n👀 Requesting posts from
			https://www.reddit.com/r/${subreddit}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}\n`,
                true,
            );
        }

        // Get the top posts from the subreddit
        let response = null;
        let data = null;

        try {
            response = await axios.get(
                `https://www.reddit.com/r/${subreddit}/${sorting}/.json?sort=${sorting}&t=${time}&limit=${postsRemaining}&after=${lastPostId}`,
            );

            data = await response.data;

            currentAPICall = data;
            if (data.message == 'Not Found' || data.data.children.length == 0) {
                throw error;
            }
            if (data.data.children.length < postsRemaining) {
                lastAPICallForSubreddit = true;
                postsRemaining = data.data.children.length;
            } else {
                lastAPICallForSubreddit = false;
            }
        } catch (err) {
            log(
                `\n\nERROR: There was a problem fetching posts for ${subreddit}. This is likely because the subreddit is private, banned, or doesn't exist.`,
                true,
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
            downloadDirectory =
                downloadDirectoryBase + `/${data.data.children[0].data.subreddit}`;
        } else {
            downloadDirectory =
                downloadDirectoryBase +
                `/${isOver18}/${data.data.children[0].data.subreddit}`;
        }

        // Make sure the image directory exists
        // If no directory is found, create one
        if (!fs.existsSync(downloadDirectory)) {
            fs.mkdirSync(downloadDirectory);
        }

        responseSize = data.data.children.length;

        for (const child of data.data.children) {
            await sleep();
            try {
                const post = child.data;
                await downloadPost(post); // Make sure to await this as well
            } catch (e) {
                log(e, true);
            }
        }
    } catch (error) {
        // throw the error
        throw error;
    }
}

async function downloadUser(user, currentUserAfter) {
    let lastPostId = currentUserAfter;
    let postsRemaining = numberOfPostsRemaining()[0];
    if (postsRemaining <= 0) {
        // If we have downloaded enough posts, move on to the next subreddit
        if (subredditList.length > 1) {
            return downloadNextSubreddit();
        } else {
            // If we have downloaded all the subreddits, end the program
            return checkIfDone('', true);
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
        if (user == undefined) {
            if (subredditList.length > 1) {
                return downloadNextSubreddit();
            } else {
                return checkIfDone();
            }
        }

        // Use log function to log a string
        // as well as a boolean if the log should be displayed to the user.
        let reqUrl = `https://www.reddit.com/user/${user.replace(
            'u/',
            '',
        )}/submitted/.json?limit=${postsRemaining}&after=${lastPostId}`;
        log(
            `\n\n👀 Requesting posts from
			${reqUrl}\n`,
            false,
        );

        // Get the top posts from the subreddit
        let response = null;
        let data = null;

        try {
            response = await axios.get(`${reqUrl}`);

            data = await response.data;
            currentUserAfter = data.data.after;

            currentAPICall = data;
            if (data.message == 'Not Found' || data.data.children.length == 0) {
                throw error;
            }
            if (data.data.children.length < postsRemaining) {
                lastAPICallForSubreddit = true;
                postsRemaining = data.data.children.length;
            } else {
                lastAPICallForSubreddit = false;
            }
        } catch (err) {
            log(
                `\n\nERROR: There was a problem fetching posts for ${user}. This is likely because the subreddit is private, banned, or doesn't exist.`,
                true,
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

        downloadDirectory =
            downloadDirectoryBase + `/user_${user.replace('u/', '')}`;

        // Make sure the image directory exists
        // If no directory is found, create one
        if (!fs.existsSync(downloadDirectory)) {
            fs.mkdirSync(downloadDirectory);
        }

        responseSize = data.data.children.length;

        for (const child of data.data.children) {
            await sleep();
            try {
                const post = child.data;
                await downloadPost(post); // Make sure to await this as well
            } catch (e) {
                log(e, true);
            }
        }
    } catch (error) {
        // throw the error
        throw error;
    }
}

async function downloadFromPostListFile() {
    // this is called when config.download_from_post_list_file is true
    // this will read the download_post_list.txt file and download all the posts in it
    // downloading skips any lines starting with "#" as they are used for documentation

    // read the file
    let file = fs.readFileSync('./download_post_list.txt', 'utf8');
    // split the file into an array of lines
    let lines = file.split('\n');
    // remove any lines that start with "#"
    lines = lines.filter((line) => !line.startsWith('#'));
    // remove any empty lines
    lines = lines.filter((line) => line != '');
    // remove any lines that are just whitespace
    lines = lines.filter((line) => line.trim() != '');
    // remove any lines that don't start with "https://www.reddit.com"
    lines = lines.filter((line) => line.startsWith('https://www.reddit.com'));
    // remove any lines that don't have "/comments/" in them
    lines = lines.filter((line) => line.includes('/comments/'));
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
    );
    // iterate over the lines and download the posts
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const reqUrl = line + '.json';
        axios.get(reqUrl).then(async (response) => {
            const post = response.data[0].data.children[0].data;
            let isOver18 = post.over_18 ? 'nsfw' : 'clean';
            downloadedPosts.subreddit = post.subreddit;
            makeDirectories();

            if (!config.separate_clean_nsfw) {
                downloadDirectory = downloadDirectoryBase + `/${post.subreddit}`;
            } else {
                downloadDirectory =
                    downloadDirectoryBase + `/${isOver18}/${post.subreddit}`;
            }

            // Make sure the image directory exists
            // If no directory is found, create one
            if (!fs.existsSync(downloadDirectory)) {
                fs.mkdirSync(downloadDirectory);
            }
            downloadPost(post);
        });
        await sleep();
    }
}

// --- RedGIFs helpers (new) ---
function isRedgifsPost(post) {
    try {
        if (!post) return false;
        const fields = [
            post.domain,
            post.url_overridden_by_dest,
            post.url,
            post.permalink,
            (post.media && post.media.oembed && post.media.oembed.html) || '',
            (post.media && post.media.oembed && post.media.oembed.provider_name) || '',
            (post.preview && post.preview.images && post.preview.images[0] && post.preview.images[0].source && post.preview.images[0].source.url) || '',
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return fields.includes('redgifs.com');
    } catch {
        return false;
    }
}

function extractRedgifsIdFromText(text) {
    if (!text) return null;

    // Matches typical forms:
    // https://www.redgifs.com/watch/<id>
    // https://redgifs.com/ifr/<id>
    // https://www.redgifs.com/<id>
    // https://thumbs2.redgifs.com/<id>-mobile.jpg
    // https://i.redgifs.com/<id>.mp4 (rare direct)
    const patterns = [
        /redgifs\.com\/(?:watch|ifr)\/([\w-]+)(?:[/?#].*)?$/i,
        /redgifs\.com\/([\w-]+)(?:[/?#].*)?$/i,
        /thumbs\d*\.redgifs\.com\/([\w-]+)-/i,
        /i\.redgifs\.com\/([\w-]+)\.[a-z0-9]+/i,
        /src=["']https?:\/\/(?:www\.)?redgifs\.com\/(?:ifr|watch)\/([\w-]+)["']/i,
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) return m[1];
    }
    return null;
}

function getRedgifsIdFromPost(post) {
    // Try multiple fields to be robust
    const candidates = [
        post.url_overridden_by_dest,
        post.url,
        post.permalink,
        post.domain,
        post.media && post.media.oembed && post.media.oembed.html,
        post.media && post.media.oembed && post.media.oembed.thumbnail_url,
        post.preview && post.preview.images && post.preview.images[0] && post.preview.images[0].source && post.preview.images[0].source.url,
    ].filter(Boolean);

    for (const c of candidates) {
        const id = extractRedgifsIdFromText(String(c));
        if (id) return id;
    }
    return null;
}

async function getRedgifsToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && redgifsToken && now - redgifsTokenFetchedAt < REDGIFS_TOKEN_TTL_MS) {
        return redgifsToken;
    }
    try {
        const res = await axios.get(`${REDGIFS_API_BASE}/auth/temporary`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'easy-reddit-downloader',
            },
        });
        if (res && res.data && res.data.token) {
            redgifsToken = res.data.token;
            redgifsTokenFetchedAt = Date.now();
            return redgifsToken;
        }
        throw new Error('No token in response');
    } catch (e) {
        throw new Error('Failed to obtain RedGIFs temporary token');
    }
}

async function fetchRedgifsMp4Url(gifId) {
    if (!gifId) throw new Error('Missing RedGIFs ID');
    let token = await getRedgifsToken(false);
    try {
        const res = await axios.get(`${REDGIFS_API_BASE}/gifs/${gifId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'User-Agent': 'easy-reddit-downloader',
            },
        });
        const gif = res && res.data && (res.data.gif || res.data);
        const urls = gif && gif.urls ? gif.urls : null;
        if (urls) {
            // Prefer HD then SD then 'mobile' (sometimes present)
            return urls.hd || urls.sd || urls.mobile || urls.vmobile || urls.nhd || null;
        }
        // Some responses may nest in 'gif' differently; attempt common fallbacks
        if (gif && gif.hdUrl) return gif.hdUrl;
        if (gif && gif.sdUrl) return gif.sdUrl;
        throw new Error('No usable video URL in RedGIFs response');
    } catch (err) {
        // If unauthorized, refresh token once and retry
        if (err.response && err.response.status === 401) {
            token = await getRedgifsToken(true);
            const retry = await axios.get(`${REDGIFS_API_BASE}/gifs/${gifId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'User-Agent': 'easy-reddit-downloader',
                },
            });
            const gif = retry && retry.data && (retry.data.gif || retry.data);
            const urls = gif && gif.urls ? gif.urls : null;
            if (urls) {
                return urls.hd || urls.sd || urls.mobile || urls.vmobile || urls.nhd || null;
            }
        }
        throw err;
    }
}

// ------------------------------------------

function getPostType(post, postTypeOptions) {
    log(`Analyzing post with title: ${post.title}) and URL: ${post.url}`, true);
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
        post.domain.includes('i.reddituploads.com') ||
        // Treat RedGIFs links as media (new)
        (post.post_hint === 'link' && (post.domain && post.domain.includes('redgifs.com')))
    ) {
        postType = 1;
    } else if (post.poll_data != undefined) {
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

async function downloadPost(post) {
    let postTypeOptions = ['self', 'media', 'link', 'poll', 'gallery'];
    let postType = -1; // default to no postType until one is found

    // Determine the type of post. If no type is found, default to link as a last resort.
    // If it accidentally downloads a self or media post as a link, it will still
    // save properly.
    postType = getPostType(post, postTypeOptions);

    // Array of possible (supported) image and video formats
    const imageFormats = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];

    // All posts should have URLs, so just make sure that it does.
    // If the post doesn't have a URL, then it should be skipped.
    if (postType == 4) {
        // Don't download the gallery if we don't want to
        if (!config.download_gallery_posts) {
            log(`Skipping gallery post with title: ${post.title}`, true);
            downloadedPosts.skipped_due_to_fileType += 1;
            return checkIfDone(post.name);
        }

        // The title will be the directory name
        const postTitleScrubbed = getFileName(post);
        let newDownloads = Object.keys(post.media_metadata).length;
        // gallery_data retains the order of the gallery, so we loop over this
        // media_id can be used as the key in media_metadata
        for (const { media_id, id } of post.gallery_data.items) {
            const media = post.media_metadata[media_id];
            // s=highest quality (for some reason), u=URL
            // URL contains &amp; instead of &
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
                    if (checkIfDone(post.name)) {
                        return;
                    }
                }
            } else {
                downloadMediaFile(
                    downloadUrl,
                    `${downloadDirectory}/${filePath}`,
                    post.name,
                );
            }
        }
    } else if (postType != 3 && post.url !== undefined) {
        let downloadURL = post.url;
        // Get the file type of the post via the URL. If it ends in .jpg, then it's a jpg.
        let fileType = downloadURL.split('.').pop();
        // Post titles can be really long and have invalid characters, so we need to clean them up.
        let postTitleScrubbed = sanitizeFileName(post.title);
        postTitleScrubbed = getFileName(post);

        if (postType === 0) {
            // DOWNLOAD A SELF POST
            let toDownload = await shouldWeDownload(
                post.subreddit,
                `${postTitleScrubbed}.txt`,
            );
            if (!toDownload) {
                downloadedPosts.skipped_due_to_duplicate += 1;
                return checkIfDone(post.name);
            } else {
                if (!config.download_self_posts) {
                    log(`Skipping self post with title: ${post.title}`, true);
                    downloadedPosts.skipped_due_to_fileType += 1;
                    return checkIfDone(post.name);
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
                        `${downloadDirectory}/${postTitleScrubbed}.txt`,
                        comments_string,
                        function (err) {
                            if (err) {
                                log(err, true);
                            }
                            downloadedPosts.self += 1;
                            if (checkIfDone(post.name)) {
                                return;
                            }
                        },
                    );
                }
            }
        } else if (postType === 1) {
            // DOWNLOAD A MEDIA POST

            // --- NEW: RedGIFs direct download support ---
            if (config.download_redgifs_videos && isRedgifsPost(post)) {
                try {
                    const gifId = getRedgifsIdFromPost(post);
                    if (gifId) {
                        const redgifsUrl = await fetchRedgifsMp4Url(gifId);
                        if (redgifsUrl) {
                            downloadURL = redgifsUrl;
                            fileType = 'mp4';
                            log(`Resolved RedGIFs ${gifId} -> ${redgifsUrl}`, true);
                        }
                    }
                } catch (e) {
                    log(`RedGIFs resolution failed (${post.url}). Falling back to previews.`, true);
                }
            }

            if (post.preview != undefined && (!config.download_redgifs_videos || !isRedgifsPost(post) || (isRedgifsPost(post) && !downloadURL.includes('redgifs') && !downloadURL.endsWith('.mp4')))) {
                // Reddit stores fallback URL previews for some GIFs.
                // Changing the URL to download to the fallback URL will download the GIF, in MP4 format.
                if (post.preview.reddit_video_preview != undefined) {
                    log(
                        "Using fallback URL for Reddit's GIF preview." +
                        post.preview.reddit_video_preview,
                        true,
                    );
                    downloadURL = post.preview.reddit_video_preview.fallback_url;
                    fileType = 'mp4';
                } else if (post.url_overridden_by_dest && post.url_overridden_by_dest.includes('.gifv')) {
                    // Luckily, you can just swap URLs on imgur with .gifv
                    // with ".mp4" to get the MP4 version. Amazing!
                    log('Replacing gifv with mp4', true);
                    downloadURL = post.url_overridden_by_dest.replace('.gifv', '.mp4');
                    fileType = 'mp4';
                } else if (post.preview && post.preview.images && post.preview.images[0] && post.preview.images[0].source) {
                    let sourceURL = post.preview.images[0].source.url;
                    // set fileType to whatever imageFormat item is in the sourceURL
                    for (let i = 0; i < imageFormats.length; i++) {
                        if (
                            sourceURL.toLowerCase().includes(imageFormats[i].toLowerCase())
                        ) {
                            fileType = imageFormats[i];
                            break;
                        }
                    }
                    downloadURL = sourceURL.replaceAll('&amp;', '&');
                }
            }

            if (post.media != undefined && post.post_hint == 'hosted:video') {
                // If the post has a media object, then it's a video.
                // We need to get the URL from the media object.
                // This is because the URL in the post object is a fallback URL.
                // The media object has the actual URL.
                downloadURL = post.media.reddit_video.fallback_url;
                fileType = 'mp4';
            } else if (
                post.media != undefined &&
                post.post_hint == 'rich:video' &&
                post.media.oembed && post.media.oembed.thumbnail_url != undefined
            ) {
                // If we didn't already resolve RedGIFs, use the thumbnail as a last resort for rich:video (e.g., Gfycat/others)
                if (!(config.download_redgifs_videos && isRedgifsPost(post))) {
                    downloadURL = post.media.oembed.thumbnail_url;
                    fileType = 'gif';
                }
            }
            if (!config.download_media_posts) {
                log(`Skipping media post with title: ${post.title}`, true);
                downloadedPosts.skipped_due_to_fileType += 1;
                return checkIfDone(post.name);
            } else {
                let toDownload = await shouldWeDownload(
                    post.subreddit,
                    `${postTitleScrubbed}.${fileType}`,
                );
                if (!toDownload) {
                    downloadedPosts.skipped_due_to_duplicate += 1;
                    if (checkIfDone(post.name)) {
                        return;
                    }
                } else {
                    downloadMediaFile(
                        downloadURL,
                        `${downloadDirectory}/${postTitleScrubbed}.${fileType}`,
                        post.name,
                    );
                }
            }
        } else if (postType === 2) {
            // LINK POSTS
            // If this is a RedGIFs link and redgifs downloading is enabled, try to download as video instead
            if (config.download_redgifs_videos && isRedgifsPost(post)) {
                try {
                    const gifId = getRedgifsIdFromPost(post);
                    if (gifId) {
                        const redgifsUrl = await fetchRedgifsMp4Url(gifId);
                        if (redgifsUrl) {
                            let toDownload = await shouldWeDownload(
                                post.subreddit,
                                `${postTitleScrubbed}.mp4`,
                            );
                            if (!toDownload) {
                                downloadedPosts.skipped_due_to_duplicate += 1;
                                if (checkIfDone(post.name)) {
                                    return;
                                }
                            } else {
                                await downloadMediaFile(
                                    redgifsUrl,
                                    `${downloadDirectory}/${postTitleScrubbed}.mp4`,
                                    post.name,
                                );
                                // Count this as media since we actually downloaded a video
                                // (downloadMediaFile already increments media)
                                return;
                            }
                        }
                    }
                } catch (e) {
                    log(`RedGIFs link resolution failed (${post.url}). Saving redirect HTML instead.`, true);
                }
            }

            if (!config.download_link_posts) {
                log(`Skipping link post with title: ${post.title}`, true);
                downloadedPosts.skipped_due_to_fileType += 1;
                return checkIfDone(post.name);
            } else {
                let toDownload = await shouldWeDownload(
                    post.subreddit,
                    `${postTitleScrubbed}.html`,
                );
                if (!toDownload) {
                    downloadedPosts.skipped_due_to_duplicate += 1;
                    if (checkIfDone(post.name)) {
                        return;
                    }
                } else {
                    // DOWNLOAD A LINK POST
                    // With link posts, we create a simple HTML file that redirects to the post's URL.
                    // This enables the user to still "open" the link file, and it will redirect to the post.
                    // No comments or other data is stored.

                    if (
                        post.domain.includes('youtu') &&
                        config.download_youtube_videos_experimental
                    ) {
                        log(
                            `Downloading ${postTitleScrubbed} from YouTube... This may take a while...`,
                            false,
                        );
                        let url = post.url;
                        try {
                            // Validate YouTube URL
                            if (!ytdl.validateURL(url)) {
                                throw new Error('Invalid YouTube URL');
                            }

                            // Get video info
                            const info = await ytdl.getInfo(url);
                            log(info, true);

                            // Choose the highest quality format available
                            const format = ytdl.chooseFormat(info.formats, {
                                quality: 'highest',
                            });

                            // Create a filename based on the video title
                            const fileName = `${postTitleScrubbed}.mp4`;

                            // Download audio stream
                            const audio = ytdl(url, { filter: 'audioonly' });
                            const audioPath = `${downloadDirectory}/${fileName}.mp3`;
                            audio.pipe(fs.createWriteStream(audioPath));

                            // Download video stream
                            const video = ytdl(url, { format });
                            const videoPath = `${downloadDirectory}/${fileName}.mp4`;
                            video.pipe(fs.createWriteStream(videoPath));

                            // Wait for both streams to finish downloading
                            await Promise.all([
                                new Promise((resolve) => audio.on('end', resolve)),
                                new Promise((resolve) => video.on('end', resolve)),
                            ]);

                            // Merge audio and video using ffmpeg
                            ffmpeg()
                                .input(videoPath)
                                .input(audioPath)
                                .output(`${downloadDirectory}/${fileName}`)
                                .on('end', () => {
                                    console.log('Download complete');
                                    // Remove temporary audio and video files
                                    fs.unlinkSync(audioPath);
                                    fs.unlinkSync(videoPath);
                                    downloadedPosts.link += 1;
                                    if (checkIfDone(post.name)) {
                                        return;
                                    }
                                })
                                .run();
                        } catch (error) {
                            log(
                                `Failed to download ${postTitleScrubbed} from YouTube. Do you have FFMPEG installed? https://ffmpeg.org/ `,
                                false,
                            );
                            let htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;

                            fs.writeFile(
                                `${downloadDirectory}/${postTitleScrubbed}.html`,
                                htmlFile,
                                function (err) {
                                    if (err) throw err;
                                    downloadedPosts.link += 1;
                                    if (checkIfDone(post.name)) {
                                        return;
                                    }
                                },
                            );
                        }
                    } else {
                        let htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;

                        fs.writeFile(
                            `${downloadDirectory}/${postTitleScrubbed}.html`,
                            htmlFile,
                            function (err) {
                                if (err) throw err;
                                downloadedPosts.link += 1;
                                if (checkIfDone(post.name)) {
                                    return;
                                }
                            },
                        );
                    }
                }
            }
        } else {
            log('Failed to download: ' + post.title + 'with URL: ' + post.url, true);
            downloadedPosts.failed += 1;
            if (checkIfDone(post.name)) {
                return;
            }
        }
    } else {
        log('Failed to download: ' + post.title + 'with URL: ' + post.url, true);
        downloadedPosts.failed += 1;
        if (checkIfDone(post.name)) {
            return;
        }
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

function onErr(err) {
    log(err, true);
    return 1;
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
        (numberOfPostsRemaining()[1] === responseSize && responseSize < 100)
    ) {
        let endTime = new Date();
        let timeDiff = endTime - startTime;
        timeDiff /= 1000;
        let msPerPost = (timeDiff / numberOfPostsRemaining()[1])
            .toString()
            .substring(0, 5);
        if (numberOfPosts >= 99999999999999999999) {
            log(
                `Still downloading posts from ${chalk.cyan(
                    subredditList[currentSubredditIndex],
                )}... (${numberOfPostsRemaining()[1]}/all)`,
                false,
            );
        } else {
            log(
                `Still downloading posts from ${chalk.cyan(
                    subredditList[currentSubredditIndex],
                )}... (${numberOfPostsRemaining()[1]}/${numberOfPosts})`,
                false,
            );
        }
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
        if (numberOfPosts >= 99999999999999999999) {
            log(
                `Still downloading posts from ${chalk.cyan(
                    subredditList[currentSubredditIndex],
                )}... (${numberOfPostsRemaining()[1]}/all)`,
                false,
            );
        } else {
            log(
                `Still downloading posts from ${chalk.cyan(
                    subredditList[currentSubredditIndex],
                )}... (${numberOfPostsRemaining()[1]}/${numberOfPosts})`,
                false,
            );
        }

        for (let i = 0; i < Object.keys(downloadedPosts).length; i++) {
            log(
                `\t- ${Object.keys(downloadedPosts)[i]}: ${
                    Object.values(downloadedPosts)[i]
                }`,
                true,
            );
        }
        log('\n', true);

        if (numberOfPostsRemaining()[1] % 100 == 0) {
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
        var date = new Date(timestamp * 1000);
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

    if (fileName.search(/\ufe0e/g) >= -1) {
        fileName = fileName.replace(/\ufe0e/g, '');
    }

    if (fileName.search(/\ufe0f/g) >= -1) {
        fileName = fileName.replace(/\ufe0f/g, '');
    }

    // The max length for most systems is about 255. To give some wiggle room, I'm doing 240
    if (fileName.length > 240) {
        fileName = fileName.substring(0, 240);
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
            if (numberOfPosts < 999999999999999999) {
                logFileName += `ALL - `;
            } else {
                logFileName += `${numberOfPosts} - `;
            }
        }

        if (logFileName.endsWith(' - ')) {
            logFileName = logFileName.substring(0, logFileName.length - 3);
        }

        fs.writeFile(
            `./logs/${logFileName}.${logFormat}`,
            userLogs,
            function (err) {
                if (err) throw err;
            },
        );
    }
}

// sanitize function for file names so that they work on Mac, Windows, and Linux
function sanitizeFileName(fileName) {
    return fileName
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/([^/])\/([^/])/g, '$1_$2');
}
