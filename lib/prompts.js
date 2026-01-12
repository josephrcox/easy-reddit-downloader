/**
 * User prompts/CLI interface
 */

const prompts = require('prompts');

/**
 * Prompt user for download settings
 * @returns {Promise<Object>} - User's answers
 */
async function promptForSettings() {
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
			validate: (value) => (!isNaN(value) ? true : `Please enter a number`),
		},
		{
			type: 'text',
			name: 'sorting',
			message:
				'How would you like to sort? (top, new, hot, rising, controversial)',
			initial: 'top',
			validate: (value) =>
				['top', 'new', 'hot', 'rising', 'controversial'].includes(
					value.toLowerCase(),
				)
					? true
					: `Please enter a valid sorting method`,
		},
		{
			type: 'text',
			name: 'time',
			message: 'During what time period? (hour, day, week, month, year, all)',
			initial: 'month',
			validate: (value) =>
				['hour', 'day', 'week', 'month', 'year', 'all'].includes(
					value.toLowerCase(),
				)
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

	return await prompts(questions);
}

module.exports = {
	promptForSettings,
};

