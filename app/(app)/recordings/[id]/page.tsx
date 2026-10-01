import type { Metadata } from "next";
import { RecordingDetail } from "@/components/recordings/recording-detail";

export const metadata: Metadata = { title: "Recording" };

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordingDetail id={id} />;
}
