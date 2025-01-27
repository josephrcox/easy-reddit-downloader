import { SortTime, SortType } from "./types";

export interface UserConfig {
  testingMode: boolean;
  testingModeOptions: {
    subredditList: string[];
    numberOfPosts: number;
    sorting: SortType;
    time: SortTime;
    repeatForever: boolean;
    timeBetweenRuns: number;
    downloadDirectory?: string;
  };
  download_post_list_options: {
    enabled: boolean;
    repeatForever: boolean;
    timeBetweenRuns: number;
  };
  local_logs: boolean;
  local_logs_naming_scheme: {
    showDateAndTime: boolean;
    showSubreddits: boolean;
    showNumberOfPosts: boolean;
  };
  file_naming_scheme: {
    showDateAndTime: boolean;
    showAuthor: boolean;
    showTitle: boolean;
    showScore: boolean;
    showDate: boolean;
    showSubreddit: boolean;
  };
  file_format_options: {
    comment_format: "json" | "txt" | "csv";
  };
  download_self_posts: boolean;
  download_media_posts: boolean;
  download_link_posts: boolean;
  download_gallery_posts: boolean;
  download_youtube_videos_experimental: boolean;
  download_comments: boolean;
  download_all_comments: boolean;
  download_text_content_only: boolean;
  separate_clean_nsfw: boolean;
  redownload_posts: boolean;
  detailed_logs: boolean;
}
