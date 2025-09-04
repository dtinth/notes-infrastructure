# CLAUDE.md

This file proyeah because vides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal digital garden/notes infrastructure for Thai (dtinth). The repository contains:

- **Private notes by default** - stored as Markdown files in `data/` directory
- **Public notes** - marked with `public: true` in front matter
- **Publishing system** - generates static HTML and RSS feeds via `yarn sync`
- **VS Code extension** - custom tooling for note management and linking

## Key Commands

- `yarn sync` - Publishes public notes to the static site (main publishing command)

## Content Organization & Reachability

### Note Types

1. **Public & Reachable** - Notes with `public: true` that are linked from HomePage or topic pages
2. **Unlisted** - Notes with `public: true` but not reachable from the main navigation
3. **Private** - Notes without `public: true` (default state)

### Topic System

- Topic pages have `topic: true` in front matter
- HomePage links to topics, topics link to related articles
- **Important**: When mentioning topics like JavaScript, Docker, etc., always link to the topic page: `[JavaScript](JavaScript)`
- When adding new notes, identify relevant topics and add bidirectional links

### Link Management Strategy

- **DO NOT link to unlisted notes** - only link to notes reachable from HomePage
- Check reachability via: `curl https://notes.dt.in.th/api/sitegraph.json`
- Use WikiLink format: `[Link Text](NoteName)`
- Strive to link related notes to each other bidirectionally
- When creating new content, update relevant topic pages to include the new note

## Writing Style & Content Patterns

### Thai’s Writing Characteristics

- **Direct and practical** - minimal preamble, gets to the point quickly
- **Reference-focused** - writes primarily for personal reference but shares publicly to help others
- **Example-driven** - provides concrete code snippets and usage examples
- **Link-heavy** - extensively cross-references related notes
- **Personal voice** - uses first person, shares personal experiences

### Content Structure

- Opens with context/problem statement
- Provides practical solution with code
- Minimal explanation unless complex
- Links to related concepts
- Often includes images/screenshots for visual context

### Example Opening Patterns

- "I had to generate presigned GET URLs..."
- "Sometimes I need to quickly deploy..."
- "For small, server-heavy web applications..."

## Front Matter Requirements

### Standard Front Matter

```yaml
---
title: 'Descriptive Title'
public: true
---

```

### Additional Fields (use only when needed)

```yaml
---
title: 'Page Title'
public: true
created: 2020-10-03 # Creation date (YYYY-MM-DD format, especially useful for renamed files)
topic: true # For topic pages only
wide: true # For wider page layout
meta: true # For meta pages
facebook: https:// # For social media links
aliases: # For alternative names/IDs
  - 20201003T154758Z3667
---

```

## Page Types & Structure

### Topic Pages

**Purpose**: Hub pages that collect related notes and external resources on a specific subject
**Front matter**: `topic: true`
**Structure**:

1. **Short paragraph intro** - brief definition or description of the topic
2. **List of notes** - chronological order (older first), personal notes related to the topic
3. **Bookmarks section** - external resources with 🔖 emoji
4. **Related topics section** - links to other relevant topic pages

**Examples**: [Creatorsgarten](Creatorsgarten), [DigitalGardening](DigitalGardening), [IndieWeb](IndieWeb)

### Wide Pages

**Purpose**: Pages that benefit from wider layout and two-column structure
**Front matter**: `wide: true`
**Structure**: Uses `:::::split` with `::::aside` for right column content

**Examples**: [AboutNotes](AboutNotes), [ManagingKnowledgePublicly](ManagingKnowledgePublicly)

### Regular Notes

**Purpose**: Standard single-topic notes, tutorials, problem-solutions
**Structure**: Direct and practical content following Thai's writing style

**Examples**: Most notes in the system

## Content Management Workflow

### Creating New Notes

1. Start with private note (no front matter or `public: false`)
2. Add `title` and `public: true` when ready to publish
3. Identify relevant topics and add cross-links
4. Add note to relevant topic pages
5. Add to `Recent.md` for RSS generation
6. Run `yarn sync` to publish

### Renaming Notes

When renaming a note from `OldName` to `NewName`:

1. **Move the file** using `mv data/OldName.md data/NewName.md`
2. **Add alias** to the renamed file's front matter: add `OldName` to the `aliases` array
3. **Find all references** using `Grep` with pattern `OldName` in the `data/` folder
4. **Update all links** that reference `OldName` to use `NewName` instead
5. User will run `yarn sync` themselves to republish

This ensures backward compatibility through aliases while updating all internal references to use the new name.

### Recent Notes Management

- Manually add new public notes to `Recent.md`
- Follow the date format: `2025-07-31: [Title](NoteName)`
- This file generates the RSS feed

## File Organization

- `data/` - All note content (Markdown files)
- `published/` - Generated HTML files (auto-generated, don’t edit)
- `scripts/` - Utility scripts for note management
- `service/` - Backend service (private notes publishing)

