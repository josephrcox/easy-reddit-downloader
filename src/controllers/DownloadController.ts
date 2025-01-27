import { RuntimeConfig } from "../types/runtime";
import { LogService } from "../services/LogService";
import { FileService } from "../services/FileService";
import { RedditService } from "../services/RedditService";
import { CommentService } from "../services/CommentService";
import { PostStats, RedditPost } from "../types/types";
import fs from "fs";

export class DownloadController {
  private config: RuntimeConfig;
  private logger: LogService;
  private fileService: FileService;
  private redditService: RedditService;
  private downloadedPosts: PostStats;
  private startTime: Date | null = null;

  private commentService: CommentService;

  constructor(
    config: RuntimeConfig,
    logger: LogService,
    fileService: FileService,
    redditService: RedditService,
    commentService: CommentService
  ) {
    this.config = config;
    this.logger = logger;
    this.fileService = fileService;
    this.redditService = redditService;
    this.commentService = commentService;
    this.downloadedPosts = this.initializePostStats();
  }

  private initializePostStats(): PostStats {
    return {
      subreddit: "",
      self: 0,
      media: 0,
      link: 0,
      failed: 0,
      skipped_due_to_duplicate: 0,
      skipped_due_to_fileType: 0,
    };
  }

  public async startDownload(subreddit: string, lastPostId: string | null = null): Promise<void> {
    this.logger.log(`Starting downloading for r/${subreddit}`, false);
    this.startTime = new Date();
    this.fileService.makeDirectories();

    try {
      const limit = 25;
      const response = await this.redditService.fetchPosts(subreddit, lastPostId, limit);

      if (!response) {
        return;
      }

      // Create directory for this subreddit
      const firstPost = response.data.children[0]?.data;
      if (firstPost) {
        this.downloadedPosts.subreddit = firstPost.subreddit;
        const downloadDir = this.fileService.getDownloadDirectory(firstPost.subreddit, firstPost.over_18);
        if (!fs.existsSync(downloadDir)) {
          fs.mkdirSync(downloadDir, { recursive: true });
        }
      }

      const totalPosts = response.data.children.length;
      this.logger.log(`Processing first batch ${totalPosts} posts from r/${subreddit}...`, false);

      for (let i = 0; i < response.data.children.length; i++) {
        const child = response.data.children[i];
        if (!child) continue;

        await this.redditService.sleep();
        await this.processPost(child.data);

        // Log progress every 5 posts
        if ((i + 1) % 5 === 0 || i === totalPosts - 1) {
          this.logger.log(
            `Progress: ${i + 1}/${totalPosts} posts processed\n` +
              `Stats: ${this.downloadedPosts.media} media, ` +
              `${this.downloadedPosts.self} self posts, ` +
              `${this.downloadedPosts.link} links, ` +
              `${this.downloadedPosts.failed} failed, ` +
              `${this.downloadedPosts.skipped_due_to_duplicate} duplicates, ` +
              `${this.downloadedPosts.skipped_due_to_fileType} skipped`,
            false
          );
        }
      }

      // Handle next batch if needed
      const shouldContinue = this.config.numberOfPosts === 0 
        ? response.data.children.length === limit // If numberOfPosts is 0, continue until we get less than limit
        : this.getPostsRemaining() > 0; // Otherwise check remaining posts

      if (response.data.children.length === limit && shouldContinue) {
        const lastPost = response.data.children[response.data.children.length - 1]!.data;
        await this.startDownload(subreddit, lastPost.name);
      }
    } catch (error) {
      this.logger.logError(`Failed to download posts: ${error}`);
    } finally {
      if (this.startTime) {
        const endTime = new Date();
        const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;
        this.logger.log(`Download completed in ${duration.toFixed(2)} seconds`, false);
      }
    }
  }

