/** Strukturirani podaci za pretraživače (schema.org). `<` se escapuje da tekst iz baze ne može zatvoriti skriptu. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
