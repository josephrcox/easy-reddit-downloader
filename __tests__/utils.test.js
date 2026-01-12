/**
 * Unit tests for utility functions
 */

const {
	sanitizeFileName,
	getFileName,
	getPostType,
	getPostTypeName,
	getMediaDownloadInfo,
	isUserProfile,
	extractName,
	buildRedditApiUrl,
	parsePostListFile,
	MAX_FILENAME_LENGTH,
} = require('../lib/utils');

describe('sanitizeFileName', () => {
	test('removes forward slashes', () => {
		expect(sanitizeFileName('hello/world')).toBe('hello-world');
	});

	test('removes backslashes', () => {
		expect(sanitizeFileName('hello\\world')).toBe('hello-world');
	});

	test('removes question marks', () => {
		expect(sanitizeFileName('what?')).toBe('what-');
	});

	test('removes colons', () => {
		expect(sanitizeFileName('time: 12:00')).toBe('time- 12-00');
	});

	test('removes asterisks', () => {
		expect(sanitizeFileName('star*power')).toBe('star-power');
	});

	test('removes angle brackets', () => {
		expect(sanitizeFileName('<html>')).toBe('-html-');
	});

	test('removes pipe characters', () => {
		expect(sanitizeFileName('foo|bar')).toBe('foo-bar');
	});

	test('removes percent signs', () => {
		expect(sanitizeFileName('100%')).toBe('100-');
	});

	test('handles multiple invalid characters', () => {
		expect(sanitizeFileName('test?file:name*here')).toBe('test-file-name-here');
	});

	test('preserves valid characters', () => {
		expect(sanitizeFileName('valid-file_name.txt')).toBe('valid-file_name.txt');
	});
});

describe('getFileName', () => {
	const baseConfig = {
		file_naming_scheme: {
			showDate: true,
			showScore: true,
			showSubreddit: true,
			showAuthor: true,
			showTitle: true,
		},
	};

	const mockPost = {
		created: 1609545600, // 2021-01-02 00:00:00 UTC (avoids timezone edge cases)
		score: 1234,
		subreddit: 'pics',
		author: 'testuser',
		title: 'Test Post Title',
	};

	test('generates filename with all options enabled', () => {
		const result = getFileName(mockPost, baseConfig);
		// Check for date format (year-month-day) - exact date may vary by timezone
		expect(result).toMatch(/202\d-\d{2}-\d{2}/);
		expect(result).toContain('score=1234');
		expect(result).toContain('pics');
		expect(result).toContain('testuser');
		expect(result).toContain('Test Post Title');
	});

	test('respects showDate: false', () => {
		const config = {
			file_naming_scheme: { ...baseConfig.file_naming_scheme, showDate: false },
		};
		const result = getFileName(mockPost, config);
		expect(result).not.toContain('2021');
	});

	test('respects showScore: false', () => {
		const config = {
			file_naming_scheme: { ...baseConfig.file_naming_scheme, showScore: false },
		};
		const result = getFileName(mockPost, config);
		expect(result).not.toContain('score=');
	});

	test('respects showAuthor: false', () => {
		const config = {
			file_naming_scheme: { ...baseConfig.file_naming_scheme, showAuthor: false },
		};
		const result = getFileName(mockPost, config);
		expect(result).not.toContain('testuser');
	});

	test('truncates filenames longer than MAX_FILENAME_LENGTH', () => {
		const longTitlePost = {
			...mockPost,
			title: 'A'.repeat(300),
		};
		const result = getFileName(longTitlePost, baseConfig);
		expect(result.length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH);
	});

	test('removes newlines and tabs from filename', () => {
		const postWithNewlines = {
			...mockPost,
			title: 'Title\nwith\tnewlines\r\n',
		};
		const result = getFileName(postWithNewlines, baseConfig);
		expect(result).not.toContain('\n');
		expect(result).not.toContain('\t');
		expect(result).not.toContain('\r');
	});

	test('sanitizes special characters in title', () => {
		const postWithSpecialChars = {
			...mockPost,
			title: 'What? A <test> file!',
		};
		const result = getFileName(postWithSpecialChars, baseConfig);
		expect(result).not.toContain('?');
		expect(result).not.toContain('<');
		expect(result).not.toContain('>');
	});
});

