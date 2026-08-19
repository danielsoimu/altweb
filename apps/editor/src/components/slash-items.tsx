/**
 * Slash command menu items ("/" in the editor).
 */

import {
  Command,
  createSuggestionItems,
  renderItems,
} from 'novel';
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Table as TableIcon,
  Text,
  TextQuote,
} from 'lucide-react';
import { uploadFn } from './image-upload';

export const suggestionItems = createSuggestionItems([
  {
    title: 'Text',
    description: 'Plain paragraph',
    searchTerms: ['p', 'paragraph'],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['title', 'big', 'h1'],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['subtitle', 'medium', 'h2'],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    searchTerms: ['subtitle', 'small', 'h3'],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet list',
    description: 'Simple bullet list',
    searchTerms: ['unordered', 'point', 'ul'],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered list',
    description: 'List with numbering',
    searchTerms: ['ordered', 'ol'],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task list',
    description: 'Checklist with checkboxes',
    searchTerms: ['todo', 'task', 'check', 'checkbox'],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    searchTerms: ['blockquote', 'citation'],
    icon: <TextQuote size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run();
    },
  },
  {
    title: 'Code block',
    description: 'Snippet with monospace font',
    searchTerms: ['codeblock', 'pre'],
    icon: <Code size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Table',
    description: '3x3 table with header row',
    searchTerms: ['table', 'grid', 'rows'],
    icon: <TableIcon size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: 'Image',
    description: 'Embed an image (stored inside the capsule)',
    searchTerms: ['photo', 'picture', 'media', 'img'],
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          const pos = editor.view.state.selection.from;
          uploadFn(file, editor.view, pos);
        }
      };
      input.click();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    searchTerms: ['hr', 'separator', 'line'],
    icon: <Minus size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
]);

export const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
});