  private async processPost(post: RedditPost): Promise<void> {
    try {
      const postType = this.redditService.getPostType(post);
      const fileName = this.fileService.getFileName(post);
      const downloadDir = this.fileService.getDownloadDirectory(post.subreddit, post.over_18);

      switch (postType) {
        case "self":
          await this.processSelfPost(post, fileName, downloadDir);
          break;
        case "media":
          await this.processMediaPost(post, fileName, downloadDir);
          break;
        case "gallery":
          await this.processGalleryPost(post, fileName, downloadDir);
          break;
        case "link":
          await this.processLinkPost(post, fileName, downloadDir);
          break;
        default:
          this.downloadedPosts.skipped_due_to_fileType++;
          this.logger.log(`Skipping unsupported post type: ${postType}`, true);
      }
    } catch (error) {
      this.downloadedPosts.failed++;
      this.logger.logError(`Failed to process post: ${error}`);
    }
  }

  private async processSelfPost(post: RedditPost, fileName: string, downloadDir: string): Promise<void> {
    if (!this.config.download_self_posts) {
      this.downloadedPosts.skipped_due_to_fileType++;
      return;
    }

    const filePath = `${downloadDir}/${fileName}.txt`;
    if (!(await this.fileService.shouldDownloadFile(filePath))) {
      this.downloadedPosts.skipped_due_to_duplicate++;
      return;
    }

    try {
      const content = await this.formatSelfPostContent(post);
      await this.fileService.writeFile(filePath, content);
      this.downloadedPosts.self++;
    } catch (error) {
      throw new Error(`Failed to process self post: ${error}`);
    }
  }

  private async processMediaPost(post: RedditPost, fileName: string, downloadDir: string): Promise<void> {
    if (!this.config.download_media_posts) {
      this.downloadedPosts.skipped_due_to_fileType++;
      return;
    }

    try {
      const { downloadUrl, fileType } = await this.getMediaDownloadInfo(post);
      const filePath = `${downloadDir}/${fileName}.${fileType}`;

      if (!(await this.fileService.shouldDownloadFile(filePath))) {
        this.downloadedPosts.skipped_due_to_duplicate++;
        return;
      }

      await this.redditService.downloadMediaFile(downloadUrl, filePath);
      this.downloadedPosts.media++;

      // Download comments if enabled
      const comments = await this.getPostComments(post);
      if (comments) {
        const commentFilePath = `${downloadDir}/${fileName}_comments.txt`;
        const commentContent = `${post.title} by ${post.author}\n\n${comments}`;
        await this.fileService.writeFile(commentFilePath, commentContent);
      }
    } catch (error) {
      throw new Error(`Failed to process media post: ${error}`);
    }
  }

  private async processGalleryPost(post: RedditPost, fileName: string, downloadDir: string): Promise<void> {
    if (!this.config.download_gallery_posts || !post.gallery_data || !post.media_metadata) {
      this.downloadedPosts.skipped_due_to_fileType++;
      return;
    }

    const galleryDir = `${downloadDir}/${fileName}`;
    if (!(await this.fileService.shouldDownloadFile(galleryDir))) {
      this.downloadedPosts.skipped_due_to_duplicate++;
      return;
    }

    try {
      // Create gallery directory
      if (!fs.existsSync(galleryDir)) {
        fs.mkdirSync(galleryDir, { recursive: true });
      }

      for (const { media_id, id } of post.gallery_data.items) {
        const media = post.media_metadata[media_id];
        if (!media?.s?.u) continue;

        const downloadUrl = media.s.u.replaceAll("&amp;", "&");
        const fileType = downloadUrl.split("?")[0]?.split(".").pop() || "jpg";
        const filePath = `${galleryDir}/${id}.${fileType}`;

        await this.redditService.downloadMediaFile(downloadUrl, filePath);
      }
      this.downloadedPosts.media++;

      // Download comments if enabled
      const comments = await this.getPostComments(post);
      if (comments) {
        const commentFilePath = `${galleryDir}/comments.txt`;
        const commentContent = `${post.title} by ${post.author}\n\n${comments}`;
        await this.fileService.writeFile(commentFilePath, commentContent);
      }
    } catch (error) {
      throw new Error(`Failed to process gallery post: ${error}`);
    }
  }

