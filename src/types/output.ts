// Should have the same sort as the original post
export type PostComments = JSONcomment[];

export interface JSONcomment {
  user: string;
  comment: string;
  votes: number;
  child: JSONcomment[];
}

export interface CSVComment {
  user: string;
  comment_id: string;
  comment: string;
  votes: number;
  parent: string | null;
}

/* CSV example
user|comment_id|comment|votes|parent
userName1|asd123|commentContent|5|null
userName2|asd456|commentContent|2|asd123
...

*/

/*txt example, json rendered as txt file in tree form
[UserName1]- +15
[commentContent1]
  ├─[UserName2] - +5
  │ "ChildCommentContent1"
  │
  └─[UserName3] - +2
    "ChildCommentContent2"
      └─[UserName4] - -10
        "ChildCommentContent3"

[UserName4] - +5
[commentContent4]
  ├─[UserName5] - +5
  │ "ChildCommentContent5"
  │
  └─[UserName6] - +5
    "ChildCommentContent6"
      ├─[UserName7] - +5
      │ "ChildCommentContent7"
      │   └─[UserName8] - +5
      │     "ChildCommentContent8"
      │
      └─[UserName9] - +5
        "ChildCommentContent9"
*/
