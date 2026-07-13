export function SphynxBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-6 flex items-center justify-end overflow-hidden sm:inset-9 md:inset-12"
    >
      <img
        alt=""
        className="h-[120%] max-w-none translate-x-[18%] select-none object-contain opacity-30 sm:translate-x-[8%] sm:opacity-35 dark:opacity-[0.16] dark:sm:opacity-20"
        draggable={false}
        height={1316}
        src="/sphynx-hero.png"
        width={1000}
      />
    </div>
  );
}
