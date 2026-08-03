'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Code, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function HtmlEditor({ value, onChange, placeholder = '내용을 입력하세요...', minHeight = '300px' }: HtmlEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none max-w-none w-full p-4 min-h-[${minHeight}] text-gray-900`,
      },
    },
  });

  // 1. Sync external value to editor (only if editor's content is different from external value)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ onClick, isActive, icon: Icon, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-100 transition-colors ${isActive ? 'bg-gray-100 text-pink-500' : 'text-gray-600'}`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="flex p-2 border-b border-gray-200 bg-gray-50 items-center justify-between">
        <div className={`flex flex-wrap gap-1 items-center flex-1 ${isHtmlMode ? 'opacity-50 pointer-events-none' : ''}`}>
          <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
          title="굵게"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
          title="기울임"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          icon={Strikethrough}
          title="취소선"
        />
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          icon={Heading1}
          title="제목 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          title="제목 2"
        />
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          icon={AlignLeft}
          title="왼쪽 정렬"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          icon={AlignCenter}
          title="가운데 정렬"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          icon={AlignRight}
          title="오른쪽 정렬"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
          title="글머리 기호 목록"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={ListOrdered}
          title="번호 매기기 목록"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          icon={Code}
          title="코드 블록"
        />
        </div>
        
        <div className="ml-2 flex items-center gap-2 pl-3 border-l border-gray-300 text-sm shrink-0">
          <input 
            type="checkbox" 
            id="html-mode-toggle"
            checked={isHtmlMode}
            onChange={(e) => setIsHtmlMode(e.target.checked)}
            className="rounded border-gray-300 text-pink-500 focus:ring-pink-500 cursor-pointer w-4 h-4"
          />
          <label htmlFor="html-mode-toggle" className="cursor-pointer select-none font-medium text-gray-700">HTML</label>
        </div>
      </div>
      
      {isHtmlMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight }}
          className="w-full p-4 resize-y focus:outline-none text-gray-800 font-mono text-sm leading-relaxed bg-gray-50 border-none"
          placeholder={placeholder}
          spellCheck={false}
        />
      ) : (
        <div className="flex-1 overflow-y-auto cursor-text bg-white text-gray-900" onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
