/**
 * Logging functionality
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const chalk = require('chalk');

const { ALL_POSTS } = require('./utils');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
const LOG_FORMAT = 'txt';

// Internal log buffer
let userLogs = '';

/**
 * Create logger instance with configuration
 * @param {Object} config - User configuration
 * @returns {Object} - Logger object
 */
function createLogger(config) {
	userLogs = '';

	const date = new Date();
	const dateString = `${date.getFullYear()} ${
		date.getMonth() + 1
	} ${date.getDate()} at ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

	/**
	 * Log a message with optional file logging
	 * @param {string} message - Message to log
	 * @param {boolean} detailed - If true, only show in console if detailed_logs is enabled
	 * @param {string[]} subredditList - Current subreddit list for log filename
	 * @param {number} numberOfPosts - Number of posts for log filename
	 */
	function log(message, detailed = false, subredditList = [], numberOfPosts = 0) {
		userLogs += message + '\r\n';

		const visibleToUser = !detailed || config.detailed_logs;

		if (visibleToUser) {
			console.log(message);
		}

		if (config.local_logs && subredditList.length > 0) {
			writeLogFile(subredditList, numberOfPosts, dateString);
		}
	}

	/**
	 * Write accumulated logs to file
	 */
	async function writeLogFile(subredditList, numberOfPosts, dateString) {
		if (!fs.existsSync(LOGS_DIR)) {
			fs.mkdirSync(LOGS_DIR);
		}

		let logFileName = '';

		if (config.local_logs_naming_scheme.showDateAndTime) {
			logFileName += `${dateString} - `;
		}

		if (config.local_logs_naming_scheme.showSubreddits) {
			const subredditListString = JSON.stringify(subredditList).replace(
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

		try {
			await fsp.writeFile(`${LOGS_DIR}/${logFileName}.${LOG_FORMAT}`, userLogs);
		} catch (err) {
			console.error('Failed to write log file:', err);
		}
	}

	/**
	 * Log welcome messages
	 */
	function logWelcome() {
		console.clear();
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
	}

	/**
	 * Log configuration validation results
	 * @param {Object} validation - { valid, warnings, errors }
	 */
	function logValidation(validation) {
		for (const warning of validation.warnings) {
			log(chalk.red('WARNING: ' + warning), false);
		}
		for (const error of validation.errors) {
			log(chalk.red('ALERT: ' + error), false);
		}
	}

	/**
	 * Log version information
	 * @param {string} currentVersion - Current app version
	 * @param {string} latestVersion - Latest available version
	 */
	function logVersionInfo(currentVersion, latestVersion) {
		if (currentVersion !== latestVersion) {
			log(
				`Hey! A new version (${latestVersion}) is available. \nConsider updating to the latest version with 'git pull'.\n`,
				false,
			);
		} else {
			log('You are on the latest stable version (' + currentVersion + ')\n', true);
		}
	}

	return {
		log,
		logWelcome,
		logValidation,
		logVersionInfo,
		chalk,
	};
}

module.exports = {
	createLogger,
	LOGS_DIR,
};

