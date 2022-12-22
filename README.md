# reddit_post_downloader
A NodeJS-based Reddit post downloader utilizing only the public Reddit API

## Setup
After cloning the repo, and installing NodeJS, you must install all of the node modules. `cd` into the repo and type the command below. 

`npm i`

Then, you are ready to go! Type either of the commands below to start it up. 

`node index.js` or `npm run start`

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



