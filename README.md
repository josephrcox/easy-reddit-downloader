# reddit-downloaded by mapleweekend
*A NodeJS-based Reddit post downloader utilizing only the public Reddit API.*

## Setup
After cloning the repo, and installing NodeJS, you must install all of the node modules. `cd` into the repo and type the command below. 

`npm i`

Then, you are ready to go! Type either of the commands below to start it up. 

`node index.js` or `npm run start`

## Example log
```
Welcome to Reddit Post Downloader by Mapleweekend!
What subreddit would you like to download? You may submit multiple separated by commas (no spaces).
         askreddit,news
How many posts do you want to go through? (more posts = more downloads, but takes longer)
         15
How would you like to sort? (top, new, hot, rising, controversial)
         top
What time period? (hour, day, week, month, year, all)
         all
How often should this be run? 
1.) one time
2.) every 30 seconds
3.) every minute
4.) every 5 minutes
5.) every 30 minutes
6.) every hour
7.) every 3 hours
8.) every day
         1
Requesting posts from https://www.reddit.com/r/askreddit/top.json?sort=top&t=all&limit=15
Requesting posts from https://www.reddit.com/r/news/top.json?sort=top&t=all&limit=15
Still downloading posts... (1/15)
{"self":0,"media":0,"link":1,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (2/15)
{"self":0,"media":0,"link":2,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (3/15)
{"self":0,"media":0,"link":3,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (4/15)
{"self":0,"media":0,"link":4,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (5/15)
{"self":0,"media":0,"link":5,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (6/15)
{"self":0,"media":0,"link":6,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (7/15)
{"self":0,"media":0,"link":7,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (8/15)
{"self":0,"media":0,"link":8,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (9/15)
{"self":0,"media":0,"link":9,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (10/15)
{"self":0,"media":0,"link":10,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (11/15)
{"self":0,"media":0,"link":11,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (12/15)
{"self":0,"media":0,"link":12,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (13/15)
{"self":0,"media":0,"link":13,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (14/15)
{"self":0,"media":0,"link":14,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (15/15)
{"self":0,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (16/15)
{"self":1,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (17/15)
{"self":2,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (18/15)
{"self":3,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (19/15)
{"self":4,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (20/15)
{"self":5,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (21/15)
{"self":6,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (22/15)
{"self":7,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (23/15)
{"self":8,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (24/15)
{"self":9,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (25/15)
{"self":10,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (26/15)
{"self":11,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (27/15)
{"self":12,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (28/15)
{"self":13,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
Still downloading posts... (29/15)
{"self":14,"media":0,"link":15,"failed":0,"subreddit":"news"}

------------------------------------------------
🎉 All done downloading posts from news!
{"self":15,"media":0,"link":15,"failed":0,"subreddit":"news"}

📈 Downloading took 3.7 seconds, at about 0.123 seconds/post  
```

## FAQ
#### Is there any authentication needed?
No. This uses the public Reddit API provided by adding `.json` to regular Reddit pages. 
This means no oauth is required and it's easy for anyone with an internet connection to use. 

#### What post types are supported and should download?
- Any text/self post
- Any image (posted directly on reddit, imgur, or other services)
- Most video or image-video formats (tested with MP4, GIF, GIFV which converts to MP4, MOV)
- Any link post (which generates an HTML file that redirects the user to the link page)

#### Is there any tracking with what I download?
No. There is no Google analytics or other tracking that goes into the posts or subreddits that you choose to download. 

#### Can this get me banned or restricted from Reddit?
Not sure. I have downloaded a lot and haven't faced problems, but it doesn't mean that Reddit won't ban my IP address in the future with continuous use. 

#### Can I run this without NodeJS installed?
No.

#### Can I run this on my computer?
Any computer that can run NodeJS can run this, although a stable internet connection and room for the posts to download will decrease the chance of random errors. If you face problems, submit an issue!

## Upcoming features
Please see the issues tab to see upcoming features and vote on what you want the most. 



