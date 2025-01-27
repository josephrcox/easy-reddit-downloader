export interface RedditPost {
  title: string;
  url: string;
  name: string;
  author: string;
  score: number;
  created: number;
  subreddit: string;
  post_hint?: string;
  is_self?: boolean;
  selftext?: string;
  over_18: boolean;
  domain?: string;
  url_overridden_by_dest?: string;
  preview?: {
    reddit_video_preview?: {
      fallback_url: string;
    };
    images: Array<{
      source: {
        url: string;
      };
    }>;
  };
  media?: {
    reddit_video?: {
      fallback_url: string;
    };
    oembed?: {
      thumbnail_url?: string;
    };
  };
  poll_data?: any;
  is_gallery?: boolean;
  gallery_data?: {
    items: Array<{
      media_id: string;
      id: string;
    }>;
  };
  media_metadata?: {
    [key: string]: {
      s: {
        u: string;
      };
    };
  };
}

export interface RedditApiResponse {
  data: {
    after: string;
    children: Array<{
      data: RedditPost;
    }>;
  };
  message?: string;
}

export interface DownloadedPosts {
  subreddit: string;
  self: number;
  media: number;
  link: number;
  failed: number;
  skipped_due_to_duplicate: number;
  skipped_due_to_fileType: number;
}

export interface PromptResult {
  subreddit: string;
  numberOfPosts: number;
  sorting: string;
  time: string;
  repeatForever: boolean;
  timeBetweenRuns?: number;
  downloadDirectory?: string;
}

export type PostType = "self" | "media" | "link" | "poll" | "gallery";

export type SortType = "top" | "new" | "hot" | "rising" | "controversial";
export type SortTime = "hour" | "day" | "week" | "month" | "year" | "all";

export interface PostStats {
  subreddit: string;
  self: number;
  media: number;
  link: number;
  failed: number;
  skipped_due_to_duplicate: number;
  skipped_due_to_fileType: number;
}
