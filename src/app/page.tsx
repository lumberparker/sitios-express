import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 60% 10%, rgba(38,125,155,.35), transparent), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(251,180,118,.12), transparent), #101c33",
        }}
      />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold tracking-tight">
          Sitios Web <span className="text-brand-peach">Express</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
            Admin
          </Link>
          <Link href="/onboarding" className="rounded-lg bg-brand-navy px-4 py-2 font-medium hover:bg-brand-blue transition-colors">
            Crear mi sitio
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-32 text-center">
        <p className="mb-6 inline-block rounded-full border border-brand-teal/50 bg-brand-blue/10 px-4 py-1 text-sm text-brand-teal">
          Sin registro, sin contraseñas — tu sitio en minutos
        </p>
        <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Arma tu sitio web.
          <br />
          <span className="bg-gradient-to-r from-brand-peach via-brand-red to-brand-teal bg-clip-text text-transparent">
            Paga solo lo que agregas.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Llena un formulario (o chatea con nuestro bot de WhatsApp), elige un template con personalidad y personaliza
          todo. Tu sitio queda guardado en un enlace privado: vuelve cuando quieras a editarlo, y al pagar descargas tu
          código listo para publicar.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="rounded-xl bg-brand-navy px-8 py-4 text-lg font-semibold shadow-lg shadow-brand-navy/30 hover:bg-brand-blue hover:shadow-brand-blue/40 transition-all"
          >
            Crear mi sitio ahora
          </Link>
        </div>
        <div className="mt-24 grid gap-6 text-left md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "1. Cuéntanos de tu negocio", d: "Formulario paso a paso aquí, o conversando con nuestro bot de WhatsApp." },
            { t: "2. Personaliza todo", d: "Templates con carácter, secciones, colores, fondos y widgets con precio claro." },
            { t: "3. Paga y descarga", d: "Tu sitio vive en una URL privada. Edita cuando quieras y, al confirmar tu pago, descarga el .zip listo para publicar." },
            { t: "4. Ponlo en línea", d: "Te ayudamos a publicarlo — con tu propio dominio o con una dirección nuestra — o hazlo por tu cuenta: el código funciona en cualquier hosting." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="font-display font-semibold text-white">{f.t}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
