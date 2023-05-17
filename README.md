# Easy Reddit Post Downloader
*A NodeJS-based Reddit post downloader utilizing only the public Reddit API, **no OAuth or login required!***

<img width="965" alt="Screenshot 2022-12-22 at 2 51 23 PM" src="https://user-images.githubusercontent.com/73198556/209214987-50813257-5c9a-432a-b882-7f60429fa63a.png">

## Features
1. Downloading of all post types from any public subreddit that you would like. This includes downloading YouTube videos from Reddit posts!
2. No OAuth or login required! 🔓
3. **SUPER FAST** 🏃 with an average speed of 20 posts/second. (your mileage may vary)
4. Downloading of user accounts 🙋‍♂️
5. Ability to run the script indefinitely at your set interval (run daily, hourly, or even every 30 seconds) - Great for catching new posts before they are removed. 
6. Automatic HTML file creation for link posts. 🔗
7. Very few Node dependencies so it's fast to clone and run.
8. Customizable file naming and file structure. 📁
9. View top comments and nested comments in text/self posts, all stored locally on your computer.

## Setup & Usage
1. Clone or download this repo
2. Install NodeJS from https://nodejs.org/en/download/ (if you don't already have it)
3. Install all of the node dependencies. `cd` into the repo and type the command below. 

`npm i`

Then, you are ready to go! Type either of the commands below to start it up. 

`node index.js` or `npm run start`

After the script begins, you will be asked a few questions about what you want to download. Fill out the questions (be careful not to have any typos) and it will download all post types from the subreddit(s) you entered with your sorting options. 

### user_config.json
After the first launch, a file called `user_config.json` will be created for you. You can modify this file at anytime to set your personal preferences. This will not be reset during Git pulls or updates, so it is perfect if you want a very specific setup for a long time. 

If you mess up the user_config.json file, there will always be a default version called `user_config_DEFAULT.json'. This may change in the future to enable more features. 

#### File-naming-scheme
This is the naming scheme for the files that are downloaded. To reduce the chance of duplicate posts and errors, we recommend using the default naming scheme. 

Problems can happen if you just show the author, because if that author writes multiple posts, then it would overwrite the previous posts. Similiar problems can happen if you attempt to only use the post title in subreddits that have a lot of posts with the same names. 

## Post types
### Text/self posts
All self posts are stored as `md` (markdown) files which contain the full title, the author of the post, and the post description. 

It also downloads the parent comments on the post, as well as the top nested comments beneathe that. Here is an example snippet from one post:
```
How would you feel about a feature where if someone upvotes a crosspost, the original post is upvoted automatically? by Ka1-
------------------------------------------------

--COMMENTS--

samoyedboi:
what about subs that crosspost from other subs to mock them?
	>	StoryDrive:
	>	Yeah, I was hoping someone had already commented this. I'd hate to upvote a critique of something I disagree with only for the despicable thing to also get upvoted.



[deleted]:
The karmaceutical companies would be outraged.
	>	TheEnKrypt:
	>	Let's hope Big Karma doesn't hear about this then. We really need to do something about Unidan Shkreli smh.


```

### Media posts
Many media formats are supported including JPG, PNG, JPEG, GIF, GIFv, MP4, and MOV. These are downloaded in their original format, except for GIF and GIFv which are converted in real-time to MP4 format. There is sometimes a slight loss in quality here but its not noticble in my testing, with the added benefit of being able to scrub through the GIF. 

### Link posts
Link posts are saved as HTML files that can be opened in a web browser. The HTML file is basic and immediately redirects the user with Javascript to the webpage of the link. 

For example, if there was a post that went to `https://www.google.com/` then the HTML file contents would be this:

```
<html>
	<body>
		<script type='text/javascript'>
			window.location.href = "https://www.google.com/";
		</script>
	</body>
</html>
```

### YouTube videos
Starting with version v0.3.0, YouTube videos can be downloaded in MP4 format. You must have ffmpeg installed on your computer for this to work, download it here - https://ffmpeg.org/.

You also must set `download_youtube_videos_experimental` to true in your `user_config.json` file. 

## Downloading users
With the release of v0.2.0, I added the ability to download posts from a specific user. 

To download a user, enter the username in this format when asked what subreddits you would like to download:
`u/elonmusk`. So, for example if you would like to download a few subs and also a couple of users, this is what it could look like:
```
Welcome to Reddit Post Downloader! 
Contribute @ https://github.com/josephrcox/easy-reddit-downloader

✔ Which subreddits or users would you like to download? You may submit multiple separated by commas (no spaces). … u/elonmusk,pics,u/spez
```
Note: at this time, comments from a specific user are not supported. If you would like this, please submit an issue with the `enhancement` tag. 

## Downloading from a post list (download specific URLs)
With version v0.2.1, I added the ability to download specific posts from a list of URLs.

To download a list of posts:
1. Enter your post list in `download_post_list.txt` in the root directory of the project. Make sure to follow the format as shown in the first few comment lines of the file. 
2. Go into `user_config.json` and set `download_post_list_options` > `enabled: true`.
3. Run the application as normal.

You may also choose to download these specific posts at a set interval using the `repeatForever` boolean and `timeBetweenRuns` integer in the `download_post_list_options` object in `user_config.json`. Make sure to enter the timeBetweenRuns in milliseconds. 

