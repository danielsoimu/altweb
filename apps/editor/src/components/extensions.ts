/**
 * TipTap extension set for the ALTWEB editor.
 * Built from Novel's presets (Apache-2.0) plus TipTap table support.
 * No AI extensions, no embeds that phone home — everything runs locally.
 */

import {
  StarterKit,
  Placeholder,
  TiptapLink,
  TiptapImage,
  TiptapUnderline,
  HighlightExtension,
  TaskList,
  TaskItem,
  HorizontalRule,
  GlobalDragHandle,
  UploadImagesPlugin,
} from 'novel';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';

const starterKit = StarterKit.configure({
  // Novel's HorizontalRule (with the --- input rule) replaces the default one
  horizontalRule: false,
  bulletList: {
    HTMLAttributes: { class: 'aw-bullet-list' },
  },
  orderedList: {
    HTMLAttributes: { class: 'aw-ordered-list' },
  },
  blockquote: {
    HTMLAttributes: { class: 'aw-blockquote' },
  },
  codeBlock: {
    HTMLAttributes: { class: 'aw-code-block' },
  },
  code: {
    HTMLAttributes: { class: 'aw-inline-code', spellcheck: 'false' },
  },
  dropcursor: {
    color: '#9ca3af',
    width: 3,
  },
});

const link = TiptapLink.configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'aw-link',
    rel: 'noopener noreferrer nofollow',
  },
});

const image = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [UploadImagesPlugin({ imageClass: 'aw-image aw-image-uploading' })];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: { class: 'aw-image' },
});

const taskList = TaskList.configure({
  HTMLAttributes: { class: 'aw-task-list' },
});

const taskItem = TaskItem.configure({
  nested: false,
  HTMLAttributes: { class: 'aw-task-item' },
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: { class: 'aw-hr' },
});

export const defaultExtensions = [
  starterKit,
  Placeholder,
  link,
  image,
  TiptapUnderline,
  HighlightExtension,
  taskList,
  taskItem,
  horizontalRule,
  GlobalDragHandle,
  Table.configure({ HTMLAttributes: { class: 'aw-table' } }),
  TableRow,
  TableHeader,
  TableCell,
];
