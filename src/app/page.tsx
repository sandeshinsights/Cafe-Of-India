/**
 * Homepage
 * 
 * WHAT IT DOES:
 * - This is the main page at cafeindiamaynard.com
 * - It imports and renders all 9 sections in order
 * - Right now it shows a placeholder message
 * - In Step 4, we'll replace this with real section components
 * 
 * WHY it's a Server Component (no "use client"):
 * - Just renders sections — no interactivity needed
 * - Each section handles its own client logic if needed
 */

export default function HomePage() {
  return (
    <>
      {/* 
        Step 4 will add these sections:
        <Hero />
        <About />
        <Menu />
        <Specials />
        <Reviews />
        <Catering />
        <FAQ />
        <Gallery />
        <Contact />
      */}

      {/* TEMPORARY: Shows the site is working */}
      <section className="pt-32 pb-20 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary mb-6">
            Welcome to Cafe of India
          </h1>
          <p className="text-text-light text-lg md:text-xl max-w-2xl mx-auto">
            Our website is being built with love. Check back soon for the full experience!
          </p>
        </div>
      </section>
    </>
  );
}