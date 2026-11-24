import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Italic, Link, List, ListOrdered, Redo2, Strikethrough, Underline, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
}

const buttonClass = 'rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40';
const activeButtonClass = 'rounded bg-[#3E9AF4] p-1.5 text-white shadow-sm hover:bg-[#2563EB]';

export function RichTextEditor({ value, onChange, placeholder = 'Enter text...', minHeight = '140px' }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<Range | null>(null);
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [fontColor, setFontColor] = useState('#111827');
    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
    }, [value]);

    const refreshActiveFormats = () => {
        if (!editorRef.current?.contains(window.getSelection()?.anchorNode ?? null)) return;
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikeThrough: document.queryCommandState('strikeThrough'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
            insertOrderedList: document.queryCommandState('insertOrderedList'),
        });
    };

    useEffect(() => {
        document.addEventListener('selectionchange', refreshActiveFormats);
        return () => document.removeEventListener('selectionchange', refreshActiveFormats);
    }, []);

    const saveSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !editorRef.current?.contains(selection.anchorNode)) return;
        selectionRef.current = selection.getRangeAt(0).cloneRange();
    };

    const restoreSelection = () => {
        const selection = window.getSelection();
        if (!selection || !selectionRef.current) return;
        selection.removeAllRanges();
        selection.addRange(selectionRef.current);
    };

    const emitChange = () => onChange(editorRef.current?.innerHTML ?? '');

    const applyCommand = (command: string, commandValue?: string) => {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand(command, false, commandValue);
        refreshActiveFormats();
        saveSelection();
        emitChange();
    };

    const applyFontSize = (size: string) => {
        editorRef.current?.focus();
        restoreSelection();
        const existingSizeNodes = new Set(editorRef.current?.querySelectorAll('font[size="7"]') ?? []);
        document.execCommand('fontSize', false, '7');
        editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
            if (existingSizeNodes.has(font)) return;
            const span = document.createElement('span');
            span.style.fontSize = `${size}px`;
            span.innerHTML = font.innerHTML;
            font.replaceWith(span);
        });
        saveSelection();
        emitChange();
    };

    const openLinkDialog = () => {
        saveSelection();
        setLinkUrl('');
        setLinkDialogOpen(true);
    };

    const styleSelectedLink = () => {
        const selection = window.getSelection();
        const node = selection?.anchorNode;
        const element = node instanceof Element ? node : node?.parentElement;
        const link = element?.closest('a');
        if (link) {
            link.style.color = '#3E9AF4';
            link.style.textDecoration = 'underline';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    };

    const insertLink = () => {
        if (!linkUrl.trim()) return;
        applyCommand('createLink', linkUrl.trim());
        styleSelectedLink();
        emitChange();
        setLinkDialogOpen(false);
        setLinkUrl('');
    };

    return (
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
                <button type="button" title="Undo" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('undo')} className={buttonClass}><Undo2 className="h-4 w-4" /></button>
                <button type="button" title="Redo" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('redo')} className={buttonClass}><Redo2 className="h-4 w-4" /></button>
                <span className="mx-1 h-5 border-l border-gray-300" />
                <Select defaultValue="14" onOpenChange={(open) => open && saveSelection()} onValueChange={applyFontSize}>
                    <SelectTrigger className="h-8 w-[82px] border-gray-200 px-2 text-xs" aria-label="Font size"><SelectValue placeholder="Font size" /></SelectTrigger>
                    <SelectContent><SelectItem value="8">8</SelectItem><SelectItem value="9">9</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="11">11</SelectItem><SelectItem value="12">12</SelectItem><SelectItem value="14">14</SelectItem><SelectItem value="16">16</SelectItem><SelectItem value="18">18</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="24">24</SelectItem><SelectItem value="28">28</SelectItem><SelectItem value="32">32</SelectItem><SelectItem value="36">36</SelectItem><SelectItem value="48">48</SelectItem><SelectItem value="72">72</SelectItem></SelectContent>
                </Select>
                <Select defaultValue="Arial" onOpenChange={(open) => open && saveSelection()} onValueChange={(value) => applyCommand('fontName', value)}>
                    <SelectTrigger className="h-8 w-[100px] border-gray-200 px-2 text-xs" aria-label="Font"><SelectValue placeholder="Font" /></SelectTrigger>
                    <SelectContent><SelectItem value="Arial">Arial</SelectItem><SelectItem value="Georgia">Georgia</SelectItem><SelectItem value="Tahoma">Tahoma</SelectItem><SelectItem value="Times New Roman">Times New Roman</SelectItem><SelectItem value="Verdana">Verdana</SelectItem></SelectContent>
                </Select>
                <span className="mx-1 h-5 border-l border-gray-300" />
                <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('bold')} className={activeFormats.bold ? activeButtonClass : buttonClass}><Bold className="h-4 w-4" /></button>
                <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('italic')} className={activeFormats.italic ? activeButtonClass : buttonClass}><Italic className="h-4 w-4" /></button>
                <button type="button" title="Underline" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('underline')} className={activeFormats.underline ? activeButtonClass : buttonClass}><Underline className="h-4 w-4" /></button>
                <button type="button" title="Strikethrough" aria-label="Strikethrough" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('strikeThrough')} className={activeFormats.strikeThrough ? activeButtonClass : buttonClass}><Strikethrough className="h-4 w-4" /></button>
                <label title="Font color" className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded text-sm font-bold text-gray-700 hover:bg-gray-200"><span className="border-b-2" style={{ borderBottomColor: fontColor }}>A</span><input type="color" aria-label="Font color" value={fontColor} onMouseDown={saveSelection} onChange={(event) => { setFontColor(event.target.value); applyCommand('foreColor', event.target.value); }} className="absolute inset-0 cursor-pointer opacity-0" /></label>
                <span className="mx-1 h-5 border-l border-gray-300" />
                <button type="button" title="Bulleted list" aria-label="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('insertUnorderedList')} className={activeFormats.insertUnorderedList ? activeButtonClass : buttonClass}><List className="h-4 w-4" /></button>
                <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('insertOrderedList')} className={activeFormats.insertOrderedList ? activeButtonClass : buttonClass}><ListOrdered className="h-4 w-4" /></button>
                <button type="button" title="Align left" aria-label="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyLeft')} className={buttonClass}><AlignLeft className="h-4 w-4" /></button>
                <button type="button" title="Align center" aria-label="Align center" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyCenter')} className={buttonClass}><AlignCenter className="h-4 w-4" /></button>
                <button type="button" title="Align right" aria-label="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyRight')} className={buttonClass}><AlignRight className="h-4 w-4" /></button>
                <span className="mx-1 h-5 border-l border-gray-300" />
                <button type="button" title="Add link" aria-label="Add link" onMouseDown={(event) => event.preventDefault()} onClick={openLinkDialog} className={buttonClass}><Link className="h-4 w-4" /></button>
                <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('removeFormat')} className={buttonClass}><Eraser className="h-4 w-4" /></button>
            </div>
            <div ref={editorRef} contentEditable role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={() => { saveSelection(); emitChange(); }} onKeyUp={saveSelection} onMouseUp={saveSelection} className="max-w-none overflow-y-auto px-3 py-2 text-sm text-gray-900 outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_a]:text-[#3E9AF4] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6" style={{ minHeight }} suppressContentEditableWarning />
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Insert Link</DialogTitle>
                        <DialogDescription>Enter the URL for the selected text.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label htmlFor="rich-text-link-url" className="text-sm font-medium text-gray-900">URL</label>
                        <Input id="rich-text-link-url" type="url" autoFocus value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && insertLink()} placeholder="https://example.com" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-50" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                        <Button type="button" className="bg-[#3E9AF4] text-white hover:bg-[#2563EB]" onClick={insertLink} disabled={!linkUrl.trim()}>Insert Link</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
