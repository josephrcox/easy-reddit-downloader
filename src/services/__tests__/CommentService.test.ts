const { CommentService } = require("../CommentService");
const { LogService } = require("../LogService");
const { RuntimeConfig } = require("../../types/runtime");
const axios = require("axios");

jest.mock("axios");
const mockedAxios = jest.mocked(axios);

interface MockLogger {
  log: jest.Mock;
  logError: jest.Mock;
}

interface MockConfig {
  download_comments: boolean;
  file_format_options: {
    comment_format: string;
  };
}

describe("CommentService", () => {
  let commentService: InstanceType<typeof CommentService>;
  let mockLogger: MockLogger;
  let mockConfig: MockConfig;

  const mockRedditResponse = [
    {}, // First element is post data
    {
      data: {
        children: [
          {
            data: {
              author: "user1",
              body: "comment1",
              score: 10,
              replies: {
                data: {
                  children: [
                    {
                      data: {
                        author: "user2",
                        body: "reply2",
                        score: 5,
                        replies: "",
                      },
                    },
                    {
                      data: {
                        author: "user3",
                        body: "reply3",
                        score: 2,
                        replies: {
                          data: {
                            children: [
                              {
                                data: {
                                  author: "user4",
                                  body: "reply4",
                                  score: -10,
                                  replies: "",
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            data: {
              author: "user4",
              body: "comment2",
              score: 5,
              replies: {
                data: {
                  children: [
                    {
                      data: {
                        author: "user5",
                        body: "reply5",
                        score: 5,
                        replies: "",
                      },
                    },
                    {
                      data: {
                        author: "user6",
                        body: "reply6",
                        score: 2,
                        replies: {
                          data: {
                            children: [
                              {
                                data: {
                                  author: "user7",
                                  body: "reply7",
                                  score: -10,
                                  replies: {
                                    data: {
                                      children: [
                                        {
                                          data: {
                                            author: "user8",
                                            body: "reply8",
                                            score: -10,
                                            replies: "",
                                          },
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                              {
                                data: {
                                  author: "user7",
                                  body: "reply7",
                                  score: -10,
                                  replies: "",
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      logError: jest.fn(),
    };

    mockConfig = {
      download_comments: true,
      file_format_options: {
        comment_format: "json",
      },
    };

    commentService = new CommentService(mockConfig, mockLogger);
    mockedAxios.get.mockReset();
  });

  describe("fetchAndFormatComments", () => {
    it("should return null if download_comments is false", async () => {
      mockConfig.download_comments = false;
      const result = await commentService.fetchAndFormatComments("https://reddit.com/r/test/123");
      expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      mockedAxios.get.mockRejectedValue(new Error("API Error"));
      const result = await commentService.fetchAndFormatComments("https://reddit.com/r/test/123");
      expect(result).toBeNull();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch comments"), true);
    });

    describe("JSON format", () => {
      beforeEach(() => {
        mockConfig.file_format_options.comment_format = "json";
        mockedAxios.get.mockResolvedValue({ data: mockRedditResponse });
      });

      it("should convert comments to JSON format correctly", async () => {
        const result = await commentService.fetchAndFormatComments("https://reddit.com/r/test/123");
        const parsed = JSON.parse(result!);

        expect(parsed).toHaveLength(2);
        // First comment thread
        expect(parsed[0]).toEqual({
          user: "user1",
          comment: "comment1",
          votes: 10,
          child: [
            {
              user: "user2",
              comment: "reply2",
              votes: 5,
              child: [],
            },
            {
              user: "user3",
              comment: "reply3",
              votes: 2,
              child: [
                {
                  user: "user4",
                  comment: "reply4",
                  votes: -10,
                  child: [],
                },
              ],
            },
          ],
        });
        // Second comment thread
        expect(parsed[1]).toEqual({
          user: "user4",
          comment: "comment2",
          votes: 5,
          child: [
            {
              user: "user5",
              comment: "reply5",
              votes: 5,
              child: [],
            },
            {
              user: "user6",
              comment: "reply6",
              votes: 2,
              child: [
                {
                  user: "user7",
                  comment: "reply7",
                  votes: -10,
                  child: [
                    {
                      user: "user8",
                      comment: "reply8",
                      votes: -10,
                      child: [],
                    },
                  ],
                },
                {
                  user: "user7",
                  comment: "reply7",
                  votes: -10,
                  child: [],
                },
              ],
            },
          ],
        });
      });
    });

    describe("CSV format", () => {
      beforeEach(() => {
        mockConfig.file_format_options.comment_format = "csv";
        mockedAxios.get.mockResolvedValue({ data: mockRedditResponse });
      });

      it("should convert comments to CSV format correctly", async () => {
        const result = await commentService.fetchAndFormatComments("https://reddit.com/r/test/123");
        const lines = result!.split("\n");

        expect(lines[0]).toBe("user|comment_id|comment|votes|parent");
        expect(lines.length).toBe(11); // header + 10 comments (2 top-level + 8 replies)

        const commentLines = lines.slice(1);
        const comments = commentLines.map((line: string) => {
          const [user = "", comment_id = "", comment = "", votes = "0", parent = ""] = line.split("|");
          return { user, comment_id, comment, votes: parseInt(votes), parent };
        });

        // Verify first comment thread
        const comment1 = comments.find((c: { user: string }) => c.user === "user1");
        const reply1 = comments.find((c: { user: string }) => c.user === "user2");
        const reply2 = comments.find((c: { user: string }) => c.user === "user3");
        const reply3 = comments.find((c: { user: string; comment: string }) => c.user === "user4" && c.comment === "reply4");

        expect(comment1?.votes).toBe(10);
        expect(reply1?.parent).toBe(comment1?.comment_id);
        expect(reply2?.parent).toBe(comment1?.comment_id);
        expect(reply3?.parent).toBe(reply2?.comment_id);

        // Verify second comment thread
        const comment2 = comments.find((c: { user: string; comment: string }) => c.user === "user4" && c.comment === "comment2");
        const reply4 = comments.find((c: { user: string }) => c.user === "user5");
        const reply5 = comments.find((c: { user: string }) => c.user === "user6");

        expect(comment2?.votes).toBe(5);
        expect(reply4?.parent).toBe(comment2?.comment_id);
        expect(reply5?.parent).toBe(comment2?.comment_id);
      });
    });

    describe("TXT format", () => {
      beforeEach(() => {
        mockConfig.file_format_options.comment_format = "txt";
        mockedAxios.get.mockResolvedValue({ data: mockRedditResponse });
      });

      it("should convert comments to TXT format correctly", async () => {
        const result = await commentService.fetchAndFormatComments("https://reddit.com/r/test/123");
        const lines = result!.split("\n");
        console.log(result);

        // First comment thread
        expect(lines[0]).toBe("[user1 | +10]: comment1");
        expect(lines[1]).toBe("  ├─[user2 | +5]: reply2");
        expect(lines[2]).toBe("  └─[user3 | +2]: reply3");
        expect(lines[3]).toBe("    └─[user4 | -10]: reply4");
        expect(lines[4]).toBe("");
        expect(lines[5]).toBe("[user4 | +5]: comment2");
        expect(lines[6]).toBe("  ├─[user5 | +5]: reply5");
        expect(lines[7]).toBe("  └─[user6 | +2]: reply6");
        expect(lines[8]).toBe("    ├─[user7 | -10]: reply7");
        expect(lines[9]).toBe("    │ └─[user8 | -10]: reply8");
       expect(lines[10]).toBe("    └─[user7 | -10]: reply7");
      });
    });
  });
});
