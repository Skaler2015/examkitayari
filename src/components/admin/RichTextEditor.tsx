"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dependency-free rich-text editor (contentEditable + toolbar). Outputs HTML
 * into a hidden input so it submits with the surrounding form. The server
 * sanitises the HTML before storage/render, so execCommand output is safe.
 */
type Btn = { label: string; title: string; run: () => void };

export function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue ?? "");

  // Populate the editable area once (uncontrolled — React never re-writes it).
  useEffect(() => {
    if (ref.current && defaultValue) ref.current.innerHTML = defaultValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => setHtml(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };

  const buttons: Btn[] = [
    { label: "B", title: "Bold", run: () => exec("bold") },
    { label: "I", title: "Italic", run: () => exec("italic") },
    { label: "H2", title: "Heading", run: () => exec("formatBlock", "H2") },
    { label: "H3", title: "Sub-heading", run: () => exec("formatBlock", "H3") },
    { label: "¶", title: "Paragraph", run: () => exec("formatBlock", "P") },
    { label: "• List", title: "Bullet list", run: () => exec("insertUnorderedList") },
    { label: "1. List", title: "Numbered list", run: () => exec("insertOrderedList") },
    {
      label: "Link",
      title: "Insert link",
      run: () => {
        const url = window.prompt("Link URL (https://…):");
        if (url) exec("createLink", url);
      },
    },
    { label: "Clear", title: "Clear formatting", run: () => exec("removeFormat") },
  ];

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap gap-1 border-b bg-secondary/40 p-1.5">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.run}
            className="rounded px-2 py-1 text-xs font-medium hover:bg-secondary"
          >
            {b.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        className="prose-article min-h-[240px] max-h-[520px] overflow-y-auto p-3 text-sm focus:outline-none"
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
