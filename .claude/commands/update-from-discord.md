---
description: "Read Discord messages and update notes accordingly"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "TodoWrite", "WebFetch"]
---

Please help me update my notes from new Discord messages. Here's what I need you to do:

1. **Check current public pages**: First, fetch https://notes.dt.in.th/api/sitegraph.json to understand what pages are currently public and reachable.

2. **Read Discord messages**: Run `~/virta/read` to get the current Discord messages. Note: The output is already JSON and doesn't need jq parsing.

3. **Find new messages**: Look for any new messages that came after the last message from virtabot (ID: 713802108050210837). These are the messages I need to process. All messages in the output are already parsed and ready for analysis.

4. **Analyze and propose updates**: Based on the new message content, propose how to update my notes. Consider:
   - Whether to create new notes or update existing ones
   - What topics are relevant and should be linked
   - Whether the content should be public or private
   - How to maintain the interconnected nature of my digital garden

5. **Update notes**: After I approve your proposal, update the relevant notes in the `data/` directory following my established patterns:
   - Use my direct, practical writing style
   - Include code examples where relevant
   - Add proper cross-references using WikiLink format `[Link Text](NoteName)`
   - Update relevant topic pages with bidirectional links
   - Add to `Recent.md` if creating new public notes
   - Use appropriate frontmatter (minimal: just `title` and `public: true`)

6. **Publish if needed**: If you created or updated public notes, run `yarn sync` to publish them.

7. **Reply to Discord**: Once the notes are successfully updated, send a confirmation message to Discord using `~/virta/write 'message'` letting me know what was updated.

Please start by checking the sitegraph and Discord messages.

## Technical Notes

### Discord Integration Tools
- **`~/virta/read`**: Outputs pre-parsed JSON - no need for `jq` or additional parsing
- **`~/virta/write 'message'`**: Send messages to Discord with markdown link support
- **Message Identification**: Look for messages after the last virtabot message (ID: 713802108050210837) to identify new content
- **Publishing Flow**: Always run `yarn sync` after updating public notes to publish changes