describe('getPostType', () => {
	test('returns 0 for self posts (is_self)', () => {
		const post = { is_self: true, domain: 'self.test' };
		expect(getPostType(post)).toBe(0);
	});

	test('returns 0 for self posts (post_hint)', () => {
		const post = { post_hint: 'self', domain: 'self.test' };
		expect(getPostType(post)).toBe(0);
	});

	test('returns 1 for image posts', () => {
		const post = { post_hint: 'image', domain: 'i.imgur.com' };
		expect(getPostType(post)).toBe(1);
	});

	test('returns 1 for hosted video posts', () => {
		const post = { post_hint: 'hosted:video', domain: 'v.redd.it' };
		expect(getPostType(post)).toBe(1);
	});

	test('returns 1 for i.redd.it posts', () => {
		const post = { domain: 'i.redd.it', post_hint: 'link' };
		expect(getPostType(post)).toBe(1);
	});

	test('returns 1 for imgur link posts (not gallery)', () => {
		const post = {
			post_hint: 'link',
			domain: 'imgur.com',
			url_overridden_by_dest: 'https://imgur.com/abc123',
		};
		expect(getPostType(post)).toBe(1);
	});

	test('returns 2 for YouTube links (not media)', () => {
		const post = {
			post_hint: 'rich:video',
			domain: 'youtube.com',
		};
		expect(getPostType(post)).toBe(2);
	});

	test('returns 3 for poll posts', () => {
		const post = { poll_data: { options: [] }, domain: 'reddit.com' };
		expect(getPostType(post)).toBe(3);
	});

	test('returns 4 for gallery posts', () => {
		const post = { is_gallery: true, domain: 'reddit.com' };
		expect(getPostType(post)).toBe(4);
	});

	test('returns 2 for regular link posts', () => {
		const post = { post_hint: 'link', domain: 'example.com' };
		expect(getPostType(post)).toBe(2);
	});

	test('defaults to 2 for unknown post types', () => {
		const post = { domain: 'unknown.com' };
		expect(getPostType(post)).toBe(2);
	});
});

describe('getPostTypeName', () => {
	test('returns correct names for each type', () => {
		expect(getPostTypeName(0)).toBe('self');
		expect(getPostTypeName(1)).toBe('media');
		expect(getPostTypeName(2)).toBe('link');
		expect(getPostTypeName(3)).toBe('poll');
		expect(getPostTypeName(4)).toBe('gallery');
	});

	test('returns unknown for invalid type', () => {
		expect(getPostTypeName(99)).toBe('unknown');
	});
});

describe('getMediaDownloadInfo', () => {
	test('extracts file type from URL', () => {
		const post = { url: 'https://example.com/image.jpg' };
		const result = getMediaDownloadInfo(post);
		expect(result.fileType).toBe('jpg');
		expect(result.downloadURL).toBe(post.url);
	});

	test('uses reddit_video_preview fallback URL when available', () => {
		const post = {
			url: 'https://example.com/image.gif',
			preview: {
				reddit_video_preview: {
					fallback_url: 'https://preview.redd.it/video.mp4',
				},
			},
		};
		const result = getMediaDownloadInfo(post);
		expect(result.fileType).toBe('mp4');
		expect(result.downloadURL).toBe('https://preview.redd.it/video.mp4');
	});

	test('converts .gifv to .mp4', () => {
		const post = {
			url: 'https://i.imgur.com/abc.gifv',
			url_overridden_by_dest: 'https://i.imgur.com/abc.gifv',
			preview: { images: [] },
		};
		const result = getMediaDownloadInfo(post);
		expect(result.fileType).toBe('mp4');
		expect(result.downloadURL).toContain('.mp4');
	});

	test('uses reddit_video fallback for hosted videos', () => {
		const post = {
			url: 'https://v.redd.it/abc123',
			post_hint: 'hosted:video',
			media: {
				reddit_video: {
					fallback_url: 'https://v.redd.it/abc123/DASH_720.mp4',
				},
			},
		};
		const result = getMediaDownloadInfo(post);
		expect(result.fileType).toBe('mp4');
		expect(result.downloadURL).toContain('DASH_720.mp4');
	});
});