## Special Markdown Syntax

The notes system supports several custom Markdown extensions:

### Two-Column Layout

- **Directive syntax**: `:::::split` with `::::aside` for right column content
- **Usage**: Moderately used (41 occurrences across 7 files)

### Grid System

- **Syntax**: `<r-grid columns="3">` with `<r-cell>` elements
- **Usage**: Occasionally used (24 occurrences across 7 files)

### Callouts (Info Boxes)

- **Syntax**: `:::info`, `:::warning`, `:::tip`, `:::success`, `:::important`, `:::danger`, `:::caution`
- **Custom titles**: All callout types support custom titles with bracket syntax: `:::info[Custom Title]`
- **Usage**: Commonly used (36+ occurrences across 13+ files)
- **Details**: `:::details[Title]` for collapsible content

### Chat Bubbles & Thoughts

- **Syntax**: `:::me`, `:::bubble[Author]`, `:::thought`
- **Usage**: Occasionally used (29 occurrences across 4 files)
- **Purpose**: Simulating conversations or internal thoughts

### YouTube Embeds

- **Syntax**: `::youtube[VIDEO_ID]`
- **Usage**: Rarely used (7 occurrences across 6 files)

### Lead Text

- **Syntax**: `:::lead` for emphasized introductory text
- **Usage**: Frequently used across many files

### Footnotes

- **Syntax**: `[^footnote_name]` in text, then `[^footnote_name]: content` at bottom
- **Usage**: For detailed explanations that would interrupt the main flow
- **Rendering**: Footnote markers become clickable buttons that display content in popovers on the web
- **Guidelines**: Footnotes can be long and detailed - they keep the main text direct while providing technical details

### Figures and Images

- **Syntax**: `:::figure[Caption text]{.class}` directive for proper semantic markup
- **Classes**:
  - `framed` - adds border/frame around images
- **Usage**: For images, screenshots, and visual content that needs captions
- **Examples**: [AboutNotes](AboutNotes), [ManagingKnowledgePublicly](ManagingKnowledgePublicly)

```markdown
:::figure[Image caption with links]{.framed}
![Alt text](image-url)
:::
```

## Guidelines for Content Creation

When helping create or edit notes:

1. **Follow the established voice** - be direct, practical, and personal
2. **Include code examples** - concrete implementations over abstract explanations
3. **Add cross-references** - link to related notes and topics using WikiLink format
4. **Update topic pages** - add bidirectional links between new notes and relevant topics
5. **Update Recent.md** - add new public notes to the recent writings list
6. **Use minimal front matter** - only `title` and `public: true` unless other fields are needed
7. **Maintain reachability** - ensure new notes are linked from HomePage or topic pages
8. **Use special syntax appropriately** - leverage callouts for important information, two-column layout for side-by-side content, and other custom elements when they enhance readability
9. **Link structure** - Regular notes should inline link keywords to topics (e.g., `[GitHub Actions](GitHubActions)`). "Related" sections are only for topic pages, not regular notes
10. **Use smart quotes in prose**

## Navigation Philosophy

This is a "maze-like" digital garden where navigation happens through links rather than hierarchical structure. The key principle is **reachability** - all public content should be discoverable by following links from the HomePage through topic pages.

When creating content:

- Link liberally to related concepts and topics
- Use descriptive link text
- Cross-reference both ways when relevant
- Help maintain the interconnected nature of the knowledge base
- Always check that new notes are reachable through the topic system

### Content Organization Patterns

**Topic vs Related Topics Placement**:

- Add notes directly to topic lists when they are specific implementations/tutorials
- Add to "Related topics" section when they are standalone tools/concepts that relate to the topic
- Example: Mosh goes in Linux "Related topics" since it’s a standalone tool, not a Linux tutorial

**Recent.md Management**: Only add substantial new articles to Recent.md, not every new topic page

**Lead Section Guidelines**:

- Use first person ("Here’s how I...") or contextual intro ("X has Y feature, here’s how I...")
- For updates to existing information, use `:::info` callouts rather than modifying the main lead

## Topic Page Creation Workflow

When creating new topic pages (`topic: true`):

### Assessment Criteria

- **Content volume**: At least 3+ dedicated notes or 30+ total mentions across multiple files
- **Coherent theme**: Content forms a logical grouping around a specific technology, concept, or tool
- **Cross-references**: Existing notes already reference each other or share common themes

### Creation Process

1. **Content audit**: Use Grep to find all mentions and assess content volume
2. **Create topic page**: Include brief description and links to main articles
3. **Update external links**: Replace external URLs with internal topic links where appropriate
4. **Add to HomePage**: Insert in alphabetical order in the topics list
5. **Cross-reference**: Add to related topics’ “Related topics” sections
6. **Publish linked content**: Ensure all linked notes are public to avoid broken links

