import fs from "fs";
import { RuntimeConfig } from "../types/runtime";
import { RedditPost } from "../types/types";
import { LogService } from "./LogService";

export class FileService {
  private config: RuntimeConfig;
  private logger: LogService;
  private downloadDirectoryBase: string;

  constructor(config: RuntimeConfig, logger: LogService) {
    this.config = config;
    this.logger = logger;
    this.downloadDirectoryBase = config.downloadDirectory || "./downloads";
  }

  public makeDirectories(): void {
    if (!fs.existsSync(this.downloadDirectoryBase)) {
      fs.mkdirSync(this.downloadDirectoryBase);
    }

    if (this.config.separate_clean_nsfw) {
      if (!fs.existsSync(`${this.downloadDirectoryBase}/clean`)) {
        fs.mkdirSync(`${this.downloadDirectoryBase}/clean`);
      }
      if (!fs.existsSync(`${this.downloadDirectoryBase}/nsfw`)) {
        fs.mkdirSync(`${this.downloadDirectoryBase}/nsfw`);
      }
    }
  }

  public getDownloadDirectory(subreddit: string, isNsfw: boolean): string {
    let downloadDirectory: string;
    if (!this.config.separate_clean_nsfw) {
      downloadDirectory = `${this.downloadDirectoryBase}/${subreddit}`;
    } else {
      const cleanNsfwPath = isNsfw ? "nsfw" : "clean";
      downloadDirectory = `${this.downloadDirectoryBase}/${cleanNsfwPath}/${subreddit}`;
    }

    if (!fs.existsSync(downloadDirectory)) {
      fs.mkdirSync(downloadDirectory);
    }

    return downloadDirectory;
  }

  public async shouldDownloadFile(filePath: string): Promise<boolean> {
    if (this.config.redownload_posts === true || this.config.redownload_posts === undefined) {
      if (this.config.redownload_posts === undefined) {
        this.logger.logWarning(
          'ALERT: Please note that the "redownload_posts" option is now available in user_config. See the default JSON for example usage.'
        );
      }
      return true;
    }
    return !fs.existsSync(filePath);
  }

  public getFileName(post: RedditPost): string {
    let fileName = "";

    if (this.config.file_naming_scheme.showDate || this.config.file_naming_scheme.showDate === undefined) {
      const date = new Date(post.created * 1000);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      fileName += `${year}-${month}-${day}`;
    }

    if (this.config.file_naming_scheme.showScore || this.config.file_naming_scheme.showScore === undefined) {
      fileName += `_score=${post.score}`;
    }

    if (this.config.file_naming_scheme.showSubreddit || this.config.file_naming_scheme.showSubreddit === undefined) {
      fileName += `_${post.subreddit}`;
    }

    if (this.config.file_naming_scheme.showAuthor || this.config.file_naming_scheme.showAuthor === undefined) {
      fileName += `_${post.author}`;
    }

    if (this.config.file_naming_scheme.showTitle || this.config.file_naming_scheme.showTitle === undefined) {
      let title = this.sanitizeFileName(post.title);
      fileName += `_${title}`;
    }

    fileName = this.cleanFileName(fileName);
    return fileName;
  }

  public async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public async appendFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.appendFile(filePath, content, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[/\\?%*:|"<>]/g, "-").replace(/([^/])\/([^/])/g, "$1_$2");
  }

  private cleanFileName(fileName: string): string {
    // Remove special characters and emojis
    fileName = fileName.replace(/(?:\r\n|\r|\n|\t)/g, "");
    fileName = fileName.replace(/\ufe0e/g, "");
    fileName = fileName.replace(/\ufe0f/g, "");

    // Limit filename length
    if (fileName.length > 240) {
      fileName = fileName.substring(0, 240);
    }

    return fileName;
  }

  public async createDefaultFiles(): Promise<void> {
    // Create user_config.json if it doesn't exist
    if (!fs.existsSync("user_config.json")) {
      await fs.promises.copyFile("user_config_DEFAULT.json", "user_config.json");
      this.logger.log("user_config.json was created. Edit it to manage user options.", true);
    }

    // Create download_post_list.txt if it doesn't exist
    if (!fs.existsSync("download_post_list.txt")) {
      const fileDefaultContent =
        `# Below, please list any posts that you wish to download. # \n` +
        `# They must follow this format below: # \n` +
        `# https://www.reddit.com/r/gadgets/comments/ptt967/eu_proposes_mandatory_usbc_on_all_devices/ # \n` +
        `# Lines with "#" at the start will be ignored (treated as comments). #`;

      await this.writeFile("download_post_list.txt", fileDefaultContent);
      this.logger.log("download_post_list.txt was created with default content.", true);
    }
  }
}
