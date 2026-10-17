const paths: Record<string, string> = {
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5 M9 3v16 M15 5v16",
  military: "M12 3l8 4v6c0 4-8 8-8 8s-8-4-8-8V7z M8 8l8 8 M16 8l-8 8",
  build: "M4 20l9-9 M12 4l3-2 7 7-3 3z M3 17l4 4",
  technology: "M9 3h6 M10 3v7l-6 10h16l-6-10V3 M7 15h10",
  economy: "M3 20h18 M5 17v-6h3v6 M11 17V7h3v10 M17 17V3h3v14",
  resources: "M4 8 12 3l8 5v9l-8 5-8-5z M4 8l8 5 8-5 M12 13v9",
  gate: "M4 21V9a8 8 0 0116 0v12 M8 21V9a4 4 0 018 0v12 M2 21h20",
  diplomacy: "M3 4h18v12H9l-6 5V4 M7 8h10 M7 12h7",
  communications: "M4 4h16v12H9l-5 4V4 M8 8h8 M8 12h5",
  legacy: "M8 3h8v8a4 4 0 01-8 0V3 M8 5H3v4a4 4 0 005 4 M16 5h5v4a4 4 0 01-5 4 M12 15v6 M8 21h8",
  orders: "M9 5h12 M9 12h12 M9 19h12 M2 5l2 2 3-4 M2 12l2 2 3-4 M2 19l2 2 3-4",
  room: "M3 21V3h14v18 M17 8h4v13 M7 7h2 M12 7h2 M7 12h2 M12 12h2 M9 21v-5h4v5",
  academy: "M3 6l9-4 9 4-9 4z M6 9v6c3 2 9 2 12 0V9 M21 6v8",
};

export default function CommandIcon({ name }: { name: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.orders} /></svg>;
}
