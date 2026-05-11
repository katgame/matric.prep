import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RevisionPackReader } from "@/components/revision-pack-reader";
import { fetchRevisionPack } from "@/lib/api";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function RevisionPackPage({ params }: PageProps) {
  const { packId } = await params;
  const pack = await fetchRevisionPack(packId).catch(() => null);
  if (!pack) notFound();

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader backHref="/revision" backLabel="Back to revision" title="Revision pack" />
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <RevisionPackReader pack={pack} />
      </main>
    </div>
  );
}
