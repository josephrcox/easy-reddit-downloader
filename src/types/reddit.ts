export interface RedditResponse {
  kind: string;
  message?: string;
  data: RedditListing;
}

export type PostResponse = RedditResponse[];
export type ListingResponse = RedditResponse;

export type RedditResponseArray = RedditResponse[];

export interface RedditListing {
  after: string | null;
  dist: number | null;
  modhash: string;
  geo_filter: string;
  children: RedditChild[];
  before: string | null;
}

export interface RedditChild {
  kind: string;
  data: PostData | CommentData;
}

export interface BaseData {
  subreddit: string;
  author: string;
  title: string;
  name: string;
  url: string;
  domain: string;
  over_18: boolean;
  score: number;
  created: number;
}

export interface PostData extends BaseData {
  approved_at_utc: number | null;
  selftext: string;
  user_reports: any[];
  saved: boolean;
  mod_reason_title: string | null;
  gilded: number;
  clicked: boolean;
  is_gallery?: boolean;
  link_flair_richtext: any[];
  subreddit_name_prefixed: string;
  hidden: boolean;
  pwls: number;
  link_flair_css_class: string | null;
  downs: number;
  thumbnail_height: number | null;
  top_awarded_type: string | null;
  media_metadata: Record<string, MediaMetadataImage | MediaMetadataAnimated>;
  hide_score: boolean;
  quarantine: boolean;
  link_flair_text_color: string;
  upvote_ratio: number;
  author_flair_background_color: string | null;
  ups: number;
  media_embed: Record<string, any>;
  thumbnail_width: number | null;
  author_flair_template_id: string | null;
  is_original_content: boolean;
  author_fullname: string;
  secure_media: any | null;
  is_reddit_media_domain: boolean;
  is_meta: boolean;
  category: string | null;
  secure_media_embed: Record<string, any>;
  gallery_data: {
    items: GalleryItem[];
  };
  link_flair_text: string | null;
  can_mod_post: boolean;
  approved_by: string | null;
  is_created_from_ads_ui: boolean;
  author_premium: boolean;
  thumbnail: string;
  edited: boolean | number;
  author_flair_css_class: string | null;
  author_flair_richtext: any[];
  gildings: Record<string, any>;
  content_categories: string[] | null;
  is_self: boolean;
  subreddit_type: string;
  link_flair_type: string;
  wls: number;
  removed_by_category: string | null;
  banned_by: string | null;
  author_flair_type: string;
  total_awards_received: number;
  allow_live_comments: boolean;
  selftext_html: string | null;
  likes: boolean | null;
  suggested_sort: string | null;
  banned_at_utc: number | null;
  url_overridden_by_dest?: string;
  view_count: number | null;
  archived: boolean;
  no_follow: boolean;
  is_crosspostable: boolean;
  pinned: boolean;
  all_awardings: any[];
  awarders: any[];
  media_only: boolean;
  can_gild: boolean;
  spoiler: boolean;
  locked: boolean;
  author_flair_text: string | null;
  treatment_tags: string[];
  visited: boolean;
  removed_by: string | null;
  mod_note: string | null;
  distinguished: string | null;
  subreddit_id: string;
  author_is_blocked: boolean;
  mod_reason_by: string | null;
  num_reports: number | null;
  removal_reason: string | null;
  link_flair_background_color: string;
  id: string;
  is_robot_indexable: boolean;
  num_duplicates?: number;
  report_reasons: string[] | null;
  discussion_type: string | null;
  num_comments: number;
  send_replies: boolean;
  media: any | null;
  contest_mode: boolean;
  author_patreon_flair: boolean;
  author_flair_text_color: string | null;
  permalink: string;
  stickied: boolean;
  subreddit_subscribers: number;
  created_utc: number;
  num_crossposts: number;
  mod_reports: any[];
  is_video: boolean;
  post_hint?: string;
  preview?: {
    reddit_video_preview?: {
      fallback_url: string;
    };
    images: {
      source: {
        url: string;
      };
    }[];
  };
  poll_data?: any;
}

export interface CommentData extends BaseData {
  subreddit_id: string;
  approved_at_utc: number | null;
  author_is_blocked: boolean;
  comment_type: string | null;
  awarders: any[];
  mod_reason_by: string | null;
  banned_by: string | null;
  author_flair_type: string;
  total_awards_received: number;
  author_flair_template_id: string | null;
  likes: boolean | null;
  replies: string | RedditResponse;
  user_reports: any[];
  saved: boolean;
  id: string;
  banned_at_utc: number | null;
  mod_reason_title: string | null;
  gilded: number;
  archived: boolean;
  collapsed_reason_code: string | null;
  no_follow: boolean;
  can_mod_post: boolean;
  created_utc: number;
  send_replies: boolean;
  parent_id: string;
  author_fullname: string;
  removal_reason: string | null;
  approved_by: string | null;
  mod_note: string | null;
  all_awardings: any[];
  body: string;
  edited: boolean | number;
  top_awarded_type: string | null;
  author_flair_css_class: string | null;
  is_submitter: boolean;
  downs: number;
  author_flair_richtext: any[];
  author_patreon_flair: boolean;
  body_html: string;
  gildings: Record<string, any>;
  collapsed_reason: string | null;
  distinguished: string | null;
  associated_award: any | null;
  stickied: boolean;
  author_premium: boolean;
  can_gild: boolean;
  link_id: string;
  unrepliable_reason: string | null;
  author_flair_text_color: string | null;
  score_hidden: boolean;
  permalink: string;
  subreddit_type: string;
  locked: boolean;
  report_reasons: string[] | null;
  author_flair_text: string | null;
  treatment_tags: string[];
  collapsed: boolean;
  subreddit_name_prefixed: string;
  controversiality: number;
  depth: number;
  author_flair_background_color: string | null;
  collapsed_because_crowd_control: boolean | null;
  mod_reports: any[];
  num_reports: number | null;
  ups: number;
  media_metadata?: Record<string, MediaMetadataImage | MediaMetadataAnimated>;
}

export interface MediaMetadataBase {
  status: string;
  e: string;
  m: string;
  id: string;
}

export interface MediaMetadataImage extends MediaMetadataBase {
  p: MediaPreview[];
  s: MediaSource;
}

export interface MediaMetadataAnimated extends MediaMetadataBase {
  p: MediaPreview[];
  s: MediaSourceAnimated;
  t?: string;
  ext?: string;
}

export interface MediaPreview {
  y: number;
  x: number;
  u: string;
}

export interface MediaSource {
  y: number;
  x: number;
  u: string;
}

export interface MediaSourceAnimated extends MediaSource {
  gif?: string;
  mp4?: string;
}

export interface GalleryItem {
  media_id: string;
  id: number;
}

// Type guard to check if data is PostData
export function isPostData(data: PostData | CommentData): data is PostData {
  return "post_hint" in data || "is_gallery" in data || "is_self" in data;
}
