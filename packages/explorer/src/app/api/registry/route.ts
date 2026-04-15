import { fetchRegistrySnapshot } from "@/lib/registry";

/**
 * GET /api/registry
 * Client-side polling endpoint — returns the current registry snapshot.
 * The Next.js RSC page uses this for live updates without full page reloads.
 */
export async function GET() {
  try {
    const snapshot = await fetchRegistrySnapshot();
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to fetch registry" },
      { status: 500 },
    );
  }
}
