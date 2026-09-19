/** Page backdrop. The earlier design drew a grid and glows here; now it is a flat surface. */
export function BackgroundFx() {
  return <div className="pointer-events-none fixed inset-0 -z-10 bg-void" aria-hidden="true" />;
}
