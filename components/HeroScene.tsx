import Image from "next/image";

/**
 * The painted hero image. The live 3D scene lives in components/home/Story.tsx (desktop only); this is what phones,
 * reduced-motion users, slow GPUs and no-JS visitors get. It deliberately never starts WebGL: the page decides
 * once, in Home, so two scenes can never load at the same time.
 */
export default function HeroScene() {
  return (
    <div aria-hidden className="absolute inset-0">
      <Image
        src="/hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_47%] sm:object-[62%_47%]"
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(245,245,242,.45), rgba(245,245,242,.1) 38%, transparent 58%)",
        }}
      />
    </div>
  );
}
