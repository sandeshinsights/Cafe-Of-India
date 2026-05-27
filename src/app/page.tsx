import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Menu from "@/components/sections/Menu";
import Specials from "@/components/sections/Specials";
import Reviews from "@/components/sections/Reviews";
import Catering from "@/components/sections/Catering";
import FAQ from "@/components/sections/FAQ";
import Gallery from "@/components/sections/Gallery";
import Contact from "@/components/sections/Contact";

/**
 * Homepage
 * 
 * Renders all 9 sections in order from site-config.json.
 * Each section handles its own data loading and rendering.
 */

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Menu />
      <Specials />
      <Reviews />
      <Catering />
      <FAQ />
      <Gallery />
      <Contact />
    </>
  );
}