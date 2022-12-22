const request = require('request');
const fs = require('fs');
const prompt = require('prompt');
var colors = require("@colors/colors/safe");
const chalk = require('chalk');

let userLogs = "";
let logFormat = "md"
let date = new Date();
let date_string = `${date.getFullYear()} ${date.getMonth()} ${date.getDate()} at ${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

let startTime = null;

console.clear();
log(chalk.cyan('Welcome to Reddit Post Downloader by Mapleweekend!'), true);

let timeBetweenRuns = 0; // 24 hours

let subredditList = [];
let numberOfPosts = -1;
let sorting = "top";
let time = "all";
let repeatForever = false;
let imageDir = "";

const testingMode = true;
if (testingMode) {
  subredditList = ['random'];
  numberOfPosts = 10;
  sorting = "top";
  time = "all";
  repeatForever = true;
  timeBetweenRuns = 1000 * 5; // every 5 seconds
  continueWithData();
}

let downloadedPosts = {
  self:0,
  media:0,
  link:0,
  failed:0
}

function startPrompt() {
  prompt.start();
  prompt.message = "";
  prompt.delimiter = "";
  if (!repeatForever) {
    prompt.get({
      properties: {
        subreddit: {
          description: colors.magenta("What subreddit would you like to download? You may submit multiple separated by commas (no spaces).\n\t")
        },
        post_count: {
          description: colors.blue("How many posts do you want to go through? (more posts = more downloads, but takes longer)\n\t")
        },
        sorting: {
          description: colors.yellow("How would you like to sort? (top, new, hot, rising, controversial)\n\t")
        },
        time: {
          description: colors.green("What time period? (hour, day, week, month, year, all)\n\t")
        },
        repeat: {
          description: colors.red("How often should this be run? \n1.) one time\n2.) every 30 seconds\n3.) every minute\n4.) every 5 minutes\n5.) every 30 minutes\n6.) every hour\n7.) every 3 hours\n8.) every day\n\t")
        }
      }
    }, function (err, result) {
      if (err) {
        return onErr(err);
      }
      subredditList = result.subreddit.split(',');
      numberOfPosts = result.post_count;
      sorting = result.sorting;
      time = result.time;
      repeatForever = true;
      switch(result.repeat){
        case "1":
          repeatForever = false; // one time
          break;
        case "2":
          timeBetweenRuns = 1000 * 30; // 30 seconds
          break;
        case "3":
          timeBetweenRuns = 1000 * 60; // 1 minute
          break;
        case "4":
          timeBetweenRuns = 1000 * 60 * 5; // 5 minutes
          break;
        case "5":
          timeBetweenRuns = 1000 * 60 * 30; // 30 minutes
          break;
        case "6":
          timeBetweenRuns = 1000 * 60 * 60; // 1 hour
          break;
        case "7":
          timeBetweenRuns = 1000 * 60 * 60 * 3; // 3 hours
          break;
        case "8":
          timeBetweenRuns = 1000 * 60 * 60 * 24; // 24 hours
          break;
        default:
          repeatForever = false;
          break;
      }

      continueWithData();
    })
  }
}
  
function continueWithData() {
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

    log(`Requesting posts from https://www.reddit.com/r/${subreddit}/${sorting}.json?sort=${sorting}&t=${time}&limit=${numberOfPosts}`, true)
    // Get the top posts from the subreddit
    request(`https://www.reddit.com/r/${subreddit}/${sorting}.json?sort=${sorting}&t=${time}&limit=${numberOfPosts}`, (error, response, body) => {
      const data = JSON.parse(body);

      if (error || data.message == "Not Found" || data.data.children.length == 0) {
        log(`There was a problem fetching posts for ${subreddit}. Does it exist?`, true);
        return;
      }
      let isOver18 = (data.data.children[0].data.over_18) ? "nsfw" : "clean";
      downloadedPosts.subreddit = data.data.children[0].data.subreddit;

      // Loop through the posts
      for (let i = 0; i < data.data.children.length; i++) {
        try {
          const post = data.data.children[i].data;

          imageDir = `./downloads/${isOver18}/${post.subreddit}`;
          // Make sure the image directory exists
          if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir);
          }
          let postTypeOptions = ['self', 'media', 'link'];
          let postType = -1;
  
          if (post.post_hint === "self" || post.is_self) {postType = 0;}
          else if (post.post_hint === "image" || post.post_hint === "rich:video" || post.post_hint === "hosted:video") {postType = 1;}
          else {postType = 2;}
          log(`Analyzing post with title: ${post.title}) and URL: ${post.url}`, false)
          log(`Post has type: ${postTypeOptions[postType]}`, false)
  
          if (post.url) {
            // array of image and video formats
            const imageFormats = ['jpeg', 'jpg', 'gif', 'png', 'mp4', 'webm', 'gifv'];
  
            let downloadURL = post.url;
            let fileType = downloadURL.split('.').pop();
            let postTitleScrubbed = post.title.replace(/@"^[\w\-. ]+$/, '_').replace(/\//g, '_').substring(0, 80);

            if (post.preview != undefined && postType === 1) {
              // the post is a media post
              if (post.preview.reddit_video_preview != undefined) {
                downloadURL = post.preview.reddit_video_preview.fallback_url;
                fileType = 'mp4';
              } else if (post.url_overridden_by_dest.includes(".gifv")) {
                downloadURL = post.url_overridden_by_dest.replace(".gifv", ".mp4");
                fileType = 'mp4';
              }
            }
  
            if (postType === 0) {
              // DOWNLOAD A SELF POST
              let comments_string = "";
              request(`${post.url}.json`, (e, resp, b) => {
                if (e) {
                  log(`${e}`, false);
                  log(`Error requesting post with URL: ${post.url}`, false);
                  return;
                }
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
  
              fs.writeFile(`${imageDir}/SELF -${postTitleScrubbed}.txt`, comments_string, function (err) {
                if (err) throw err;
                downloadedPosts.self += 1;
                checkIfDone();
              });
            })}
            else if (postType === 1) {
              // DOWNLOAD A MEDIA POST
              if (imageFormats.indexOf(fileType) != -1) {
                request(downloadURL)
                .pipe(fs.createWriteStream(`${imageDir}/MEDIA - ${postTitleScrubbed}.${fileType}`))
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
  
              let htmlFile = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`
  
              fs.writeFile(`${imageDir}/LINK - ${postTitleScrubbed}.html`, htmlFile, function (err) {
                if (err) throw err;
                downloadedPosts.link += 1;
                checkIfDone();
  
              });
            } else {
              downloadedPosts.failed += 1;
              checkIfDone();
            }
            
          }
        } catch (e) {
          log(e, false)
        }
        
      };
    });
  }
}

if (!testingMode) {startPrompt();}

function onErr(err) {
  log(err, false);
  return 1;
}

function checkIfDone() {
  let total = downloadedPosts.self + downloadedPosts.media + downloadedPosts.link + downloadedPosts.failed;
  if (total == (numberOfPosts * subredditList.length)) {
    let endTime = new Date();
    let timeDiff = endTime - startTime;
    timeDiff /= 1000;
    let msPerPost = (timeDiff / total).toString().substring(0, 5);

    log("🎉 All done downloading posts from " + downloadedPosts.subreddit + "!", true);
    log(JSON.stringify(downloadedPosts), true)
    log(`\n📈 Downloading took ${timeDiff} seconds, at about ${msPerPost} seconds/post`, true);

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

fs.writeFile(`./logs/${date_string}.${logFormat}`, userLogs, function (err) {
  if (err) throw err;
});

function log(message, visibleToUser) {
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