'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Undo, Redo } from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, onChange, placeholder = 'Start writing...', className = '' }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] px-3 py-2 text-gray-900',
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-primary text-gray-500'
          : 'text-gray-600 hover:text-white hover:bg-primary-light'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`bg-white border border-primary-light/50 rounded-lg overflow-hidden text-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-primary-light/20">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #6b7280;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          min-height: 150px;
          color: #111827;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.25rem;
        }
        .ProseMirror p {
          margin-bottom: 0.5rem;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror strong {
          font-weight: 600;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
