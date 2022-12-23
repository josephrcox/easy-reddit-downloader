// NodeJS Dependencies: request, fs, prompt, colors, chalk
const request = require('request');
const fs = require('fs');
const prompt = require('prompt');
var colors = require("@colors/colors/safe");
const chalk = require('chalk');

// Variables used for logging
let userLogs = "";
const logFormat = "txt"
let date = new Date();
let date_string = 
  `${date.getFullYear()} ${date.getMonth()} ${date.getDate()} 
  at 
  ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
let startTime = null;

// Start actions
console.clear(); // Clear the console
log(chalk.cyan('Welcome to Reddit Post Downloader!'), true); 
log(chalk.red('Contribute @ https://github.com/mapleweekend/easy-reddit-downloader'), true); 

// User-defined variables, these can be preset with the help of testingMode
let timeBetweenRuns = 0; // in milliseconds, the time between runs. This is only used if repeatForever is true
let subredditList = []; // List of subreddits in this format: ['subreddit1', 'subreddit2', 'subreddit3']
let numberOfPosts = -1; // How many posts to go through, more posts = more downloads, but takes longer
let sorting = "top"; // How to sort the posts (top, new, hot, rising, controversial)
let time = "all";  // What time period to sort by (hour, day, week, month, year, all)
let repeatForever = false; // If true, the program will repeat every timeBetweenRuns milliseconds
let downloadDirectory = ""; // Where to download the files to, defined when 

// Testing Mode for developer testing. This enables you to hardcode 
// the variables above and skip the prompt.
const testingMode = false; 
if (testingMode) {
  subredditList = ['random'];
  numberOfPosts = 10;
  sorting = "top";
  time = "all";
  repeatForever = true;
  timeBetweenRuns = 1000 * 5; // every 5 seconds, 1000 ms = 1 second, 1000 * 5 = 5 seconds
  continueWithData(); // skip the prompt and get right to the API calls
}

// Default object to track the downloaded posts by type,
// and the subreddit downloading from.
let downloadedPosts = { 
  subreddit:"",
  self:0,
  media:0,
  link:0,
  failed:0
}

// Repeat intervals in milliseconds if the user choses to repeat forever
const repeatIntervals = {
  "1": 0,
  "2": 1000 * 30, // 30 seconds
  "3": 1000 * 60, // 1 minute
  "4": 1000 * 60 * 5, // 5 minutes
  "5": 1000 * 60 * 30, // 30 minutes
  "6": 1000 * 60 * 60, // 1 hour
  "7": 1000 * 60 * 60 * 3, // 3 hours
  "8": 1000 * 60 * 60 * 24 // 24 hours
};

function startPrompt() {
  prompt.start();
  prompt.message = ""; // remove the default prompt message
  prompt.delimiter = ""; // removes the delimter between the prompt and the input ("prompt: ")
  
  // On first exec, this will always run. 
  // But if repeatForever is set to true (by the user) then this will 
  // run again after the timeBetweenRuns interval
  if (!repeatForever) {
    prompt.get({
      properties: {
        subreddit: {
          description: colors.magenta(
            "What subreddit would you like to download?" +
            "You may submit multiple separated by commas (no spaces).\n\t"
          )
        },
        post_count: {
          description: colors.blue(
            "How many posts do you want to go through?"+ 
            "(more posts = more downloads, but takes longer)\n\t"
          )
        },
        sorting: {
          description: colors.yellow(
            "How would you like to sort? (top, new, hot, rising, controversial)\n\t"
          )
        },
        time: {
          description: colors.green(
            "What time period? (hour, day, week, month, year, all)\n\t"
          )
        },
        repeat: {
          description: colors.red(
            "How often should this be run? \n" +
            "1.) one time\n" +
            "2.) every 30 seconds\n" +
            "3.) every minute\n" + 
            "4.) every 5 minutes\n" + 
            "5.) every 30 minutes\n" + 
            "6.) every hour\n" + 
            "7.) every 3 hours\n" + 
            "8.) every day\n\t`" 
          )
        }
      }
    }, function (err, result) {
      if (err) {
        return onErr(err); 
      }
      subredditList = result.subreddit.split(','); // the user enters subreddits separated by commas
      // clean up the subreddit list in case the user puts in invalid chars
      for (let i=0;i<subredditList.length;i++) {
        subredditList[i] = subredditList[i].replace(/\s/g, '');
      }
      numberOfPosts = result.post_count;
      sorting = result.sorting.replace(/\s/g, '');
      time = result.time.replace(/\s/g, '');
      repeatForever = true;
      if (result.repeat == 1) {
        repeatForever = false;
      }
      timeBetweenRuns = repeatIntervals[result.repeat] || 0;

      // With the data gathered, call the APIs and download the posts
      continueWithData();
    })
  }
}
  
