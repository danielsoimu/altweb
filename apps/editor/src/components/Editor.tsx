/**
 * The writing surface: Novel (TipTap) with slash commands, a formatting
 * bubble menu, and local-only image handling.
 */

import { useEffect, useMemo, useReducer } from 'react';
import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorBubble,
  EditorBubbleItem,
  useEditor,
  handleCommandNavigation,
  handleImagePaste,
  handleImageDrop,
  type EditorInstance,
  type JSONContent,
} from 'novel';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { defaultExtensions } from './extensions';
import { slashCommand, suggestionItems } from './slash-items';
import { uploadFn } from './image-upload';

interface BubbleButton {
  name: string;
  label: string;
  icon: typeof Bold;
  isActive: (editor: EditorInstance) => boolean;
  run: (editor: EditorInstance) => void;
}

const bubbleButtons: BubbleButton[] = [
  {
    name: 'bold',
    label: 'Bold',
    icon: Bold,
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    name: 'italic',
    label: 'Italic',
    icon: Italic,
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    name: 'underline',
    label: 'Underline',
    icon: Underline,
    isActive: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    name: 'strike',
    label: 'Strikethrough',
    icon: Strikethrough,
    isActive: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    name: 'code',
    label: 'Inline code',
    icon: Code,
    isActive: (editor) => editor.isActive('code'),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    name: 'link',
    label: 'Link',
    icon: LinkIcon,
    isActive: (editor) => editor.isActive('link'),
    run: (editor) => {
      const previous = editor.getAttributes('link').href as string | undefined;
      const url = window.prompt('Link URL (leave empty to remove)', previous ?? 'https://');
      if (url === null) return;
      if (url === '' || url === 'https://') {
        editor.chain().focus().unsetLink().run();
        return;
      }
      editor.chain().focus().setLink({ href: url }).run();
    },
  },
];

/** Formatting bubble shown over a text selection. */
function FormatBubble() {
  const { editor } = useEditor();
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  // Re-render on every transaction so active states stay accurate.
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', forceRender);
    return () => {
      editor.off('transaction', forceRender);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <EditorBubble
      tippyOptions={{ placement: 'top' }}
      className="flex overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    >
      {bubbleButtons.map((button) => {
        const Icon = button.icon;
        const active = button.isActive(editor);
        return (
          <EditorBubbleItem
            key={button.name}
            onSelect={(instance) => button.run(instance)}
            className={`cursor-pointer p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
              active
                ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
            title={button.label}
          >
            <Icon size={15} strokeWidth={2.25} />
          </EditorBubbleItem>
        );
      })}
    </EditorBubble>
  );
}

interface EditorProps {
  initialContent?: JSONContent;
  onReady: (editor: EditorInstance) => void;
  onUpdate?: (editor: EditorInstance) => void;
}

export function Editor({ initialContent, onReady, onUpdate }: EditorProps) {
  const extensions = useMemo(() => [...defaultExtensions, slashCommand], []);

  return (
    <EditorRoot>
      <EditorContent
        className="relative w-full"
        extensions={extensions}
        initialContent={initialContent}
        onCreate={({ editor }) => onReady(editor)}
        onUpdate={({ editor }) => onUpdate?.(editor)}
        editorProps={{
          handleDOMEvents: {
            keydown: (_view, event) => handleCommandNavigation(event),
          },
          handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
          handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
          attributes: {
            class: 'aw-prose min-h-[65vh] focus:outline-none',
            'aria-label': 'Document editor',
          },
        }}
      >
        <EditorCommand className="z-50 h-auto max-h-[320px] w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white px-1 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <EditorCommandEmpty className="px-2 py-1 text-sm text-neutral-500">
            No results
          </EditorCommandEmpty>
          <EditorCommandList>
            {suggestionItems.map((item) => (
              <EditorCommandItem
                key={item.title}
                value={item.title}
                onCommand={(val) => item.command?.(val)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-neutral-800 aria-selected:bg-neutral-100 dark:text-neutral-200 dark:aria-selected:bg-neutral-800"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-xs text-neutral-500">{item.description}</p>
                </div>
              </EditorCommandItem>
            ))}
          </EditorCommandList>
        </EditorCommand>
        <FormatBubble />
      </EditorContent>
    </EditorRoot>
  );
}
