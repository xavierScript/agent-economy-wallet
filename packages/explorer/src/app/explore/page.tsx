import { fetchRegistrySnapshot } from "@/lib/registry";
import Dashboard from "@/components/Dashboard";

// Re-fetch every 30 seconds on the server
export const revalidate = 30;

export default async function ExplorePage() {
  const snapshot = await fetchRegistrySnapshot();

  return <Dashboard snapshot={snapshot} />;
}