### Link Management Strategy

- **Selective backlinking**: Add 1-2 meaningful backlinks from main articles, not every mention
- **External link replacement**: Replace `[Tool](https://example.com/)` with `[Tool](Tool)` in main content
- **Bidirectional linking**: Ensure topic appears in related topics’ pages

### Publishing Considerations

- **Topic pages go to HomePage**: Add to alphabetical topics list, not Recent.md
- **Linked content must be public**: Check and publish any private notes referenced by the topic
- **Cross-reference updates**: Update Database, Tools, or other relevant topic pages

## Old Blog Migration Workflow

When migrating content from Thai's old blog (dt.in.th) to the notes system:

### Fetching Content

**ALWAYS use curl** - WebFetch gives summaries, not exact raw content:

```bash
curl -s "https://raw.githubusercontent.com/dtinth/dt.in.th/refs/heads/master/{slug}.md"
```

### Conversion Rules

1. **File naming**: Convert `hyphenated-slug` → `CamelCase`
2. **Add alias**: Include old slug in `aliases` array for domain migration
3. **Component conversion**:
   - `<YouTube id="X" />` → `::youtube[X]`
   - `<SoundCloud id="X" />` → `::soundcloud[X]`
   - `<call-to-action href="...">Text</call-to-action>` → `::cta[Text]{href="..."}`
   - Remove `<template>` wrappers

### Front Matter Processing

**Remove these fields**:

- `parents` (ignore completely)
- `image` and `description` (unless specifically requested to keep)
- `updated` (if same as `created`)
- `soundcloud` (unless specifically requested to keep)

**Convert these fields**:

- `created: 2016-09-23T00:00:00.000Z` → `created: 2016-09-23` (remove time component)

**Add these fields**:

- `public: true`
- `aliases: [old-slug]`

**Keep these fields unchanged**:

- `song` metadata structure (artist, type, genre)
- `title`

### Link Conversion

- `./filename.md` → `https://dt.in.th/filename.html` (for unmigrated content)
- `./filename.md` → `NoteName` (if already migrated to notes system)
- Always check if referenced content exists in notes system first

### Content Rules

1. **Always add H1 heading** matching the title
2. **Preserve ALL content** - including complete submission texts, lyrics, etc.
3. **Topic linking**: Link only the FIRST occurrence of topic words (e.g., first "song" → `[song](Songs)`) to avoid link spam
4. **Cross-references**: Update referring pages to link to new note name

### Songs-Specific Workflow

For song migrations:

1. **Add to Songs table** in chronological order (newest first)
2. **Table format**: `| YYYY-MM-DD | [**Title**](NoteName) | GENRE | Description |`
3. **Genre**: Use uppercase genre from front matter
4. **Description**: Brief summary, don't link "song" in table (avoid self-reference)
5. **Capitalization matters**: Use correct acronym capitalization (e.g., `BMS` not `Bms`)

### Cross-Reference Updates

After migration, update all references to the old content:

1. **Search for old slug**: `grep -r "old-slug" data/`
2. **Search for old domain links**: `grep -r "old-slug\.html" data/`
3. **Update all references** to use the new `NoteName` format
4. **Verify no broken links** remain in the system

### Common Pitfalls to Avoid

- **Don't use WebFetch** - use curl for exact content
- **Don't skip submission texts** - these are valuable historical context
- **Don't spam topic links** - only link first occurrence
- **Don't forget cross-references** - update other pages that reference the content
- **Don't assume component syntax** - verify directive formats (::youtube, ::soundcloud, ::cta)
- **Always grep for old references** - other pages may link to the old blog URLs

## Critical Editing Limitations

### Curly Quotes Issue

**IMPORTANT**: Due to Claude Code limitation (https://github.com/anthropics/claude-code/issues/1599), Claude cannot output curly quotes ("smart quotes"). When editing existing text that contains curly quotes, they will be automatically converted to straight quotes.

**Mitigation strategies**:
- Use **surgical replacements** that target only specific URLs/links, not entire sentences
- When possible, replace only the minimal necessary text (e.g., just the URL part)
- Avoid editing large blocks of text that contain curly quotes
- Be especially careful with Thai's writing which uses smart quotes throughout

**Example of surgical replacement**:
```
# Good - only replace the URL
old_string: "https://dt.in.th/old-slug.html"
new_string: "NewNoteName"

# Bad - would convert curly quotes to straight quotes
old_string: "I wrote about this in my [article](https://dt.in.th/old-slug.html) which..."
```

## Index Topics Reference

The following are the main index/topic pages that collect related content:

- **Songs** - Musical compositions and tracks
- **Projects** - Software projects and applications  
- **Talks** - Presentations, lectures, and conference talks
- **Tools** - Development tools and utilities

When migrating content, ensure appropriate items are added to these index pages in addition to any cross-references.
