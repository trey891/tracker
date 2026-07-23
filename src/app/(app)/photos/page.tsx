import { getAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { PhotoGallery, type PhotoMeta } from "@/components/PhotoGallery";

export const dynamic = "force-dynamic";

export default async function ProgressPhotosPage() {
  const { session, access } = await getAccess();
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="Progress Photos" subtitle="Site documentation over time" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const photos = await prisma.attachment.findMany({
    where: { projectId: project.id, kind: "photo" },
    // newest first: prefer the photo's date taken (nulls last), then upload time
    orderBy: [{ takenDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, filename: true, description: true, takenDate: true, createdAt: true, uploadedBy: true },
  });

  const dtos: PhotoMeta[] = photos.map((p) => ({
    id: p.id,
    filename: p.filename,
    description: p.description,
    takenDate: p.takenDate ? p.takenDate.toISOString().slice(0, 10) : null,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy,
  }));

  return (
    <>
      <Topbar
        title="Progress Photos"
        subtitle={`${project.name} — site documentation, newest first`}
        user={session?.user ?? {}}
      />
      <PhotoGallery photos={dtos} readOnly={access === "viewer"} />
    </>
  );
}