describe('isUserProfile', () => {
	test('returns true for u/ prefix', () => {
		expect(isUserProfile('u/username')).toBe(true);
	});

	test('returns true for user/ prefix', () => {
		expect(isUserProfile('user/username')).toBe(true);
	});

	test('returns true for /u/ prefix', () => {
		expect(isUserProfile('/u/username')).toBe(true);
	});

	test('returns false for subreddit names', () => {
		expect(isUserProfile('pics')).toBe(false);
		expect(isUserProfile('AskReddit')).toBe(false);
	});
});

describe('extractName', () => {
	test('extracts username from u/ prefix', () => {
		expect(extractName('u/testuser')).toBe('testuser');
	});

	test('extracts username from user/ prefix', () => {
		expect(extractName('user/testuser')).toBe('testuser');
	});

	test('returns subreddit name as-is', () => {
		expect(extractName('pics')).toBe('pics');
		expect(extractName('AskReddit')).toBe('AskReddit');
	});
});

describe('buildRedditApiUrl', () => {
	test('builds subreddit URL correctly', () => {
		const url = buildRedditApiUrl({
			target: 'pics',
			isUser: false,
			sorting: 'top',
			time: 'all',
			limit: 25,
			after: '',
		});
		expect(url).toBe(
			'https://www.reddit.com/r/pics/top/.json?sort=top&t=all&limit=25&after=',
		);
	});

	test('builds user URL correctly', () => {
		const url = buildRedditApiUrl({
			target: 'testuser',
			isUser: true,
			sorting: 'new',
			time: 'month',
			limit: 10,
			after: 't3_abc123',
		});
		expect(url).toBe(
			'https://www.reddit.com/user/testuser/submitted/.json?limit=10&after=t3_abc123',
		);
	});

	test('handles empty after parameter', () => {
		const url = buildRedditApiUrl({
			target: 'test',
			isUser: false,
			sorting: 'new',
			time: 'day',
			limit: 50,
		});
		expect(url).toContain('after=');
	});
});

describe('parsePostListFile', () => {
	test('parses valid Reddit URLs', () => {
		const content = `
https://www.reddit.com/r/pics/comments/abc123/test_post/
https://www.reddit.com/r/news/comments/def456/another_post/
		`;
		const result = parsePostListFile(content);
		expect(result).toHaveLength(2);
		expect(result[0]).toContain('abc123');
		expect(result[1]).toContain('def456');
	});

	test('ignores comment lines', () => {
		const content = `
# This is a comment
https://www.reddit.com/r/pics/comments/abc123/test/
# Another comment
		`;
		const result = parsePostListFile(content);
		expect(result).toHaveLength(1);
	});

	test('ignores empty lines', () => {
		const content = `

https://www.reddit.com/r/pics/comments/abc123/test/

		`;
		const result = parsePostListFile(content);
		expect(result).toHaveLength(1);
	});

	test('ignores non-Reddit URLs', () => {
		const content = `
https://www.reddit.com/r/pics/comments/abc123/test/
https://www.google.com
https://imgur.com/gallery/abc
		`;
		const result = parsePostListFile(content);
		expect(result).toHaveLength(1);
	});

	test('ignores URLs without /comments/', () => {
		const content = `
https://www.reddit.com/r/pics/
https://www.reddit.com/r/pics/comments/abc123/test/
https://www.reddit.com/u/testuser
		`;
		const result = parsePostListFile(content);
		expect(result).toHaveLength(1);
	});

	test('trims whitespace from URLs', () => {
		const content = `   https://www.reddit.com/r/pics/comments/abc123/test/   `;
		const result = parsePostListFile(content);
		expect(result[0]).toBe('https://www.reddit.com/r/pics/comments/abc123/test/');
	});
});

