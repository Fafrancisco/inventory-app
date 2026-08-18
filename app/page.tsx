import Link from "next/link";
import { ArrowRight, ChefHat, Package, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f4] text-[#12212b]">
      <section className="relative min-h-[min(760px,88vh)] overflow-hidden bg-[#12212b] text-white">
        <img
          src="/landing-kitchen.jpeg"
          alt="Bancada de cozinha organizada com ingredientes frescos"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(18_33_43/0.06)_0%,rgb(18_33_43/0.12)_36%,rgb(18_33_43/0.72)_72%,rgb(18_33_43/0.92)_100%)]" />
        <div className="relative mx-auto flex min-h-[min(760px,88vh)] max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" aria-label="Inventory App">
              <img src="/icon.png" alt="" className="h-10 w-10 rounded-xl" aria-hidden="true" />
              <span className="text-sm font-black tracking-[0.18em] text-white">INVENTORY</span>
            </Link>
            <Link
              href="/inventario"
              className="rounded-full border border-white/35 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#12212b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f36b]"
            >
              Abrir aplicação
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-end py-12 lg:py-16">
            <div className="max-w-xl lg:mr-[4%]">
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c7f36b]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Casa em ordem
              </p>
              <h1 className="max-w-lg text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-7xl">
                Sabe o que tens. Decide melhor.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-200 sm:text-lg">
                Um inventário simples para organizar a casa, evitar desperdício e transformar o que já tens em boas refeições.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/inventario"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#c7f36b] px-5 py-3 text-sm font-black text-[#12212b] shadow-[0_12px_30px_rgb(199_243_107/0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#d8f992] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f36b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12212b]"
                >
                  Ver inventário
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/receitas"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f36b]"
                >
                  <ChefHat className="h-4 w-4" aria-hidden="true" />
                  Experimentar Chef AI
                </Link>
              </div>
            </div>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-2 border-t border-white/20 pt-5 text-xs text-slate-200 sm:gap-6">
            <div className="flex items-center gap-2"><Package className="h-4 w-4 text-[#c7f36b]" aria-hidden="true" /><span>Stock visível</span></div>
            <div className="flex items-center gap-2"><ChefHat className="h-4 w-4 text-[#c7f36b]" aria-hidden="true" /><span>Receitas úteis</span></div>
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#c7f36b]" aria-hidden="true" /><span>Menos desperdício</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3 md:py-20 lg:px-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#789b35]">Um ponto de partida</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">A cozinha começa pelo que já existe.</h2>
        </div>
        <p className="text-sm leading-7 text-slate-600">Regista artigos, localizações e quantidades sem transformar a gestão da casa numa tarefa pesada.</p>
        <p className="text-sm leading-7 text-slate-600">Quando estiveres pronto, o Chef AI cruza o inventário com as tuas preferências e sugere o próximo prato.</p>
      </section>
    </main>
  );
}
