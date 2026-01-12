/**
 * Configuration loading and validation
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'user_config.json');
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'user_config_DEFAULT.json');
const POST_LIST_PATH = path.join(__dirname, '..', 'download_post_list.txt');

/**
 * Load configuration from user_config.json, creating it if it doesn't exist
 * @returns {Object} - Configuration object
 */
function loadConfig() {
	let config;

	if (fs.existsSync(CONFIG_PATH)) {
		config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
	} else {
		fs.copyFileSync(DEFAULT_CONFIG_PATH, CONFIG_PATH);
		config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
		console.log('user_config.json was created. Edit it to manage user options.');
	}

	return config;
}

/**
 * Validate configuration and return warnings/errors
 * @param {Object} config - Configuration object
 * @returns {Object} - { valid: boolean, warnings: string[], errors: string[] }
 */
function validateConfig(config) {
	const warnings = [];
	const errors = [];

	const namingScheme = config.file_naming_scheme || {};
	const activeCount =
		(namingScheme.showDate === true ? 1 : 0) +
		(namingScheme.showAuthor === true ? 1 : 0) +
		(namingScheme.showTitle === true ? 1 : 0);

	if (activeCount === 0) {
		errors.push(
			'Your file naming scheme (user_config.json) does not have any options set. ' +
				'You cannot download posts without filenames.',
		);
	} else if (activeCount < 2) {
		warnings.push(
			'Your file naming scheme (user_config.json) is poorly set, we recommend changing it.',
		);
	}

	if (errors.length > 0 || warnings.length > 0) {
		warnings.push(
			'Read about recommended naming schemes here - ' +
				'https://github.com/josephrcox/easy-reddit-downloader/blob/main/README.md#File-naming-scheme',
		);
	}

	return {
		valid: errors.length === 0,
		warnings,
		errors,
	};
}

/**
 * Ensure download_post_list.txt exists with default content
 */
function ensurePostListFile() {
	if (!fs.existsSync(POST_LIST_PATH)) {
		const defaultContent = `# Below, please list any posts that you wish to download. #
# They must follow this format below: #
# https://www.reddit.com/r/gadgets/comments/ptt967/eu_proposes_mandatory_usbc_on_all_devices/ #
# Lines with "#" at the start will be ignored (treated as comments). #`;
		fs.writeFileSync(POST_LIST_PATH, defaultContent);
		console.log('download_post_list.txt was created with default content.');
	}
}

/**
 * Read and parse the post list file
 * @returns {string[]} - Array of valid Reddit post URLs
 */
function readPostListFile() {
	const content = fs.readFileSync(POST_LIST_PATH, 'utf8');
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
	CONFIG_PATH,
	DEFAULT_CONFIG_PATH,
	POST_LIST_PATH,
	loadConfig,
	validateConfig,
	ensurePostListFile,
	readPostListFile,
};