## FAQ
### Is there any authentication needed? Do I need to login? Do they know that I am downloading all of these posts?
No. This uses the public Reddit API provided by adding `.json` to regular Reddit pages. 
This means no authorization is required and it's easy for anyone with an internet connection to use. 

This also means that besides linking to your IP address, Reddit has no way of knowing that you are downloading all of these posts.

### What post types are supported and should download?
- Any text/self post
- Any image (posted directly on reddit, imgur, or other services)
- Most video or image-video formats (tested with MP4, GIF, GIFV which converts to MP4, MOV). These can fail if they take too long to load, are from a third-party site, or are deleted. 
- Any link post (which generates an HTML file that redirects the user to the link page)

### Do I need to enter the "/r/" or "r/" before a subreddit name?
No.

### Why am I asked how many posts to dig through? What does this number mean?
The higher the number the....
- More posts you will download.
- More data you will use (keep in mind if on a data-limited plan).
- Less subreddits you will download/second.

*Just because you put 1000, you may not get 1000 posts. There are lots of reasons why this can happen, and it should not be treated as a bug. The average "success rate" right now is about 70%. So if you request 1000 posts, you will likely get 700. If you want 1000 or more posts, then it may be wise to request 1500 or so.*

### Is there any tracking with what I download?
No. There is no Google analytics or other tracking that goes into the posts or subreddits that you choose to download. 

### Can this get me banned or restricted from Reddit?
No, but there are no promises or guarantees. This is a public API and is not against any Reddit rules to consume for personal use. 

### Can I run this without NodeJS installed?
No. It is required, and there is no website or web interface for this. 

### Can I run this on my computer?
Any computer that can run NodeJS can run this, although a stable internet connection and room for the posts to download will decrease the chance of random errors. If you face problems, submit an issue!

### Why did you (josephrcox) make this?
In the past, I have wanted to download subreddits for offline consumption. This makes it easy to do so and does not need OAUTH which I found annoying with many other tools. I also just wanted a fun tiny project to work on during vacation so I spent a couple of hours making and refining this. 

## Upcoming features
Please see the issues tab to see upcoming features and vote on what you want the most by commenting! 

## Example log
```
Welcome to Reddit Post Downloader! 
Contribute @ https://github.com/josephrcox/easy-reddit-downloader
ALERT: A new version (v1.1.9) is available. 
Please update to the latest version with 'git pull'.

What subreddit would you like to download? You may submit multiple separated by commas (no spaces).
	 askreddit,pics
How many posts do you want to go through?(more posts = more downloads, but takes longer)
	 10
How would you like to sort? (top, new, hot, rising, controversial)
	 top
What time period? (hour, day, week, month, year, all)
	 all
How often should this be run? 
Manually enter number other than the options below for manual entry, i.e. "500" for every 0.5 second 
1.) one time
2.) every 0.5 minute
3.) every minute
4.) every 5 minutes
5.) every 30 minutes
6.) every hour
7.) every 3 hours
8.) every day
	 1


Requesting posts from 
		https://www.reddit.com/r/askreddit/top/.json?sort=top&t=all&limit=10&after=


Still downloading posts... (1/10)
{"subreddit":"AskReddit","self":1,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (2/10)
{"subreddit":"AskReddit","self":2,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (3/10)
{"subreddit":"AskReddit","self":3,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (4/10)
{"subreddit":"AskReddit","self":4,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (5/10)
{"subreddit":"AskReddit","self":5,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (6/10)
{"subreddit":"AskReddit","self":6,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (7/10)
{"subreddit":"AskReddit","self":7,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (8/10)
{"subreddit":"AskReddit","self":8,"media":0,"link":0,"failed":0}

------------------------------------------------
Still downloading posts... (9/10)
{"subreddit":"AskReddit","self":9,"media":0,"link":0,"failed":0}

------------------------------------------------
🎉 All done downloading posts from AskReddit!
{"subreddit":"AskReddit","self":10,"media":0,"link":0,"failed":0}

📈 Downloading took 3.823 seconds, at about 0.382 seconds/post


Requesting posts from 
		https://www.reddit.com/r/pics/top/.json?sort=top&t=all&limit=10&after=


Still downloading posts... (1/10)
{"subreddit":"pics","self":0,"media":0,"link":1,"failed":0}

------------------------------------------------
Still downloading posts... (2/10)
{"subreddit":"pics","self":0,"media":0,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (3/10)
{"subreddit":"pics","self":0,"media":1,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (4/10)
{"subreddit":"pics","self":0,"media":2,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (5/10)
{"subreddit":"pics","self":0,"media":3,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (6/10)
{"subreddit":"pics","self":0,"media":4,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (7/10)
{"subreddit":"pics","self":0,"media":5,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (8/10)
{"subreddit":"pics","self":0,"media":6,"link":2,"failed":0}

------------------------------------------------
Still downloading posts... (9/10)
{"subreddit":"pics","self":0,"media":7,"link":2,"failed":0}

------------------------------------------------
🎉 All done downloading posts from pics!
{"subreddit":"pics","self":0,"media":8,"link":2,"failed":0}

📈 Downloading took 1.62 seconds, at about 0.162 seconds/post
What subreddit would you like to download? You may submit multiple separated by commas (no spaces).

```