  private async processLinkPost(post: RedditPost, fileName: string, downloadDir: string): Promise<void> {
    if (!this.config.download_link_posts) {
      this.downloadedPosts.skipped_due_to_fileType++;
      return;
    }

    const filePath = `${downloadDir}/${fileName}${post.domain?.includes("youtu") ? ".mp4" : ".html"}`;
    if (!(await this.fileService.shouldDownloadFile(filePath))) {
      this.downloadedPosts.skipped_due_to_duplicate++;
      return;
    }

    try {
      if (post.domain?.includes("youtu") && this.config.download_youtube_videos_experimental) {
        await this.redditService.downloadYouTubeVideo(post.url!, filePath);
      } else {
        const htmlContent = `<html><body><script type='text/javascript'>window.location.href = "${post.url}";</script></body></html>`;
        await this.fileService.writeFile(filePath, htmlContent);
      }
      this.downloadedPosts.link++;

      // Download comments if enabled
      const comments = await this.getPostComments(post);
      if (comments) {
        const commentFilePath = `${downloadDir}/${fileName}_comments.txt`;
        const commentContent = `${post.title} by ${post.author}\n\n${comments}`;
        await this.fileService.writeFile(commentFilePath, commentContent);
      }
    } catch (error) {
      throw new Error(`Failed to process link post: ${error}`);
    }
  }

  private async formatSelfPostContent(post: RedditPost): Promise<string> {
    let content = `${post.title} by ${post.author}\n\n`;
    content += `${post.selftext}\n`;
    content += "------------------------------------------------\n\n";

    const comments = await this.getPostComments(post);
    if (comments) {
      content += comments;
    }

    return content;
  }

  private async getPostComments(post: RedditPost): Promise<string | null> {
    return this.commentService.fetchAndFormatComments(post.url);
  }

  private async getMediaDownloadInfo(post: RedditPost): Promise<{ downloadUrl: string; fileType: string }> {
    let downloadUrl = post.url || "";
    let fileType = downloadUrl.split(".").pop() || "jpg";

    if (post.preview?.reddit_video_preview) {
      downloadUrl = post.preview.reddit_video_preview.fallback_url;
      fileType = "mp4";
    } else if (post.url_overridden_by_dest?.includes(".gifv")) {
      downloadUrl = post.url_overridden_by_dest.replace(".gifv", ".mp4");
      fileType = "mp4";
    } else if (post.media?.reddit_video) {
      downloadUrl = post.media.reddit_video.fallback_url;
      fileType = "mp4";
    } else if (post.media?.oembed?.thumbnail_url) {
      downloadUrl = post.media.oembed.thumbnail_url;
      fileType = "gif";
    }

    return { downloadUrl, fileType };
  }

    private getPostsRemaining(): number {
        // If numberOfPosts is 0, return a large number to ensure continuation
        if (this.config.numberOfPosts === 0) {
            return Number.MAX_SAFE_INTEGER;
        }

        // Get only numeric values from downloadedPosts
        const numericValues = Object.entries(this.downloadedPosts)
            .filter(([key, val]) => key !== 'subreddit' && typeof val === 'number')
            .map(([_, val]) => val as number);

        // If no posts have been downloaded yet, return the total number of posts to download
        if (numericValues.every(val => val === 0)) {
            return this.config.numberOfPosts;
        }

        // Calculate remaining posts based on what's been downloaded
        const total = numericValues.reduce((sum, val) => sum + val, 0);
        return this.config.numberOfPosts - total;
    }

  public getStats(): PostStats {
    return { ...this.downloadedPosts };
  }

  public resetStats(): void {
    this.downloadedPosts = this.initializePostStats();
  }
}
