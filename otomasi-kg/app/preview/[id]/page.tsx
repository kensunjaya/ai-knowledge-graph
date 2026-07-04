import Link from 'next/link';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  
  return (
    <div className="flex flex-col h-screen bg-zinc-100">
      {/* Header bar */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between shadow-sm z-10">
        <h1 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <span>Interactive Preview</span>
          <span className="hidden sm:inline text-xs font-mono font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded">
            {id}
          </span>
        </h1>
        
        <Link
          href="/"
          className="bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-xs px-4 py-2 rounded transition shadow-sm"
        >
          Close Preview
        </Link>
      </header>
      
      {/* Isolated iframe for PyVis HTML to execute scripts safely */}
      <main className="flex-1 relative bg-white">
        <iframe
          src={`/api/results/${id}/preview`}
          className="absolute inset-0 w-full h-full border-none"
          title="PyVis Knowledge Graph Visualization"
        />
      </main>
    </div>
  );
}
