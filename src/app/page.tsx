import { ColorShift } from "@/components/color-shift";
import { parseShare } from "@/lib/share";

// Reads a share link on the server, so the first HTML already has the shared pair (no flash of
// the defaults). Reading searchParams makes this page render per request instead of at build.
export default async function Home({ searchParams }: PageProps<"/">) {
  return <ColorShift shared={parseShare(await searchParams)} />;
}
