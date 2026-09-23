import Link from 'next/link';

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            News Pulse
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          </div>
        </div>
        <div>
          <Link 
            href="/timeline" 
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            Explore Timeline &rarr;
          </Link>
        </div>
      </div>
    </nav>
  );
}

function TimelinePreview() {
  return (
    <div className="bg-white rounded-xl shadow-2xl shadow-indigo-100/50 border border-slate-200 overflow-hidden relative w-full h-[280px] flex flex-col max-w-4xl mx-auto mt-12 transform perspective-1000 rotate-x-2 scale-95 origin-top transition-transform hover:scale-100 duration-500 cursor-default select-none">
      <div className="px-4 py-3 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
        <div className="flex gap-2 items-center">
           <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
        </div>
        <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Live Preview</div>
      </div>
      <div className="relative flex-1 flex flex-col bg-slate-50/50">
        {/* Time Axis */}
        <div className="h-8 border-b border-slate-200 bg-white/90 z-10 flex items-end px-4">
          {['09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
            <div key={i} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${15 + i * 20}%`}}>
              <span className="text-[9px] font-semibold text-slate-400 mb-1 tracking-wider">{time}</span>
              <div className="w-px h-1.5 bg-slate-300"></div>
            </div>
          ))}
        </div>
        
        {/* Vertical Grid */}
        <div className="absolute top-8 bottom-0 left-4 right-4 pointer-events-none">
          {[15, 35, 55, 75, 95].map((pos, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-200/50" style={{ left: `${pos}%` }}></div>
          ))}
        </div>

        {/* Lanes */}
        <div className="relative flex-1 p-4 overflow-hidden">
          {/* High Activity */}
          <div className="absolute top-4 h-10 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-md shadow-sm flex flex-col justify-center px-2.5 z-10" style={{ left: '10%', width: '35%' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
            <span className="text-[11px] font-bold leading-tight">Global Markets / Rate Cuts</span>
            <span className="text-[9px] font-medium opacity-80">12 articles</span>
          </div>

          {/* Medium Activity */}
          <div className="absolute top-16 h-8 bg-slate-50 border border-slate-200 text-slate-800 rounded-md flex flex-col justify-center px-2 z-10" style={{ left: '28%', width: '22%' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400"></div>
            <span className="text-[10px] font-bold leading-tight truncate">UN General Assembly</span>
            <span className="text-[8px] font-medium opacity-80">8 articles</span>
          </div>

          {/* Standard Activity */}
          <div className="absolute top-28 h-8 bg-white border border-slate-300 text-slate-700 shadow-sm rounded-md flex flex-col justify-center px-2 z-10" style={{ left: '55%', width: '30%' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
            <span className="text-[10px] font-bold leading-tight truncate">Tech Policy Regulations</span>
            <span className="text-[8px] font-medium opacity-80">5 articles</span>
          </div>
          
          {/* Small Activity */}
          <div className="absolute top-40 h-8 bg-white border border-slate-300 text-slate-700 shadow-sm rounded-md flex flex-col justify-center px-2 z-10" style={{ left: '70%', width: '15%' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
            <span className="text-[10px] font-bold leading-tight truncate">Space Exploration</span>
            <span className="text-[8px] font-medium opacity-80">2 articles</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-24 pb-16 px-4 text-center overflow-hidden">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <p className="text-[11px] font-bold tracking-widest text-indigo-600 uppercase mb-4 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          Live News Intelligence
        </p>
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
          See how the world&apos;s <br className="hidden md:block" />
          stories evolve over time.
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
          News Pulse brings together live articles from multiple news sources, groups related stories into topic clusters, and turns them into an interactive visual timeline.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            href="/timeline"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl text-center"
          >
            Explore Live Timeline
          </Link>
          <a 
            href="#how-it-works"
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors text-center"
          >
            See How It Works
          </a>
        </div>
      </div>
      <TimelinePreview />
    </section>
  );
}

function TrustStatement() {
  return (
    <section className="py-16 px-4 bg-slate-50 border-y border-slate-200">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
          News moves fast. <br className="md:hidden" />
          Understanding how stories connect is harder.
        </h2>
        <p className="text-slate-600 text-lg leading-relaxed">
          News Pulse turns scattered articles into a visual story of what is happening, when it started, and how long it remained active in the global news cycle.
        </p>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Live News Ingestion",
      desc: "Collect articles from multiple public RSS sources as they are published.",
      icon: "📡"
    },
    {
      title: "Topic Clustering",
      desc: "Related articles are grouped into meaningful topic clusters using TF-IDF similarity.",
      icon: "🔗"
    },
    {
      title: "Timeline Intelligence",
      desc: "See when a topic started, how long it remained active, and how many articles covered it.",
      icon: "📊"
    },
    {
      title: "Source Exploration",
      desc: "Filter stories by source and inspect the individual articles behind each cluster.",
      icon: "🔍"
    }
  ];

  return (
    <section id="features" className="py-24 px-4 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((f, i) => (
          <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-xl mb-4">
              {f.icon}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Collect", desc: "News Pulse fetches articles from multiple RSS feeds." },
    { step: "02", title: "Understand", desc: "Articles are normalized and related stories are grouped using TF-IDF similarity." },
    { step: "03", title: "Organize", desc: "Clusters are stored and structured for timeline visualization." },
    { step: "04", title: "Explore", desc: "Users interact with the timeline and inspect the stories behind each topic." }
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-16 text-center tracking-tight">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-6 left-[10%] right-[10%] h-px bg-slate-700"></div>
          
          {steps.map((s, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center font-bold mb-6 text-indigo-50 border-4 border-slate-900">
                {s.step}
              </div>
              <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineExplanation() {
  return (
    <section className="py-24 px-4 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
      <div className="flex-1 space-y-6">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Not just what happened. <br className="hidden sm:block" />
          When it happened.
        </h2>
        <p className="text-slate-600 text-lg leading-relaxed">
          The timeline is designed for rapid news comprehension. Each block represents a distinct topic cluster.
        </p>
        <ul className="space-y-4 text-sm text-slate-700">
          <li className="flex items-start gap-3">
            <span className="text-indigo-600 font-bold mt-0.5">&rarr;</span>
            <span><strong>Position</strong> represents when the topic first appeared in the cycle.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-indigo-600 font-bold mt-0.5">&rarr;</span>
            <span><strong>Width</strong> represents how long the topic remained actively covered.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-indigo-600 font-bold mt-0.5">&rarr;</span>
            <span><strong>Article count</strong> and visual intensity reflect the total volume of coverage.</span>
          </li>
        </ul>
      </div>
      <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-inner relative flex justify-center">
         <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="h-12 w-full bg-white border border-slate-300 rounded-lg shadow-sm flex flex-col justify-center px-4 relative">
               <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-400 rounded-l-lg"></div>
               <span className="text-xs font-bold text-slate-800">Standard Coverage</span>
               <span className="text-[10px] text-slate-500">Short duration, normal volume</span>
            </div>
            <div className="h-16 w-3/4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm flex flex-col justify-center px-4 relative ml-auto">
               <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-400 rounded-l-lg"></div>
               <span className="text-xs font-bold text-indigo-900">High Intensity</span>
               <span className="text-[10px] text-indigo-600/80">Extended duration, high volume</span>
            </div>
         </div>
      </div>
    </section>
  );
}

function SourcesSection() {
  return (
    <section className="py-16 px-4 bg-slate-50 border-t border-slate-200 text-center">
      <div className="max-w-3xl mx-auto">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Aggregating Global Perspectives</h3>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-8 opacity-70 grayscale">
          <span className="text-xl font-bold font-serif">BBC News</span>
          <span className="text-xl font-bold font-sans">NPR</span>
          <span className="text-xl font-bold font-serif italic">New York Times</span>
        </div>
      </div>
    </section>
  );
}

function ProductPreviewSection() {
  return (
    <section className="py-24 px-4 bg-slate-100 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center mb-16">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">A clearer way to read the news</h2>
        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
          Dive into the complete dashboard to filter sources, explore raw timelines, and inspect individual articles behind every topic.
        </p>
      </div>
      
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative">
        {/* Mock App Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="font-bold text-slate-800">News Pulse</div>
          <div className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded flex items-center gap-2">
            ↻ Refresh Data
          </div>
        </div>
        
        {/* Mock App Body */}
        <div className="flex-1 p-6 flex flex-col gap-6">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-slate-800 text-white text-xs rounded-full">BBC News · 32</span>
            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded-full">NPR · 14</span>
            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded-full">New York Times · 41</span>
          </div>
          
          <div className="h-64 border border-slate-200 rounded-xl bg-slate-50/50 relative overflow-hidden flex">
            {/* Timeline Area */}
            <div className="flex-1 p-4 relative">
               <div className="absolute top-4 left-4 h-8 bg-indigo-50 border border-indigo-200 rounded text-xs flex items-center px-2 text-indigo-900 font-bold" style={{ width: '60%'}}>Global Markets</div>
               <div className="absolute top-16 left-24 h-8 bg-white border border-slate-200 rounded text-xs flex items-center px-2 shadow-sm text-slate-800 font-bold" style={{ width: '40%'}}>Election Updates</div>
            </div>
            
            {/* Drawer Area */}
            <div className="w-64 bg-white border-l border-slate-200 shadow-xl flex flex-col">
              <div className="p-4 border-b border-slate-100">
                <div className="font-bold text-sm text-slate-800 mb-1">Global Markets</div>
                <div className="text-[10px] text-slate-500 uppercase">12 Articles</div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="p-3 border border-slate-100 rounded-lg bg-slate-50">
                  <div className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded inline-block mb-1 font-bold">BBC NEWS</div>
                  <div className="text-xs font-semibold">Markets rally after rate cut...</div>
                </div>
                <div className="p-3 border border-slate-100 rounded-lg bg-slate-50">
                  <div className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded inline-block mb-1 font-bold">NPR</div>
                  <div className="text-xs font-semibold">Federal reserve shifts tone...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center mt-12">
        <Link 
          href="/timeline"
          className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
        >
          Open Live Timeline &rarr;
        </Link>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 px-4 bg-white text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">See the news differently.</h2>
        <p className="text-lg text-slate-600 mb-10">
          Explore the live News Pulse timeline and follow stories as they develop across major publishers.
        </p>
        <Link 
          href="/timeline"
          className="inline-flex items-center justify-center px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-all shadow-xl hover:shadow-2xl"
        >
          Explore Live Timeline &rarr;
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-12 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h4 className="font-bold text-slate-900 text-lg">News Pulse</h4>
          <p className="text-sm text-slate-500">Topic-clustered news timeline</p>
        </div>
        <div className="flex gap-6 text-sm font-medium text-slate-600">
          <Link href="/timeline" className="hover:text-slate-900">Timeline</Link>
          <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 scroll-smooth">
      <Navbar />
      <main>
        <Hero />
        <TrustStatement />
        <Features />
        <HowItWorks />
        <ProductPreviewSection />
        <TimelineExplanation />
        <SourcesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
