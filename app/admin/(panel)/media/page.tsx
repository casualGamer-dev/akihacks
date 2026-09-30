import MediaManager from "@/components/admin/MediaManager";
import { listMedia } from "../../actions";

export default async function Media() {
  return (
    <>
      <h1 className="font-pixel text-4xl">Photos</h1>
      <p className="mb-8 mt-3 max-w-xl text-muted">
        Upload here, copy the URL, or upload straight from a field while editing (organiser photos,
        logos). PNG, JPEG, WebP or GIF, up to 5 MB.
      </p>
      <MediaManager initial={await listMedia()} />
    </>
  );
}
