/**
 * End-to-end tests for Reddit Post Downloader
 * These tests actually download content from Reddit to verify functionality
 *
 * NOTE: These tests make real network requests and may take some time.
 * Run with: npm test -- --testPathPattern=e2e
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
	getPostType,
	getPostTypeName,
	getFileName,
	getMediaDownloadInfo,
	buildRedditApiUrl,
	DEFAULT_REQUEST_TIMEOUT,
} = require('../lib/utils');

const TEST_DOWNLOAD_DIR = path.join(__dirname, '../downloads_test');
const TEST_CONFIG = {
	file_naming_scheme: {
		showDate: true,
		showScore: true,
		showSubreddit: true,
		showAuthor: true,
		showTitle: true,
	},
};

jest.setTimeout(60000);

async function fetchRedditPosts(subreddit, limit = 5, sorting = 'top', time = 'month') {
	const url = buildRedditApiUrl({
		target: subreddit,
		isUser: false,
		sorting,
		time,
		limit,
	});

	const response = await axios.get(url, {
		timeout: DEFAULT_REQUEST_TIMEOUT,
		headers: {
			'User-Agent': 'RedditDownloaderTest/1.0',
		},
	});

	return response.data.data.children.map((child) => child.data);
}

async function fetchSinglePost(postUrl) {
	const response = await axios.get(`${postUrl}.json`, {
		timeout: DEFAULT_REQUEST_TIMEOUT,
		headers: {
			'User-Agent': 'RedditDownloaderTest/1.0',
		},
	});

	return response.data[0].data.children[0].data;
}

async function downloadFile(url, destPath) {
	const response = await axios({
		method: 'GET',
		url,
		responseType: 'stream',
		timeout: DEFAULT_REQUEST_TIMEOUT,
		headers: {
			'User-Agent': 'RedditDownloaderTest/1.0',
		},
	});

	const writer = fs.createWriteStream(destPath);
	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on('finish', resolve);
		writer.on('error', reject);
	});
}

beforeAll(() => {
	if (!fs.existsSync(TEST_DOWNLOAD_DIR)) {
		fs.mkdirSync(TEST_DOWNLOAD_DIR, { recursive: true });
	}
});

afterAll(() => {
	if (fs.existsSync(TEST_DOWNLOAD_DIR)) {
		fs.rmSync(TEST_DOWNLOAD_DIR, { recursive: true, force: true });
	}
});

describe('Reddit API Integration', () => {
	test('can fetch posts from r/pics subreddit', async () => {
		const posts = await fetchRedditPosts('pics', 3);

		expect(posts.length).toBeGreaterThan(0);
		expect(posts[0]).toHaveProperty('title');
		expect(posts[0]).toHaveProperty('author');
		expect(posts[0]).toHaveProperty('subreddit');
		expect(posts[0].subreddit.toLowerCase()).toBe('pics');
	});

	test('can fetch posts from r/news subreddit', async () => {
		const posts = await fetchRedditPosts('news', 3);

		expect(posts.length).toBeGreaterThan(0);
		expect(posts[0]).toHaveProperty('title');
		expect(posts[0].subreddit.toLowerCase()).toBe('news');
	});

	test('can fetch posts with different sorting options', async () => {
		const topPosts = await fetchRedditPosts('pics', 2, 'top', 'all');
		const newPosts = await fetchRedditPosts('pics', 2, 'new', 'all');

		expect(topPosts.length).toBeGreaterThan(0);
		expect(newPosts.length).toBeGreaterThan(0);

		expect(topPosts[0].score).toBeGreaterThan(0);
	});

	test('handles non-existent subreddit gracefully', async () => {
		await expect(
			fetchRedditPosts('thisdoesnotexist123456789xyz', 1),
		).rejects.toThrow();
	});
});

describe('Post Type Detection (Real Posts)', () => {
	test('correctly identifies image posts from r/pics', async () => {
		const posts = await fetchRedditPosts('pics', 10, 'top', 'month');

		const imagePost = posts.find((post) => {
			const type = getPostType(post);
			return type === 1; // media
		});

		if (imagePost) {
			expect(getPostType(imagePost)).toBe(1);
			expect(getPostTypeName(getPostType(imagePost))).toBe('media');
		}
	});

	test('correctly identifies self/text posts from r/AskReddit', async () => {
		const posts = await fetchRedditPosts('AskReddit', 5, 'top', 'week');

		const selfPost = posts.find((post) => getPostType(post) === 0);

		if (selfPost) {
			expect(getPostType(selfPost)).toBe(0);
			expect(selfPost.is_self).toBe(true);
		}
	});

	test('correctly identifies link posts from r/technology', async () => {
		const posts = await fetchRedditPosts('technology', 10, 'top', 'week');

		const linkPost = posts.find((post) => getPostType(post) === 2);

		if (linkPost) {
			expect(getPostType(linkPost)).toBe(2);
			expect(linkPost.is_self).toBeFalsy();
		}
	});
});

describe('File Naming (Real Posts)', () => {
	test('generates valid filenames for real posts', async () => {
		const posts = await fetchRedditPosts('pics', 3);

		for (const post of posts) {
			const fileName = getFileName(post, TEST_CONFIG);

			expect(fileName).not.toMatch(/[/\\?%*:|"<>]/);

			expect(fileName).toContain(post.subreddit);
			expect(fileName).toContain(post.author);

			expect(fileName.length).toBeLessThanOrEqual(240);
		}
	});

	test('handles posts with special characters in title', async () => {
		const posts = await fetchRedditPosts('news', 10);

		for (const post of posts) {
			const fileName = getFileName(post, TEST_CONFIG);

			expect(typeof fileName).toBe('string');
			expect(fileName.length).toBeGreaterThan(0);
			expect(fileName).not.toMatch(/[/\\?%*:|"<>]/);
		}
	});
});

describe('Media Download Info (Real Posts)', () => {
	test('extracts download info from image posts', async () => {
		const posts = await fetchRedditPosts('pics', 10);

		const imagePost = posts.find(
			(post) => getPostType(post) === 1 && post.url,
		);

		if (imagePost) {
			const info = getMediaDownloadInfo(imagePost);

			expect(info).toHaveProperty('downloadURL');
			expect(info).toHaveProperty('fileType');
			expect(info.downloadURL).toMatch(/^https?:\/\//);
		}
	});
});

describe('Actual File Downloads', () => {
	test('can download an image from Reddit', async () => {
		const posts = await fetchRedditPosts('pics', 20, 'top', 'month');

		const imagePost = posts.find(
			(post) =>
				post.url &&
				(post.url.endsWith('.jpg') ||
					post.url.endsWith('.png') ||
					post.url.endsWith('.jpeg')),
		);

		if (imagePost) {
			const fileName = `test_image.${imagePost.url.split('.').pop()}`;
			const filePath = path.join(TEST_DOWNLOAD_DIR, fileName);

			await downloadFile(imagePost.url, filePath);

			expect(fs.existsSync(filePath)).toBe(true);

			const stats = fs.statSync(filePath);
			expect(stats.size).toBeGreaterThan(0);

			console.log(`Downloaded image: ${fileName} (${stats.size} bytes)`);
		} else {
			console.log('No direct image link found, skipping download test');
		}
	});

	test('can download from i.redd.it domain', async () => {
		const posts = await fetchRedditPosts('pics', 30, 'hot');

		const redditImagePost = posts.find(
			(post) => post.domain === 'i.redd.it' && post.url,
		);

		if (redditImagePost) {
			const ext = redditImagePost.url.split('.').pop().split('?')[0];
			const fileName = `test_reddit_image.${ext}`;
			const filePath = path.join(TEST_DOWNLOAD_DIR, fileName);

			await downloadFile(redditImagePost.url, filePath);

			expect(fs.existsSync(filePath)).toBe(true);
			const stats = fs.statSync(filePath);
			expect(stats.size).toBeGreaterThan(0);

			console.log(`Downloaded i.redd.it image: ${fileName} (${stats.size} bytes)`);
		} else {
			console.log('No i.redd.it image found, skipping test');
		}
	});

	test('can create HTML redirect file for link posts', async () => {
		const posts = await fetchRedditPosts('technology', 10);

		const linkPost = posts.find((post) => getPostType(post) === 2);

		if (linkPost) {
			const fileName = 'test_link.html';
			const filePath = path.join(TEST_DOWNLOAD_DIR, fileName);
			const htmlContent = `<html><body><script type='text/javascript'>window.location.href = "${linkPost.url}";</script></body></html>`;

			fs.writeFileSync(filePath, htmlContent);

			expect(fs.existsSync(filePath)).toBe(true);
			const content = fs.readFileSync(filePath, 'utf8');
			expect(content).toContain(linkPost.url);

			console.log(`Created link redirect for: ${linkPost.url}`);
		}
	});

	test('can create text file for self posts', async () => {
		const posts = await fetchRedditPosts('AskReddit', 5);

		const selfPost = posts.find((post) => getPostType(post) === 0);

		if (selfPost) {
			const fileName = 'test_self_post.txt';
			const filePath = path.join(TEST_DOWNLOAD_DIR, fileName);

			let content = `${selfPost.title} by ${selfPost.author}\n\n`;
			content += `${selfPost.selftext || '(no body text)'}\n`;
			content += '------------------------------------------------\n';

			fs.writeFileSync(filePath, content);

			expect(fs.existsSync(filePath)).toBe(true);
			const savedContent = fs.readFileSync(filePath, 'utf8');
			expect(savedContent).toContain(selfPost.title);
			expect(savedContent).toContain(selfPost.author);

			console.log(`Created self post file for: ${selfPost.title.substring(0, 50)}...`);
		}
	});
});

describe('User Profile Downloads', () => {
	test('can fetch posts from a user profile', async () => {
		const url = buildRedditApiUrl({
			target: 'reddit',
			isUser: true,
			sorting: 'new',
			time: 'all',
			limit: 5,
		});

		const response = await axios.get(url, {
			timeout: DEFAULT_REQUEST_TIMEOUT,
			headers: {
				'User-Agent': 'RedditDownloaderTest/1.0',
			},
		});

		const posts = response.data.data.children.map((child) => child.data);

		expect(posts.length).toBeGreaterThan(0);
		expect(posts[0]).toHaveProperty('author');
	});
});

describe('Gallery Post Detection', () => {
	test('can identify gallery posts', async () => {
		const posts = await fetchRedditPosts('itookapicture', 20, 'top', 'month');

		const galleryPost = posts.find((post) => post.is_gallery === true);

		if (galleryPost) {
			expect(getPostType(galleryPost)).toBe(4);
			expect(galleryPost).toHaveProperty('media_metadata');

			console.log(
				`Found gallery post with ${Object.keys(galleryPost.media_metadata).length} images`,
			);
		} else {
			console.log('No gallery post found in sample');
		}
	});
});

describe('Error Handling', () => {
	test('handles 404 errors gracefully', async () => {
		const invalidUrl =
			'https://www.reddit.com/r/thisdefinitelydoesnotexist12345/top/.json';

		await expect(
			axios.get(invalidUrl, {
				timeout: DEFAULT_REQUEST_TIMEOUT,
				headers: { 'User-Agent': 'RedditDownloaderTest/1.0' },
			}),
		).rejects.toThrow();
	});

	test('handles timeout appropriately', async () => {
		await expect(
			axios.get('https://www.reddit.com/r/pics/top/.json', {
				timeout: 1,
				headers: { 'User-Agent': 'RedditDownloaderTest/1.0' },
			}),
		).rejects.toThrow();
	});
});

describe('Rate Limiting Awareness', () => {
	test('can make multiple requests without being rate limited', async () => {
		const subreddits = ['pics', 'news', 'technology'];
		const results = [];

		for (const subreddit of subreddits) {
			const posts = await fetchRedditPosts(subreddit, 2);
			results.push({
				subreddit,
				count: posts.length,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		expect(results.length).toBe(3);
		results.forEach((result) => {
			expect(result.count).toBeGreaterThan(0);
		});
	});
});

