import type { Resource } from "../../../game";

export type DisplayResource = Resource | "labor" | "legacy";

const paths: Record<DisplayResource, string> = {
  material: "M4 8 12 3l8 5v9l-8 5-8-5zM4 8l8 5 8-5M12 13v9",
  currency: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15.5 8.5c-1-1-5-1.5-6.3.5-1.7 2.6 4.8 2.3 5.3 4.7.4 2.1-3.8 3.1-6 1.8M12 5v14",
  research: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M3 12c0-7 18-7 18 0S3 19 3 12zM7.5 4.2c6-3.5 14.8 12 9 15.5S1.5 7.7 7.5 4.2zM16.5 4.2c-6-3.5-14.8 12-9 15.5S22.5 7.7 16.5 4.2z",
  influence: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5zM12 9v6M9 12h6",
  labor: "M4 20v-5l4-3 4 3 4-3 4 3v5M8 12V6a4 4 0 0 1 8 0v6M4 20h16",
  legacy: "M12 4l2.4 5 5.6.8-4 4 .9 5.7L12 17l-4.9 2.5.9-5.7-4-4 5.6-.8zM3 20l4 2m14-2-4 2",
};

export const displayResources: DisplayResource[] = ["material", "currency", "research", "influence", "labor", "legacy"];

export function ResourceGlyph({ resource, label = true }: { resource: DisplayResource; label?: boolean }) {
  return <span className={`resource-glyph resource-${resource}`} title={resource} aria-label={label ? resource : undefined} aria-hidden={!label}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[resource]} /></svg>
  </span>;
}