function continueWithData() {
  // Make needed directories for downloads, 
  // clean and nsfw are made nomatter the subreddits downloaded
  if (!fs.existsSync('./downloads')) {
    fs.mkdirSync('./downloads');
  }
  if (!fs.existsSync('./downloads/clean')) {
    fs.mkdirSync('./downloads/clean');
  }
  if (!fs.existsSync('./downloads/nsfw')) {
    fs.mkdirSync('./downloads/nsfw');
  }


  for (let s=0;s < subredditList.length; s++) {
    startTime = new Date();
    let subreddit = subredditList[s].replace(/\s/g, '');

    // Use log function to log a string 
    // as well as a boolean if the log should be displayed to the user.
    log(
      `Requesting posts from 
      https://www.reddit.com/r/${subreddit}/${sorting}.json?sort=${sorting}&t=${time}&limit=${numberOfPosts}`
    , true)
    // Get the top posts from the subreddit
    request(`https://www.reddit.com/r/${subreddit}/${sorting}.json?sort=${sorting}&t=${time}&limit=${numberOfPosts}`, (error, response, body) => {
      const data = JSON.parse(body);

      // check if there was a problem with the request. 
      // typical if there are no posts for the subreddit, or if the subreddit is private, banned, etc.
      if (error || data.message == "Not Found" || data.data.children.length == 0) {
        log(`There was a problem fetching posts for ${subreddit}. Does it exist?`, true);
        return;
      }
      // if the first post on the subreddit is NSFW, then there is a fair chance 
      // that the rest of the posts are NSFW. 
      let isOver18 = (data.data.children[0].data.over_18) ? "nsfw" : "clean";
      downloadedPosts.subreddit = data.data.children[0].data.subreddit;

      // Iterate through the posts, saving the post being iterated on as "post".
      for (let i = 0; i < data.data.children.length; i++) {
        try {
          const post = data.data.children[i].data;

          downloadDirectory = `./downloads/${isOver18}/${post.subreddit}`;
          // Make sure the image directory exists
          // If no directory is found, create one
          if (!fs.existsSync(downloadDirectory)) {
            fs.mkdirSync(downloadDirectory);
          }
          let postTypeOptions = ['self', 'media', 'link']; // 0 = self, 1 = media, 2 = link
          let postType = -1; // default to no postType until one is found
  
          // Determine the type of post. If no type is found, default to link as a last resort.
          // If it accidentally downloads a self or media post as a link, it will still
          // save properly. 
          if (post.post_hint === "self" || post.is_self) {postType = 0;}
          else if (post.post_hint === "image" || post.post_hint === "rich:video" 
            || post.post_hint === "hosted:video") {postType = 1;}
          else {postType = 2;}

          log(`Analyzing post with title: ${post.title}) and URL: ${post.url}`, false)
          log(`Post has type: ${postTypeOptions[postType]}`, false)
  
          // All posts should have URLs, so just make sure that it does. 
          // If the post doesn't have a URL, then it should be skipped.
          if (post.url) {
            // Array of possible (supported) image and video formats
            const imageFormats = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];
  
            let downloadURL = post.url;
            // Get the file type of the post via the URL. If it ends in .jpg, then it's a jpg.
            let fileType = downloadURL.split('.').pop();
            // Post titles can be really long and have invalid characters, so we need to clean them up.
            let postTitleScrubbed = post.title.replace(/@"^[\w\-. ]+$/, '_').replace(/\//g, '_').substring(0, 80);

            // Only run for media posts
            if (post.preview != undefined && postType === 1) {
              // Reddit stores fallback URL previews for some GIFs.
              // Changing the URL to download to the fallback URL will download the GIF, in MP4 format.
              if (post.preview.reddit_video_preview != undefined) {
                downloadURL = post.preview.reddit_video_preview.fallback_url;
                fileType = 'mp4';
              } else if (post.url_overridden_by_dest.includes(".gifv")) {
                // Luckily, you can just swap URLs on imgur with .gifv 
                // with ".mp4" to get the MP4 version. Amazing!
                downloadURL = post.url_overridden_by_dest.replace(".gifv", ".mp4");
                fileType = 'mp4';
              }
            }
  
            if (postType === 0) {
              // DOWNLOAD A SELF POST
              let comments_string = "";
              request(`${post.url}.json`, (e, resp, b) => {
                if (e) {
                  onErr(e);
                  log(`Error requesting post with URL: ${post.url}`, false);
                  return;
                }
                // With text/self posts, we want to download the top comments as well.
                // This is done by requesting the post's JSON data, and then iterating through each comment.
                // We also iterate through the top nested comments (only one level deep).
                // So we have a file output with the post title, the post text, the author, and the top comments.
                const data = JSON.parse(b);
                comments_string += post.title + " by " + post.author + "\n\n";
                comments_string += post.selftext + "\n";
                comments_string += "------------------------------------------------\n\n";
                comments_string += "--COMMENTS--\n\n";
                for (let i = 0; i < data[1].data.children.length; i++) {
                  const comment = data[1].data.children[i].data;
                  comments_string += comment.author + ":\n";
                  comments_string += comment.body + "\n";
                  if (comment.replies) {
                    const top_reply = comment.replies.data.children[0].data;
                    comments_string += "\t>\t" + top_reply.author + ":\n";
                    comments_string += "\t>\t" + top_reply.body + "\n";
                  }
                  comments_string += "\n\n\n";
  
                }
  
              fs.writeFile(`${downloadDirectory}/SELF -${postTitleScrubbed}.txt`, comments_string, function (err) {
                if (err) throw err;
                downloadedPosts.self += 1;
                checkIfDone();
              });
            })}
            else if (postType === 1) {
              // DOWNLOAD A MEDIA POST
              if (imageFormats.indexOf(fileType) !== -1) {
                request(downloadURL)
                .pipe(fs.createWriteStream(`${downloadDirectory}/MEDIA - ${postTitleScrubbed}.${fileType}`))
                .on("close", () => {
                  downloadedPosts.media += 1;
                  checkIfDone();
                });
              } else {
                downloadedPosts.failed += 1;
                checkIfDone();
              }
            }
            else if (postType === 2) {
              // DOWNLOAD A LINK POST
              // With link posts, we create a simple HTML file that redirects to the post's URL.
              // This enables the user to still "open" the link file, and it will redirect to the post.
              // No comments or other data is stored. 
              let htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`
  
              fs.writeFile(`${downloadDirectory}/LINK - ${postTitleScrubbed}.html`, htmlFile, function (err) {
                if (err) throw err;
                downloadedPosts.link += 1;
                checkIfDone();
  
              });
            } else {
              downloadedPosts.failed += 1;
              checkIfDone();
            }
            
          } else {
            log(`FAILURE: No URL found for post with title: ${post.title} from subreddit ${post.subreddit}`, false)
          }
        } catch (e) {
          log(e, false)
        }
        
      };
    });
  }
}

// Only ask the prompt questions if testingMode is disabled.
// If testingMode is enabled, the script will run with the preset values written at the top. 
if (!testingMode) {startPrompt();}

function onErr(err) {
  log(err, false);
  return 1;
}

// checkIfDone is called frequently to see if we have downloaded the number of posts
// that the user requested to download. 
// We could check this inline but it's easier to read if it's a separate function, 
// and this ensures that we only check after the files are done being downloaded to the PC, not 
// just when the request is sent.
function checkIfDone() {
  // Add up all downloaded/failed posts that have been downloaded so far, and check if it matches the 
  // number requested. 
  let total = downloadedPosts.self + downloadedPosts.media + downloadedPosts.link + downloadedPosts.failed;
  if (total == (numberOfPosts * subredditList.length)) {
    let endTime = new Date();
    let timeDiff = endTime - startTime;
    timeDiff /= 1000;
    // simplify to first 5 digits for msPerPost
    let msPerPost = (timeDiff / total).toString().substring(0, 5);

    log("🎉 All done downloading posts from " + downloadedPosts.subreddit + "!", true);
    log(JSON.stringify(downloadedPosts), true)
    log(`\n📈 Downloading took ${timeDiff} seconds, at about ${msPerPost} seconds/post`, true);

    // default values for next run (important if being run multiple times)
    downloadedPosts = {
      subreddit: "",
      self: 0,
      media: 0,
      link: 0,
      failed: 0
    };
    if (repeatForever) {
      log(`⏲️ Waiting ${timeBetweenRuns / 1000} seconds before rerunning...`, true)
      log("\n------------------------------------------------", true)
      setTimeout(continueWithData, timeBetweenRuns);
    } else {
      startPrompt();
    }

  } else {
    log(`Still downloading posts... (${total}/${numberOfPosts})`, true)
    log(JSON.stringify(downloadedPosts), true)
    log("\n------------------------------------------------", true)
  }

}

// Create initial log file with current date and time. 
fs.writeFile(`./logs/${date_string}.${logFormat}`, userLogs, function (err) {
  if (err) throw err;
});

function log(message, visibleToUser) {
  // This function takes a message string and a boolean.
  // If the boolean is true, the message will be logged to the console, otherwise it 
  // will only be logged to the log file.
  userLogs += message+'\r\n\n';
  if (visibleToUser || visibleToUser == undefined) {
    console.log(message);
  }
  if (!fs.existsSync("./logs")) {
    fs.mkdirSync("./logs");
  }

  fs.writeFile(`./logs/${date_string}.${logFormat}`, userLogs, function (err) {
    if (err) throw err;
  });
}