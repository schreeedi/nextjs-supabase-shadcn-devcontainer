/**
 * Structured data (schema.org) as JSON-LD. `<` is escaped so content such as
 * "</script>" inside a string can't break out of the script tag (XSS).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
