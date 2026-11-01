/**
 * React warns when a client render produces a <script> tag, and the script would
 * not run anyway. So it is only live in the server-rendered HTML.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
