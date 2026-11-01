"use client";

import { useId } from "react";
import { InlineScript } from "./InlineScript";

// LEARNING NOTE: the server cannot know the browser's timezone, and in Docker it
// runs in UTC, so a date formatted there is wrong for the user. Formatting it in a
// plain Client Component causes a hydration error, and useEffect causes a visible
// flash. Instead, an inline script fixes the text as the HTML is parsed, before
// the first paint, and suppressHydrationWarning tells React to keep that text.
// Being a Client Component covers lists re-rendered in place, where the script
// never runs: there, this code runs in the browser and formats correctly.

const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export function LocalDateTime({ value }: { value: string }) {
  const id = useId();
  const format = `new Date(${JSON.stringify(value)}).toLocaleString(undefined,${JSON.stringify(options)})`;

  return (
    <>
      <time id={id} dateTime={value} suppressHydrationWarning>
        {new Date(value).toLocaleString(undefined, options)}
      </time>
      <InlineScript
        html={`{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=${format}}`}
      />
    </>
  );
}
