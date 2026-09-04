import Link from "next/link";

export function GradientCta() {
  return (
    <section className="bg-[#F3F2EC] pb-24 px-6 font-sans">
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-gradient-to-r from-[#D9FC50] to-[#3395FF] rounded-2xl p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-10 shadow-lg">

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight text-[#08090B] max-w-lg leading-[1.1] font-sans">
            Get Started<br />
            with Agentic Commerce
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <Link href="/login" className="h-12 px-8 rounded-full bg-[#08090B] text-white flex items-center justify-center text-[13px] font-medium tracking-wide hover:bg-black/80 transition-colors shadow-sm hover:shadow">
              Start Building
            </Link>
            <Link href="#sales" className="h-12 px-8 rounded-full bg-white text-[#08090B] flex items-center justify-center text-[13px] font-medium tracking-wide hover:bg-slate-50 transition-colors shadow-sm hover:shadow">
              Contact Sales
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
